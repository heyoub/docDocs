/**
 * @fileoverview LSP-based symbol extraction for docDocs extension.
 * This module wraps VS Code's LSP commands to extract symbols, hover info,
 * references, call hierarchy, and semantic tokens from source files.
 * Layer 3 - imports from types/ (Layer 0) and uses VS Code API.
 *
 * @module core/extractor/lsp
 */

import * as vscode from 'vscode';
import type { FileURI, Position, AsyncResult } from '../../types/base.js';
import type { ExtractedSymbol } from '../../types/extraction.js';
import type {
    HoverInfo,
    Reference,
    CallHierarchyItem,
    SemanticToken,
    LSPError
} from './lspTypes.js';
import {
    DEFAULT_TIMEOUT_MS,
    executeWithRetry,
    convertRange,
    toVSCodePosition,
    convertSymbolKind,
    generateSymbolId,
    extractDocumentation,
    extractSignature,
    getDefaultSemanticTokensLegend
} from './lspHelpers.js';

// Re-export types for convenience
export type {
    HoverInfo,
    Reference,
    CallHierarchyItem,
    SemanticToken,
    SignatureInfo,
    InlayHintInfo,
    LSPError
} from './lspTypes.js';
export { formatLSPError } from './lspTypes.js';

// Re-export extended functions
export {
    extractTypeDefinition,
    extractDefinition,
    extractImplementations,
    extractSignatureHelp,
    extractInlayHints
} from './lspExtended.js';

// ============================================================
// Symbol Conversion
// ============================================================

/**
 * Resolves hover for a symbol; hover enrichment failures do not fail symbol extraction.
 */
async function resolveHover(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Hover | null> {
    const hoverResult = await executeWithRetry<vscode.Hover>(
        'vscode.executeHoverProvider',
        [uri, position],
        DEFAULT_TIMEOUT_MS,
        'allow'
    );
    if (!hoverResult.ok) {
        return null;
    }
    return hoverResult.value ?? null;
}

/**
 * Converts a VS Code DocumentSymbol to our ExtractedSymbol type.
 */
async function convertDocumentSymbol(
    symbol: vscode.DocumentSymbol,
    uri: vscode.Uri,
    parentName?: string
): Promise<ExtractedSymbol> {
    const fileUri = uri.toString() as FileURI;
    const symbolId = generateSymbolId(fileUri, symbol.name, parentName);

    const hover = await resolveHover(uri, symbol.selectionRange.start);
    const documentation = extractDocumentation(hover);
    const signature = extractSignature(hover, symbol.name);

    const children: ExtractedSymbol[] = [];
    if (symbol.children && symbol.children.length > 0) {
        for (const child of symbol.children) {
            const convertedChild = await convertDocumentSymbol(child, uri, symbol.name);
            children.push(convertedChild);
        }
    }

    return {
        id: symbolId,
        name: symbol.name,
        kind: convertSymbolKind(symbol.kind),
        location: { uri: fileUri, range: convertRange(symbol.range) },
        modifiers: [],
        visibility: 'public',
        signature,
        documentation,
        children
    };
}

// ============================================================
// Public API - Core Extraction Functions
// ============================================================

/**
 * Extracts all symbols from a document using LSP.
 * Uses vscode.executeDocumentSymbolProvider to retrieve symbols.
 *
 * @param uri - The URI of the document to extract symbols from
 * @returns Symbols on success; empty array when the document has no symbols;
 *          {@link LSPError} when the provider is unavailable or times out
 */
export async function extractSymbols(uri: vscode.Uri): AsyncResult<readonly ExtractedSymbol[], LSPError> {
    const symbolsResult = await executeWithRetry<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        [uri]
    );

    if (!symbolsResult.ok) {
        return symbolsResult;
    }

    const extracted: ExtractedSymbol[] = [];
    for (const symbol of symbolsResult.value) {
        const convertedSymbol = await convertDocumentSymbol(symbol, uri);
        extracted.push(convertedSymbol);
    }

    return { ok: true, value: extracted };
}

/**
 * Extracts hover information at a specific position.
 * Uses vscode.executeHoverProvider to retrieve hover data.
 *
 * @param uri - The URI of the document
 * @param pos - The position to get hover info for
 * @returns Hover info, `null` when no hover exists at the position, or {@link LSPError}
 */
