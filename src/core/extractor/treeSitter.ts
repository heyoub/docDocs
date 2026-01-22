/**
 * @fileoverview Tree-sitter based symbol extraction for GenDocs extension.
 * This module provides fallback extraction when LSP is unavailable.
 * Uses web-tree-sitter WASM for syntax parsing.
 * Layer 3 - imports from types/ (Layer 0-2).
 *
 * @module core/extractor/treeSitter
 */

import type { SymbolID, FileURI, Range } from '../../types/base.js';
import type { SymbolKind, SymbolModifier, Visibility } from '../../types/symbols.js';
import type { ExtractedSymbol } from '../../types/extraction.js';
import type { SyntaxNode, Tree } from './treeSitterTypes.js';
import {
    SUPPORTED_LANGUAGES,
    SYMBOL_NODE_TYPES,
    COMMENT_NODE_TYPES
} from './treeSitterTypes.js';

// Re-export DocComment type
export type { DocComment } from './treeSitterTypes.js';

// ============================================================
// Module State
// ============================================================

type Parser = unknown;
type Language = unknown;

let parserInstance: Parser | null = null;
const loadedLanguages: Map<string, Language> = new Map();
let initialized = false;

// ============================================================
// Public API
// ============================================================

/**
 * Checks if a language is supported by tree-sitter extraction.
 * @param languageId - VS Code language identifier
 */
export function isSupported(languageId: string): boolean {
    return SUPPORTED_LANGUAGES.has(languageId);
}

/**
 * Loads the tree-sitter grammar for a language.
 * Grammars are loaded lazily and cached for reuse.
 * @param languageId - VS Code language identifier
 */
export async function loadLanguage(languageId: string): Promise<void> {
    if (!isSupported(languageId)) {
        throw new Error(`Language '${languageId}' is not supported by tree-sitter`);
    }
    if (loadedLanguages.has(languageId)) return;

    await ensureInitialized();
    const grammarName = SUPPORTED_LANGUAGES.get(languageId)!;

    try {
        const TreeSitter = await import('web-tree-sitter');
        const language = await TreeSitter.default.Language.load(`tree-sitter-${grammarName}.wasm`);
        loadedLanguages.set(languageId, language);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load tree-sitter grammar for '${languageId}': ${msg}`);
    }
}

/**
 * Extracts symbols from source code using tree-sitter.
 * @param content - Source code content
 * @param languageId - VS Code language identifier
 */
export function extractSymbols(content: string, languageId: string): readonly ExtractedSymbol[] {
    const tree = parseIfReady(content, languageId);
    if (!tree) return [];

    const grammarName = SUPPORTED_LANGUAGES.get(languageId) ?? languageId;
    const symbolTypes = SYMBOL_NODE_TYPES.get(grammarName) ?? SYMBOL_NODE_TYPES.get('javascript')!;
    const symbols: ExtractedSymbol[] = [];

    traverseTree(tree.rootNode, (node) => {
        if (symbolTypes.has(node.type)) {
            const symbol = nodeToSymbol(node, languageId, symbolTypes);
            if (symbol) symbols.push(symbol);
        }
    });

    return symbols;
}

/**
 * Extracts documentation comments from source code using tree-sitter.
 * @param content - Source code content
 * @param languageId - VS Code language identifier
 */
export function extractDocComments(
    content: string,
    languageId: string
): readonly import('./treeSitterTypes.js').DocComment[] {
    const tree = parseIfReady(content, languageId);
    if (!tree) return [];

    const grammarName = SUPPORTED_LANGUAGES.get(languageId) ?? languageId;
    const commentTypes = COMMENT_NODE_TYPES.get(grammarName) ?? COMMENT_NODE_TYPES.get('javascript')!;
    const comments: import('./treeSitterTypes.js').DocComment[] = [];

    traverseTree(tree.rootNode, (node) => {
        if (commentTypes.has(node.type) && isDocComment(node.text)) {
            comments.push({
                text: cleanCommentText(node.text),
                range: nodeToRange(node),
                associatedSymbol: findAssociatedSymbol(node)
            });
        }
    });

    return comments;
}

// ============================================================
// Internal Functions
// ============================================================

async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    try {
        const TreeSitter = await import('web-tree-sitter');
        await TreeSitter.default.init();
        parserInstance = new TreeSitter.default();
        initialized = true;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to initialize tree-sitter: ${msg}`);
    }
}

function parseIfReady(content: string, languageId: string): Tree | null {
    if (!isSupported(languageId)) return null;
    const language = loadedLanguages.get(languageId);
    if (!language || !parserInstance) return null;

    try {
        const parser = parserInstance as { setLanguage(l: Language): void; parse(c: string): Tree };
        parser.setLanguage(language);
        return parser.parse(content);
    } catch {
        return null;
    }
}

