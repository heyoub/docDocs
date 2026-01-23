/**
 * @fileoverview Embedding generation using transformers.js.
 * Supports code-aware models like Qwen3-Embedding, Nomic, Jina.
 */

import type { Chunk, EmbeddedChunk } from './types.js';

// =============================================================================
// Config
// =============================================================================

export interface EmbedderOpts {
  model: string;
  batch: number;
  device: 'cpu' | 'webgpu' | 'auto';
  norm: boolean;
  pooling: 'mean' | 'cls' | 'last';
}

export const DEFAULT_EMBEDDER: EmbedderOpts = {
  model: 'Qwen/Qwen3-Embedding-0.6B',
  batch: 32,
  device: 'auto',
  norm: true,
  pooling: 'mean',
};

const DIMS: Record<string, number> = {
  'Qwen/Qwen3-Embedding-0.6B': 1024,
  'nomic-ai/nomic-embed-code-v1': 768,
  'jinaai/jina-embeddings-v2-base-code': 768,
};

// =============================================================================
// Module State
// =============================================================================

type Pipeline = (t: string[], o?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array }[]>;
let pipeline: Pipeline | null = null;
let loadedModel: string | null = null;

// =============================================================================
// Embedder
// =============================================================================

export type ProgressFn = (p: { stage: 'loading' | 'embedding'; current: number; total: number; msg: string }) => void;

export class Embedder {
  private opts: EmbedderOpts;
  readonly dim: number;

  constructor(opts: Partial<EmbedderOpts> = {}) {
    this.opts = { ...DEFAULT_EMBEDDER, ...opts };
    this.dim = DIMS[this.opts.model] ?? 384;
  }

  async load(onProgress?: ProgressFn): Promise<void> {
    if (pipeline && loadedModel === this.opts.model) return;

    onProgress?.({ stage: 'loading', current: 0, total: 1, msg: `Loading ${this.opts.model}...` });

    const tf = await import('@huggingface/transformers');
    const device = await this.pickDevice();
    const opts: Record<string, unknown> = {
      progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
        if (p.status === 'downloading' || p.status === 'progress') {
          onProgress?.({ stage: 'loading', current: p.progress ?? 0, total: 1, msg: p.file ? `Downloading ${p.file}...` : 'Downloading...' });
        }
      },
    };
    if (device === 'webgpu') opts['device'] = 'webgpu';

    pipeline = await tf.pipeline('feature-extraction', this.opts.model, opts) as unknown as Pipeline;
    loadedModel = this.opts.model;
    onProgress?.({ stage: 'loading', current: 1, total: 1, msg: 'Model loaded' });
  }

  async embed(chunks: readonly Chunk[], onProgress?: ProgressFn): Promise<EmbeddedChunk[]> {
    if (!pipeline) await this.load(onProgress);

    const out: EmbeddedChunk[] = [];
    const batches = Math.ceil(chunks.length / this.opts.batch);

    for (let i = 0; i < chunks.length; i += this.opts.batch) {
      const batch = chunks.slice(i, i + this.opts.batch);
      const batchNum = Math.floor(i / this.opts.batch) + 1;
      onProgress?.({ stage: 'embedding', current: batchNum, total: batches, msg: `Batch ${batchNum}/${batches}` });

      const texts = batch.map(c => this.prepare(c));
      const vecs = await this.run(texts);

      for (let j = 0; j < batch.length; j++) {
        const c = batch[j], v = vecs[j];
        if (c && v) out.push({ ...c, vec: v, model: this.opts.model, dim: this.dim });
      }
    }
    return out;
  }

  async embedQuery(q: string): Promise<Float32Array> {
    if (!pipeline) await this.load();
    const vecs = await this.run([q]);
    const v = vecs[0];
    if (!v) throw new Error('Embedding failed');
    return v;
  }

  async dispose(): Promise<void> { pipeline = null; loadedModel = null; }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async pickDevice(): Promise<'cpu' | 'webgpu'> {
    if (this.opts.device === 'cpu') return 'cpu';
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown | null> } }).gpu;
        if (await gpu?.requestAdapter()) return 'webgpu';
      } catch { /* fall through */ }
    }
    return 'cpu';
  }

  private prepare(c: Chunk): string {
    const parts: string[] = [];
    if (c.type === 'code' && c.symbol && c.kind) parts.push(`[${c.kind}] ${c.symbol}`);
    if (c.type === 'code' && c.lang) parts.push(`Language: ${c.lang}`);
    if (c.type === 'docs') parts.push('[documentation]');
    if (c.type === 'comments') parts.push('[code comment]');
    if (c.type === 'commits') parts.push('[git commit]');
    if (c.type === 'prs') parts.push('[pull request]');
    parts.push(c.content);
    const text = parts.join('\n');
    return text.length > 2000 ? text.slice(0, 2000) : text;
  }

  private async run(texts: string[]): Promise<Float32Array[]> {
    if (!pipeline) throw new Error('Model not loaded');
    const results = await pipeline(texts, { pooling: this.opts.pooling, normalize: this.opts.norm });
    return results.map(r => r.data instanceof Float32Array ? r.data : new Float32Array(r.data));
  }
}

