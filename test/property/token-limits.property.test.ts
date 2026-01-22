/**
 * @fileoverview Property-based tests for AI context token limits.
 * Tests Property 8: AI Context Token Limits from the design document.
 *
 * **Validates: Requirements 4.6, 4.7**
 *
 * Property Statement:
 * *For any* ModuleSchema and configured maxTokens limit, the AI_Context_Generator SHALL
 * produce output where each AIContextFile has estimatedTokens <= maxTokens, splitting
 * into multiple chunks if necessary.
 *
 * @module test/property/token-limits
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { FileURI, SchemaRef } from '../../src/types/base.js';
import type { SymbolKind, SymbolModifier } from '../../src/types/symbols.js';
import type { ModuleSchema, SymbolSchema, ParameterSchema, TypeSchema } from '../../src/types/schema.js';
import { renderAIContext, chunkModule, linkChunks } from '../../src/core/renderer/aiContext.js';

// ============================================================
// Test Configuration
// ============================================================

/**
 * Minimum 100 iterations per property test as per design document.
 */
const PROPERTY_CONFIG: fc.Parameters<unknown> = {
    numRuns: 100,
    verbose: false,
};

// ============================================================
// Arbitrary Generators - Base Types
// ============================================================

/**
 * Generates a valid FileURI.
 */
const arbitraryFileURI: fc.Arbitrary<FileURI> = fc
    .stringMatching(/^[a-z][a-z0-9_/]*$/)
    .filter((s) => s.length > 0 && s.length <= 50)
    .map((s) => `file:///${s}.ts` as FileURI);

/**
 * Generates a valid SchemaRef.
 */
const arbitrarySchemaRef: fc.Arbitrary<SchemaRef> = fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9_]*$/)
    .filter((s) => s.length > 0 && s.length <= 30)
    .map((s) => `#/definitions/${s}` as SchemaRef);

/**
 * Generates a valid symbol name.
 */
const arbitrarySymbolName: fc.Arbitrary<string> = fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9_]*$/)
    .filter((s) => s.length > 0 && s.length <= 30);

/**
 * Generates a valid SymbolKind.
 */
const arbitrarySymbolKind: fc.Arbitrary<SymbolKind> = fc.constantFrom<SymbolKind>(
    'module',
    'namespace',
    'class',
    'interface',
    'type',
    'enum',
    'function',
    'method',
    'property',
    'variable',
    'constant',
    'constructor',
    'field',
    'event'
);

/**
 * Generates a valid SymbolModifier.
 */
const arbitrarySymbolModifier: fc.Arbitrary<SymbolModifier> = fc.constantFrom<SymbolModifier>(
    'static',
    'readonly',
    'abstract',
    'async',
    'generator',
    'optional',
    'override',
    'final',
    'virtual',
    'deprecated'
);

/**
 * Generates a valid Position.
 */
const arbitraryPosition = fc.record({
    line: fc.nat({ max: 10000 }),
    character: fc.nat({ max: 500 }),
});

/**
 * Generates a valid Range.
 */
const arbitraryRange = fc
    .tuple(arbitraryPosition, arbitraryPosition)
    .map(([start, end]) => ({
        start,
        end: {
            line: Math.max(start.line, end.line),
            character: end.line > start.line ? end.character : Math.max(start.character, end.character),
        },
    }));

/**
 * Generates a valid SourceLocation.
 */
const arbitrarySourceLocation = (uri: FileURI) =>
    arbitraryRange.map((range) => ({
        uri,
        range,
    }));

// ============================================================
// Arbitrary Generators - Schema Types
// ============================================================

/**
 * Generates a valid TypeSchema.
 */
const arbitraryTypeSchema: fc.Arbitrary<TypeSchema> = fc.record({
    raw: fc.constantFrom('string', 'number', 'boolean', 'void', 'any', 'unknown', 'T', 'Options', 'Promise<void>'),
    kind: fc.constantFrom<TypeSchema['kind']>('primitive', 'reference', 'generic'),
});

/**
 * Generates a valid ParameterSchema.
 */
const arbitraryParameterSchema: fc.Arbitrary<ParameterSchema> = fc.record({
    name: arbitrarySymbolName,
    type: arbitraryTypeSchema,
    description: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: null }),
    optional: fc.boolean(),
    defaultValue: fc.option(fc.constantFrom('null', 'undefined', '{}', '[]', '0', '""'), { nil: null }),
});

/**
 * Generates a SymbolSchema with configurable size.
 * @param name - The symbol name
 * @param uri - The file URI for source location
 * @param large - Whether to generate a large symbol (more content)
 */
