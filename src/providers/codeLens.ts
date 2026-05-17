/**
 * @fileoverview CodeLens provider for docDocs extension.
 * Displays "Generate Docs", "View Docs", and "Docs Stale - Regenerate" actions
 * above exported symbols in source files.
 *
 * @module providers/codeLens
 * @requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import * as vscode from 'vscode';
import type { ExtractedSymbol, FileURI } from '../types/index.js';
import { extractSymbols, formatLSPError } from '../core/extractor/lsp.js';
import { checkFreshness } from '../state/freshness.js';
import { contentHash } from '../utils/hash.js';

// ============================================================
// Constants
// ============================================================

/** Configuration key for enabling/disabling CodeLens */
const CONFIG_CODELENS_ENABLED = 'docdocs.codeLens.enabled';

/** Command IDs for CodeLens actions */
const COMMAND_GENERATE_DOCS = 'docdocs.generateDocsForSymbol';
const COMMAND_VIEW_DOCS = 'docdocs.viewDocsForSymbol';
const COMMAND_CHECK_FRESHNESS = 'docdocs.checkFreshnessForSymbol';

// ============================================================
// Types
// ============================================================

type CodeLensDiagnosticReporter = (uri: FileURI, message: string) => void;

let reportCodeLensDiagnostic: CodeLensDiagnosticReporter | undefined;
let clearCodeLensDiagnostic: ((uri: FileURI) => void) | undefined;

/**
 * Registers optional callbacks for CodeLens extraction failures (Problems panel).
 */
export function registerCodeLensDiagnostics(
    report: CodeLensDiagnosticReporter,
    clear?: (uri: FileURI) => void
): void {
    reportCodeLensDiagnostic = report;
    clearCodeLensDiagnostic = clear;
}

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
 * Checks if an extracted symbol is exported (public API surface).
 */
function isExportedSymbol(symbol: ExtractedSymbol): boolean {
    const exportableKinds = new Set([
        'class',
        'interface',
        'enum',
        'function',
        'constant',
        'variable',
        'type',
        'module',
        'namespace',
    ]);
    return exportableKinds.has(symbol.kind);
}

/**
 * Converts an extracted symbol range to a VS Code Range.
 */
function toVSCodeRange(symbol: ExtractedSymbol): vscode.Range {
    const { start, end } = symbol.location.range;
    return new vscode.Range(start.line, start.character, end.line, end.character);
}

/**
 * Extracts top-level exported symbols via the shared LSP Result pipeline.
 */
async function getExportedSymbols(
    document: vscode.TextDocument
): Promise<readonly ExtractedSymbol[]> {
    const uri = document.uri.toString() as FileURI;
    const result = await extractSymbols(document.uri);
    if (!result.ok) {
        const message = formatLSPError(result.error);
        if (reportCodeLensDiagnostic) {
            reportCodeLensDiagnostic(uri, message);
        } else {
            console.warn(`[docDocs] CodeLens: ${message}`);
        }
        return [];
    }
    clearCodeLensDiagnostic?.(uri);
    return result.value.filter(isExportedSymbol);
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
    symbol: ExtractedSymbol,
    uri: vscode.Uri
): vscode.CodeLens {
    const range = toVSCodeRange(symbol);
    const data: CodeLensData = {
        uri: uri.toString(),
        symbolName: symbol.name,
        symbolKind: symbol.kind,
        range,
    };

    return new vscode.CodeLens(range, {
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
    symbol: ExtractedSymbol,
    uri: vscode.Uri
): vscode.CodeLens {
    const range = toVSCodeRange(symbol);
    const data: CodeLensData = {
        uri: uri.toString(),
        symbolName: symbol.name,
        symbolKind: symbol.kind,
        range,
    };

    return new vscode.CodeLens(range, {
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
    symbol: ExtractedSymbol,
    uri: vscode.Uri
): vscode.CodeLens {
    const range = toVSCodeRange(symbol);
    const data: CodeLensData = {
        uri: uri.toString(),
        symbolName: symbol.name,
        symbolKind: symbol.kind,
        range,
    };

    return new vscode.CodeLens(range, {
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
 * CodeLens provider for docDocs documentation actions.
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
        const config = vscode.workspace.getConfiguration();
        const enabled = config.get<boolean>(CONFIG_CODELENS_ENABLED, true);
        if (!enabled) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];
        const uri = document.uri.toString() as FileURI;

        const symbols = await getExportedSymbols(document);
        if (symbols.length === 0) {
            return [];
        }

        const hasDocs = hasDocumentation(uri);
        const isStale = hasDocs && await isDocumentationStale(document);

        for (const symbol of symbols) {
            if (hasDocs) {
                if (isStale) {
                    lenses.push(createStaleLens(symbol, document.uri));
                } else {
                    lenses.push(createViewDocsLens(symbol, document.uri));
                }
            } else {
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

    const providerDisposable = vscode.languages.registerCodeLensProvider(
        selector,
        provider
    );

    const generateCommand = vscode.commands.registerCommand(
        COMMAND_GENERATE_DOCS,
        async (data: CodeLensData) => {
            await vscode.commands.executeCommand(
                'docdocs.generateFile',
                vscode.Uri.parse(data.uri),
                data.symbolName
            );
            provider.refresh();
        }
    );

    const viewCommand = vscode.commands.registerCommand(
        COMMAND_VIEW_DOCS,
        async (data: CodeLensData) => {
            await vscode.commands.executeCommand(
                'docdocs.preview',
                vscode.Uri.parse(data.uri),
                data.symbolName
            );
        }
    );

    const freshnessCommand = vscode.commands.registerCommand(
        COMMAND_CHECK_FRESHNESS,
        async (data: CodeLensData) => {
            await vscode.commands.executeCommand(
                'docdocs.checkFreshness',
                vscode.Uri.parse(data.uri)
            );
            provider.refresh();
        }
    );

    context.subscriptions.push(providerDisposable, generateCommand, viewCommand, freshnessCommand, provider);

    return provider;
}
