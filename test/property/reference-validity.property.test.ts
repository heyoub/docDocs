/**
 * @fileoverview Property-based tests for schema reference validity.
 * Tests Property 4: Schema Reference Validity from the design document.
 *
 * **Validates: Requirements 2.5, 26.3**
 *
 * Property Statement:
 * *For any* generated WorkspaceSchema, all JSON Schema $ref values SHALL resolve
 * to valid definitions within the schema, and there SHALL be no dangling references
 * to non-existent symbols.
 *
 * @module test/property/reference-validity
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { FileURI, SymbolID, SchemaRef } from '../../src/types/base.js';
import type { SymbolKind, SymbolModifier, Visibility } from '../../src/types/symbols.js';
import type {
    ExtractedSymbol,
    ExtractedParameter,
    ExtractedFunction,
    FileExtraction,
    ExtractionMethod,
    ImportInfo,
    ExportInfo,
} from '../../src/types/extraction.js';
import type { ModuleSchema, WorkspaceSchema, SymbolSchema } from '../../src/types/schema.js';
import {
    generateModuleSchema,
    generateWorkspaceSchema,
    resolveReferences,
    resolveModuleReferences,
} from '../../src/core/schema/generator.js';

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
 * Generates a valid SymbolID.
 */
const arbitrarySymbolID: fc.Arbitrary<SymbolID> = fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9_]*$/)
    .filter((s) => s.length > 0 && s.length <= 30)
    .map((s) => s as SymbolID);

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
 * Generates a valid Visibility.
 */
const arbitraryVisibility: fc.Arbitrary<Visibility> = fc.constantFrom<Visibility>(
    'public',
    'protected',
    'private',
    'internal'
);

/**
 * Generates a valid ExtractionMethod.
 */
const arbitraryExtractionMethod: fc.Arbitrary<ExtractionMethod> = fc.constantFrom<ExtractionMethod>(
    'lsp',
    'tree-sitter',
    'regex'
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
// Arbitrary Generators - Extraction Types
// ============================================================

/**
 * Generates a valid ExtractedParameter.
 */
const arbitraryExtractedParameter: fc.Arbitrary<ExtractedParameter> = fc.record({
    name: arbitrarySymbolName,
    type: fc.constantFrom('string', 'number', 'boolean', 'void', 'any', 'unknown', 'T', 'Options'),
    description: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: null }),
    optional: fc.boolean(),
    defaultValue: fc.option(fc.constantFrom('null', 'undefined', '{}', '[]', '0', '""'), { nil: null }),
});

/**
 * Generates a valid ImportInfo.
 */
const arbitraryImportInfo: fc.Arbitrary<ImportInfo> = fc.record({
    source: fc.constantFrom('./utils.js', './types.js', '../base.js', 'lodash', 'vscode'),
    specifiers: fc.array(arbitrarySymbolName, { minLength: 0, maxLength: 5 }),
    isTypeOnly: fc.boolean(),
});

/**
 * Generates a valid ExportInfo.
 */
const arbitraryExportInfo: fc.Arbitrary<ExportInfo> = fc.record({
    name: arbitrarySymbolName,
    isDefault: fc.boolean(),
    isTypeOnly: fc.boolean(),
});

/**
 * Non-function symbol kinds (excludes function and method which require extra fields).
 */
const arbitraryNonFunctionSymbolKind: fc.Arbitrary<SymbolKind> = fc.constantFrom<SymbolKind>(
    'module',
    'namespace',
    'class',
    'interface',
    'type',
    'enum',
    'property',
    'variable',
    'constant',
    'field',
    'event'
);

/**
 * Generates a valid ExtractedSymbol (non-function).
 */
const arbitraryExtractedSymbolBase = (uri: FileURI): fc.Arbitrary<ExtractedSymbol> =>
    fc.record({
        id: arbitrarySymbolID,
        name: arbitrarySymbolName,
        kind: arbitraryNonFunctionSymbolKind,
        location: arbitrarySourceLocation(uri),
        modifiers: fc.uniqueArray(arbitrarySymbolModifier, { maxLength: 3 }),
        visibility: arbitraryVisibility,
        signature: fc.string({ minLength: 1, maxLength: 100 }),
        documentation: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        children: fc.constant([] as readonly ExtractedSymbol[]),
    });

