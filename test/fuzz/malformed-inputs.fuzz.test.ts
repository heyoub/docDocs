/**
 * @fileoverview Fuzz tests for malformed and adversarial inputs.
 * Verifies the system doesn't crash on unexpected data.
 *
 * Uses property-based testing with fast-check to generate
 * edge cases and boundary conditions.
 *
 * @module test/fuzz/malformed-inputs
 */

import '../__mocks__/setup.js';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { FileURI } from '../../src/types/base.js';
import type { ExtractedSymbol, ExtractionResult } from '../../src/types/extraction.js';

// Core modules under test
import { generateModuleSchema, generateSymbolSchema } from '../../src/core/schema/generator.js';
import { renderModule } from '../../src/core/renderer/markdown.js';
import { estimateTokens, truncateToTokens } from '../../src/utils/tokens.js';
import { extractFlowMatrix } from '../../src/core/analysis/flow.js';

// ============================================================
// Configuration
// ============================================================

const FUZZ_CONFIG: fc.Parameters<unknown> = {
    numRuns: 50,
    verbose: false,
};

// Helper for creating valid SourceLocation in tests
function validLocation(line: number = 1, endLine: number = 1) {
    return {
        uri: 'file:///test/fuzz.ts' as FileURI,
        range: {
            start: { line, character: 0 },
            end: { line: endLine, character: 10 },
        },
    };
}

// ============================================================
// Arbitrary Generators
// ============================================================

const arbitraryUnicode = fc.string({ minLength: 0, maxLength: 1000 });

const arbitrarySymbolName = fc.oneof(
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.constant(''),
    fc.constant('constructor'),
    fc.constant('prototype'),
    fc.constant('__proto__'),
    fc.constant('toString'),
    fc.constant('valueOf'),
    fc.stringMatching(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/),
    fc.unicodeString({ minLength: 1, maxLength: 50 }),
);

const arbitrarySymbolKind = fc.oneof(
    fc.constant('function'),
    fc.constant('class'),
    fc.constant('interface'),
    fc.constant('type'),
    fc.constant('enum'),
    fc.constant('variable'),
    fc.constant('constant'),
    fc.constant('method'),
    fc.string({ minLength: 0, maxLength: 20 }),
);

// Generates a proper SourceLocation (uri + range)
const arbitrarySourceLocation = fc.record({
    uri: fc.constant('file:///test/fuzz.ts' as FileURI),
    range: fc.record({
        start: fc.record({
            line: fc.integer({ min: 0, max: 100000 }),
            character: fc.integer({ min: 0, max: 10000 }),
        }),
        end: fc.record({
            line: fc.integer({ min: 0, max: 100000 }),
            character: fc.integer({ min: 0, max: 10000 }),
        }),
    }),
});

const arbitraryModifiers = fc.array(
    fc.oneof(
        fc.constant('export'),
        fc.constant('default'),
        fc.constant('async'),
        fc.constant('static'),
        fc.constant('readonly'),
        fc.constant('private'),
        fc.constant('protected'),
        fc.constant('public'),
        fc.constant('abstract'),
        fc.string({ minLength: 0, maxLength: 20 }),
    ),
    { maxLength: 10 }
);

const arbitrarySymbol: fc.Arbitrary<ExtractedSymbol> = fc.record({
    name: arbitrarySymbolName,
    kind: arbitrarySymbolKind,
    signature: arbitraryUnicode,
    location: arbitrarySourceLocation,
    documentation: fc.oneof(
        fc.constant(null),
        fc.record({
            summary: fc.oneof(fc.constant(null), arbitraryUnicode),
            description: fc.oneof(fc.constant(null), arbitraryUnicode),
            params: fc.array(
                fc.record({
                    name: arbitrarySymbolName,
                    type: fc.oneof(fc.constant(null), arbitraryUnicode),
                    description: fc.oneof(fc.constant(null), arbitraryUnicode),
                }),
                { maxLength: 20 }
            ),
            returns: fc.oneof(
                fc.constant(null),
                fc.record({
                    type: fc.oneof(fc.constant(null), arbitraryUnicode),
                    description: fc.oneof(fc.constant(null), arbitraryUnicode),
                })
            ),
            examples: fc.array(arbitraryUnicode, { maxLength: 5 }),
            tags: fc.array(
                fc.record({
                    name: arbitrarySymbolName,
                    value: fc.oneof(fc.constant(null), arbitraryUnicode),
                }),
                { maxLength: 10 }
            ),
        })
    ),
    modifiers: arbitraryModifiers,
    children: fc.constant([]), // Avoid deep recursion
});

const arbitraryExtraction = (symbols: ExtractedSymbol[]): ExtractionResult => ({
    uri: 'file:///test/fuzz.ts' as FileURI,
    languageId: 'typescript',
    symbols,
    imports: [],
    exports: [],
    method: 'lsp',
    timestamp: Date.now(),
});

