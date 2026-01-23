/**
 * @fileoverview Shared utilities for vector infrastructure.
 * Consolidates hashing, tokenization, vector math, BM25, and text processing.
 */

import { createHash } from 'crypto';
import type { Chunk } from './types.js';

// =============================================================================
// Hashing
// =============================================================================

/** Generate deterministic ID from components */
export const hashId = (...parts: string[]): string =>
  createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 16);

// =============================================================================
// Tokenization
// =============================================================================

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have',
  'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'what',
  'which', 'who', 'whom', 'how', 'when', 'where', 'why', 'all', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'same', 'so', 'than', 'too', 'very', 'just', 'find', 'get',
]);

/** Tokenize text into terms, filtering stop words and short tokens */
export const tokenize = (text: string, minLen = 2): string[] =>
  text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)
    .filter(t => t.length > minLen && !STOP_WORDS.has(t));

/** Estimate token count (rough: ~4 chars per token for code) */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

// =============================================================================
// Vector Math
// =============================================================================

/** Dot product of two vectors */
export const dot = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
};

/** Euclidean norm of vector */
export const norm = (v: Float32Array): number => Math.sqrt(dot(v, v));

/** Cosine similarity between two vectors */
export const cosine = (a: Float32Array, b: Float32Array): number => {
  const d = dot(a, b), na = norm(a), nb = norm(b);
  return na === 0 || nb === 0 ? 0 : d / (na * nb);
};

/** Euclidean distance between two vectors */
export const euclidean = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
};

/** Normalize vector to unit length */
export const normalize = (v: Float32Array): Float32Array => {
  const n = norm(v);
  if (n === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / n;
  return out;
};

// =============================================================================
// BM25
// =============================================================================

export interface BM25Index {
  avgDl: number;
  docCount: number;
  df: Map<string, number>;
}

const BM25_K1 = 1.2;
const BM25_B = 0.75;

/** Build BM25 index from documents */
export const buildBM25 = (docs: string[]): BM25Index => {
  const df = new Map<string, number>();
  let totalLen = 0;

  for (const doc of docs) {
    const terms = new Set(tokenize(doc));
    for (const term of terms) df.set(term, (df.get(term) ?? 0) + 1);
    totalLen += tokenize(doc).length;
  }

  return { avgDl: totalLen / docs.length, docCount: docs.length, df };
};

/** Compute BM25 score for a query against a document */
export const bm25Score = (query: string, doc: string, idx: BM25Index): number => {
  const qTerms = tokenize(query);
  const dTerms = tokenize(doc);
  const tf = new Map<string, number>();
  for (const t of dTerms) tf.set(t, (tf.get(t) ?? 0) + 1);

  let score = 0;
  for (const term of qTerms) {
    const termTf = tf.get(term) ?? 0;
    if (termTf === 0) continue;

    const docFreq = idx.df.get(term) ?? 0;
    const idf = Math.log((idx.docCount - docFreq + 0.5) / (docFreq + 0.5) + 1);
    const tfNorm = (termTf * (BM25_K1 + 1)) /
      (termTf + BM25_K1 * (1 - BM25_B + BM25_B * (dTerms.length / idx.avgDl)));
    score += idf * tfNorm;
  }

  return score;
};

// =============================================================================
// Text Processing
// =============================================================================

/** Check if text is a doc comment (JSDoc, docstring, etc) */
export const isDocComment = (text: string): boolean =>
  /^(\/\*\*|\/\/\/|"""|'''|##)/.test(text);

/** Clean comment markers from text */
export const cleanComment = (text: string): string =>
  text
    .replace(/^\/\*\*?|\*\/$/g, '')
    .replace(/^\/\/\/?/gm, '')
    .replace(/^\s*\*\s?/gm, '')
    .replace(/^"""|"""$/g, '')
    .replace(/^'''|'''$/g, '')
    .trim();

/** Extract first N lines as summary */
export const summarize = (text: string, n = 10): string =>
  text.split('\n').slice(0, n).join('\n');

/** Highlight query terms in text */
export const highlight = (query: string, text: string): string[] => {
  const terms = tokenize(query);
  const lines = text.split('\n');
  const results: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (terms.some(t => lower.includes(t))) {
      let hl = line;
      for (const term of terms) {
        hl = hl.replace(new RegExp(`(${term})`, 'gi'), '**$1**');
      }
      results.push(hl.trim());
      if (results.length >= 3) break;
    }
  }

  return results;
};

// =============================================================================
// Code Synonyms for Query Expansion
// =============================================================================

const CODE_SYNONYMS: Record<string, string[]> = {
  function: ['method', 'func', 'fn', 'procedure'],
  class: ['type', 'struct', 'object'],
  variable: ['var', 'let', 'const', 'field', 'property'],
  error: ['exception', 'throw', 'catch', 'bug', 'issue'],
  test: ['spec', 'unit', 'integration', 'e2e'],
  async: ['await', 'promise', 'callback', 'concurrent'],
  import: ['require', 'include', 'use', 'dependency'],
  export: ['expose', 'public', 'module'],
  create: ['new', 'init', 'construct', 'make', 'build'],
  delete: ['remove', 'destroy', 'drop', 'clear'],
  update: ['modify', 'change', 'set', 'patch'],
  get: ['fetch', 'retrieve', 'read', 'load'],
  send: ['post', 'push', 'emit', 'dispatch'],
  receive: ['handle', 'listen', 'subscribe', 'on'],
};

/** Expand query with code-specific synonyms */
export const expandQuery = (query: string): string[] => {
  const keywords = tokenize(query);
  const expansions = [query];

  for (const kw of keywords) {
    const syns = CODE_SYNONYMS[kw];
    if (syns) {
      for (const syn of syns) {
        expansions.push(query.replace(new RegExp(kw, 'gi'), syn));
      }
    }
  }

  return [...new Set(expansions)];
};

// =============================================================================
// Diff Parsing
// =============================================================================

/** Summarize a git diff */
export const summarizeDiff = (diff: string): string => {
  const lines = diff.split('\n');
  const added = lines.filter(l => l.startsWith('+')).length;
  const removed = lines.filter(l => l.startsWith('-')).length;
  const files = (diff.match(/diff --git/g) ?? []).length;
  return `${files} files (+${added}/-${removed})`;
};

/** Split diff by file */
export const splitDiff = (diff: string): Map<string, string> => {
  const files = new Map<string, string>();
  for (const part of diff.split(/(?=diff --git)/)) {
    const m = part.match(/diff --git a\/(.+?) b\//);
    if (m?.[1]) files.set(m[1], part);
  }
  return files;
};

// =============================================================================
// Chunk Filtering
// =============================================================================

/** Filter chunks to code symbols only */
export const filterCodeSymbols = (chunks: readonly Chunk[]): Chunk[] =>
  chunks.filter(c => c.type === 'code' && c.level === 'symbol');

/** Filter chunks to docs and comments only */
export const filterDocs = (chunks: readonly Chunk[]): Chunk[] =>
  chunks.filter(c => c.type === 'comments' || c.type === 'docs');

// =============================================================================
// Hybrid Scoring
// =============================================================================

/** Calculate hybrid score from vector and BM25 scores */
export const hybridScore = (vecScore: number, bm25Score: number, alpha: number): number =>
  alpha * vecScore + (1 - alpha) * bm25Score;
