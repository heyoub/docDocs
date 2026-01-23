/**
 * @fileoverview AST-aware chunker for code and documentation.
 * Uses tree-sitter for semantic chunking, falls back to sliding window.
 */

import type { Chunk, ContentType, Commit } from './types.js';
import { chunk as mkChunk } from './types.js';
import { hashId, estimateTokens, isDocComment, cleanComment, summarize, summarizeDiff, splitDiff } from './utils.js';
import { SUPPORTED_LANGUAGES, SYMBOL_NODE_TYPES, COMMENT_NODE_TYPES } from '../extractor/treeSitterTypes.js';
import type { SyntaxNode, Tree } from '../extractor/treeSitterTypes.js';

// =============================================================================
// Config
// =============================================================================

export interface ChunkerOpts {
  maxTokens: number;
  minTokens: number;
  overlap: number;
  includeContext: boolean;
  extractComments: boolean;
}

export const DEFAULT_OPTS: ChunkerOpts = {
  maxTokens: 512,
  minTokens: 50,
  overlap: 50,
  includeContext: true,
  extractComments: true,
};

// =============================================================================
// Tree-sitter State
// =============================================================================

type Parser = { setLanguage(l: unknown): void; parse(c: string): Tree };
let parser: Parser | null = null;
const langs = new Map<string, unknown>();
let ready = false;

async function init(): Promise<void> {
  if (ready) return;
  const TS = await import('web-tree-sitter');
  await TS.default.init();
  parser = new TS.default() as Parser;
  ready = true;
}

async function loadLang(id: string): Promise<void> {
  if (!SUPPORTED_LANGUAGES.has(id) || langs.has(id)) return;
  await init();
  const TS = await import('web-tree-sitter');
  const name = SUPPORTED_LANGUAGES.get(id)!;
  langs.set(id, await TS.default.Language.load(`tree-sitter-${name}.wasm`));
}

function parse(content: string, langId: string): Tree | null {
  const lang = langs.get(langId);
  if (!lang || !parser) return null;
  try {
    parser.setLanguage(lang);
    return parser.parse(content);
  } catch { return null; }
}

// =============================================================================
// Chunker
// =============================================================================

export class Chunker {
  private opts: ChunkerOpts;

  constructor(opts: Partial<ChunkerOpts> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }

  /** Chunk code file using AST when available */
  async code(content: string, path: string, langId: string, module?: string): Promise<Chunk[]> {
    await loadLang(langId);
    const tree = parse(content, langId);
    return tree ? this.astChunk(tree, content, path, langId, module) : this.textChunk(content, path, 'code', langId);
  }

