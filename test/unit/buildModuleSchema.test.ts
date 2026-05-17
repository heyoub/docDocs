/**
 * @fileoverview Integration-style tests for buildModuleSchema pipeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import type { FileURI } from '../../src/types/base.js';
import type { ExtractedSymbol } from '../../src/types/extraction.js';
import { buildModuleSchema } from '../../src/core/pipeline/buildModuleSchema.js';
import { extractSymbols, formatLSPError } from '../../src/core/extractor/lsp.js';
import {
    extractSymbols as extractSymbolsTreeSitter,
    isSupported as isTreeSitterSupported,
} from '../../src/core/extractor/treeSitter.js';
import { tryGenerateModuleSchema } from '../../src/core/schema/generator.js';

vi.mock('../../src/core/extractor/lsp.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/core/extractor/lsp.js')>();
    return {
        ...actual,
        extractSymbols: vi.fn(),
    };
});

vi.mock('../../src/core/extractor/treeSitter.js', () => ({
    extractSymbols: vi.fn(),
    isSupported: vi.fn(),
}));

vi.mock('../../src/core/extractor/exports.js', () => ({
    extractExports: vi.fn(async () => ({ ok: true, value: [] })),
}));

const testUri = vscode.Uri.file('/workspace/src/example.ts');
const fileUri = testUri.toString() as FileURI;

function treeSitterSymbol(): ExtractedSymbol {
    return {
        id: 'tree-sitter:foo' as ExtractedSymbol['id'],
        name: 'foo',
        kind: 'function',
        location: {
            uri: fileUri,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 3 },
            },
        },
        visibility: 'public',
        signature: 'function foo()',
        documentation: null,
        modifiers: [],
        children: [],
    };
}

describe('buildModuleSchema', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isTreeSitterSupported).mockReturnValue(true);
        vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue({
            getText: () => 'export function foo() {}',
        } as vscode.TextDocument);
    });

    it('uses LSP symbols when extraction succeeds', async () => {
        const lspSymbol = treeSitterSymbol();
        lspSymbol.id = 'lsp:foo' as ExtractedSymbol['id'];
        vi.mocked(extractSymbols).mockResolvedValue({ ok: true, value: [lspSymbol] });

        const result = await buildModuleSchema(testUri, 'typescript', { treeSitterFallback: true });

        expect(result.ok).toBe(true);
        expect(extractSymbolsTreeSitter).not.toHaveBeenCalled();
        if (result.ok) {
            expect(result.value.definitions['foo']).toBeDefined();
        }
    });

    it('attempts tree-sitter fallback when LSP fails', async () => {
        vi.mocked(extractSymbols).mockResolvedValue({
            ok: false,
            error: { type: 'unavailable', message: 'LSP unavailable' },
        });
        vi.mocked(extractSymbolsTreeSitter).mockReturnValue([treeSitterSymbol()]);

        const result = await buildModuleSchema(testUri, 'typescript', { treeSitterFallback: true });

        expect(extractSymbolsTreeSitter).toHaveBeenCalledWith('export function foo() {}', 'typescript');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.definitions['foo']).toBeDefined();
        }
    });

    it('returns symbol-extraction error when LSP fails and fallback is disabled', async () => {
        vi.mocked(extractSymbols).mockResolvedValue({
            ok: false,
            error: { type: 'unavailable', message: 'LSP unavailable' },
        });

        const result = await buildModuleSchema(testUri, 'typescript', { treeSitterFallback: false });

        expect(extractSymbolsTreeSitter).not.toHaveBeenCalled();
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.type).toBe('symbol-extraction');
            expect(result.error.message).toContain(formatLSPError({
                type: 'unavailable',
                message: 'LSP unavailable',
            }));
        }
    });

    it('feeds tree-sitter extraction through tryGenerateModuleSchema', () => {
        const extraction = {
            uri: fileUri,
            languageId: 'typescript',
            symbols: [treeSitterSymbol()],
            imports: [],
            exports: [],
            method: 'tree-sitter' as const,
            timestamp: Date.now(),
        };

        const result = tryGenerateModuleSchema(extraction);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.definitions['foo']).toBeDefined();
        }
    });
});
