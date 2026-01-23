/**
 * @fileoverview Vector search MCP tools.
 * Provides semantic search, indexing, and incoherence detection.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

import {
  VectorDatabase,
  Embedder,
  SearchEngine,
  Indexer,
  IncoherenceDetector,
  type VectorFS,
  type ContentType,
  type HierarchyLevel,
  CONTENT_TYPES,
  HIERARCHY_LEVELS,
} from '../../core/vector/index.js';

// =============================================================================
// Helpers
// =============================================================================

const getRoot = (): string => process.cwd();
const getDbPath = (): string => path.join(getRoot(), '.docdocs', 'vectors');

const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
  '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.rb': 'ruby', '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
  '.md': 'markdown', '.mdx': 'mdx',
};

const createFS = (root: string): VectorFS => ({
  glob: async (patterns, opts) => {
    const files: string[] = [];
    for (const p of patterns) {
      const matches = await glob(p, { cwd: root, ignore: opts?.ignore ?? [] });
      files.push(...matches.map(f => path.resolve(root, f)));
    }
    return [...new Set(files)];
  },
  read: async (p) => fs.promises.readFile(p, 'utf-8'),
  exists: async (p) => fs.existsSync(p),
  mtime: async (p) => (await fs.promises.stat(p)).mtimeMs,
  lang: (p) => LANG_MAP[path.extname(p).toLowerCase()] ?? 'text',
});

// Lazy singleton instances
let db: VectorDatabase | null = null;
let embedder: Embedder | null = null;

const getDb = async (): Promise<VectorDatabase> => {
  if (!db) {
    db = new VectorDatabase({ path: getDbPath() });
    await db.connect();
  }
  return db;
};

const getEmbedder = async (): Promise<Embedder> => {
  if (!embedder) {
    embedder = new Embedder();
    await embedder.load();
  }
  return embedder;
};

// =============================================================================
// Tool Registration
// =============================================================================

export function registerVectorTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // docdocs_vector_search
  // ---------------------------------------------------------------------------
  server.tool(
    'docdocs_vector_search',
    'Semantic search across code, documentation, and comments using vector embeddings.',
    {
      query: z.string().describe('Natural language search query'),
      limit: z.number().min(1).max(50).default(10).describe('Max results to return'),
      types: z.array(z.enum(CONTENT_TYPES as unknown as [string, ...string[]])).optional()
        .describe('Content types to search: code, docs, comments, commits, prs'),
      levels: z.array(z.enum(HIERARCHY_LEVELS as unknown as [string, ...string[]])).optional()
        .describe('Hierarchy levels: project, module, file, symbol'),
      path: z.string().optional().describe('Filter by path pattern'),
      lang: z.string().optional().describe('Filter by language'),
      hybrid: z.boolean().default(true).describe('Use hybrid search (vector + BM25)'),
      rerank: z.boolean().default(true).describe('Apply re-ranking'),
    },
    async ({ query, limit, types, levels, path: pathPattern, lang, hybrid, rerank }) => {
      const database = await getDb();
      const emb = await getEmbedder();
      const engine = new SearchEngine(database, emb);
      const root = getRoot();

      const result = await engine.search({
        q: query,
        k: limit,
        types: types as ContentType[] | undefined,
        levels: levels as HierarchyLevel[] | undefined,
        path: pathPattern,
        lang,
        hybrid,
        rerank,
      });

      const hits = result.hits.map(h => ({
        path: path.relative(root, h.chunk.path),
        symbol: h.chunk.symbol,
        kind: h.chunk.kind,
        type: h.chunk.type,
        level: h.chunk.level,
        score: h.score.toFixed(3),
        lines: h.chunk.lines,
        highlights: h.hl?.slice(0, 3),
        snippet: h.chunk.content.slice(0, 200),
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query,
            totalHits: result.total,
            searchTimeMs: result.ms,
            hits,
          }, null, 2),
        }],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // docdocs_vector_similar
  // ---------------------------------------------------------------------------
  server.tool(
    'docdocs_vector_similar',
    'Find code or documentation similar to a given file or symbol.',
    {
      path: z.string().describe('File path to find similar content for'),
      symbol: z.string().optional().describe('Specific symbol within the file'),
      limit: z.number().min(1).max(20).default(5).describe('Max results'),
    },
    async ({ path: filePath, symbol, limit }) => {
      const database = await getDb();
      const emb = await getEmbedder();
      const engine = new SearchEngine(database, emb);
      const root = getRoot();
      const absPath = path.resolve(root, filePath);

      const chunks = await database.getByPath(absPath);
      const target = symbol
        ? chunks.find(c => c.symbol === symbol)
        : chunks.find(c => c.level === 'file');

      if (!target) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'File or symbol not found in index' }) }],
          isError: true,
        };
      }

      const similar = await engine.findSimilar(target, limit);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            source: { path: filePath, symbol: target.symbol },
            similar: similar.map(h => ({
              path: path.relative(root, h.chunk.path),
              symbol: h.chunk.symbol,
              type: h.chunk.type,
              score: h.score.toFixed(3),
              snippet: h.chunk.content.slice(0, 150),
            })),
          }, null, 2),
        }],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // docdocs_vector_index
  // ---------------------------------------------------------------------------
  server.tool(
    'docdocs_vector_index',
    'Index files for vector search. Indexes code, documentation, and comments.',
    {
      path: z.string().optional().describe('Specific file or directory to index'),
      force: z.boolean().default(false).describe('Re-index even if already indexed'),
      types: z.array(z.enum(['code', 'docs', 'comments'])).default(['code', 'docs', 'comments'])
        .describe('Content types to index'),
    },
    async ({ path: targetPath, force, types }) => {
      const database = await getDb();
      const emb = await getEmbedder();
      const root = getRoot();
      const fsImpl = createFS(root);

      const indexer = new Indexer(database, emb, fsImpl, {
        types: types as ContentType[],
        include: targetPath
          ? [path.resolve(root, targetPath)]
          : ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.md'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      if (force) await indexer.clearIndex();

      const status = await indexer.indexAll();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: status.state,
            filesProcessed: status.done,
            filesTotal: status.total,
            chunksIndexed: status.chunks,
            errors: status.errors,
            error: status.error,
          }, null, 2),
        }],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // docdocs_vector_incoherence
  // ---------------------------------------------------------------------------
  server.tool(
    'docdocs_vector_incoherence',
    'Detect incoherence between code and documentation using semantic analysis.',
    {
      path: z.string().optional().describe('Specific file to analyze'),
      minSeverity: z.number().min(0).max(1).default(0.3).describe('Minimum severity (0-1) to report'),
      limit: z.number().min(1).max(50).default(20).describe('Max issues to return'),
    },
    async ({ path: targetPath, minSeverity, limit }) => {
      const database = await getDb();
      const emb = await getEmbedder();
      const detector = new IncoherenceDetector(database, emb);
      const root = getRoot();

      if (targetPath) {
        const absPath = path.resolve(root, targetPath);
        const report = await detector.analyzeFile(absPath);

        const issues = report.issues
          .filter(i => i.severity >= minSeverity)
          .slice(0, limit)
          .map(i => ({
            type: i.type,
            severity: i.severity.toFixed(2),
            message: i.msg,
            code: { symbol: i.code.symbol, kind: i.code.kind, lines: i.code.lines },
            doc: i.doc.id !== i.code.id ? { symbol: i.doc.symbol, lines: i.doc.lines } : undefined,
            suggestedFix: detector.suggestFix(i),
            confidence: i.confidence.toFixed(2),
          }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              path: targetPath,
              coherenceScore: report.score.toFixed(2),
              totalIssues: report.issues.length,
              reportedIssues: issues.length,
              issues,
            }, null, 2),
          }],
        };
      }

      const summary = await detector.analyzeProject();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalFiles: summary.files,
            filesWithIssues: summary.withIssues,
            totalIncoherences: summary.total,
            averageCoherence: summary.avgScore.toFixed(2),
            byType: summary.byType,
            bySeverity: summary.bySeverity,
            worstFiles: summary.worst.slice(0, 10),
          }, null, 2),
        }],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // docdocs_vector_stats
  // ---------------------------------------------------------------------------
  server.tool(
    'docdocs_vector_stats',
    'Get statistics about the vector index.',
    {},
    async () => {
      const database = await getDb();
      const collections = await database.listCollections();

      const stats = {
        totalCollections: collections.length,
        totalChunks: collections.reduce((s, c) => s + c.count, 0),
        byType: {} as Record<string, number>,
        byLevel: {} as Record<string, number>,
        collections: collections.map(c => ({
          name: c.name,
          type: c.type,
          level: c.level,
          count: c.count,
        })),
      };

      for (const c of collections) {
        stats.byType[c.type] = (stats.byType[c.type] ?? 0) + c.count;
        stats.byLevel[c.level] = (stats.byLevel[c.level] ?? 0) + c.count;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        }],
      };
    }
  );

  // ---------------------------------------------------------------------------
  // docdocs_vector_clear
  // ---------------------------------------------------------------------------
  server.tool(
    'docdocs_vector_clear',
    'Clear the vector index. Use with caution.',
    {
      confirm: z.boolean().describe('Must be true to confirm deletion'),
    },
    async ({ confirm }) => {
      if (!confirm) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Must confirm=true to clear index' }) }],
          isError: true,
        };
      }

      const database = await getDb();
      const emb = await getEmbedder();
      const root = getRoot();
      const fsImpl = createFS(root);
      const indexer = new Indexer(database, emb, fsImpl);

      await indexer.clearIndex();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: 'Index cleared successfully' }),
        }],
      };
    }
  );
}
