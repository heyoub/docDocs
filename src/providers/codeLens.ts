/**
 * @fileoverview CodeLens provider for GenDocs extension.
 * Displays "Generate Docs", "View Docs", and "Docs Stale - Regenerate" actions
 * above exported symbols in source files.
 *
 * @module providers/codeLens
 * @requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import * as vscode from 'vscode';
import type { FileURI } from '../types/index.js';
import { checkFreshness } from '../state/freshness.js';
import { contentHash } from '../utils/hash.js';

// ============================================================
// Constants
// ============================================================

/** Configuration key for enabling/disabling CodeLens */
const CONFIG_CODELENS_ENABLED = 'gendocs.codeLens.enabled';

/** Command IDs for CodeLens actions */
const COMMAND_GENERATE_DOCS = 'gendocs.generateDocsForSymbol';
const COMMAND_VIEW_DOCS = 'gendocs.viewDocsForSymbol';

// ============================================================
// Types
// ============================================================

/**
 * Data attached to CodeLens items for command execution.
 */
interface CodeLensData {
    readonly uri: string;
    readonly symbolName: string;
    readonly symbolKind: string;
    readonly range: vscode.Range;
}

// ============================================================
// Symbol Detection
// ============================================================

/**
 * Checks if a VS Code symbol is exported (public API surface).
 * Uses naming conventions and symbol kind to determine export status.
 */
function isExportedSymbol(symbol: vscode.DocumentSymbol): boolean {
    // Classes, interfaces, enums, and functions at module level are typically exported
    const exportableKinds = new Set([
        vscode.SymbolKind.Class,
        vscode.SymbolKind.Interface,
        vscode.SymbolKind.Enum,
        vscode.SymbolKind.Function,
        vscode.SymbolKind.Constant,
        vscode.SymbolKind.Variable,
        vscode.SymbolKind.TypeParameter,
    ]);

    return exportableKinds.has(symbol.kind);
}

/**
 * Extracts top-level exported symbols from a document.
 * Uses VS Code's document symbol provider for accurate symbol detection.
 */
async function getExportedSymbols(
    document: vscode.TextDocument
): Promise<vscode.DocumentSymbol[]> {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
    );

    if (!symbols) {
        return [];
    }

    // Filter to exported symbols at the top level
    return symbols.filter(isExportedSymbol);
}

// ============================================================
// Documentation Status
// ============================================================

/**
 * Checks if documentation exists for a file.
 * Currently checks at file level - per-symbol tracking is a future enhancement.
 * Returns true if documentation has been generated for this file.
 */
function hasDocumentation(uri: FileURI): boolean {
    const status = checkFreshness(uri);
    return status.status !== 'unknown';
}

/**
 * Checks if documentation is stale for a file.
 */
async function isDocumentationStale(
    document: vscode.TextDocument
): Promise<boolean> {
    const uri = document.uri.toString() as FileURI;
    const content = document.getText();
    const currentHash = await contentHash(content);
    const status = checkFreshness(uri, currentHash);
    return status.status === 'stale';
}

// ============================================================
// CodeLens Creation
// ============================================================

/**
 * Creates a "Generate Docs" CodeLens for a symbol.
 */
function createGenerateDocsLens(
    symbol: vscode.DocumentSymbol,
    uri: vscode.Uri
): vscode.CodeLens {
    const data: CodeLensData = {
        uri: uri.toString(),
        symbolName: symbol.name,
        symbolKind: vscode.SymbolKind[symbol.kind],
        range: symbol.range,
    };

    return new vscode.CodeLens(symbol.range, {
        title: '$(book) Generate Docs',
        command: COMMAND_GENERATE_DOCS,
        arguments: [data],
        tooltip: `Generate documentation for ${symbol.name}`,
    });
}

/**
 * Creates a "View Docs" CodeLens for a symbol.
 */
function createViewDocsLens(
    symbol: vscode.DocumentSymbol,
    uri: vscode.Uri
): vscode.CodeLens {
    const data: CodeLensData = {
        uri: uri.toString(),
        symbolName: symbol.name,
        symbolKind: vscode.SymbolKind[symbol.kind],
        range: symbol.range,
    };

    return new vscode.CodeLens(symbol.range, {
        title: '$(eye) View Docs',
        command: COMMAND_VIEW_DOCS,
        arguments: [data],
        tooltip: `View documentation for ${symbol.name}`,
    });
}

