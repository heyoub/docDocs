/**
 * @fileoverview Workspace symbol provider for docDocs extension.
 * Provides documented symbols in the workspace symbol search with doc icons.
 *
 * @module providers/symbols
 * @requirements 33.1, 33.2, 33.3, 33.4, 33.5
 */

import * as vscode from 'vscode';
import type { FileURI, ModuleSchema, SymbolSchema, SymbolKind } from '../types/index.js';
import { formatExtractionError } from '../types/index.js';
import { buildModuleSchema } from '../core/pipeline/buildModuleSchema.js';
import { indexSchemaInProviders } from '../core/pipeline/indexGeneratedSchema.js';
import { getStore } from '../state/freshness.js';

// ============================================================
// Constants
// ============================================================

/** Prefix for documented symbols in search results */
const DOC_ICON_PREFIX = '📖 ';

// ============================================================
// Types
// ============================================================

/**
 * Cached documentation data for workspace symbol search.
 */
interface SymbolCache {
    readonly schemas: Map<FileURI, ModuleSchema>;
    readonly allSymbols: SymbolSchema[];
}

// ============================================================
// Symbol Cache
// ============================================================

/** Global symbol cache */
let symbolCache: SymbolCache = {
    schemas: new Map(),
    allSymbols: [],
};

/** In-flight schema loads keyed by file URI (dedupe parallel workspace symbol queries) */
const schemaLoadInFlight = new Map<FileURI, Promise<void>>();

/**
 * Updates the symbol cache with new schema data.
 */
export function updateSymbolCache(uri: FileURI, schema: ModuleSchema): void {
    symbolCache.schemas.set(uri, schema);
    rebuildSymbolIndex();
}

/**
 * Clears the symbol cache.
 */
export function clearSymbolCache(): void {
    symbolCache = {
        schemas: new Map(),
        allSymbols: [],
    };
    schemaLoadInFlight.clear();
}

/**
 * Rebuilds the flat symbol index from all cached schemas.
 */
/**
 * Gets language ID from file extension (for live schema extraction).
 */
function getLanguageId(uri: vscode.Uri): string {
    const ext = uri.fsPath.split('.').pop() ?? '';
    const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescriptreact',
        js: 'javascript', jsx: 'javascriptreact',
        py: 'python', rs: 'rust', go: 'go', hs: 'haskell',
    };
    return langMap[ext] ?? ext;
}

/**
 * Loads a module schema into provider caches when missing (freshness store entries only).
 */
async function loadSchemaIntoCache(
    fileUri: FileURI,
    token: vscode.CancellationToken
): Promise<void> {
    if (symbolCache.schemas.has(fileUri)) {
        return;
    }

    if (token.isCancellationRequested) {
        return;
    }

    const vscodeUri = vscode.Uri.parse(fileUri);
    const folder = vscode.workspace.getWorkspaceFolder(vscodeUri);
    if (!folder) {
        return;
    }

    const result = await buildModuleSchema(vscodeUri, getLanguageId(vscodeUri));
    if (!result.ok) {
        console.warn(`[docDocs] Symbols: ${formatExtractionError(result.error)}`);
        return;
    }

    indexSchemaInProviders(fileUri, result.value);
}

/**
 * Ensures provider caches include schemas for files tracked in the freshness store.
 */
async function ensureSymbolCacheForDocumentedFiles(
    token: vscode.CancellationToken
): Promise<void> {
    const documentedUris = Object.keys(getStore().files) as FileURI[];
    const uncached = documentedUris.filter(uri => !symbolCache.schemas.has(uri));
    if (uncached.length === 0) {
        return;
    }

    await Promise.all(
        uncached.map(async (fileUri) => {
            let load = schemaLoadInFlight.get(fileUri);
            if (!load) {
                load = loadSchemaIntoCache(fileUri, token).finally(() => {
                    schemaLoadInFlight.delete(fileUri);
                });
                schemaLoadInFlight.set(fileUri, load);
            }
            await load;
        })
    );
}

function rebuildSymbolIndex(): void {
    const symbols: SymbolSchema[] = [];

    for (const schema of symbolCache.schemas.values()) {
        if (schema.definitions) {
            for (const symbolSchema of Object.values(schema.definitions)) {
                symbols.push(symbolSchema);
            }
        }
    }

    symbolCache = {
        ...symbolCache,
        allSymbols: symbols,
    };
}

