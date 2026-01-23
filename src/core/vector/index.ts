/**
 * @fileoverview Vector indexing and search infrastructure.
 * Provides semantic search over code, documentation, commits, and PRs.
 */

// Types - single source of truth
export * from './types.js';

// Utilities
export * from './utils.js';

// Database
export { VectorDatabase, type DbOpts } from './db.js';

// Chunking
export { Chunker, DEFAULT_OPTS as DEFAULT_CHUNKER, type ChunkerOpts } from './chunker.js';

// Embedding
export { Embedder, DEFAULT_EMBEDDER, type EmbedderOpts, type ProgressFn as EmbedderProgress } from './embedder.js';

// Search
export { SearchEngine, DEFAULT_SEARCH, type SearchOpts, type GraphContext } from './search.js';

// Indexer
export { Indexer, IndexerWatcher, DEFAULT_INDEXER, type ProgressFn as IndexerProgressFn } from './indexer.js';

// Incoherence Detection
export { IncoherenceDetector, DEFAULT_INCOHERENCE, type IncoherenceOpts, type FileSummary, type ProjectSummary } from './incoherence.js';