function traverseTree(node: SyntaxNode, visitor: (n: SyntaxNode) => void): void {
    visitor(node);
    for (const child of node.children) traverseTree(child, visitor);
}

function nodeToSymbol(
    node: SyntaxNode,
    languageId: string,
    symbolTypes: ReadonlySet<string>
): ExtractedSymbol | null {
    const name = extractSymbolName(node);
    if (!name) return null;

    return {
        id: `tree-sitter:${name}` as SymbolID,
        name,
        kind: nodeTypeToSymbolKind(node.type),
        location: { uri: '' as FileURI, range: nodeToRange(node) },
        modifiers: extractModifiers(node),
        visibility: extractVisibility(node),
        signature: extractSignature(node),
        documentation: extractPrecedingDoc(node),
        children: extractChildren(node, languageId, symbolTypes)
    };
}

function extractSymbolName(node: SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name')
        ?? node.childForFieldName('identifier')
        ?? findChildByType(node, 'identifier')
        ?? findChildByType(node, 'property_identifier');
    return nameNode?.text ?? null;
}

function findChildByType(node: SyntaxNode, type: string): SyntaxNode | null {
    for (const child of node.namedChildren) {
        if (child.type === type) return child;
    }
    return null;
}

function nodeTypeToSymbolKind(nodeType: string): SymbolKind {
    const map: Record<string, SymbolKind> = {
        function_declaration: 'function', function_definition: 'function', function_item: 'function',
        arrow_function: 'function', function_expression: 'function', function_signature: 'function',
        class_declaration: 'class', class_definition: 'class', struct_item: 'class',
        method_definition: 'method', method_declaration: 'method', method_signature: 'method',
        interface_declaration: 'interface', trait_item: 'interface',
        type_alias_declaration: 'type', type_declaration: 'type', type_item: 'type',
        enum_declaration: 'enum', enum_item: 'enum',
        variable_declaration: 'variable', lexical_declaration: 'variable', var_declaration: 'variable',
        const_declaration: 'constant', const_item: 'constant', static_item: 'variable',
        field_declaration: 'field', constructor_declaration: 'constructor',
        impl_item: 'class', mod_item: 'module', decorated_definition: 'function'
    };
    return map[nodeType] ?? 'variable';
}

function nodeToRange(node: SyntaxNode): Range {
    return {
        start: { line: node.startPosition.row, character: node.startPosition.column },
        end: { line: node.endPosition.row, character: node.endPosition.column }
    };
}

function isDocComment(text: string): boolean {
    return text.startsWith('/**') || text.startsWith('///') ||
        text.startsWith('"""') || text.startsWith("'''") || text.startsWith('##');
}

function cleanCommentText(text: string): string {
    return text
        .replace(/^\/\*\*?|\*\/$/g, '')
        .replace(/^\/\/\/?/gm, '')
        .replace(/^\s*\*\s?/gm, '')
        .replace(/^"""|"""$/g, '')
        .replace(/^'''|'''$/g, '')
        .trim();
}

function findAssociatedSymbol(commentNode: SyntaxNode): string | null {
    const siblings = commentNode.parent?.children ?? [];
    const idx = siblings.indexOf(commentNode as SyntaxNode);
    const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
    return next ? extractSymbolName(next) : null;
}

function extractPrecedingDoc(node: SyntaxNode): string | null {
    const prev = node.previousSibling;
    if (!prev) return null;
    const isComment = prev.type === 'comment' || prev.type === 'line_comment' || prev.type === 'block_comment';
    return isComment && isDocComment(prev.text) ? cleanCommentText(prev.text) : null;
}

function extractModifiers(node: SyntaxNode): readonly SymbolModifier[] {
    const mods: SymbolModifier[] = [];
    const text = node.text.toLowerCase();
    if (text.includes('async')) mods.push('async');
    if (text.includes('static')) mods.push('static');
    if (text.includes('readonly')) mods.push('readonly');
    if (text.includes('abstract')) mods.push('abstract');
    return mods;
}

function extractVisibility(node: SyntaxNode): Visibility {
    const text = node.text.toLowerCase();
    if (text.includes('private')) return 'private';
    if (text.includes('protected')) return 'protected';
    if (text.includes('internal')) return 'internal';
    return 'public';
}

function extractSignature(node: SyntaxNode): string {
    const text = node.text;
    const bodyStart = text.indexOf('{');
    if (bodyStart > 0) return text.substring(0, bodyStart).trim();
    const firstLine = text.split('\n')[0] ?? text;
    return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
}

function extractChildren(
    node: SyntaxNode,
    languageId: string,
    symbolTypes: ReadonlySet<string>
): readonly ExtractedSymbol[] {
    const children: ExtractedSymbol[] = [];
    for (const child of node.namedChildren) {
        if (symbolTypes.has(child.type)) {
            const symbol = nodeToSymbol(child, languageId, symbolTypes);
            if (symbol) children.push(symbol);
        }
    }
    return children;
}
