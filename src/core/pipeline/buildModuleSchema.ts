/**
 * @fileoverview Shared pipeline: LSP extraction → module schema generation.
 * Used by commands and providers for consistent Result handling.
 *
 * @module core/pipeline/buildModuleSchema
 */

import * as vscode from 'vscode';
import type { AsyncResult, FileURI } from '../../types/base.js';
import type { ExtractionError } from '../../types/extraction.js';
import type { ModuleSchema } from '../../types/schema.js';
import { extractSymbols, formatLSPError } from '../extractor/lsp.js';
import { extractExports } from '../extractor/exports.js';
import { tryGenerateModuleSchema } from '../schema/generator.js';
import { ok, err } from '../../utils/result.js';

/**
 * Builds a module schema from a source file (symbols + exports + schema generation).
 */
export async function buildModuleSchema(
    uri: vscode.Uri,
    languageId: string
): AsyncResult<ModuleSchema, ExtractionError> {
    const fileUri = uri.toString() as FileURI;

    const symbolsResult = await extractSymbols(uri);
    if (!symbolsResult.ok) {
        return err({
            type: 'symbol-extraction',
            uri: fileUri,
            message: formatLSPError(symbolsResult.error),
        });
    }

    const exportsResult = await extractExports(uri, symbolsResult.value);
    const exports = exportsResult.ok ? exportsResult.value : [];

    const schemaResult = tryGenerateModuleSchema({
        uri: fileUri,
        languageId,
        symbols: symbolsResult.value,
        imports: [],
        exports: [...exports],
        method: 'lsp',
        timestamp: Date.now(),
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