/**
 * Generates a valid ExtractedFunction.
 */
const arbitraryExtractedFunction = (uri: FileURI): fc.Arbitrary<ExtractedFunction> =>
    fc.record({
        id: arbitrarySymbolID,
        name: arbitrarySymbolName,
        kind: fc.constantFrom<'function' | 'method'>('function', 'method'),
        location: arbitrarySourceLocation(uri),
        modifiers: fc.uniqueArray(arbitrarySymbolModifier, { maxLength: 3 }),
        visibility: arbitraryVisibility,
        signature: fc.string({ minLength: 1, maxLength: 100 }),
        documentation: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        children: fc.constant([] as readonly ExtractedSymbol[]),
        parameters: fc.array(arbitraryExtractedParameter, { minLength: 0, maxLength: 5 }),
        returnType: fc.constantFrom('void', 'string', 'number', 'boolean', 'Promise<void>', 'T'),
        typeParameters: fc.array(fc.constantFrom('T', 'U', 'K', 'V'), { minLength: 0, maxLength: 2 }),
    });

/**
 * Generates a valid ExtractedSymbol (either base or function).
 */
const arbitraryExtractedSymbol = (uri: FileURI): fc.Arbitrary<ExtractedSymbol> =>
    fc.oneof(
        { weight: 3, arbitrary: arbitraryExtractedSymbolBase(uri) },
        { weight: 2, arbitrary: arbitraryExtractedFunction(uri) }
    );

/**
 * Generates unique symbols by ensuring unique names.
 */
const arbitraryUniqueSymbols = (uri: FileURI, minLength: number, maxLength: number): fc.Arbitrary<ExtractedSymbol[]> =>
    fc.uniqueArray(arbitrarySymbolName, { minLength, maxLength }).chain((names) =>
        fc.tuple(
            ...names.map((name) =>
                arbitraryExtractedSymbol(uri).map((symbol) => ({
                    ...symbol,
                    name,
                    id: name as SymbolID,
                }))
            )
        )
    );

/**
 * Generates a valid FileExtraction with unique symbol names.
 */
const arbitraryFileExtraction: fc.Arbitrary<FileExtraction> = arbitraryFileURI.chain((uri) =>
    fc.record({
        uri: fc.constant(uri),
        languageId: fc.constantFrom('typescript', 'javascript', 'python', 'rust', 'go'),
        symbols: arbitraryUniqueSymbols(uri, 1, 10),
        imports: fc.array(arbitraryImportInfo, { minLength: 0, maxLength: 5 }),
        exports: fc.array(arbitraryExportInfo, { minLength: 0, maxLength: 5 }),
        method: arbitraryExtractionMethod,
        timestamp: fc.nat({ max: Date.now() }),
    })
);

/**
 * Generates multiple file extractions with unique URIs for workspace testing.
 */
const arbitraryMultipleFileExtractions: fc.Arbitrary<FileExtraction[]> = fc
    .integer({ min: 1, max: 5 })
    .chain((count) => {
        const uris = Array.from({ length: count }, (_, i) => `file:///module${i}.ts` as FileURI);
        return fc.tuple(
            ...uris.map((uri) =>
                fc.record({
                    uri: fc.constant(uri),
                    languageId: fc.constantFrom('typescript', 'javascript'),
                    symbols: arbitraryUniqueSymbols(uri, 1, 5),
                    imports: fc.array(arbitraryImportInfo, { minLength: 0, maxLength: 3 }),
                    exports: fc.array(arbitraryExportInfo, { minLength: 0, maxLength: 3 }),
                    method: arbitraryExtractionMethod,
                    timestamp: fc.nat({ max: Date.now() }),
                })
            )
        );
    });

// ============================================================
// Helper Functions
// ============================================================