  /** Chunk documentation file (markdown) */
  docs(content: string, path: string): Chunk[] {
    const fileId = hashId(path, 'file');
    const chunks: Chunk[] = [mkChunk({
      id: fileId,
      content: summarize(content, 20),
      type: 'docs',
      level: 'file',
      path,
    })];

    // Split by headers
    let heading = '', lines: string[] = [], start = 0;
    for (const [i, line] of content.split('\n').entries()) {
      const m = line.match(/^#+\s+(.+)/);
      if (m) {
        if (lines.length && estimateTokens(lines.join('\n')) >= this.opts.minTokens) {
          chunks.push(mkChunk({
            id: hashId(path, 'section', heading || 'intro'),
            content: lines.join('\n'),
            type: 'docs',
            level: 'symbol',
            path,
            symbol: heading || 'Introduction',
            parent: fileId,
            lines: [start, i - 1],
          }));
        }
        heading = m[1] ?? '';
        lines = [line];
        start = i;
      } else {
        lines.push(line);
      }
    }
    if (lines.length && estimateTokens(lines.join('\n')) >= this.opts.minTokens) {
      chunks.push(mkChunk({
        id: hashId(path, 'section', heading || 'end'),
        content: lines.join('\n'),
        type: 'docs',
        level: 'symbol',
        path,
        symbol: heading || 'Content',
        parent: fileId,
        lines: [start, content.split('\n').length - 1],
      }));
    }
    return chunks;
  }

  /** Chunk a git commit */
  commit(c: Commit): Chunk[] {
    const id = hashId(c.sha, 'commit');
    const chunks: Chunk[] = [mkChunk({
      id,
      content: `${c.msg}\n\n${summarizeDiff(c.diff)}`,
      type: 'commits',
      level: 'project',
      path: c.sha,
      meta: { commitSha: c.sha, author: c.author, timestamp: c.time },
    })];

    for (const [file, diff] of splitDiff(c.diff)) {
      chunks.push(mkChunk({
        id: hashId(c.sha, 'file', file),
        content: diff,
        type: 'commits',
        level: 'file',
        path: file,
        parent: id,
        meta: { commitSha: c.sha, author: c.author, timestamp: c.time },
      }));
    }
    return chunks;
  }

  /** Chunk a PR */
  pr(num: number, title: string, body: string, comments: string[], author: string, time: number): Chunk[] {
    return [mkChunk({
      id: hashId(`pr-${num}`, 'pr'),
      content: `# ${title}\n\n${body}\n\n## Discussion\n${comments.map(c => `- ${c}`).join('\n')}`,
      type: 'prs',
      level: 'project',
      path: `pr/${num}`,
      meta: { prNumber: num, author, timestamp: time },
    })];
  }

  // ===========================================================================
  // Private
  // ===========================================================================

  private astChunk(tree: Tree, content: string, path: string, langId: string, module?: string): Chunk[] {
    const fileId = hashId(path, 'file');
    const chunks: Chunk[] = [mkChunk({
      id: fileId,
      content: this.fileContext(tree, content),
      type: 'code',
      level: 'file',
      path,
      lang: langId,
      meta: module ? { modulePath: module, isExported: this.hasExports(tree) } : { isExported: this.hasExports(tree) },
    })];

    const grammar = SUPPORTED_LANGUAGES.get(langId) ?? langId;
    const symbolTypes = SYMBOL_NODE_TYPES.get(grammar) ?? SYMBOL_NODE_TYPES.get('javascript')!;
    const commentTypes = COMMENT_NODE_TYPES.get(grammar) ?? COMMENT_NODE_TYPES.get('javascript')!;

    this.walk(tree.rootNode, n => {
      if (symbolTypes.has(n.type)) {
        const c = this.nodeChunk(n, path, langId, fileId, module);
        if (c) chunks.push(c);
      }
    });

    if (this.opts.extractComments) {
      this.walk(tree.rootNode, n => {
        if (commentTypes.has(n.type) && isDocComment(n.text)) {
          const text = cleanComment(n.text);
          if (estimateTokens(text) >= this.opts.minTokens) {
            const sym = this.nextSymbol(n);
            chunks.push(mkChunk({
              id: hashId(path, 'comment', String(n.startPosition.row)),
              content: text,
              type: 'comments',
              level: 'symbol',
              path,
              symbol: sym ?? undefined,
              parent: fileId,
              lines: [n.startPosition.row, n.endPosition.row],
              lang: langId,
            }));
          }
        }
      });
    }

    return chunks;
  }

  private textChunk(content: string, path: string, type: ContentType, lang?: string): Chunk[] {
    const fileId = hashId(path, 'file');
    const lines = content.split('\n');
    const chunks: Chunk[] = [mkChunk({
      id: fileId,
      content: lines.slice(0, 20).join('\n'),
      type,
      level: 'file',
      path,
      lang,
    })];

    let buf: string[] = [], tokens = 0, start = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lt = estimateTokens(line);
      if (tokens + lt > this.opts.maxTokens && buf.length) {
        chunks.push(mkChunk({
          id: hashId(path, 'chunk', String(start)),
          content: buf.join('\n'),
          type,
          level: 'symbol',
          path,
          parent: fileId,
          lines: [start, i - 1],
          lang,
        }));
        const keep = Math.ceil(this.opts.overlap / 4);
        buf = buf.slice(-keep);
        tokens = estimateTokens(buf.join('\n'));
        start = i - keep;
      }
      buf.push(line);
      tokens += lt;
    }

    if (buf.length && tokens >= this.opts.minTokens) {
      chunks.push(mkChunk({
        id: hashId(path, 'chunk', String(start)),
        content: buf.join('\n'),
        type,
        level: 'symbol',
        path,
        parent: fileId,
        lines: [start, lines.length - 1],
        lang,
      }));
    }

    return chunks;
  }

