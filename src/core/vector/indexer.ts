/**
 * @fileoverview Background indexer daemon for continuous vector indexing.
 * Watches for file changes and maintains up-to-date indexes.
 */

import * as path from 'path';
import type { Chunk, IndexerStatus, IndexerConfig, VectorFS, VectorGit } from './types.js';
import { VectorDatabase } from './db.js';
import { Embedder } from './embedder.js';
import { Chunker } from './chunker.js';

// =============================================================================
// Config
// =============================================================================

export const DEFAULT_INDEXER: IndexerConfig = {
  types: ['code', 'docs', 'comments'],
  include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.md'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
  batch: 50,
  workers: 2,
  watch: true,
  debounce: 1000,
  git: false,
  maxCommits: 100,
};

// =============================================================================
// Types
// =============================================================================

export type ProgressFn = (p: { type: 'file' | 'progress' | 'complete' | 'error'; status: IndexerStatus; file?: string | undefined; msg?: string | undefined }) => void;

// =============================================================================
// Indexer
// =============================================================================

export class Indexer {
  private db: VectorDatabase;
  private embedder: Embedder;
  private chunker: Chunker;
  private fs: VectorFS;
  private git?: VectorGit | undefined;
  private cfg: IndexerConfig;
  private status: IndexerStatus = { state: 'idle', done: 0, total: 0, chunks: 0, errors: 0 };
  private abort: AbortController | null = null;
  private indexed = new Map<string, number>(); // path -> mtime
  private progress?: ProgressFn | undefined;

