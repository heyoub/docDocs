/**
 * @fileoverview Completion provider for GenDocs extension.
 * Surfaces relevant documentation context in IntelliSense completions.
 *
 * @module providers/completion
 * @requirements 16.1, 16.2, 16.3, 16.4, 16.5
 */

import * as vscode from 'vscode';
import type { FileURI, ModuleSchema, SymbolID, SymbolSchema } from '../types/index.js';

// ============================================================
// Constants
// ============================================================

/** Configuration key for enabling/disabling completion provider */
const CONFIG_COMPLETION_ENABLED = 'gendocs.completion.enabled';

/** Maximum number of completion items to return */
const MAX_COMPLETIONS = 10;

/** Trigger characters for documentation completions */
const TRIGGER_CHARACTERS = ['.', '(', '<'];

// ============================================================
// Types
// ============================================================

/**
 * Cached documentation data for a workspace.
 */
interface DocCache {
    readonly schemas: Map<FileURI, ModuleSchema>;
    readonly symbolIndex: Map<SymbolID, SymbolSchema>;
}

// ============================================================
// Documentation Cache
// ============================================================

/** Global documentation cache */
let docCache: DocCache = {
    schemas: new Map(),
    symbolIndex: new Map(),
};

/**
 * Updates the documentation cache with new schema data.
 *
 * @param uri - The file URI to associate with the schema
 * @param schema - The module schema containing symbol definitions
 * @returns void
 */
export function updateDocCache(uri: FileURI, schema: ModuleSchema): void {
    docCache.schemas.set(uri, schema);

    // Index all symbols for quick lookup
    if (schema.definitions) {
        for (const [id, symbolSchema] of Object.entries(schema.definitions)) {
            const symbol = symbolSchema as SymbolSchema;
            docCache.symbolIndex.set(id as SymbolID, symbol);
            // Also index by name for easier lookup
            if (symbol.name) {
                docCache.symbolIndex.set(symbol.name as SymbolID, symbol);
            }
        }
    }
}

/**
 * Clears the documentation cache.
 *
 * @returns void
 */
export function clearDocCache(): void {
    docCache = {
        schemas: new Map(),
        symbolIndex: new Map(),
    };
}

// ============================================================
// Symbol Relevance
// ============================================================

/**
 * Calculates relevance score for a symbol relative to cursor position.
 * Higher scores indicate more relevant symbols.
 */
function calculateRelevance(
    symbol: SymbolSchema,
    document: vscode.TextDocument,
    position: vscode.Position
): number {
    let score = 0;

    // Boost symbols from the same file
    if (symbol.source?.uri === document.uri.toString()) {
        score += 100;
    }

    // Boost symbols near the cursor
    if (symbol.source?.range) {
        const symbolLine = symbol.source.range.start.line;
        const distance = Math.abs(symbolLine - position.line);
        score += Math.max(0, 50 - distance);
    }

    // Boost symbols without 'deprecated' modifier
    const isNotDeprecated = !symbol.modifiers.some(m => m === 'deprecated');
    if (isNotDeprecated) {
        score += 20;
    }

    // Boost functions and classes (more commonly needed)
    if (symbol.kind === 'function' || symbol.kind === 'class') {
        score += 10;
    }

    return score;
}

/**
 * Gets symbols relevant to the current cursor position.
 */
function getRelevantSymbols(
    document: vscode.TextDocument,
    position: vscode.Position,
    prefix: string
): SymbolSchema[] {
    const symbols: Array<{ symbol: SymbolSchema; score: number }> = [];

    for (const symbol of docCache.symbolIndex.values()) {
        // Filter by prefix if provided
        if (prefix && !symbol.name.toLowerCase().startsWith(prefix.toLowerCase())) {
            continue;
        }

        const score = calculateRelevance(symbol, document, position);
        symbols.push({ symbol, score });
    }

    // Sort by relevance and take top results
    return symbols
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_COMPLETIONS)
        .map(s => s.symbol);
}

// ============================================================
// Completion Item Creation
// ============================================================

/**
 * Creates a completion item from a symbol schema.
 */
