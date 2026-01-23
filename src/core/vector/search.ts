/**
 * @fileoverview Hybrid search with vector similarity, BM25, and re-ranking.
 * Implements graph-aware boosting for related symbols.
 */

import type { Chunk, SearchQuery, SearchHit, SearchResult } from './types.js';
import type { VectorDatabase } from './db.js';
import type { Embedder } from './embedder.js';
import { cosine, highlight, bm25Score, buildBM25, type BM25Index } from './utils.js';

// =============================================================================
// Config
// =============================================================================

export interface SearchOpts {
  defaultK: number;
  defaultRerank: boolean;
  defaultHybrid: boolean;
  defaultAlpha: number;
  rerankMult: number;
}

export const DEFAULT_SEARCH: SearchOpts = {
  defaultK: 10,
  defaultRerank: true,
  defaultHybrid: true,
  defaultAlpha: 0.7,
  rerankMult: 3,
};

export interface GraphContext {
  dependents: readonly string[];
  dependencies: readonly string[];
  siblings: readonly string[];
}

// =============================================================================
// Search Engine
// =============================================================================

export class SearchEngine {
  private db: VectorDatabase;
  private embedder: Embedder;
  private opts: SearchOpts;
  private bm25Idx: BM25Index | null = null;

  constructor(db: VectorDatabase, embedder: Embedder, opts: Partial<SearchOpts> = {}) {
    this.db = db;
    this.embedder = embedder;
    this.opts = { ...DEFAULT_SEARCH, ...opts };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async search(q: SearchQuery): Promise<SearchResult> {
    const start = Date.now();
    const {
      k = this.opts.defaultK,
      hybrid = this.opts.defaultHybrid,
      alpha = this.opts.defaultAlpha,
      rerank = this.opts.defaultRerank,
    } = q;

    const vec = await this.embedder.embedQuery(q.q);
    const candidates = rerank ? k * this.opts.rerankMult : k;

    let hits = await this.db.search(vec, { ...q, k: candidates, hybrid: false });

    if (hybrid && hits.length) hits = this.hybridScore(q.q, hits, alpha);
    if (rerank && hits.length > k) hits = await this.rerank(q.q, hits, k);

    hits = hits.filter(h => h.score >= (q.min ?? 0)).slice(0, k);
    hits = this.addHighlights(q.q, hits);

    return { hits, q: q.q, total: hits.length, ms: Date.now() - start };
  }

  async searchWithContext(q: SearchQuery, ctx: GraphContext): Promise<SearchResult> {
    const result = await this.search(q);
    return { ...result, hits: this.graphBoost(result.hits, ctx) };
  }

  async findSimilar(chunk: Chunk, k = 5): Promise<SearchHit[]> {
    const vec = await this.embedder.embedQuery(chunk.content);
    const hits = await this.db.search(vec, { q: chunk.content, k: k + 1, types: [chunk.type] });
    return hits.filter(h => h.chunk.id !== chunk.id).slice(0, k);
  }

  async globalSearch(q: string, k = 20): Promise<SearchResult> {
    return this.search({ q, k, hybrid: true, rerank: true });
  }

  async searchCode(q: string, opts: Partial<SearchQuery> = {}): Promise<SearchResult> {
    return this.search({ q, types: ['code'], ...opts });
  }

  async searchDocs(q: string, opts: Partial<SearchQuery> = {}): Promise<SearchResult> {
    return this.search({ q, types: ['docs', 'comments'], ...opts });
  }

  async semanticCode(q: string, k = 10): Promise<SearchResult> {
    return this.search({ q: `Find code that: ${q}`, k, types: ['code'], levels: ['symbol'], hybrid: true, rerank: true });
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private hybridScore(q: string, hits: SearchHit[], alpha: number): SearchHit[] {
    const docs = hits.map(h => h.chunk.content);
    this.bm25Idx = buildBM25(docs);
    const maxBM25 = Math.max(...hits.map(h => bm25Score(q, h.chunk.content, this.bm25Idx!)), 1);

    return hits.map(h => {
      const bm = bm25Score(q, h.chunk.content, this.bm25Idx!) / maxBM25;
      return { ...h, bm25: bm, score: alpha * (h.vec ?? h.score) + (1 - alpha) * bm };
    }).sort((a, b) => b.score - a.score);
  }

  private async rerank(q: string, hits: SearchHit[], k: number): Promise<SearchHit[]> {
    const qVec = await this.embedder.embedQuery(q);
    const reranked: SearchHit[] = [];

    for (const h of hits) {
      const pairText = `Query: ${q}\nDocument: ${h.chunk.content.slice(0, 500)}`;
      const pairVec = await this.embedder.embedQuery(pairText);
      const rerankScore = cosine(qVec, pairVec);
      reranked.push({ ...h, rerank: rerankScore, score: rerankScore });
    }

    return reranked.sort((a, b) => b.score - a.score).slice(0, k);
  }

  private graphBoost(hits: SearchHit[], ctx: GraphContext): SearchHit[] {
    return hits.map(h => {
      let boost = 0;
      if (ctx.dependents.includes(h.chunk.path)) boost += 0.1;
      if (ctx.dependencies.includes(h.chunk.path)) boost += 0.15;
      if (h.chunk.symbol && ctx.siblings.includes(h.chunk.symbol)) boost += 0.2;
      return { ...h, boost, score: Math.min(1, h.score + boost) };
    }).sort((a, b) => b.score - a.score);
  }

  private addHighlights(q: string, hits: SearchHit[]): SearchHit[] {
    return hits.map(h => ({ ...h, hl: highlight(q, h.chunk.content) }));
  }
}