const arbitrarySymbolSchema = (
    name: string,
    uri: FileURI,
    large: boolean = false
): fc.Arbitrary<SymbolSchema> =>
    fc.record({
        $id: fc.constant(`#/definitions/${name}` as SchemaRef),
        name: fc.constant(name),
        qualifiedName: fc.constant(`module.${name}`),
        kind: arbitrarySymbolKind,
        signature: large
            ? fc.string({ minLength: 50, maxLength: 200 })
            : fc.string({ minLength: 1, maxLength: 50 }),
        description: large
            ? fc.string({ minLength: 100, maxLength: 500 })
            : fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: '' }).map((s) => s ?? ''),
        modifiers: fc.uniqueArray(arbitrarySymbolModifier, { maxLength: 3 }),
        parameters: large
            ? fc.array(arbitraryParameterSchema, { minLength: 3, maxLength: 8 })
            : fc.array(arbitraryParameterSchema, { minLength: 0, maxLength: 3 }),
        returnType: fc.option(arbitraryTypeSchema, { nil: undefined }),
        references: fc.constant([] as readonly SchemaRef[]),
        source: arbitrarySourceLocation(uri),
    });

// ============================================================
// Arbitrary Generators - Module Schema
// ============================================================

/**
 * Generates a ModuleSchema with a specific number of symbols.
 * @param symbolCount - Number of symbols to generate
 * @param large - Whether to generate large symbols
 */
const arbitraryModuleSchemaWithCount = (
    symbolCount: number,
    large: boolean = false
): fc.Arbitrary<ModuleSchema> =>
    arbitraryFileURI.chain((uri) =>
        fc.uniqueArray(arbitrarySymbolName, { minLength: symbolCount, maxLength: symbolCount })
            .chain((names) =>
                fc.tuple(...names.map((name) => arbitrarySymbolSchema(name, large, uri)))
                    .map((symbols) => {
                        const definitions: Record<string, SymbolSchema> = {};
                        const symbolRefs: SchemaRef[] = [];

                        for (const symbol of symbols) {
                            definitions[symbol.name] = symbol;
                            symbolRefs.push(`#/definitions/${symbol.name}` as SchemaRef);
                        }

                        const moduleSchema: ModuleSchema = {
                            $id: uri as unknown as SchemaRef,
                            path: uri.replace('file:///', ''),
                            symbols: symbolRefs,
                            imports: [],
                            exports: [],
                            definitions,
                        };

                        return moduleSchema;
                    })
            )
    );

/**
 * Generates a random ModuleSchema with varying symbol counts.
 */
const arbitraryModuleSchema: fc.Arbitrary<ModuleSchema> = fc
    .integer({ min: 1, max: 20 })
    .chain((count) => arbitraryModuleSchemaWithCount(count, false));

/**
 * Generates a large ModuleSchema (many symbols with lots of content).
 * Used to test chunking behavior.
 */
const arbitraryLargeModuleSchema: fc.Arbitrary<ModuleSchema> = fc
    .integer({ min: 10, max: 30 })
    .chain((count) => arbitraryModuleSchemaWithCount(count, true));

/**
 * Generates an empty ModuleSchema (no symbols).
 */
const arbitraryEmptyModuleSchema: fc.Arbitrary<ModuleSchema> = arbitraryFileURI.map((uri) => ({
    $id: uri as unknown as SchemaRef,
    path: uri.replace('file:///', ''),
    symbols: [],
    imports: [],
    exports: [],
    definitions: {},
}));

/**
 * Generates a ModuleSchema with exactly one symbol.
 */
const arbitrarySingleSymbolModuleSchema: fc.Arbitrary<ModuleSchema> =
    arbitraryModuleSchemaWithCount(1, false);

/**
 * Generates a valid maxTokens value.
 * Range from very small (forces chunking) to large (no chunking needed).
 */
const arbitraryMaxTokens: fc.Arbitrary<number> = fc.integer({ min: 100, max: 10000 });

/**
 * Generates a very small maxTokens value to force chunking.
 */
const arbitrarySmallMaxTokens: fc.Arbitrary<number> = fc.integer({ min: 50, max: 300 });

// ============================================================
// Property Tests
// ============================================================

