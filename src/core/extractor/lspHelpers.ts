/**
 * @fileoverview Helper functions for LSP extraction.
 * This module provides conversion utilities and timeout handling for LSP commands.
 * Layer 3 - imports from types/ (Layer 0) and uses VS Code API.
 *
 * @module core/extractor/lspHelpers
 */

import * as vscode from 'vscode';
import type { SymbolID, FileURI, Position, Range } from '../../types/base.js';
import type { SymbolKind } from '../../types/symbols.js';

// ============================================================
// Configuration Constants
// ============================================================

/** Default timeout for LSP commands in milliseconds */
export const DEFAULT_TIMEOUT_MS = 5000;

/** Retry timeout multiplier for exponential backoff */
export const RETRY_TIMEOUT_MULTIPLIER = 2;

/** Maximum number of retry attempts */
export const MAX_RETRIES = 1;

// ============================================================
// Timeout Handling
// ============================================================

/**
 * Creates a timeout promise that rejects after the specified duration.
 * If signal is provided and aborts first, the timer is cleared to avoid leaks.
 */
function createTimeout(ms: number, signal?: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`LSP command timed out after ${ms}ms`)), ms);
        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(new Error('LSP command cancelled'));
            },
            { once: true }
        );
    });
}

/**
 * Executes a VS Code command with timeout handling.
 * Cleans up the timeout when the command completes first to avoid timer leaks.
 */
export async function executeWithTimeout<T>(
    command: string,
    args: readonly unknown[],
    timeoutMs: number
): Promise<T | null> {
    const controller = new AbortController();
    try {
        const result = await Promise.race([
            vscode.commands.executeCommand<T>(command, ...args),
            createTimeout(timeoutMs, controller.signal),
        ]);
        return result ?? null;
    } catch (error) {
        if (error instanceof Error && (error.message.includes('timed out') || error.message.includes('cancelled'))) {
            throw error;
        }
        return null;
    } finally {
        controller.abort();
    }
}

/**
 * Executes a VS Code command with retry logic for timeouts.
 */
