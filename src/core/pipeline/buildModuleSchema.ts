/**
 * @fileoverview Shared pipeline: LSP extraction → module schema generation.
 * Used by commands and providers for consistent Result handling.
 *
 * @module core/pipeline/buildModuleSchema
 */

import * as vscode from 'vscode';
import type { AsyncResult, FileURI } from '../../types/base.js';
import type { ExtractionError, ExtractionMethod, ExtractedSymbol } from '../../types/extraction.js';
import type { ModuleSchema } from '../../types/schema.js';
import { extractSymbols, formatLSPError } from '../extractor/lsp.js';
import { extractExports } from '../extractor/exports.js';
import {
    extractSymbols as extractSymbolsTreeSitter,
    isSupported as isTreeSitterSupported,
} from '../extractor/treeSitter.js';
import { tryGenerateModuleSchema } from '../schema/generator.js';
import { ok, err } from '../../utils/result.js';
import { resolveModulePath } from '../../utils/modulePath.js';

export interface BuildModuleSchemaOptions {
    /** When true (default), retry with tree-sitter if LSP symbol extraction fails. */
    readonly treeSitterFallback?: boolean;
}

function isTreeSitterFallbackEnabled(options: BuildModuleSchemaOptions): boolean {
    if (options.treeSitterFallback !== undefined) {
        return options.treeSitterFallback;
    }
    return vscode.workspace
        .getConfiguration('docdocs')
        .get<boolean>('extraction.treeSitterFallback', true);
}

async function extractSymbolsWithFallback(
    uri: vscode.Uri,
    languageId: string,
    fileUri: FileURI,
    options: BuildModuleSchemaOptions
): AsyncResult<{ readonly symbols: readonly ExtractedSymbol[]; readonly method: ExtractionMethod }, ExtractionError> {
    const symbolsResult = await extractSymbols(uri);
    if (symbolsResult.ok) {
        return ok({ symbols: symbolsResult.value, method: 'lsp' });
    }

    if (!isTreeSitterFallbackEnabled(options) || !isTreeSitterSupported(languageId)) {
        return err({
            type: 'symbol-extraction',
            uri: fileUri,
            message: formatLSPError(symbolsResult.error),
        });
    }

    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const symbols = extractSymbolsTreeSitter(document.getText(), languageId);
        if (symbols.length === 0) {
            return err({
                type: 'symbol-extraction',
                uri: fileUri,
                message: `${formatLSPError(symbolsResult.error)}; tree-sitter fallback returned no symbols`,
            });
        }
        return ok({ symbols, method: 'tree-sitter' });
    } catch (error) {
        const fallbackMessage = error instanceof Error ? error.message : String(error);
        return err({
            type: 'symbol-extraction',
            uri: fileUri,
            message: `${formatLSPError(symbolsResult.error)}; tree-sitter fallback failed: ${fallbackMessage}`,
        });
    }
}

/**
 * Builds a module schema from a source file (symbols + exports + schema generation).
 */
export async function buildModuleSchema(
    uri: vscode.Uri,
    languageId: string,
    options: BuildModuleSchemaOptions = {}
): AsyncResult<ModuleSchema, ExtractionError> {
    const fileUri = uri.toString() as FileURI;

    const extractionResult = await extractSymbolsWithFallback(uri, languageId, fileUri, options);
    if (!extractionResult.ok) {
        return extractionResult;
    }

    const { symbols, method } = extractionResult.value;

    const exportsResult = await extractExports(uri, symbols);
    const exports = exportsResult.ok ? exportsResult.value : [];

    const getWorkspaceFolder = vscode.workspace.getWorkspaceFolder;
    const folder =
        typeof getWorkspaceFolder === 'function' ? getWorkspaceFolder(uri) : undefined;
    const relativePath = folder
        ? resolveModulePath(fileUri, folder.uri.fsPath)
        : resolveModulePath(fileUri);

    const schemaResult = tryGenerateModuleSchema({
        uri: fileUri,
        languageId,
        symbols,
        imports: [],
        exports: [...exports],
        method,
        timestamp: Date.now(),
        relativePath,
    });

    if (!schemaResult.ok) {
        return err({
            type: 'schema-generation',
            uri: fileUri,
            message: schemaResult.error,
        });
    }

    return ok(schemaResult.value);
}