// ============================================================
// Fuzz Tests: Schema Generation
// ============================================================

describe('Fuzz: Schema Generation', () => {
    it('never throws on arbitrary symbols', () => {
        fc.assert(
            fc.property(arbitrarySymbol, (symbol) => {
                expect(() => {
                    generateSymbolSchema(symbol, 'file:///test.ts' as FileURI);
                }).not.toThrow();
            }),
            FUZZ_CONFIG
        );
    });

    it('never throws on arbitrary symbol arrays', () => {
        fc.assert(
            fc.property(
                fc.array(arbitrarySymbol, { maxLength: 50 }),
                (symbols) => {
                    expect(() => {
                        generateModuleSchema(arbitraryExtraction(symbols));
                    }).not.toThrow();
                }
            ),
            FUZZ_CONFIG
        );
    });

    it('handles symbols with special characters in names', () => {
        const specialNames = [
            '$$special$$',
            '日本語',
            '🚀rocket',
            'with spaces',
            'with\nnewline',
            'with\ttab',
            '<script>alert("xss")</script>',
            '../../../etc/passwd',
            'null',
            'undefined',
            'NaN',
            'Infinity',
        ];

        for (const name of specialNames) {
            const symbol: ExtractedSymbol = {
                name,
                kind: 'function',
                signature: `function ${name}()`,
                location: validLocation(),
                documentation: null,
                modifiers: [],
                children: [],
            };

            expect(() => {
                generateSymbolSchema(symbol, 'file:///test.ts' as FileURI);
            }).not.toThrow();
        }
    });

    it('handles very long symbol names', () => {
        const longName = 'a'.repeat(10000);
        const symbol: ExtractedSymbol = {
            name: longName,
            kind: 'function',
            signature: `function ${longName}()`,
            location: validLocation(),
            documentation: null,
            modifiers: [],
            children: [],
        };

        expect(() => {
            generateSymbolSchema(symbol, 'file:///test.ts' as FileURI);
        }).not.toThrow();
    });
});

// ============================================================
// Fuzz Tests: Markdown Rendering
// ============================================================

describe('Fuzz: Markdown Rendering', () => {
    it('never throws on arbitrary schemas', () => {
        fc.assert(
            fc.property(
                fc.array(arbitrarySymbol, { maxLength: 20 }),
                (symbols) => {
                    const extraction = arbitraryExtraction(symbols);
                    const schema = generateModuleSchema(extraction);

                    expect(() => renderModule(schema)).not.toThrow();
                }
            ),
            FUZZ_CONFIG
        );
    });

    it('handles markdown injection attempts', () => {
        const injectionAttempts = [
            '# Injected Header',
            '[Link](javascript:alert(1))',
            '![Image](data:text/html,<script>alert(1)</script>)',
            '```\ncode block\n```',
            '| Table | Header |\n|-------|--------|\n| Cell | Cell |',
            '<script>alert(1)</script>',
            '{{template}}',
            '${interpolation}',
        ];

        for (const injection of injectionAttempts) {
            const symbol: ExtractedSymbol = {
                name: 'test',
                kind: 'function',
                signature: `function test()`,
                location: validLocation(),
                documentation: {
                    summary: injection,
                    description: injection,
                    params: [{ name: 'param', type: injection, description: injection }],
                    returns: { type: injection, description: injection },
                    examples: [injection],
                    tags: [{ name: 'tag', value: injection }],
                },
                modifiers: [],
                children: [],
            };

            const extraction = arbitraryExtraction([symbol]);
            const schema = generateModuleSchema(extraction);

            expect(() => renderModule(schema)).not.toThrow();
        }
    });
});

// ============================================================
// Fuzz Tests: Token Estimation
// ============================================================

describe('Fuzz: Token Estimation', () => {
    it('never returns negative for any input', () => {
        fc.assert(
            fc.property(arbitraryUnicode, (text) => {
                const tokens = estimateTokens(text);
                expect(tokens).toBeGreaterThanOrEqual(0);
            }),
            FUZZ_CONFIG
        );
    });

    it('truncation never exceeds requested limit', () => {
        fc.assert(
            fc.property(
                arbitraryUnicode,
                fc.integer({ min: 1, max: 10000 }),
                (text, maxTokens) => {
                    const truncated = truncateToTokens(text, maxTokens);
                    const resultTokens = estimateTokens(truncated);
                    expect(resultTokens).toBeLessThanOrEqual(maxTokens + 1); // +1 for rounding
                }
            ),
            FUZZ_CONFIG
        );
    });

    it('handles null bytes and control characters', () => {
        const controlChars = '\x00\x01\x02\x03\x04\x05\x06\x07\x08';
        expect(() => estimateTokens(controlChars)).not.toThrow();
        expect(estimateTokens(controlChars)).toBeGreaterThanOrEqual(0);
    });

    it('handles very long strings', () => {
        const longString = 'word '.repeat(100000);
        expect(() => estimateTokens(longString)).not.toThrow();
    });
});

