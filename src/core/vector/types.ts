/**
 * @fileoverview Vector infrastructure types - single source of truth.
 * All vector-related types centralized here.
 */

// =============================================================================
// Constants
// =============================================================================

export const CONTENT_TYPES = ['code', 'docs', 'comments', 'commits', 'prs'] as const;
export const HIERARCHY_LEVELS = ['project', 'module', 'file', 'symbol'] as const;
export const INCOHERENCE_TYPES = ['outdated', 'missing', 'mismatch', 'incomplete', 'orphaned', 'drift'] as const;

export type ContentType = typeof CONTENT_TYPES[number];
export type HierarchyLevel = typeof HIERARCHY_LEVELS[number];
export type IncoherenceType = typeof INCOHERENCE_TYPES[number];

// =============================================================================
// Core Data Structures
// =============================================================================

/** Metadata that can be attached to any chunk */
export interface ChunkMeta {
  modulePath?: string;
  signature?: string;
  visibility?: string;
  isExported?: boolean;
  complexity?: number;
  commitSha?: string;
  prNumber?: number;
  author?: string;
  timestamp?: number;
  dependencies?: string[];
}

/** A semantic unit of content for embedding */
export interface Chunk {
  id: string;
  content: string;
  type: ContentType;
  level: HierarchyLevel;
  path: string;
  symbol?: string | undefined;
  kind?: string | undefined;
  parent?: string | undefined;
  lines?: [number, number] | undefined;
  lang?: string | undefined;
  meta: ChunkMeta;
}

/** Chunk with embedding vector attached */
export interface EmbeddedChunk extends Chunk {
  vec: Float32Array;
  model: string;
  dim: number;
}

// =============================================================================
// Search
// =============================================================================

export interface SearchQuery {
  q: string;
  k?: number;
  min?: number;
  types?: ContentType[];
  levels?: HierarchyLevel[];
  path?: string;
  lang?: string;
  hybrid?: boolean;
  alpha?: number;
  rerank?: boolean;
}

export interface SearchHit {
  chunk: Chunk;
  score: number;
  vec?: number;
  bm25?: number;
  rerank?: number;
  boost?: number;
  hl?: string[];
}

export interface SearchResult {
  hits: SearchHit[];
  q: string;
  total: number;
  ms: number;
}

// =============================================================================
// Indexer
// =============================================================================

export type IndexerState = 'idle' | 'running' | 'paused' | 'error';

export interface IndexerStatus {
  state: IndexerState;
  file?: string | undefined;
  done: number;
  total: number;
  chunks: number;
  errors: number;
  started?: number | undefined;
  eta?: number | undefined;
  error?: string | undefined;
}

export interface IndexerConfig {
  types: ContentType[];
  include: string[];
  exclude: string[];
  batch: number;
  workers: number;
  watch: boolean;
  debounce: number;
  git: boolean;
  maxCommits: number;
}

// =============================================================================
// Incoherence Detection
// =============================================================================

export interface Incoherence {
  id: string;
  code: Chunk;
  doc: Chunk;
  type: IncoherenceType;
  severity: number;
  msg: string;
  fix?: string;
  confidence: number;
}

export interface IncoherenceReport {
  path: string;
  issues: Incoherence[];
  score: number;
  at: number;
}

// =============================================================================
// Database
// =============================================================================

export interface DbRecord {
  id: string;
  content: string;
  type: string;
  level: string;
  path: string;
  symbol: string | null;
  kind: string | null;
  parent: string | null;
  line_start: number | null;
  line_end: number | null;
  lang: string | null;
  meta: string;
  vec: number[];
  model: string;
  created: number;
  updated: number;
}

// =============================================================================
// File System Interface
// =============================================================================

export interface VectorFS {
  glob(patterns: string[], opts?: { ignore?: string[] }): Promise<string[]>;
  read(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  mtime(path: string): Promise<number>;
  lang(path: string): string;
}

// =============================================================================
// Git Interface
// =============================================================================

export interface Commit {
  sha: string;
  msg: string;
  author: string;
  time: number;
  diff: string;
}

export interface VectorGit {
  commits(n: number): Promise<Commit[]>;
  branch(): Promise<string>;
  isRepo(): Promise<boolean>;
}

// =============================================================================
// Helpers
// =============================================================================

export const chunk = (c: Partial<Chunk> & Pick<Chunk, 'id' | 'content' | 'type' | 'level' | 'path'>): Chunk => ({
  meta: {},
  ...c,
});

export const hit = (chunk: Chunk, score: number, extras?: Partial<SearchHit>): SearchHit => ({
  chunk,
  score,
  ...extras,
});