export async function extractHover(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<HoverInfo | null, LSPError> {
    const hoverResult = await executeWithRetry<vscode.Hover>(
        'vscode.executeHoverProvider',
        [uri, toVSCodePosition(pos)],
        DEFAULT_TIMEOUT_MS,
        'allow'
    );

    if (!hoverResult.ok) {
        return hoverResult;
    }

    const hover = hoverResult.value ?? null;
    if (!hover) {
        return { ok: true, value: null };
    }

    return {
        ok: true,
        value: {
            contents: extractDocumentation(hover) ?? '',
            range: hover.range ? convertRange(hover.range) : null
        }
    };
}

/**
 * Extracts all references to a symbol at a specific position.
 * Uses vscode.executeReferenceProvider to find usages.
 *
 * @param uri - The URI of the document
 * @param pos - The position of the symbol to find references for
 * @returns References on success, empty array when none exist, or {@link LSPError}
 */
export async function extractReferences(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<readonly Reference[], LSPError> {
    const locationsResult = await executeWithRetry<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        [uri, toVSCodePosition(pos)]
    );

    if (!locationsResult.ok) {
        return locationsResult;
    }

    const references: Reference[] = locationsResult.value.map(loc => ({
        uri: loc.uri.toString() as FileURI,
        range: convertRange(loc.range)
    }));

    return { ok: true, value: references };
}

/**
 * Extracts call hierarchy items at a specific position.
 * Uses vscode.prepareCallHierarchy to get call hierarchy data.
 *
 * @param uri - The URI of the document
 * @param pos - The position of the symbol
 * @returns Call hierarchy items, empty array when none exist, or {@link LSPError}
 */
export async function extractCallHierarchy(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<readonly CallHierarchyItem[], LSPError> {
    const itemsResult = await executeWithRetry<vscode.CallHierarchyItem[]>(
        'vscode.prepareCallHierarchy',
        [uri, toVSCodePosition(pos)]
    );

    if (!itemsResult.ok) {
        return itemsResult;
    }

    const converted: CallHierarchyItem[] = itemsResult.value.map(item => ({
        name: item.name,
        kind: convertSymbolKind(item.kind),
        uri: item.uri.toString() as FileURI,
        range: convertRange(item.range),
        selectionRange: convertRange(item.selectionRange)
    }));

    return { ok: true, value: converted };
}

/**
 * Extracts incoming calls for a call hierarchy item.
 * Uses vscode.provideIncomingCalls to find callers.
 *
 * @param item - The call hierarchy item to get incoming calls for
 * @returns Incoming call items, empty array when none exist, or {@link LSPError}
 */
export async function extractIncomingCalls(
    item: vscode.CallHierarchyItem
): AsyncResult<readonly CallHierarchyItem[], LSPError> {
    const callsResult = await executeWithRetry<vscode.CallHierarchyIncomingCall[]>(
        'vscode.provideIncomingCalls',
        [item]
    );

    if (!callsResult.ok) {
        return callsResult;
    }

    const converted: CallHierarchyItem[] = callsResult.value.map(call => ({
        name: call.from.name,
        kind: convertSymbolKind(call.from.kind),
        uri: call.from.uri.toString() as FileURI,
        range: convertRange(call.from.range),
        selectionRange: convertRange(call.from.selectionRange)
    }));

    return { ok: true, value: converted };
}

/**
 * Extracts outgoing calls for a call hierarchy item.
 * Uses vscode.provideOutgoingCalls to find callees.
 *
 * @param item - The call hierarchy item to get outgoing calls for
 * @returns Outgoing call items, empty array when none exist, or {@link LSPError}
 */
export async function extractOutgoingCalls(
    item: vscode.CallHierarchyItem
): AsyncResult<readonly CallHierarchyItem[], LSPError> {
    const callsResult = await executeWithRetry<vscode.CallHierarchyOutgoingCall[]>(
        'vscode.provideOutgoingCalls',
        [item]
    );

    if (!callsResult.ok) {
        return callsResult;
    }

    const converted: CallHierarchyItem[] = callsResult.value.map(call => ({
        name: call.to.name,
        kind: convertSymbolKind(call.to.kind),
        uri: call.to.uri.toString() as FileURI,
        range: convertRange(call.to.range),
        selectionRange: convertRange(call.to.selectionRange)
    }));

    return { ok: true, value: converted };
}

/**
 * Extracts semantic tokens from a document.
 * Uses vscode.provideDocumentSemanticTokens to get token classifications.
 *
 * @param uri - The URI of the document to extract semantic tokens from
 * @returns Semantic tokens, empty array when none exist, or {@link LSPError}
 */
export async function extractSemanticTokens(
    uri: vscode.Uri
): AsyncResult<readonly SemanticToken[], LSPError> {
    const tokensResult = await executeWithRetry<vscode.SemanticTokens>(
        'vscode.provideDocumentSemanticTokens',
        [uri],
        DEFAULT_TIMEOUT_MS,
        'allow'
    );

    if (!tokensResult.ok) {
        return tokensResult;
    }

    const result = tokensResult.value;
    if (!result?.data || result.data.length === 0) {
        return { ok: true, value: [] };
    }

    const legend = getDefaultSemanticTokensLegend();
    const tokens: SemanticToken[] = [];
    const data = result.data;

    let line = 0;
    let startChar = 0;

    for (let i = 0; i < data.length; i += 5) {
        const deltaLine = data[i] ?? 0;
        const deltaStartChar = data[i + 1] ?? 0;
        const length = data[i + 2] ?? 0;
        const tokenTypeIndex = data[i + 3] ?? 0;
        const tokenModifiersBitset = data[i + 4] ?? 0;

        if (deltaLine > 0) {
            line += deltaLine;
            startChar = deltaStartChar;
        } else {
            startChar += deltaStartChar;
        }

        const tokenType = legend.tokenTypes[tokenTypeIndex] ?? 'unknown';
        const tokenModifiers: string[] = [];
        for (let bit = 0; bit < legend.tokenModifiers.length; bit++) {
            if (tokenModifiersBitset & (1 << bit)) {
                const modifier = legend.tokenModifiers[bit];
                if (modifier) {
                    tokenModifiers.push(modifier);
                }
            }
        }

        tokens.push({ line, startChar, length, tokenType, tokenModifiers });
    }

    return { ok: true, value: tokens };
}

/**
 * Checks if LSP is available for a document.
 * Returns true if the document has an active language server.
 *
 * @param uri - The URI of the document to check
 * @returns Promise resolving to true if LSP is available
 */
export async function isLSPAvailable(uri: vscode.Uri): Promise<boolean> {
    const result = await executeWithRetry<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        [uri],
        2000
    );
    return result.ok;
}