/**
 * Extracts all $ref values from a ModuleSchema.
 * Collects references from symbols array and from symbol definitions.
 */
function collectAllRefsFromModule(schema: ModuleSchema): SchemaRef[] {
    const refs: SchemaRef[] = [];

    // Collect refs from symbols array
    for (const symbolRef of schema.symbols) {
        refs.push(symbolRef);
    }

    // Collect refs from symbol definitions
    for (const symbolSchema of Object.values(schema.definitions)) {
        // References field
        for (const ref of symbolSchema.references) {
            refs.push(ref);
        }

        // Incoming calls
        if (symbolSchema.incomingCalls) {
            for (const ref of symbolSchema.incomingCalls) {
                refs.push(ref);
            }
        }

        // Outgoing calls
        if (symbolSchema.outgoingCalls) {
            for (const ref of symbolSchema.outgoingCalls) {
                refs.push(ref);
            }
        }
    }

    return refs;
}

/**
 * Extracts all $ref values from a WorkspaceSchema.
 * Collects module references.
 */
function collectAllRefsFromWorkspace(schema: WorkspaceSchema): SchemaRef[] {
    const refs: SchemaRef[] = [];

    for (const moduleRef of schema.modules) {
        refs.push(moduleRef.$ref);
    }

    return refs;
}

/**
 * Resolves a $ref within a ModuleSchema.
 * Returns true if the reference points to a valid definition.
 */
