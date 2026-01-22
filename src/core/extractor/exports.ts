/**
 * @fileoverview Export extraction for GenDocs extension.
 * This module extracts export information from source files using LSP
 * semantic tokens and document symbols.
 * Layer 3 - imports from types/ (Layer 0) and uses VS Code API.
 *
 * @module core/extractor/exports
 */

import * as vscode from 'vscode';
import type { AsyncResult } from '../../types/base.js';
import type { ExportInfo, ExtractedSymbol } from '../../types/extraction.js';
import type { LSPError, SemanticToken } from './lspTypes.js';
import { extractSemanticTokens } from './lsp.js';

// ============================================================
// Types
// ============================================================

/**
 * Result of export extraction.
 */
export interface ExportExtractionResult {
    /** All exports found in the file */
    readonly exports: readonly ExportInfo[];
    /** Names of symbols that have the export modifier */
    readonly exportedNames: ReadonlySet<string>;
}

// ============================================================
// Semantic Token Analysis
// ============================================================

/**
 * Checks if a semantic token has the 'declaration' or 'definition' modifier
 * which typically indicates an export in many languages.
 */
function hasExportModifier(token: SemanticToken): boolean {
    return token.tokenModifiers.includes('declaration') ||
           token.tokenModifiers.includes('definition');
}

/**
 * Extracts export information from semantic tokens.
 * Looks for tokens with export-related modifiers.
 */
async function extractExportsFromSemanticTokens(
    uri: vscode.Uri,
    document: vscode.TextDocument
): Promise<ExportExtractionResult> {
    const tokensResult = await extractSemanticTokens(uri);
    if (!tokensResult.ok) {
        return { exports: [], exportedNames: new Set() };
    }

    const tokens = tokensResult.value;
    const exports: ExportInfo[] = [];
    const exportedNames = new Set<string>();
    const text = document.getText();
    const lines = text.split('\n');

    for (const token of tokens) {
        // Check if this token represents a declaration that could be exported
        if (hasExportModifier(token)) {
            const line = lines[token.line];
            if (line) {
                const name = line.substring(token.startChar, token.startChar + token.length);

                // Check if the line contains an export keyword before this token
                const lineBeforeToken = line.substring(0, token.startChar);
                const isExported = /\bexport\b/.test(lineBeforeToken) ||
                                   /^\s*export\b/.test(line);
                const isDefaultExport = /\bexport\s+default\b/.test(lineBeforeToken) ||
                                        /^\s*export\s+default\b/.test(line);

                if (isExported && name.length > 0 && !exportedNames.has(name)) {
                    exportedNames.add(name);
                    exports.push({
                        name,
                        isDefault: isDefaultExport,
                        isTypeOnly: /\bexport\s+type\b/.test(lineBeforeToken) ||
                                    /^\s*export\s+type\b/.test(line)
                    });
                }
            }
        }
    }

    return { exports, exportedNames };
}

// ============================================================
// Text-Based Export Detection
// ============================================================

/**
 * Detects exports by analyzing the document text directly.
 * This is a fallback when semantic tokens don't provide enough info.
 */