/**
 * Creates a "Docs Stale - Regenerate" CodeLens for a symbol.
 */
function createStaleLens(
    symbol: vscode.DocumentSymbol,
    uri: vscode.Uri
): vscode.CodeLens {
    const data: CodeLensData = {
        uri: uri.toString(),
        symbolName: symbol.name,
        symbolKind: vscode.SymbolKind[symbol.kind],
        range: symbol.range,
    };

    return new vscode.CodeLens(symbol.range, {
        title: '$(warning) Docs Stale - Regenerate',
        command: COMMAND_GENERATE_DOCS,
        arguments: [data],
        tooltip: `Documentation is out of date. Click to regenerate for ${symbol.name}`,
    });
}

// ============================================================
// CodeLens Provider
// ============================================================

/**
 * CodeLens provider for GenDocs documentation actions.
 * Displays "Generate Docs", "View Docs", and "Docs Stale" lenses
 * above exported symbols in source files.
 *
 * @implements vscode.CodeLensProvider
 */
export class GenDocsCodeLensProvider implements vscode.CodeLensProvider {
    private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    /**
     * Provides CodeLens items for a document.
     * Shows "Generate Docs" for symbols without docs,
     * "View Docs" for symbols with fresh docs,
     * and "Docs Stale - Regenerate" for symbols with stale docs.
     */
    async provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        // Check if CodeLens is enabled in settings
        const config = vscode.workspace.getConfiguration();
        const enabled = config.get<boolean>(CONFIG_CODELENS_ENABLED, true);
        if (!enabled) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];
        const uri = document.uri.toString() as FileURI;

        // Get exported symbols from the document
        const symbols = await getExportedSymbols(document);
        if (symbols.length === 0) {
            return [];
        }

        // Check documentation status
        const hasDocs = hasDocumentation(uri);
        const isStale = hasDocs && await isDocumentationStale(document);

        // Create CodeLens for each exported symbol
        for (const symbol of symbols) {
            if (hasDocs) {
                if (isStale) {
                    // Documentation exists but is stale
                    lenses.push(createStaleLens(symbol, document.uri));
                } else {
                    // Documentation exists and is fresh - show View Docs
                    lenses.push(createViewDocsLens(symbol, document.uri));
                }
            } else {
                // No documentation - show Generate Docs
                lenses.push(createGenerateDocsLens(symbol, document.uri));
            }
        }

        return lenses;
    }

    /**
     * Resolves a CodeLens item (no-op as we provide commands upfront).
     */
    resolveCodeLens(
        codeLens: vscode.CodeLens,
        _token: vscode.CancellationToken
    ): vscode.CodeLens {
        return codeLens;
    }

    /**
     * Triggers a refresh of all CodeLens items.
     * Call this when documentation status changes.
     */
    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Disposes of the provider resources.
     */
    dispose(): void {
        this._onDidChangeCodeLenses.dispose();
    }
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers the CodeLens provider and associated commands.
 * Returns disposables that should be added to the extension context.
 *
 * @param context - Extension context for registering disposables
 * @returns The CodeLens provider instance for external refresh triggers
 */
export function registerCodeLensProvider(
    context: vscode.ExtensionContext
): GenDocsCodeLensProvider {
    const provider = new GenDocsCodeLensProvider();

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

    // Register the CodeLens provider
    const providerDisposable = vscode.languages.registerCodeLensProvider(
        selector,
        provider
    );

    // Register the Generate Docs command
    const generateCommand = vscode.commands.registerCommand(
        COMMAND_GENERATE_DOCS,
        async (data: CodeLensData) => {
            await vscode.commands.executeCommand(
                'gendocs.generateDocumentation',
                vscode.Uri.parse(data.uri),
                data.symbolName
            );
            provider.refresh();
        }
    );

    // Register the View Docs command
    const viewCommand = vscode.commands.registerCommand(
        COMMAND_VIEW_DOCS,
        async (data: CodeLensData) => {
            await vscode.commands.executeCommand(
                'gendocs.previewDocumentation',
                vscode.Uri.parse(data.uri),
                data.symbolName
            );
        }
    );

    // Add all disposables to context
    context.subscriptions.push(providerDisposable, generateCommand, viewCommand, provider);

    return provider;
}
