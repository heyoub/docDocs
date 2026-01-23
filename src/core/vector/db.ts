/**
 * @fileoverview LanceDB wrapper for vector storage and hybrid search.
 * Single source of truth for all vector persistence.
 */

import type { Chunk, EmbeddedChunk, ContentType, HierarchyLevel, SearchQuery, SearchHit, DbRecord } from './types.js';
import { CONTENT_TYPES, HIERARCHY_LEVELS, hit } from './types.js';

// =============================================================================
// Constants
// =============================================================================

const TABLE_PREFIX = 'docdocs';

// =============================================================================
// LanceDB Dynamic Types
// =============================================================================

type Connection = { openTable(n: string): Promise<Table>; createTable(n: string, d: unknown[]): Promise<Table>; dropTable(n: string): Promise<void>; tableNames(): Promise<string[]> };
type Table = { add(r: unknown[]): Promise<void>; delete(f: string): Promise<void>; countRows(): Promise<number>; search(v: number[]): SearchBuilder };
type SearchBuilder = { where(f: string): SearchBuilder; limit(n: number): SearchBuilder; execute(): Promise<Row[]> };
type Row = DbRecord & { _distance?: number };

// =============================================================================
// Database
// =============================================================================

export interface DbOpts { path: string; cache?: number }

export class VectorDatabase {
  private db: Connection | null = null;
  private tables = new Map<string, Table>();
  private readonly path: string;

  constructor(opts: DbOpts) { this.path = opts.path; }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    if (this.db) return;
    const lancedb = await import('vectordb');
    this.db = await lancedb.connect(this.path) as Connection;
  }

  async disconnect(): Promise<void> { this.tables.clear(); this.db = null; }

  private async conn(): Promise<Connection> { if (!this.db) await this.connect(); return this.db!; }

  // ---------------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------------

  private name(t: ContentType, l: HierarchyLevel): string { return `${TABLE_PREFIX}_${t}_${l}`; }

  private parse(n: string): { type: ContentType; level: HierarchyLevel } | null {
    const m = n.match(new RegExp(`^${TABLE_PREFIX}_(\\w+)_(\\w+)$`));
    if (!m?.[1] || !m[2]) return null;
    const t = m[1] as ContentType, l = m[2] as HierarchyLevel;
    return CONTENT_TYPES.includes(t) && HIERARCHY_LEVELS.includes(l) ? { type: t, level: l } : null;
  }

  private async forEachTable<T>(fn: (t: Table, info: { name: string; type: ContentType; level: HierarchyLevel }) => Promise<T | null>): Promise<T[]> {
    const db = await this.conn();
    const names = await db.tableNames();
    const results: T[] = [];
    for (const n of names) {
      const p = this.parse(n);
      if (!p) continue;
      try {
        const t = await db.openTable(n);
        const r = await fn(t, { name: n, type: p.type, level: p.level });
        if (r !== null) results.push(r);
      } catch { /* ignore */ }
    }
    return results;
  }

  async listCollections(): Promise<{ name: string; type: ContentType; level: HierarchyLevel; count: number }[]> {
    return this.forEachTable(async (t, info) => ({
      name: info.name,
      type: info.type,
      level: info.level,
      count: await t.countRows(),
    }));
  }

  async dropCollection(t: ContentType, l: HierarchyLevel): Promise<void> {
    const n = this.name(t, l);
    const db = await this.conn();
    try { await db.dropTable(n); this.tables.delete(n); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  private toRecord(c: EmbeddedChunk): DbRecord {
    return {
      id: c.id,
      content: c.content,
      type: c.type,
      level: c.level,
      path: c.path,
      symbol: c.symbol ?? null,
      kind: c.kind ?? null,
      parent: c.parent ?? null,
      line_start: c.lines?.[0] ?? null,
      line_end: c.lines?.[1] ?? null,
      lang: c.lang ?? null,
      meta: JSON.stringify(c.meta),
      vec: Array.from(c.vec),
      model: c.model,
      created: Date.now(),
      updated: Date.now(),
    };
  }

  private toChunk(r: DbRecord): Chunk {
    return {
      id: r.id,
      content: r.content,
      type: r.type as ContentType,
      level: r.level as HierarchyLevel,
      path: r.path,
      symbol: r.symbol ?? undefined,
      kind: r.kind ?? undefined,
      parent: r.parent ?? undefined,
      lines: r.line_start !== null && r.line_end !== null ? [r.line_start, r.line_end] : undefined,
      lang: r.lang ?? undefined,
      meta: JSON.parse(r.meta) as Chunk['meta'],
    };
  }

  async insert(chunks: readonly EmbeddedChunk[]): Promise<void> {
    if (!chunks.length) return;
    const db = await this.conn();
    const grouped = new Map<string, DbRecord[]>();
    for (const c of chunks) {
      const n = this.name(c.type, c.level);
      if (!grouped.has(n)) grouped.set(n, []);
      grouped.get(n)!.push(this.toRecord(c));
    }
    for (const [n, recs] of grouped) {
      try {
        const t = await db.openTable(n);
        await t.add(recs);
        this.tables.set(n, t);
      } catch {
        const t = await db.createTable(n, recs);
        this.tables.set(n, t);
      }
    }
  }

  async upsert(chunks: readonly EmbeddedChunk[]): Promise<void> {
    if (!chunks.length) return;
    await this.deleteByIds(chunks.map(c => c.id));
    await this.insert(chunks);
  }

  async deleteByIds(ids: readonly string[]): Promise<void> {
    if (!ids.length) return;
    const filter = `id IN (${ids.map(i => `'${i}'`).join(', ')})`;
    await this.forEachTable(async t => { await t.delete(filter); return null; });
  }

  async deleteByPath(path: string): Promise<void> {
    await this.forEachTable(async t => { await t.delete(`path = '${path}'`); return null; });
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(vec: Float32Array, q: SearchQuery): Promise<SearchHit[]> {
    const { k = 10, min = 0, types, levels, path, lang } = q;
    const db = await this.conn();
    const names = await db.tableNames();
    const all: SearchHit[] = [];

    for (const n of names) {
      const p = this.parse(n);
      if (!p) continue;
      if (types?.length && !types.includes(p.type)) continue;
      if (levels?.length && !levels.includes(p.level)) continue;

      try {
        const t = await db.openTable(n);
        let s = t.search(Array.from(vec));
        const filters: string[] = [];
        if (path) filters.push(`path LIKE '%${path}%'`);
        if (lang) filters.push(`lang = '${lang}'`);
        if (filters.length) s = s.where(filters.join(' AND '));

        const rows = await s.limit(k * 2).execute();
        for (const r of rows) {
          const score = 1 - (r._distance ?? 0);
          if (score < min) continue;
          all.push(hit(this.toChunk(r), score, { vec: score }));
        }
      } catch { /* ignore */ }
    }

    // Note: Hybrid scoring with BM25 is handled by SearchEngine.hybridScore()
    return all.sort((a, b) => b.score - a.score).slice(0, k);
  }

  async getById(id: string): Promise<Chunk | null> {
    const results = await this.forEachTable(async t => {
      const rows = await t.search([]).where(`id = '${id}'`).limit(1).execute();
      return rows[0] ? this.toChunk(rows[0]) : null;
    });
    return results[0] ?? null;
  }

  async getByPath(path: string): Promise<Chunk[]> {
    const results = await this.forEachTable(async t => {
      const rows = await t.search([]).where(`path = '${path}'`).execute();
      return rows.length ? rows.map(r => this.toChunk(r)) : null;
    });
    return results.flat();
  }
}