  constructor(db: VectorDatabase, embedder: Embedder, fs: VectorFS, cfg: Partial<IndexerConfig> = {}, git?: VectorGit) {
    this.db = db;
    this.embedder = embedder;
    this.chunker = new Chunker();
    this.fs = fs;
    this.git = git;
    this.cfg = { ...DEFAULT_INDEXER, ...cfg };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async indexAll(onProgress?: ProgressFn): Promise<IndexerStatus> {
    if (this.status.state === 'running') throw new Error('Already indexing');

    this.progress = onProgress;
    this.abort = new AbortController();
    this.update({ state: 'running', done: 0, total: 0, chunks: 0, errors: 0, started: Date.now() });

    try {
      await this.db.connect();
      await this.embedder.load(p => this.emit({ type: 'progress', status: this.status, msg: p.msg }));

      const files = await this.fs.glob(this.cfg.include, { ignore: this.cfg.exclude });
      this.update({ total: files.length });

      await this.indexFiles(files);
      if (this.cfg.git && this.git) await this.indexGitHistory();

      this.update({ state: 'idle' });
      this.emit({ type: 'complete', status: this.status });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') this.update({ state: 'paused' });
      else this.update({ state: 'error', error: e instanceof Error ? e.message : String(e), errors: this.status.errors + 1 });
      this.emit({ type: 'error', status: this.status, msg: this.status.error });
    }

    return this.status;
  }

  async indexFile(filePath: string): Promise<void> {
    const content = await this.fs.read(filePath);
    const langId = this.fs.lang(filePath);
    const mtime = await this.fs.mtime(filePath);

    await this.db.deleteByPath(filePath);
    const chunks = await this.chunkFile(filePath, content, langId);
    const embedded = await this.embedder.embed(chunks);
    await this.db.insert(embedded);
    this.indexed.set(filePath, mtime);
  }

  async removeFile(filePath: string): Promise<void> {
    await this.db.deleteByPath(filePath);
    this.indexed.delete(filePath);
  }

  async needsReindex(filePath: string): Promise<boolean> {
    const last = this.indexed.get(filePath);
    if (!last) return true;
    return await this.fs.mtime(filePath) > last;
  }

  pause(): void { this.abort?.abort(); this.update({ state: 'paused' }); }
  async resume(): Promise<void> { if (this.status.state === 'paused') await this.indexAll(this.progress); }
  getStatus(): IndexerStatus { return { ...this.status }; }
  getIndexedFiles(): string[] { return [...this.indexed.keys()]; }

  async clearIndex(): Promise<void> {
    const cols = await this.db.listCollections();
    for (const c of cols) await this.db.dropCollection(c.type, c.level);
    this.indexed.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async indexFiles(files: readonly string[]): Promise<void> {
    for (let i = 0; i < files.length; i += this.cfg.batch) {
      if (this.abort?.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const batch = files.slice(i, i + this.cfg.batch);
      const allChunks: Chunk[] = [];

      for (const f of batch) {
        try {
          this.update({ file: f });
          this.emit({ type: 'file', status: this.status, file: f });

          if (!(await this.needsReindex(f))) { this.update({ done: this.status.done + 1 }); continue; }

          const content = await this.fs.read(f);
          const chunks = await this.chunkFile(f, content, this.fs.lang(f));
          allChunks.push(...chunks);

          await this.db.deleteByPath(f);
          this.indexed.set(f, await this.fs.mtime(f));
          this.update({ done: this.status.done + 1 });
        } catch (e) {
          this.update({ errors: this.status.errors + 1, error: `Error indexing ${f}: ${e instanceof Error ? e.message : e}` });
        }
      }

      if (allChunks.length) {
        try {
          const embedded = await this.embedder.embed(allChunks, p => this.emit({ type: 'progress', status: this.status, msg: p.msg }));
          await this.db.insert(embedded);
          this.update({ chunks: this.status.chunks + embedded.length });
        } catch (e) {
          this.update({ errors: this.status.errors + 1, error: `Embedding batch failed: ${e instanceof Error ? e.message : e}` });
        }
      }

      const elapsed = Date.now() - (this.status.started ?? Date.now());
      const rate = this.status.done / Math.max(elapsed, 1);
      this.update({ eta: (this.status.total - this.status.done) / Math.max(rate, 0.001) });
    }
  }

  private async chunkFile(filePath: string, content: string, langId: string): Promise<Chunk[]> {
    const ext = path.extname(filePath).toLowerCase();
    if (['.md', '.mdx', '.rst', '.txt'].includes(ext) && this.cfg.types.includes('docs')) {
      return this.chunker.docs(content, filePath);
    }
    if (this.cfg.types.includes('code')) {
      const mod = this.modulePath(filePath);
      return this.chunker.code(content, filePath, langId, mod);
    }
    return [];
  }

  private modulePath(filePath: string): string {
    return filePath.replace(/^src\//, '').replace(/\.[^.]+$/, '').replace(/\//g, '/');
  }

  private async indexGitHistory(): Promise<void> {
    if (!this.git || !(await this.git.isRepo())) return;

    const commits = await this.git.commits(this.cfg.maxCommits);
    for (const c of commits) {
      if (this.abort?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const chunks = this.chunker.commit(c);
      const embedded = await this.embedder.embed(chunks);
      await this.db.insert(embedded);
      this.update({ chunks: this.status.chunks + embedded.length });
    }
  }

  private update(u: Partial<IndexerStatus>): void { this.status = { ...this.status, ...u }; }
  private emit(p: { type: 'file' | 'progress' | 'complete' | 'error'; status: IndexerStatus; file?: string | undefined; msg?: string | undefined }): void { this.progress?.(p); }
}

// =============================================================================
// Watch Mode
// =============================================================================

export class IndexerWatcher {
  private indexer: Indexer;
  private debounce: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Set<string>();
  private running = false;

  constructor(indexer: Indexer, debounce = 1000) { this.indexer = indexer; this.debounce = debounce; }

  onFileChange(path: string): void { this.pending.add(path); this.schedule(); }
  onFileDelete(path: string): void { void this.indexer.removeFile(path); }
  stop(): void { if (this.timer) clearTimeout(this.timer); this.timer = null; this.running = false; }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.process(), this.debounce);
  }

  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const files = [...this.pending];
    this.pending.clear();
    for (const f of files) {
      try { await this.indexer.indexFile(f); } catch (e) { console.error(`Index failed for ${f}:`, e); }
    }
    this.running = false;
    if (this.pending.size) this.schedule();
  }
}