function extractExportsFromText(document: vscode.TextDocument): ExportExtractionResult {
    const text = document.getText();
    const lines = text.split('\n');
    const exports: ExportInfo[] = [];
    const exportedNames = new Set<string>();

    // Patterns for different export styles
    const patterns = [
        // export function name
        /^\s*export\s+(?:async\s+)?function\s+(\w+)/,
        // export class name
        /^\s*export\s+(?:abstract\s+)?class\s+(\w+)/,
        // export interface name
        /^\s*export\s+interface\s+(\w+)/,
        // export type name
        /^\s*export\s+type\s+(\w+)/,
        // export const/let/var name
        /^\s*export\s+(?:const|let|var)\s+(\w+)/,
        // export enum name
        /^\s*export\s+enum\s+(\w+)/,
        // export default function name
        /^\s*export\s+default\s+(?:async\s+)?function\s+(\w+)/,
        // export default class name
        /^\s*export\s+default\s+(?:abstract\s+)?class\s+(\w+)/,
        // export default name (identifier)
        /^\s*export\s+default\s+(\w+)\s*;?\s*$/,
        // export { name, name2 }
        /^\s*export\s*\{([^}]+)\}/,
        // export { name } from 'module' (re-exports)
        /^\s*export\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/
    ];

    // TypeScript/JavaScript specific: export = (CommonJS style)
    const commonJSExport = /^\s*export\s*=\s*(\w+)/;

    // Rust: pub fn, pub struct, etc.
    const rustPubPatterns = [
        /^\s*pub\s+(?:async\s+)?fn\s+(\w+)/,
        /^\s*pub\s+struct\s+(\w+)/,
        /^\s*pub\s+enum\s+(\w+)/,
        /^\s*pub\s+trait\s+(\w+)/,
        /^\s*pub\s+type\s+(\w+)/,
        /^\s*pub\s+const\s+(\w+)/,
        /^\s*pub\s+static\s+(\w+)/,
        /^\s*pub\s+mod\s+(\w+)/
    ];

    // Go: capitalized identifiers are exported
    const goExportPattern = /^\s*(?:func|type|var|const)\s+([A-Z]\w*)/;

    // Python: __all__ = [...] or just top-level definitions (simplified)
    const pythonAllPattern = /__all__\s*=\s*\[([^\]]+)\]/;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (!line) continue;

        // Check standard export patterns
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match && match[1]) {
                // Handle export { name1, name2 } style
                if (pattern.source.includes('\\{([^}]+)\\}')) {
                    const names = match[1].split(',').map(n => {
                        // Handle "name as alias" style
                        const parts = n.trim().split(/\s+as\s+/);
                        const lastPart = parts[parts.length - 1];
                        return lastPart ? lastPart.trim() : '';
                    }).filter(n => n.length > 0);

                    for (const name of names) {
                        if (!exportedNames.has(name)) {
                            exportedNames.add(name);
                            exports.push({
                                name,
                                isDefault: false,
                                isTypeOnly: /export\s+type\s*\{/.test(line)
                            });
                        }
                    }
                } else {
                    const name = match[1];
                    if (name && !exportedNames.has(name)) {
                        exportedNames.add(name);
                        exports.push({
                            name,
                            isDefault: /export\s+default/.test(line),
                            isTypeOnly: /export\s+type\s/.test(line)
                        });
                    }
                }
            }
        }

        // CommonJS exports
        const cjsMatch = line.match(commonJSExport);
        if (cjsMatch && cjsMatch[1] && !exportedNames.has(cjsMatch[1])) {
            exportedNames.add(cjsMatch[1]);
            exports.push({
                name: cjsMatch[1],
                isDefault: true,
                isTypeOnly: false
            });
        }

        // Rust pub exports
        for (const pattern of rustPubPatterns) {
            const match = line.match(pattern);
            if (match && match[1] && !exportedNames.has(match[1])) {
                exportedNames.add(match[1]);
                exports.push({
                    name: match[1],
                    isDefault: false,
                    isTypeOnly: false
                });
            }
        }

        // Go exports (capitalized)
        const goMatch = line.match(goExportPattern);
        if (goMatch && goMatch[1] && !exportedNames.has(goMatch[1])) {
            exportedNames.add(goMatch[1]);
            exports.push({
                name: goMatch[1],
                isDefault: false,
                isTypeOnly: false
            });
        }
    }

    // Python __all__ handling
    const allMatch = text.match(pythonAllPattern);
    if (allMatch && allMatch[1]) {
        const names = allMatch[1]
            .split(',')
            .map(n => n.trim().replace(/['"]/g, ''))
            .filter(n => n.length > 0);

        for (const name of names) {
            if (!exportedNames.has(name)) {
                exportedNames.add(name);
                exports.push({
                    name,
                    isDefault: false,
                    isTypeOnly: false
                });
            }
        }
    }

    return { exports, exportedNames };
}

// ============================================================
// Symbol-Based Export Detection
// ============================================================

/**
 * Extracts exports by correlating with document symbols.
 * Checks if symbols have export modifiers via hover info.
 */
async function extractExportsFromSymbols(
    uri: vscode.Uri,
    symbols: readonly ExtractedSymbol[]
): Promise<ExportExtractionResult> {
    const exports: ExportInfo[] = [];
    const exportedNames = new Set<string>();

    for (const symbol of symbols) {
        // Check if the signature indicates an export
        // Note: 'export' and 'public' are visibility concepts, not modifiers
        // We check signature text since visibility may indicate public API
        const isExported = symbol.signature.includes('export ') ||
                          symbol.signature.includes('pub ') ||  // Rust public
                          symbol.visibility === 'public';

        const isDefault = symbol.signature.includes('export default');
        const isTypeOnly = symbol.signature.includes('export type') &&
                          !symbol.signature.includes('export type {');

        if (isExported && !exportedNames.has(symbol.name)) {
            exportedNames.add(symbol.name);
            exports.push({
                name: symbol.name,
                isDefault,
                isTypeOnly
            });
        }

        // Recursively check children (for nested exports)
        if (symbol.children.length > 0) {
            const childResult = await extractExportsFromSymbols(uri, symbol.children);
            for (const exp of childResult.exports) {
                if (!exportedNames.has(exp.name)) {
                    exportedNames.add(exp.name);
                    exports.push(exp);
                }
            }
        }
    }

    return { exports, exportedNames };
}

// ============================================================
// Public API
// ============================================================

/**
 * Extracts all exports from a document.
 * Uses multiple strategies: semantic tokens, text analysis, and symbol correlation.
 *
 * @param uri - The URI of the document to extract exports from
 * @param symbols - Optional pre-extracted symbols to correlate with
 * @returns Promise resolving to array of export info
 *
 * @example
 * const result = await extractExports(document.uri);
 * if (result.ok) {
 *   for (const exp of result.value) {
 *     console.log(`Export: ${exp.name}, default: ${exp.isDefault}`);
 *   }
 * }
 */
export async function extractExports(
    uri: vscode.Uri,
    symbols?: readonly ExtractedSymbol[]
): AsyncResult<readonly ExportInfo[], LSPError> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);

        // Strategy 1: Text-based detection (most reliable across languages)
        const textResult = extractExportsFromText(document);

        // Strategy 2: Semantic tokens (when available)
        const semanticResult = await extractExportsFromSemanticTokens(uri, document);

        // Strategy 3: Symbol correlation (if symbols provided)
        let symbolResult: ExportExtractionResult = { exports: [], exportedNames: new Set() };
        if (symbols && symbols.length > 0) {
            symbolResult = await extractExportsFromSymbols(uri, symbols);
        }

        // Merge results, preferring text-based for accuracy
        const allExports = new Map<string, ExportInfo>();

        // Add text-based exports first (highest priority)
        for (const exp of textResult.exports) {
            allExports.set(exp.name, exp);
        }

        // Add semantic token exports (may have additional info)
        for (const exp of semanticResult.exports) {
            if (!allExports.has(exp.name)) {
                allExports.set(exp.name, exp);
            }
        }

        // Add symbol-based exports (fallback)
        for (const exp of symbolResult.exports) {
            if (!allExports.has(exp.name)) {
                allExports.set(exp.name, exp);
            }
        }

        return { ok: true, value: Array.from(allExports.values()) };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            ok: false,
            error: { type: 'unknown', message: `Failed to extract exports: ${message}` }
        };
    }
}

/**
 * Checks if a symbol name is exported from a document.
 *
 * @param uri - The URI of the document
 * @param symbolName - The name to check
 * @returns Promise resolving to true if the symbol is exported
 */
export async function isSymbolExported(
    uri: vscode.Uri,
    symbolName: string
): AsyncResult<boolean, LSPError> {
    const result = await extractExports(uri);
    if (!result.ok) {
        return result;
    }

    const isExported = result.value.some(exp => exp.name === symbolName);
    return { ok: true, value: isExported };
}

/**
 * Gets the default export from a document if one exists.
 *
 * @param uri - The URI of the document
 * @returns Promise resolving to the default export info or null
 */
export async function getDefaultExport(
    uri: vscode.Uri
): AsyncResult<ExportInfo | null, LSPError> {
    const result = await extractExports(uri);
    if (!result.ok) {
        return result;
    }

    const defaultExport = result.value.find(exp => exp.isDefault) ?? null;
    return { ok: true, value: defaultExport };
}
