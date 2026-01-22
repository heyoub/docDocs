/**
 * @fileoverview LSP-based symbol extraction for GenDocs extension.
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
    executeWithTimeout,
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
 * Converts a VS Code DocumentSymbol to our ExtractedSymbol type.
 */
async function convertDocumentSymbol(
    symbol: vscode.DocumentSymbol,
    uri: vscode.Uri,
    parentName?: string
): Promise<ExtractedSymbol> {
    const fileUri = uri.toString() as FileURI;
    const symbolId = generateSymbolId(fileUri, symbol.name, parentName);

    const hover = await executeWithRetry<vscode.Hover>(
        'vscode.executeHoverProvider',
        [uri, symbol.selectionRange.start],
        DEFAULT_TIMEOUT_MS
    );

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
 * @returns Promise resolving to array of extracted symbols
 */
export async function extractSymbols(uri: vscode.Uri): AsyncResult<readonly ExtractedSymbol[], LSPError> {
    const symbols = await executeWithRetry<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        [uri]
    );

    if (!symbols) {
        return { ok: true, value: [] };
    }

    const extracted: ExtractedSymbol[] = [];
    for (const symbol of symbols) {
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
 * @returns Promise resolving to hover info or null if unavailable
 */
export async function extractHover(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<HoverInfo | null, LSPError> {
    const hover = await executeWithRetry<vscode.Hover>(
        'vscode.executeHoverProvider',
        [uri, toVSCodePosition(pos)]
    );

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
 * @returns Promise resolving to array of references
 */
export async function extractReferences(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<readonly Reference[], LSPError> {
    const locations = await executeWithRetry<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        [uri, toVSCodePosition(pos)]
    );

    if (!locations) {
        return { ok: true, value: [] };
    }

    const references: Reference[] = locations.map(loc => ({
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
 * @returns Promise resolving to array of call hierarchy items
 */
export async function extractCallHierarchy(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<readonly CallHierarchyItem[], LSPError> {
    const items = await executeWithRetry<vscode.CallHierarchyItem[]>(
        'vscode.prepareCallHierarchy',
        [uri, toVSCodePosition(pos)]
    );

    if (!items) {
        return { ok: true, value: [] };
    }

    const converted: CallHierarchyItem[] = items.map(item => ({
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
 * @returns Promise resolving to array of incoming call items
 */
export async function extractIncomingCalls(
    item: vscode.CallHierarchyItem
): AsyncResult<readonly CallHierarchyItem[], LSPError> {
    const calls = await executeWithRetry<vscode.CallHierarchyIncomingCall[]>(
        'vscode.provideIncomingCalls',
        [item]
    );

    if (!calls) {
        return { ok: true, value: [] };
    }

    const converted: CallHierarchyItem[] = calls.map(call => ({
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
 * @returns Promise resolving to array of outgoing call items
 */
export async function extractOutgoingCalls(
    item: vscode.CallHierarchyItem
): AsyncResult<readonly CallHierarchyItem[], LSPError> {
    const calls = await executeWithRetry<vscode.CallHierarchyOutgoingCall[]>(
        'vscode.provideOutgoingCalls',
        [item]
    );

    if (!calls) {
        return { ok: true, value: [] };
    }

    const converted: CallHierarchyItem[] = calls.map(call => ({
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
 * @returns Promise resolving to array of semantic tokens
 */
export async function extractSemanticTokens(
    uri: vscode.Uri
): AsyncResult<readonly SemanticToken[], LSPError> {
    const result = await executeWithRetry<vscode.SemanticTokens>(
        'vscode.provideDocumentSemanticTokens',
        [uri]
    );

    if (!result || !result.data || result.data.length === 0) {
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
    try {
        const symbols = await executeWithTimeout<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            [uri],
            2000
        );
        return symbols !== null;
    } catch {
        return false;
    }
}