export async function executeWithRetry<T>(
    command: string,
    args: readonly unknown[],
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T | null> {
    let lastError: Error | null = null;
    let currentTimeout = timeoutMs;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await executeWithTimeout<T>(command, args, currentTimeout);
        } catch (error) {
            if (error instanceof Error && error.message.includes('timed out')) {
                lastError = error;
                currentTimeout *= RETRY_TIMEOUT_MULTIPLIER;
                continue;
            }
            return null;
        }
    }

    if (lastError) {
        console.warn(`LSP command ${command} failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
    }
    return null;
}

// ============================================================
// Position/Range Conversion
// ============================================================

/**
 * Converts VS Code Position to our Position type.
 */
export function convertPosition(pos: vscode.Position): Position {
    return { line: pos.line, character: pos.character };
}

/**
 * Converts VS Code Range to our Range type.
 */
export function convertRange(range: vscode.Range): Range {
    return {
        start: convertPosition(range.start),
        end: convertPosition(range.end)
    };
}

/**
 * Converts our Position type to VS Code Position.
 */
export function toVSCodePosition(pos: Position): vscode.Position {
    return new vscode.Position(pos.line, pos.character);
}

/**
 * Converts our Range type to VS Code Range.
 */
export function toVSCodeRange(range: Range): vscode.Range {
    return new vscode.Range(
        toVSCodePosition(range.start),
        toVSCodePosition(range.end)
    );
}

// ============================================================
// Symbol Kind Conversion
// ============================================================

/**
 * Converts VS Code SymbolKind to our SymbolKind type.
 */
export function convertSymbolKind(kind: vscode.SymbolKind): SymbolKind {
    const kindMap: Record<vscode.SymbolKind, SymbolKind> = {
        [vscode.SymbolKind.File]: 'module',
        [vscode.SymbolKind.Module]: 'module',
        [vscode.SymbolKind.Namespace]: 'namespace',
        [vscode.SymbolKind.Package]: 'module',
        [vscode.SymbolKind.Class]: 'class',
        [vscode.SymbolKind.Method]: 'method',
        [vscode.SymbolKind.Property]: 'property',
        [vscode.SymbolKind.Field]: 'field',
        [vscode.SymbolKind.Constructor]: 'constructor',
        [vscode.SymbolKind.Enum]: 'enum',
        [vscode.SymbolKind.Interface]: 'interface',
        [vscode.SymbolKind.Function]: 'function',
        [vscode.SymbolKind.Variable]: 'variable',
        [vscode.SymbolKind.Constant]: 'constant',
        [vscode.SymbolKind.String]: 'variable',
        [vscode.SymbolKind.Number]: 'variable',
        [vscode.SymbolKind.Boolean]: 'variable',
        [vscode.SymbolKind.Array]: 'variable',
        [vscode.SymbolKind.Object]: 'variable',
        [vscode.SymbolKind.Key]: 'property',
        [vscode.SymbolKind.Null]: 'variable',
        [vscode.SymbolKind.EnumMember]: 'constant',
        [vscode.SymbolKind.Struct]: 'class',
        [vscode.SymbolKind.Event]: 'event',
        [vscode.SymbolKind.Operator]: 'function',
        [vscode.SymbolKind.TypeParameter]: 'type'
    };
    return kindMap[kind] ?? 'variable';
}

// ============================================================
// Symbol ID Generation
// ============================================================

/**
 * Generates a unique symbol ID from URI and symbol name.
 */
export function generateSymbolId(uri: FileURI, name: string, parentName?: string): SymbolID {
    const base = uri.replace(/^file:\/\//, '').replace(/\//g, '.');
    const fullName = parentName ? `${parentName}#${name}` : name;
    return `${base}:${fullName}` as SymbolID;
}

// ============================================================
// Documentation Extraction
// ============================================================

/**
 * Extracts documentation from hover contents.
 */
export function extractDocumentation(hover: vscode.Hover | null): string | null {
    if (!hover || !hover.contents || hover.contents.length === 0) {
        return null;
    }

    const parts: string[] = [];
    for (const content of hover.contents) {
        if (typeof content === 'string') {
            parts.push(content);
        } else if ('value' in content) {
            parts.push(content.value);
        }
    }

    const doc = parts.join('\n\n').trim();
    return doc.length > 0 ? doc : null;
}

/**
 * Extracts signature from hover contents (first code block).
 */
export function extractSignature(hover: vscode.Hover | null, symbolName: string): string {
    if (!hover || !hover.contents || hover.contents.length === 0) {
        return symbolName;
    }

    for (const content of hover.contents) {
        if (typeof content !== 'string' && 'value' in content) {
            const codeMatch = content.value.match(/```[\w]*\n?([\s\S]*?)```/);
            if (codeMatch?.[1]) {
                return codeMatch[1].trim();
            }
            const firstLine = content.value.split('\n')[0]?.trim();
            if (firstLine && firstLine.length > 0) {
                return firstLine;
            }
        }
    }

    return symbolName;
}

// ============================================================
// Semantic Tokens Legend
// ============================================================

/**
 * Gets the default semantic tokens legend.
 * The legend maps token type/modifier indices to their string names.
 */
export function getDefaultSemanticTokensLegend(): vscode.SemanticTokensLegend {
    return {
        tokenTypes: [
            'namespace', 'type', 'class', 'enum', 'interface',
            'struct', 'typeParameter', 'parameter', 'variable', 'property',
            'enumMember', 'event', 'function', 'method', 'macro',
            'keyword', 'modifier', 'comment', 'string', 'number',
            'regexp', 'operator', 'decorator'
        ],
        tokenModifiers: [
            'declaration', 'definition', 'readonly', 'static', 'deprecated',
            'abstract', 'async', 'modification', 'documentation', 'defaultLibrary'
        ]
    };
}