function createCompletionItem(symbol: SymbolSchema): vscode.CompletionItem {
    const kind = mapSymbolKindToCompletionKind(symbol.kind);
    const item = new vscode.CompletionItem(symbol.name, kind);

    // Set detail to signature
    if (symbol.signature) {
        item.detail = symbol.signature;
    }

    // Set documentation from schema
    const docs = new vscode.MarkdownString();

    if (symbol.description) {
        docs.appendMarkdown(symbol.description);
        docs.appendMarkdown('\n\n');
    }

    if (symbol.summary) {
        docs.appendMarkdown(`*${symbol.summary}*\n\n`);
    }

    if (symbol.parameters && symbol.parameters.length > 0) {
        docs.appendMarkdown('**Parameters:**\n');
        for (const param of symbol.parameters) {
            const desc = param.description || '';
            docs.appendMarkdown(`- \`${param.name}\`: ${param.type?.raw || 'unknown'} ${desc}\n`);
        }
        docs.appendMarkdown('\n');
    }

    if (symbol.returnType) {
        docs.appendMarkdown(`**Returns:** \`${symbol.returnType.raw}\`\n`);
    }

    item.documentation = docs;

    // Add sort text to prioritize documented symbols
    item.sortText = symbol.description ? `0_${symbol.name}` : `1_${symbol.name}`;

    return item;
}

/**
 * Maps symbol kind to VS Code completion item kind.
 */
function mapSymbolKindToCompletionKind(kind: string): vscode.CompletionItemKind {
    switch (kind) {
        case 'function':
        case 'method':
            return vscode.CompletionItemKind.Function;
        case 'class':
            return vscode.CompletionItemKind.Class;
        case 'interface':
            return vscode.CompletionItemKind.Interface;
        case 'type':
            return vscode.CompletionItemKind.TypeParameter;
        case 'enum':
            return vscode.CompletionItemKind.Enum;
        case 'property':
        case 'field':
            return vscode.CompletionItemKind.Property;
        case 'variable':
            return vscode.CompletionItemKind.Variable;
        case 'constant':
            return vscode.CompletionItemKind.Constant;
        case 'module':
        case 'namespace':
            return vscode.CompletionItemKind.Module;
        default:
            return vscode.CompletionItemKind.Text;
    }
}

// ============================================================
// Completion Provider
// ============================================================

/**
 * Completion provider that surfaces GenDocs documentation context.
 * Prioritizes symbols near the cursor and provides rich documentation.
 *
 * @implements vscode.CompletionItemProvider
 */
export class GenDocsCompletionProvider implements vscode.CompletionItemProvider {
    /**
     * Provides completion items with documentation context.
     *
     * @param document - The text document in which the completion was requested
     * @param position - The position at which the completion was requested
     * @param _token - A cancellation token
     * @param _context - Additional context about the completion request
     * @returns Array of completion items with documentation
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        // Check if completion is enabled
        const config = vscode.workspace.getConfiguration();
        const enabled = config.get<boolean>(CONFIG_COMPLETION_ENABLED, true);
        if (!enabled) {
            return [];
        }

        // Get the word prefix at cursor
        const wordRange = document.getWordRangeAtPosition(position);
        const prefix = wordRange ? document.getText(wordRange) : '';

        // Get relevant symbols
        const symbols = getRelevantSymbols(document, position, prefix);

        // Create completion items
        return symbols.map(createCompletionItem);
    }

    /**
     * Resolves additional details for a completion item.
     *
     * @param item - The completion item to resolve
     * @param _token - A cancellation token
     * @returns The resolved completion item with additional details
     */
    resolveCompletionItem(
        item: vscode.CompletionItem,
        _token: vscode.CancellationToken
    ): vscode.CompletionItem {
        // Item is already fully populated
        return item;
    }
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers the completion provider.
 * Returns disposables that should be added to the extension context.
 *
 * @param context - The VS Code extension context for managing subscriptions
 * @returns The registered completion provider instance
 */
export function registerCompletionProvider(
    context: vscode.ExtensionContext
): GenDocsCompletionProvider {
    const provider = new GenDocsCompletionProvider();

    // Register for common programming languages
    const selector: vscode.DocumentSelector = [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' },
        { scheme: 'file', language: 'python' },
        { scheme: 'file', language: 'rust' },
        { scheme: 'file', language: 'go' },
        { scheme: 'file', language: 'java' },
        { scheme: 'file', language: 'csharp' },
        { scheme: 'file', language: 'haskell' },
    ];

    const disposable = vscode.languages.registerCompletionItemProvider(
        selector,
        provider,
        ...TRIGGER_CHARACTERS
    );

    context.subscriptions.push(disposable);

    return provider;
}