// ============================================================
// Symbol Matching
// ============================================================

/**
 * Checks if a symbol matches the search query.
 * Uses fuzzy matching on symbol name.
 */
function matchesQuery(symbol: SymbolSchema, query: string): boolean {
    if (!query) return true;

    const lowerQuery = query.toLowerCase();
    const lowerName = symbol.name.toLowerCase();

    // Exact prefix match
    if (lowerName.startsWith(lowerQuery)) return true;

    // Contains match
    if (lowerName.includes(lowerQuery)) return true;

    // Fuzzy match (all query chars appear in order)
    let queryIdx = 0;
    for (const char of lowerName) {
        if (char === lowerQuery[queryIdx]) {
            queryIdx++;
            if (queryIdx === lowerQuery.length) return true;
        }
    }

    return false;
}

// ============================================================
// Symbol Kind Mapping
// ============================================================

/**
 * Maps GenDocs symbol kind to VS Code symbol kind.
 */
function mapSymbolKind(kind: SymbolKind): vscode.SymbolKind {
    switch (kind) {
        case 'module':
            return vscode.SymbolKind.Module;
        case 'namespace':
            return vscode.SymbolKind.Namespace;
        case 'class':
            return vscode.SymbolKind.Class;
        case 'interface':
            return vscode.SymbolKind.Interface;
        case 'type':
            return vscode.SymbolKind.TypeParameter;
        case 'enum':
            return vscode.SymbolKind.Enum;
        case 'function':
            return vscode.SymbolKind.Function;
        case 'method':
            return vscode.SymbolKind.Method;
        case 'property':
            return vscode.SymbolKind.Property;
        case 'variable':
            return vscode.SymbolKind.Variable;
        case 'constant':
            return vscode.SymbolKind.Constant;
        case 'constructor':
            return vscode.SymbolKind.Constructor;
        case 'field':
            return vscode.SymbolKind.Field;
        case 'event':
            return vscode.SymbolKind.Event;
        default:
            return vscode.SymbolKind.Variable;
    }
}

// ============================================================
// Symbol Information Creation
// ============================================================

/**
 * Creates a VS Code SymbolInformation from a SymbolSchema.
 */
function createSymbolInformation(symbol: SymbolSchema): vscode.SymbolInformation {
    const kind = mapSymbolKind(symbol.kind);
    const name = DOC_ICON_PREFIX + symbol.name;

    const location = new vscode.Location(
        vscode.Uri.parse(symbol.source.uri),
        new vscode.Range(
            symbol.source.range.start.line,
            symbol.source.range.start.character,
            symbol.source.range.end.line,
            symbol.source.range.end.character
        )
    );

    return new vscode.SymbolInformation(
        name,
        kind,
        symbol.qualifiedName,
        location
    );
}

// ============================================================
// Workspace Symbol Provider
// ============================================================

/**
 * Workspace symbol provider for documented symbols.
 * Prefixes documented symbols with a doc icon for easy identification.
 *
 * @implements vscode.WorkspaceSymbolProvider
 */
export class GenDocsWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
    /**
     * Provides workspace symbols matching the query.
     * Lazily builds schemas for files in the freshness store on cache miss.
     */
    async provideWorkspaceSymbols(
        query: string,
        token: vscode.CancellationToken
    ): Promise<vscode.SymbolInformation[]> {
        await ensureSymbolCacheForDocumentedFiles(token);

        if (token.isCancellationRequested) {
            return [];
        }

        const matchingSymbols = symbolCache.allSymbols
            .filter(s => matchesQuery(s, query))
            .slice(0, 50); // Limit results

        return matchingSymbols.map(createSymbolInformation);
    }

    /**
     * Resolves additional details for a symbol.
     * Opens documentation when symbol is selected.
     */
    resolveWorkspaceSymbol(
        symbol: vscode.SymbolInformation,
        _token: vscode.CancellationToken
    ): vscode.SymbolInformation {
        // Symbol is already fully resolved
        return symbol;
    }
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers the workspace symbol provider.
 * Returns the provider instance for external updates.
 */
export function registerWorkspaceSymbolProvider(
    context: vscode.ExtensionContext
): GenDocsWorkspaceSymbolProvider {
    const provider = new GenDocsWorkspaceSymbolProvider();

    const disposable = vscode.languages.registerWorkspaceSymbolProvider(provider);
    context.subscriptions.push(disposable);

    return provider;
}
