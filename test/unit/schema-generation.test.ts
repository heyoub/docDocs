/**
 * @fileoverview Unit tests for safe module schema generation.
 */

import { describe, it, expect } from 'vitest';
import type { FileURI } from '../../src/types/base.js';
import type { FileExtraction, ExtractedSymbol } from '../../src/types/extraction.js';
import {
    tryGenerateModuleSchema,
    validateFileExtraction,
    normalizeFileExtraction,
} from '../../src/core/schema/generator.js';

const testUri = 'file:///test.ts' as FileURI;

function minimalSymbol(overrides: Partial<ExtractedSymbol> = {}): ExtractedSymbol {
    return {
        id: 'sym' as ExtractedSymbol['id'],
        name: 'foo',
        kind: 'function',
        location: {
            uri: testUri,
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
        ...overrides,
    };
}

function minimalExtraction(symbols: readonly ExtractedSymbol[]): FileExtraction {
    return {
        uri: testUri,
        languageId: 'typescript',
        symbols,
        imports: [],
        exports: [],
        method: 'lsp',
        timestamp: Date.now(),
    };
}

describe('tryGenerateModuleSchema', () => {
    it('rejects missing URI', () => {
        const result = tryGenerateModuleSchema({
            ...minimalExtraction([]),
            uri: '' as FileURI,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('URI');
        }
    });

    it('rejects non-array symbols', () => {
        const bad = { ...minimalExtraction([]), symbols: null as unknown as ExtractedSymbol[] };
        const result = tryGenerateModuleSchema(bad);
        expect(result.ok).toBe(false);
    });

    it('succeeds for valid extraction', () => {
        const result = tryGenerateModuleSchema(minimalExtraction([minimalSymbol()]));
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.definitions['foo']).toBeDefined();
        }
    });

    it('normalizes symbols missing children array', () => {
        const malformed = minimalSymbol({ children: undefined as unknown as ExtractedSymbol[] });
        const normalized = normalizeFileExtraction(minimalExtraction([malformed]));
        const result = tryGenerateModuleSchema(normalized);
        expect(result.ok).toBe(true);
    });

    it('validateFileExtraction passes for minimal valid input', () => {
        const result = validateFileExtraction(minimalExtraction([]));
        expect(result.ok).toBe(true);
    });
});