  private walk(node: SyntaxNode, fn: (n: SyntaxNode) => void): void {
    fn(node);
    for (const c of node.children) this.walk(c, fn);
  }

  private nodeChunk(node: SyntaxNode, path: string, langId: string, parent: string, module?: string): Chunk | null {
    const name = this.nodeName(node);
    if (!name) return null;
    const content = this.opts.includeContext ? this.withContext(node) : node.text;
    if (estimateTokens(content) < this.opts.minTokens) return null;

    return mkChunk({
      id: hashId(path, 'symbol', name),
      content,
      type: 'code',
      level: 'symbol',
      path,
      symbol: name,
      kind: this.nodeKind(node.type),
      parent,
      lines: [node.startPosition.row, node.endPosition.row],
      lang: langId,
      meta: {
        signature: this.signature(node),
        visibility: this.visibility(node),
        isExported: this.isExported(node),
        ...(module ? { modulePath: module } : {}),
      },
    });
  }

  private nodeName(n: SyntaxNode): string | null {
    const name = n.childForFieldName('name') ?? n.childForFieldName('identifier') ??
      n.namedChildren.find(c => c.type === 'identifier' || c.type === 'property_identifier');
    return name?.text ?? null;
  }

  private nodeKind(type: string): string {
    if (type.includes('function') || type.includes('method')) return 'function';
    if (type.includes('class')) return 'class';
    if (type.includes('interface')) return 'interface';
    if (type.includes('type')) return 'type';
    if (type.includes('enum')) return 'enum';
    return 'variable';
  }

  private withContext(n: SyntaxNode): string {
    const parts: string[] = [];
    if (n.parent?.type.includes('class') || n.parent?.type.includes('impl')) {
      const pn = this.nodeName(n.parent);
      if (pn) parts.push(`// In ${pn}`);
    }
    if (n.previousSibling?.type.includes('comment')) parts.push(n.previousSibling.text);
    parts.push(n.text);
    return parts.join('\n');
  }

  private signature(n: SyntaxNode): string {
    const i = n.text.indexOf('{');
    if (i > 0) return n.text.slice(0, i).trim();
    const line = n.text.split('\n')[0] ?? n.text;
    return line.length > 100 ? line.slice(0, 100) + '...' : line;
  }

  private visibility(n: SyntaxNode): string {
    const t = n.text.toLowerCase();
    if (t.includes('private')) return 'private';
    if (t.includes('protected')) return 'protected';
    if (t.includes('internal')) return 'internal';
    return 'public';
  }

  private isExported(n: SyntaxNode): boolean {
    return n.text.includes('export') || (n.parent?.type.includes('export') ?? false);
  }

  private hasExports(tree: Tree): boolean {
    return tree.rootNode.children.some(c => c.type.includes('export'));
  }

  private fileContext(tree: Tree, content: string): string {
    const lines = content.split('\n');
    const ctx: string[] = [];
    for (const c of tree.rootNode.children) {
      if (c.type.includes('import') || c.type.includes('export') || c.type === 'comment' || c.type.includes('module')) {
        ctx.push(...lines.slice(c.startPosition.row, c.endPosition.row + 1));
      }
    }
    return ctx.slice(0, 50).join('\n');
  }

  private nextSymbol(comment: SyntaxNode): string | null {
    const sibs = comment.parent?.children ?? [];
    const i = sibs.indexOf(comment);
    const next = i >= 0 && i < sibs.length - 1 ? sibs[i + 1] : null;
    return next ? this.nodeName(next) : null;
  }
}