function resolveRefInModule(schema: ModuleSchema, ref: SchemaRef): boolean {
    // Internal refs have format: path#/definitions/symbolName
    const match = ref.match(/#\/definitions\/(.+)$/);
    if (match) {
        const symbolName = match[1];
        return symbolName !== undefined && symbolName in schema.definitions;
    }
    return false;
}

/**
 * Checks if all symbol $refs in a module resolve to valid definitions.
 */
function allSymbolRefsResolve(schema: ModuleSchema): boolean {
    for (const symbolRef of schema.symbols) {
        if (!resolveRefInModule(schema, symbolRef)) {
            return false;
        }
    }
    return true;
}

/**
 * Counts total symbols including children recursively.
 */
function countTotalSymbols(symbols: readonly ExtractedSymbol[]): number {
    let count = symbols.length;
    for (const symbol of symbols) {
        count += countTotalSymbols(symbol.children);
    }
    return count;
}

// ============================================================
// Property Tests
// ============================================================

describe('Feature: gendocs-extension, Property 4: Schema Reference Validity', () => {
    /**
     * Property: All $ref values in the symbols array resolve to valid definitions.
     *
     * **Validates: Requirements 2.5**
     */
    it('all symbol $refs in module schema resolve to valid definitions', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                // Every $ref in symbols array should resolve
                for (const symbolRef of schema.symbols) {
                    const resolved = resolveRefInModule(schema, symbolRef);
                    expect(resolved).toBe(true);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: The number of symbol $refs matches the number of definitions.
     *
     * **Validates: Requirements 2.5**
     */
    it('symbol $refs count matches definitions count', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                expect(schema.symbols.length).toBe(Object.keys(schema.definitions).length);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Each symbol $ref points to a definition with matching name.
     *
     * **Validates: Requirements 2.5**
     */
    it('each symbol $ref points to definition with matching name', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                for (const symbolRef of schema.symbols) {
                    const match = symbolRef.match(/#\/definitions\/(.+)$/);
                    expect(match).not.toBeNull();

                    if (match) {
                        const symbolName = match[1]!;
                        const definition = schema.definitions[symbolName];
                        expect(definition).toBeDefined();
                        // The definition's name should match (for top-level) or be the last part (for nested)
                        const expectedName = symbolName.includes('.') ? symbolName.split('.').pop()! : symbolName;
                        expect(definition!.name).toBe(expectedName);
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: There are no dangling references in symbol definitions.
     * All references in the references array should point to valid symbols.
     *
     * **Validates: Requirements 26.3**
     */
    it('no dangling references in symbol definitions', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                // Collect all valid symbol IDs
                const validIds = new Set<string>();
                for (const symbolRef of schema.symbols) {
                    validIds.add(symbolRef);
                }

                // Check that all references in definitions point to valid symbols
                for (const symbolSchema of Object.values(schema.definitions)) {
                    for (const ref of symbolSchema.references) {
                        // References should either be in validIds or be external refs
                        // For now, we only generate internal refs, so all should be valid
                        // Empty references array is valid
                        if (ref.includes('#/definitions/')) {
                            expect(validIds.has(ref)).toBe(true);
                        }
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: WorkspaceSchema module $refs are well-formed.
     *
     * **Validates: Requirements 2.5**
     */
    it('workspace schema module $refs are well-formed', () => {
        fc.assert(
            fc.property(arbitraryMultipleFileExtractions, (extractions) => {
                const schema = generateWorkspaceSchema(extractions);

                // Each module ref should be a valid path
                for (const moduleRef of schema.modules) {
                    expect(moduleRef.$ref).toBeDefined();
                    expect(typeof moduleRef.$ref).toBe('string');
                    expect(moduleRef.$ref.length).toBeGreaterThan(0);
                    // Module refs should end with .schema.json
                    expect(moduleRef.$ref.endsWith('.schema.json')).toBe(true);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: WorkspaceSchema has one module ref per extraction.
     *
     * **Validates: Requirements 2.6**
     */
    it('workspace schema has one module ref per extraction', () => {
        fc.assert(
            fc.property(arbitraryMultipleFileExtractions, (extractions) => {
                const schema = generateWorkspaceSchema(extractions);

                expect(schema.modules.length).toBe(extractions.length);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: resolveReferences does not introduce invalid references.
     *
     * **Validates: Requirements 2.5, 26.3**
     */
    it('resolveReferences preserves reference validity', () => {
        fc.assert(
            fc.property(arbitraryMultipleFileExtractions, (extractions) => {
                const workspaceSchema = generateWorkspaceSchema(extractions);

                // Build module schemas map
                const moduleSchemas = new Map<string, ModuleSchema>();
                for (const extraction of extractions) {
                    const moduleSchema = generateModuleSchema(extraction);
                    moduleSchemas.set(moduleSchema.path, moduleSchema);
                }

                // Resolve references
                const resolved = resolveReferences(workspaceSchema, moduleSchemas);

                // Resolved schema should still have valid module refs
                expect(resolved.modules.length).toBe(workspaceSchema.modules.length);

                for (const moduleRef of resolved.modules) {
                    expect(moduleRef.$ref).toBeDefined();
                    expect(typeof moduleRef.$ref).toBe('string');
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: resolveModuleReferences filters out invalid references.
     *
     * **Validates: Requirements 26.3**
     */
    it('resolveModuleReferences filters invalid references', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const moduleSchema = generateModuleSchema(extraction);

                // Collect all valid symbol IDs
                const validIds = new Set<string>(moduleSchema.symbols);

                // Resolve module references
                const resolved = resolveModuleReferences(moduleSchema, validIds);

                // All remaining references should be valid
                for (const symbolSchema of Object.values(resolved.definitions)) {
                    for (const ref of symbolSchema.references) {
                        expect(validIds.has(ref)).toBe(true);
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Symbol $id values are unique within a module.
     *
     * **Validates: Requirements 2.5**
     */
    it('symbol $id values are unique within module', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                const ids = new Set<string>();
                for (const symbolSchema of Object.values(schema.definitions)) {
                    expect(ids.has(symbolSchema.$id)).toBe(false);
                    ids.add(symbolSchema.$id);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: All $refs follow the correct format.
     *
     * **Validates: Requirements 2.5**
     */
    it('all $refs follow correct JSON Schema format', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                for (const symbolRef of schema.symbols) {
                    // Internal refs should have format: path#/definitions/name
                    expect(symbolRef).toMatch(/#\/definitions\/.+$/);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Empty extraction produces no dangling references.
     */
    it('empty extraction produces no dangling references', () => {
        const emptyExtraction: FileExtraction = {
            uri: 'file:///empty.ts' as FileURI,
            languageId: 'typescript',
            symbols: [],
            imports: [],
            exports: [],
            method: 'lsp',
            timestamp: Date.now(),
        };

        const schema = generateModuleSchema(emptyExtraction);

        expect(schema.symbols).toHaveLength(0);
        expect(Object.keys(schema.definitions)).toHaveLength(0);
    });

    /**
     * Property: Reference resolution is deterministic.
     */
    it('reference resolution is deterministic', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema1 = generateModuleSchema(extraction);
                const schema2 = generateModuleSchema(extraction);

                // Same refs should be generated
                expect(schema1.symbols).toEqual(schema2.symbols);

                // Same definitions should have same references
                for (const name of Object.keys(schema1.definitions)) {
                    expect(schema1.definitions[name]!.references).toEqual(
                        schema2.definitions[name]!.references
                    );
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Cross-module reference resolution works correctly.
     *
     * **Validates: Requirements 2.5**
     */
    it('cross-module reference resolution maintains consistency', () => {
        fc.assert(
            fc.property(arbitraryMultipleFileExtractions, (extractions) => {
                // Build module schemas
                const moduleSchemas = new Map<string, ModuleSchema>();
                for (const extraction of extractions) {
                    const moduleSchema = generateModuleSchema(extraction);
                    moduleSchemas.set(moduleSchema.path, moduleSchema);
                }

                // Collect all symbol IDs across all modules
                const allSymbolIds = new Set<string>();
                for (const moduleSchema of moduleSchemas.values()) {
                    for (const symbolRef of moduleSchema.symbols) {
                        allSymbolIds.add(symbolRef);
                    }
                }

                // Resolve references in each module
                for (const [path, moduleSchema] of moduleSchemas) {
                    const resolved = resolveModuleReferences(moduleSchema, allSymbolIds);

                    // All references should be valid
                    for (const symbolSchema of Object.values(resolved.definitions)) {
                        for (const ref of symbolSchema.references) {
                            expect(allSymbolIds.has(ref)).toBe(true);
                        }
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Nested symbols have valid $refs.
     *
     * **Validates: Requirements 2.5**
     */
    it('nested symbols have valid $refs', () => {
        // Create extraction with nested symbols
        const uri = 'file:///nested.ts' as FileURI;
        // Use a property kind instead of method to avoid needing function-specific fields
        const childSymbol: ExtractedSymbol = {
            id: 'childProperty' as SymbolID,
            name: 'childProperty',
            kind: 'property',
            location: {
                uri,
                range: { start: { line: 5, character: 0 }, end: { line: 10, character: 1 } },
            },
            modifiers: [],
            visibility: 'public',
            signature: 'childProperty: string',
            documentation: 'A child property',
            children: [],
        };

        const parentSymbol: ExtractedSymbol = {
            id: 'ParentClass' as SymbolID,
            name: 'ParentClass',
            kind: 'class',
            location: {
                uri,
                range: { start: { line: 0, character: 0 }, end: { line: 20, character: 1 } },
            },
            modifiers: ['export'],
            visibility: 'public',
            signature: 'class ParentClass',
            documentation: 'A parent class',
            children: [childSymbol],
        };

        const extraction: FileExtraction = {
            uri,
            languageId: 'typescript',
            symbols: [parentSymbol],
            imports: [],
            exports: [],
            method: 'lsp',
            timestamp: Date.now(),
        };

        const schema = generateModuleSchema(extraction);

        // Both parent and child should be in definitions
        expect(schema.definitions['ParentClass']).toBeDefined();
        expect(schema.definitions['ParentClass.childProperty']).toBeDefined();

        // All symbol refs should resolve
        for (const symbolRef of schema.symbols) {
            expect(resolveRefInModule(schema, symbolRef)).toBe(true);
        }
    });

    /**
     * Property: Module $id is consistent with path.
     *
     * **Validates: Requirements 2.5**
     */
    it('module $id is consistent with path', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                // $id should be the path
                expect(schema.$id).toBe(schema.path);
            }),
            PROPERTY_CONFIG
        );
    });
});