// ============================================================
// Fuzz Tests: Flow Analysis
// ============================================================

describe('Fuzz: Flow Analysis', () => {
    it('never throws on arbitrary code strings', () => {
        fc.assert(
            fc.property(arbitraryUnicode, (code) => {
                expect(() => {
                    extractFlowMatrix(code, 'function test()');
                }).not.toThrow();
            }),
            FUZZ_CONFIG
        );
    });

    it('handles malformed control structures', () => {
        const malformedCode = [
            'if (true { }',
            'if true) { }',
            'for (;;; {}',
            'while { }',
            'switch case: break;',
            'try { } catch { } catch { }',
            '} { } {',
            'return return return;',
            'throw;',
        ];

        for (const code of malformedCode) {
            expect(() => extractFlowMatrix(code, 'function test()')).not.toThrow();
        }
    });

    it('handles deeply nested structures', () => {
        const deepNesting = 'if (true) { '.repeat(100) + '}'.repeat(100);
        expect(() => extractFlowMatrix(deepNesting, 'function test()')).not.toThrow();
    });

    it('handles regex-like patterns that might break parsing', () => {
        const regexPatterns = [
            '/.*/',
            '/[a-z]+/g',
            '/(a|b)+/',
            '/\\d+/',
            'new RegExp(".*")',
        ];

        for (const pattern of regexPatterns) {
            expect(() => extractFlowMatrix(pattern, 'function test()')).not.toThrow();
        }
    });
});

// ============================================================
// Fuzz Tests: Edge Cases
// ============================================================

describe('Fuzz: Edge Cases', () => {
    it('handles empty strings everywhere', () => {
        const emptySymbol: ExtractedSymbol = {
            name: '',
            kind: '',
            signature: '',
            location: validLocation(0, 0),
            documentation: null,
            modifiers: [],
            children: [],
        };

        expect(() => generateSymbolSchema(emptySymbol, '' as FileURI)).not.toThrow();
    });

    it('handles circular-looking references in names', () => {
        const symbols: ExtractedSymbol[] = [
            {
                name: '#/definitions/self',
                kind: 'type',
                signature: 'type Self = Self',
                location: validLocation(),
                documentation: null,
                modifiers: [],
                children: [],
            },
            {
                name: '$ref',
                kind: 'type',
                signature: 'type Ref = any',
                location: validLocation(2, 2),
                documentation: null,
                modifiers: [],
                children: [],
            },
        ];

        expect(() => generateModuleSchema(arbitraryExtraction(symbols))).not.toThrow();
    });

    it('handles JSON-special characters in all fields', () => {
        const jsonSpecial = '{"key": "value", "nested": {"a": [1,2,3]}}';
        const symbol: ExtractedSymbol = {
            name: jsonSpecial,
            kind: jsonSpecial,
            signature: jsonSpecial,
            location: validLocation(),
            documentation: {
                summary: jsonSpecial,
                description: jsonSpecial,
                params: [],
                returns: null,
                examples: [jsonSpecial],
                tags: [],
            },
            modifiers: [jsonSpecial],
            children: [],
        };

        expect(() => generateSymbolSchema(symbol, 'file:///test.ts' as FileURI)).not.toThrow();
    });
});

// ============================================================
// Fuzz Tests: Numeric Boundaries
// ============================================================

describe('Fuzz: Numeric Boundaries', () => {
    it('handles extreme line numbers', () => {
        const extremeLocations = [
            { line: 0, column: 0, endLine: 0, endColumn: 0 },
            { line: -1, column: -1, endLine: -1, endColumn: -1 },
            { line: Number.MAX_SAFE_INTEGER, column: Number.MAX_SAFE_INTEGER, endLine: Number.MAX_SAFE_INTEGER, endColumn: Number.MAX_SAFE_INTEGER },
            { line: Infinity, column: Infinity, endLine: Infinity, endColumn: Infinity },
            { line: NaN, column: NaN, endLine: NaN, endColumn: NaN },
        ];

        for (const location of extremeLocations) {
            const symbol: ExtractedSymbol = {
                name: 'test',
                kind: 'function',
                signature: 'function test()',
                location,
                documentation: null,
                modifiers: [],
                children: [],
            };

            expect(() => generateSymbolSchema(symbol, 'file:///test.ts' as FileURI)).not.toThrow();
        }
    });

    it('handles zero and negative token limits', () => {
        expect(() => truncateToTokens('hello world', 0)).not.toThrow();
        expect(() => truncateToTokens('hello world', -1)).not.toThrow();
        expect(() => truncateToTokens('hello world', -Infinity)).not.toThrow();
    });
});