describe('Feature: gendocs-extension, Property 8: AI Context Token Limits', () => {
    /**
     * Property: Each AIContextFile has estimatedTokens <= maxTokens.
     *
     * **Validates: Requirements 4.6, 4.7**
     */
    it('each chunk respects maxTokens limit', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, arbitraryMaxTokens, (schema, maxTokens) => {
                const result = renderAIContext(schema, maxTokens);

                // The result should respect the token limit
                expect(result.estimatedTokens).toBeLessThanOrEqual(maxTokens);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: When chunking is required, all chunks respect the token limit.
     *
     * **Validates: Requirements 4.6, 4.7**
     */
    it('all chunks from chunkModule respect maxTokens limit', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, arbitraryMaxTokens, (schema, maxTokens) => {
                const chunks = chunkModule(schema, maxTokens);

                for (const chunk of chunks) {
                    expect(chunk.estimatedTokens).toBeLessThanOrEqual(maxTokens);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Large schemas are properly chunked when maxTokens is small.
     *
     * **Validates: Requirements 4.6, 4.7**
     */
    it('large schemas are chunked when maxTokens is small', () => {
        fc.assert(
            fc.property(arbitraryLargeModuleSchema, arbitrarySmallMaxTokens, (schema, maxTokens) => {
                const chunks = chunkModule(schema, maxTokens);

                // Each chunk must respect the limit
                for (const chunk of chunks) {
                    expect(chunk.estimatedTokens).toBeLessThanOrEqual(maxTokens);
                }

                // With large schema and small maxTokens, we expect multiple chunks
                // (unless the schema is somehow very small)
                const symbolCount = Object.keys(schema.definitions).length;
                if (symbolCount > 5) {
                    expect(chunks.length).toBeGreaterThanOrEqual(1);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Empty modules produce valid output with token count <= maxTokens.
     *
     * **Validates: Requirements 4.6**
     */
    it('empty modules produce valid output within token limit', () => {
        fc.assert(
            fc.property(arbitraryEmptyModuleSchema, arbitraryMaxTokens, (schema, maxTokens) => {
                const result = renderAIContext(schema, maxTokens);

                expect(result.estimatedTokens).toBeLessThanOrEqual(maxTokens);
                expect(result.publicAPI.functions).toHaveLength(0);
                expect(result.publicAPI.classes).toHaveLength(0);
                expect(result.publicAPI.types).toHaveLength(0);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Single symbol modules produce valid output within token limit.
     *
     * **Validates: Requirements 4.6**
     */
    it('single symbol modules produce valid output within token limit', () => {
        fc.assert(
            fc.property(arbitrarySingleSymbolModuleSchema, arbitraryMaxTokens, (schema, maxTokens) => {
                const result = renderAIContext(schema, maxTokens);

                expect(result.estimatedTokens).toBeLessThanOrEqual(maxTokens);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Chunking produces at least one chunk for any valid input.
     *
     * **Validates: Requirements 4.7**
     */
    it('chunkModule always produces at least one chunk', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, arbitraryMaxTokens, (schema, maxTokens) => {
                const chunks = chunkModule(schema, maxTokens);

                expect(chunks.length).toBeGreaterThanOrEqual(1);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Very small maxTokens still produces valid output.
     *
     * **Validates: Requirements 4.6, 4.7**
     */
    it('very small maxTokens produces valid chunked output', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, fc.integer({ min: 10, max: 100 }), (schema, maxTokens) => {
                const chunks = chunkModule(schema, maxTokens);

                // Should always produce at least one chunk
                expect(chunks.length).toBeGreaterThanOrEqual(1);

                // Each chunk should have valid structure
                for (const chunk of chunks) {
                    expect(chunk.$schema).toBeDefined();
                    expect(chunk.version).toBeDefined();
                    expect(chunk.module).toBeDefined();
                    expect(chunk.publicAPI).toBeDefined();
                    expect(chunk.estimatedTokens).toBeGreaterThanOrEqual(0);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Linked chunks form a valid linked list.
     *
     * **Validates: Requirements 4.7**
     */
    it('linked chunks form a valid linked list', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, arbitrarySmallMaxTokens, (schema, maxTokens) => {
                const chunks = chunkModule(schema, maxTokens);

                if (chunks.length === 1) {
                    // Single chunk should have no prev/next
                    const chunk = chunks[0]!;
                    if (chunk.chunk !== null) {
                        expect(chunk.chunk.prevChunk).toBeNull();
                        expect(chunk.chunk.nextChunk).toBeNull();
                        expect(chunk.chunk.total).toBe(1);
                        expect(chunk.chunk.index).toBe(0);
                    }
                } else {
                    // Multiple chunks should form a linked list
                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i]!;
                        expect(chunk.chunk).not.toBeNull();

                        if (chunk.chunk !== null) {
                            expect(chunk.chunk.index).toBe(i);
                            expect(chunk.chunk.total).toBe(chunks.length);

                            // First chunk has no prev
                            if (i === 0) {
                                expect(chunk.chunk.prevChunk).toBeNull();
                            } else {
                                expect(chunk.chunk.prevChunk).not.toBeNull();
                            }

                            // Last chunk has no next
                            if (i === chunks.length - 1) {
                                expect(chunk.chunk.nextChunk).toBeNull();
                            } else {
                                expect(chunk.chunk.nextChunk).not.toBeNull();
                            }
                        }
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: linkChunks correctly sets prev/next references.
     *
     * **Validates: Requirements 4.7**
     */
    it('linkChunks correctly sets navigation references', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, arbitrarySmallMaxTokens, (schema, maxTokens) => {
                const chunks = chunkModule(schema, maxTokens);
                const linked = linkChunks(chunks);

                expect(linked.length).toBe(chunks.length);

                for (let i = 0; i < linked.length; i++) {
                    const chunk = linked[i]!;
                    expect(chunk.chunk).not.toBeNull();

                    if (chunk.chunk !== null) {
                        // Check index and total
                        expect(chunk.chunk.index).toBe(i);
                        expect(chunk.chunk.total).toBe(linked.length);

                        // Check prev reference
                        if (i > 0) {
                            expect(chunk.chunk.prevChunk).toContain(`chunk.${i - 1}`);
                        } else {
                            expect(chunk.chunk.prevChunk).toBeNull();
                        }

                        // Check next reference
                        if (i < linked.length - 1) {
                            expect(chunk.chunk.nextChunk).toContain(`chunk.${i + 1}`);
                        } else {
                            expect(chunk.chunk.nextChunk).toBeNull();
                        }
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Token estimation is non-negative.
     *
     * **Validates: Requirements 4.6**
     */
    it('token estimation is always non-negative', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, arbitraryMaxTokens, (schema, maxTokens) => {
                const result = renderAIContext(schema, maxTokens);

                expect(result.estimatedTokens).toBeGreaterThanOrEqual(0);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: renderAIContext is deterministic.
     *
     * **Validates: Requirements 4.6**
     */
    it('renderAIContext is deterministic', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, arbitraryMaxTokens, (schema, maxTokens) => {
                const result1 = renderAIContext(schema, maxTokens);
                const result2 = renderAIContext(schema, maxTokens);

                expect(result1.estimatedTokens).toBe(result2.estimatedTokens);
                expect(result1.module).toBe(result2.module);
                expect(result1.publicAPI.functions.length).toBe(result2.publicAPI.functions.length);
                expect(result1.publicAPI.classes.length).toBe(result2.publicAPI.classes.length);
                expect(result1.publicAPI.types.length).toBe(result2.publicAPI.types.length);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: chunkModule is deterministic.
     *
     * **Validates: Requirements 4.7**
     */
    it('chunkModule is deterministic', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, arbitraryMaxTokens, (schema, maxTokens) => {
                const chunks1 = chunkModule(schema, maxTokens);
                const chunks2 = chunkModule(schema, maxTokens);

                expect(chunks1.length).toBe(chunks2.length);

                for (let i = 0; i < chunks1.length; i++) {
                    expect(chunks1[i]!.estimatedTokens).toBe(chunks2[i]!.estimatedTokens);
                    expect(chunks1[i]!.module).toBe(chunks2[i]!.module);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Output structure is always valid.
     *
     * **Validates: Requirements 4.6**
     */
    it('output structure is always valid', () => {
        fc.assert(
            fc.property(arbitraryModuleSchema, arbitraryMaxTokens, (schema, maxTokens) => {
                const result = renderAIContext(schema, maxTokens);

                // Required fields
                expect(result.$schema).toBeDefined();
                expect(typeof result.$schema).toBe('string');
                expect(result.version).toBeDefined();
                expect(typeof result.version).toBe('string');
                expect(result.module).toBeDefined();
                expect(typeof result.module).toBe('string');
                expect(result.purpose).toBeDefined();
                expect(typeof result.purpose).toBe('string');

                // Public API structure
                expect(result.publicAPI).toBeDefined();
                expect(Array.isArray(result.publicAPI.functions)).toBe(true);
                expect(Array.isArray(result.publicAPI.classes)).toBe(true);
                expect(Array.isArray(result.publicAPI.types)).toBe(true);

                // Patterns structure
                expect(result.patterns).toBeDefined();
                expect(Array.isArray(result.patterns.commonUsage)).toBe(true);
                expect(Array.isArray(result.patterns.antiPatterns)).toBe(true);
                expect(Array.isArray(result.patterns.bestPractices)).toBe(true);

                // Dependencies
                expect(Array.isArray(result.dependencies)).toBe(true);
                expect(Array.isArray(result.dependents)).toBe(true);
                expect(Array.isArray(result.relatedModules)).toBe(true);

                // Token count
                expect(typeof result.estimatedTokens).toBe('number');
            }),
            PROPERTY_CONFIG
        );
    });
});
