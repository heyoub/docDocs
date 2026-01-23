/**
 * @fileoverview Incoherence detection between code and documentation.
 * Uses vector similarity to find mismatches and semantic drift.
 */

import type { Chunk, Incoherence, IncoherenceType, SearchHit } from './types.js';
import { INCOHERENCE_TYPES } from './types.js';
import type { VectorDatabase } from './db.js';
import type { Embedder } from './embedder.js';
import { cosine, filterCodeSymbols, filterDocs } from './utils.js';

// =============================================================================
// Config
// =============================================================================

export interface IncoherenceOpts {
  coherence: number;   // threshold for code-doc coherence (0-1)
  freshness: number;   // threshold for freshness detection (0-1)
  drift: number;       // threshold for semantic drift (0-1)
  match: number;       // minimum similarity for matching (0-1)
}

export const DEFAULT_INCOHERENCE: IncoherenceOpts = {
  coherence: 0.6,
  freshness: 0.4,
  drift: 0.3,
  match: 0.5,
};

// =============================================================================
// Types
// =============================================================================

export interface FileSummary {
  path: string;
  issues: readonly Incoherence[];
  score: number;
  at: number;
}

export interface ProjectSummary {
  files: number;
  withIssues: number;
  total: number;
  byType: Record<IncoherenceType, number>;
  bySeverity: { high: number; medium: number; low: number };
  avgScore: number;
  worst: readonly { path: string; score: number }[];
}

// =============================================================================
// Detector
// =============================================================================

export class IncoherenceDetector {
  private db: VectorDatabase;
  private embedder: Embedder;
  private opts: IncoherenceOpts;
  private embedCache = new Map<string, Float32Array>();

  constructor(db: VectorDatabase, embedder: Embedder, opts: Partial<IncoherenceOpts> = {}) {
    this.db = db;
    this.embedder = embedder;
    this.opts = { ...DEFAULT_INCOHERENCE, ...opts };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async analyzeFile(path: string): Promise<FileSummary> {
    // Clear cache for fresh analysis
    this.embedCache.clear();

    const chunks = await this.db.getByPath(path);
    const code = filterCodeSymbols(chunks);
    const docs = filterDocs(chunks);

    // Pre-compute embeddings for all chunks
    await this.cacheEmbeddings([...code, ...docs]);

    const issues: Incoherence[] = [
      ...await this.findMissing(code, docs),
      ...await this.findOrphaned(code, docs),
      ...await this.findMismatch(code, docs),
      ...this.findIncomplete(code, docs),
    ];

    return { path, issues, score: this.calcScore(code, docs, issues), at: Date.now() };
  }

  async analyzeProject(): Promise<ProjectSummary> {
    const byType = Object.fromEntries(INCOHERENCE_TYPES.map(t => [t, 0])) as Record<IncoherenceType, number>;
    const bySeverity = { high: 0, medium: 0, low: 0 };
    const reports: FileSummary[] = [];

    // In production, would iterate over all indexed files
    let total = 0;
    for (const r of reports) {
      for (const i of r.issues) {
        total++;
        byType[i.type]++;
        if (i.severity > 0.7) bySeverity.high++;
        else if (i.severity > 0.4) bySeverity.medium++;
        else bySeverity.low++;
      }
    }

    const avg = reports.length ? reports.reduce((s, r) => s + r.score, 0) / reports.length : 1;
    const worst = reports.sort((a, b) => a.score - b.score).slice(0, 10).map(r => ({ path: r.path, score: r.score }));

    return { files: reports.length, withIssues: reports.filter(r => r.issues.length > 0).length, total, byType, bySeverity, avgScore: avg, worst };
  }

  async detectDrift(code: Chunk, historicalDocs: readonly Chunk[]): Promise<Incoherence | null> {
    if (historicalDocs.length < 2) return null;

    const codeVec = await this.embedder.embedQuery(code.content);
    const sims: number[] = [];
    for (const d of historicalDocs) {
      const docVec = await this.embedder.embedQuery(d.content);
      sims.push(cosine(codeVec, docVec));
    }

    let drift = 0;
    for (let i = 1; i < sims.length; i++) {
      const d = (sims[i - 1] ?? 0) - (sims[i] ?? 0);
      if (d > this.opts.drift) drift += d;
    }

    if (drift === 0) return null;
    const lastDoc = historicalDocs[historicalDocs.length - 1];
    if (!lastDoc) return null;

    return {
      id: `drift-${code.id}`,
      code,
      doc: lastDoc,
      type: 'drift',
      severity: Math.min(1, drift / sims.length),
      msg: `Doc drifted ${(drift * 100).toFixed(1)}% over ${historicalDocs.length} versions`,
      confidence: 0.7,
    };
  }

  async findBestMatch(code: Chunk): Promise<SearchHit | null> {
    const vec = await this.getEmbedding(code);
    const hits = await this.db.search(vec, { q: code.content, k: 1, types: ['docs', 'comments'], min: this.opts.match });
    return hits[0] ?? null;
  }

  suggestFix(i: Incoherence): string {
    switch (i.type) {
      case 'missing': return `Add documentation for ${i.code.symbol ?? 'this symbol'}:\n\n/** TODO: Document this ${i.code.kind ?? 'symbol'} */`;
      case 'outdated': return `Update documentation to match:\n${i.code.content.slice(0, 200)}...`;
      case 'mismatch': return `Rewrite documentation to describe:\n${i.code.meta.signature ?? i.code.content.slice(0, 100)}`;
      case 'incomplete': return `Add missing elements (params, return, throws).`;
      case 'orphaned': return `Remove or relocate:\n${i.doc.content.slice(0, 100)}...`;
      case 'drift': return `Review and update documentation for evolved implementation.`;
      default: return 'Review and fix documentation.';
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async findMissing(code: readonly Chunk[], docs: readonly Chunk[]): Promise<Incoherence[]> {
    const issues: Incoherence[] = [];
    for (const c of code) {
      if (c.meta.visibility === 'private' || !c.meta.isExported) continue;
      const hasDoc = docs.some(d => d.symbol === c.symbol || d.content.toLowerCase().includes((c.symbol ?? '').toLowerCase()));
      if (hasDoc) continue;

      const match = await this.findBestMatch(c);
      if (!match || match.score < this.opts.match) {
        issues.push({
          id: `missing-${c.id}`,
          code: c,
          doc: c,
          type: 'missing',
          severity: this.missingSeverity(c),
          msg: `No documentation for ${c.kind ?? 'symbol'} "${c.symbol}"`,
          confidence: 0.9,
        });
      }
    }
    return issues;
  }

  private async findOrphaned(code: readonly Chunk[], docs: readonly Chunk[]): Promise<Incoherence[]> {
    const issues: Incoherence[] = [];
    for (const d of docs) {
      if (!d.symbol) continue;
      if (code.some(c => c.symbol === d.symbol)) continue;

      const vec = await this.getEmbedding(d);
      const hits = await this.db.search(vec, { q: d.content, k: 1, types: ['code'] });
      if (!hits[0] || hits[0].score < this.opts.match) {
        issues.push({
          id: `orphaned-${d.id}`,
          code: d,
          doc: d,
          type: 'orphaned',
          severity: 0.5,
          msg: `Doc for "${d.symbol}" has no code`,
          fix: 'Remove orphaned documentation or add the documented functionality',
          confidence: 0.8,
        });
      }
    }
    return issues;
  }

  private async findMismatch(code: readonly Chunk[], docs: readonly Chunk[]): Promise<Incoherence[]> {
    const issues: Incoherence[] = [];
    for (const c of code) {
      const d = docs.find(doc => doc.symbol === c.symbol);
      if (!d) continue;

      const cVec = await this.getEmbedding(c);
      const dVec = await this.getEmbedding(d);
      const sim = cosine(cVec, dVec);

      if (sim < this.opts.coherence) {
        issues.push({
          id: `mismatch-${c.id}`,
          code: c,
          doc: d,
          type: 'mismatch',
          severity: 1 - sim,
          msg: `Doc doesn't match code (${(sim * 100).toFixed(1)}% similarity)`,
          confidence: 0.85,
        });
      }
    }
    return issues;
  }

  private findIncomplete(code: readonly Chunk[], docs: readonly Chunk[]): Incoherence[] {
    const issues: Incoherence[] = [];
    for (const c of code) {
      if (c.kind !== 'function' && c.kind !== 'method') continue;
      const d = docs.find(doc => doc.symbol === c.symbol);
      if (!d) continue;

      const sig = c.meta.signature ?? '';
      const dc = d.content.toLowerCase();
      const missing: string[] = [];

      if (sig.includes('(') && !sig.includes('()') && !dc.includes('@param') && !dc.includes('parameter')) missing.push('parameters');
      if (sig.includes(': ') && !sig.includes(': void') && !dc.includes('@return') && !dc.includes('returns')) missing.push('return');
      if ((sig.toLowerCase().includes('throw') || c.content.includes('throw ')) && !dc.includes('@throws') && !dc.includes('throws')) missing.push('exceptions');

      if (missing.length) {
        issues.push({
          id: `incomplete-${c.id}`,
          code: c,
          doc: d,
          type: 'incomplete',
          severity: missing.length * 0.25,
          msg: `Missing: ${missing.join(', ')}`,
          fix: `Add documentation for ${missing.join(', ')}`,
          confidence: 0.9,
        });
      }
    }
    return issues;
  }

  private missingSeverity(c: Chunk): number {
    let s = 0.5;
    if (c.meta.isExported) s += 0.2;
    if (c.meta.visibility === 'public') s += 0.1;
    if ((c.meta.complexity ?? 0) > 5) s += 0.1;
    if (c.kind === 'class' || c.kind === 'interface') s += 0.1;
    return Math.min(1, s);
  }

  private calcScore(code: readonly Chunk[], docs: readonly Chunk[], issues: readonly Incoherence[]): number {
    if (!code.length) return 1;
    let s = 1;
    for (const i of issues) s -= i.severity * 0.1;
    s += (docs.length / code.length) * 0.1;
    return Math.max(0, Math.min(1, s));
  }

  private async cacheEmbeddings(chunks: readonly Chunk[]): Promise<void> {
    for (const c of chunks) {
      if (!this.embedCache.has(c.id)) {
        this.embedCache.set(c.id, await this.embedder.embedQuery(c.content));
      }
    }
  }

  private async getEmbedding(chunk: Chunk): Promise<Float32Array> {
    const cached = this.embedCache.get(chunk.id);
    if (cached) return cached;
    const vec = await this.embedder.embedQuery(chunk.content);
    this.embedCache.set(chunk.id, vec);
    return vec;
  }
}
