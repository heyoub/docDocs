/**
 * @fileoverview Property-based tests for schema generation completeness.
 * Tests Property 3: Schema Generation Completeness from the design document.
 *
 * **Validates: Requirements 2.1, 2.2, 2.7**
 *
 * Property Statement:
 * *For any* FileExtraction containing symbols, the JSON_Schema_Generator SHALL produce
 * a ModuleSchema where every ExtractedSymbol appears in the schema's definitions with
 * name, kind, and signature fields populated, and symbols without documentation SHALL
 * have an empty description field rather than being omitted.
 *
 * @module test/property/schema-generation
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
import { generateModuleSchema, generateSymbolSchema } from '../../src/core/schema/generator.js';

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
 * Generates a valid ExtractedSymbol (non-function).
 * Uses a fixed URI for consistent source locations.
 */
const arbitraryExtractedSymbolBase = (uri: FileURI): fc.Arbitrary<ExtractedSymbol> =>
    fc.record({
        id: arbitrarySymbolID,
        name: arbitrarySymbolName,
        kind: arbitrarySymbolKind.filter((k) => k !== 'function' && k !== 'method'),
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
 * Generates a valid ExtractedSymbol with children (nested symbols).
 */
const arbitraryExtractedSymbolWithChildren = (uri: FileURI): fc.Arbitrary<ExtractedSymbol> =>
    fc.record({
        id: arbitrarySymbolID,
        name: arbitrarySymbolName,
        kind: fc.constantFrom<SymbolKind>('class', 'interface', 'namespace', 'module'),
        location: arbitrarySourceLocation(uri),
        modifiers: fc.uniqueArray(arbitrarySymbolModifier, { maxLength: 3 }),
        visibility: arbitraryVisibility,
        signature: fc.string({ minLength: 1, maxLength: 100 }),
        documentation: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        children: fc.array(arbitraryExtractedSymbolBase(uri), { minLength: 1, maxLength: 3 }),
    });

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
 * Generates a FileExtraction with symbols that have no documentation.
 * Uses non-function kinds to avoid needing function-specific fields.
 */
const arbitraryFileExtractionWithUndocumentedSymbols: fc.Arbitrary<FileExtraction> = arbitraryFileURI.chain((uri) =>
    fc.record({
        uri: fc.constant(uri),
        languageId: fc.constantFrom('typescript', 'javascript'),
        symbols: fc.uniqueArray(arbitrarySymbolName, { minLength: 1, maxLength: 5 }).chain((names) =>
            fc.tuple(
                ...names.map((name) =>
                    fc.record({
                        id: fc.constant(name as SymbolID),
                        name: fc.constant(name),
                        kind: arbitraryNonFunctionSymbolKind, // Exclude function/method kinds
                        location: arbitrarySourceLocation(uri),
                        modifiers: fc.uniqueArray(arbitrarySymbolModifier, { maxLength: 3 }),
                        visibility: arbitraryVisibility,
                        signature: fc.string({ minLength: 1, maxLength: 100 }),
                        documentation: fc.constant(null), // Always null documentation
                        children: fc.constant([] as readonly ExtractedSymbol[]),
                    })
                )
            )
        ),
        imports: fc.constant([]),
        exports: fc.constant([]),
        method: arbitraryExtractionMethod,
        timestamp: fc.nat({ max: Date.now() }),
    })
);

/**
 * Generates a FileExtraction with nested symbols (children).
 */
const arbitraryFileExtractionWithNestedSymbols: fc.Arbitrary<FileExtraction> = arbitraryFileURI.chain((uri) =>
    fc.record({
        uri: fc.constant(uri),
        languageId: fc.constantFrom('typescript', 'javascript'),
        symbols: fc.array(arbitraryExtractedSymbolWithChildren(uri), { minLength: 1, maxLength: 3 }),
        imports: fc.constant([]),
        exports: fc.constant([]),
        method: arbitraryExtractionMethod,
        timestamp: fc.nat({ max: Date.now() }),
    })
);

// ============================================================
// Helper Functions
// ============================================================

/**
 * Recursively collects all symbol names from an extraction (including children).
 */
function collectAllSymbolNames(symbols: readonly ExtractedSymbol[], parentName?: string): string[] {
    const names: string[] = [];
    for (const symbol of symbols) {
        names.push(symbol.name);
        // Children are stored with qualified names in definitions
        for (const child of symbol.children) {
            const childPath = `${symbol.name}.${child.name}`;
            names.push(childPath);
            // Recursively collect grandchildren
            for (const grandchild of child.children) {
                names.push(...collectAllSymbolNames([grandchild], childPath));
            }
        }
    }
    return names;
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

describe('Feature: gendocs-extension, Property 3: Schema Generation Completeness', () => {
    /**
     * Property: Every symbol in the FileExtraction appears in the ModuleSchema definitions.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it('every symbol in extraction appears in schema definitions', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                // Every top-level symbol should appear in definitions
                for (const symbol of extraction.symbols) {
                    expect(schema.definitions[symbol.name]).toBeDefined();
                    expect(schema.definitions[symbol.name]!.name).toBe(symbol.name);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: The number of definitions matches the total number of symbols
     * (including nested children).
     *
     * **Validates: Requirements 2.1**
     */
    it('schema definitions count matches total symbol count', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);
                const totalSymbols = countTotalSymbols(extraction.symbols);
                const definitionCount = Object.keys(schema.definitions).length;

                expect(definitionCount).toBe(totalSymbols);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Every symbol schema has name, kind, and signature fields populated.
     *
     * **Validates: Requirements 2.2**
     */
    it('every symbol schema has name, kind, and signature populated', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                for (const [name, symbolSchema] of Object.entries(schema.definitions)) {
                    // name field must be populated
                    expect(symbolSchema.name).toBeDefined();
                    expect(typeof symbolSchema.name).toBe('string');
                    expect(symbolSchema.name.length).toBeGreaterThan(0);

                    // kind field must be populated
                    expect(symbolSchema.kind).toBeDefined();
                    expect(typeof symbolSchema.kind).toBe('string');
                    expect(symbolSchema.kind.length).toBeGreaterThan(0);

                    // signature field must be populated
                    expect(symbolSchema.signature).toBeDefined();
                    expect(typeof symbolSchema.signature).toBe('string');
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Symbols without documentation have an empty description field
     * rather than being omitted or having null/undefined.
     *
     * **Validates: Requirements 2.7**
     */
    it('symbols without documentation have empty description (not null/undefined)', () => {
        fc.assert(
            fc.property(arbitraryFileExtractionWithUndocumentedSymbols, (extraction) => {
                const schema = generateModuleSchema(extraction);

                for (const [name, symbolSchema] of Object.entries(schema.definitions)) {
                    // description field must exist and be a string
                    expect(symbolSchema.description).toBeDefined();
                    expect(typeof symbolSchema.description).toBe('string');
                    // For undocumented symbols, it should be empty string
                    expect(symbolSchema.description).toBe('');
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Symbols with documentation have their documentation preserved.
     * The generator preserves documentation as-is, converting only null to empty string.
     *
     * **Validates: Requirements 2.2**
     */
    it('symbols with documentation have description populated', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                for (const symbol of extraction.symbols) {
                    const symbolSchema = schema.definitions[symbol.name];
                    expect(symbolSchema).toBeDefined();

                    if (symbol.documentation !== null) {
                        // Documentation is preserved as-is (including whitespace-only)
                        expect(symbolSchema!.description).toBe(symbol.documentation);
                    } else {
                        // null documentation becomes empty string
                        expect(symbolSchema!.description).toBe('');
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Every symbol has a valid $id in the schema.
     *
     * **Validates: Requirements 2.1**
     */
    it('every symbol schema has a valid $id', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                for (const [name, symbolSchema] of Object.entries(schema.definitions)) {
                    expect(symbolSchema.$id).toBeDefined();
                    expect(typeof symbolSchema.$id).toBe('string');
                    expect(symbolSchema.$id.length).toBeGreaterThan(0);
                    // $id should contain the symbol name
                    expect(symbolSchema.$id).toContain(name);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: The module schema symbols array references all definitions.
     *
     * **Validates: Requirements 2.1**
     */
    it('module schema symbols array references all definitions', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                // symbols array should have same count as definitions
                expect(schema.symbols.length).toBe(Object.keys(schema.definitions).length);

                // Each symbol reference should correspond to a definition
                for (const symbolRef of schema.symbols) {
                    // Extract the definition name from the $ref
                    const refMatch = symbolRef.match(/#\/definitions\/(.+)$/);
                    expect(refMatch).not.toBeNull();
                    if (refMatch) {
                        const defName = refMatch[1];
                        expect(schema.definitions[defName!]).toBeDefined();
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Nested symbols (children) are included in definitions with qualified names.
     *
     * **Validates: Requirements 2.1**
     */
    it('nested symbols are included in definitions', () => {
        fc.assert(
            fc.property(arbitraryFileExtractionWithNestedSymbols, (extraction) => {
                const schema = generateModuleSchema(extraction);

                for (const symbol of extraction.symbols) {
                    // Parent symbol should be in definitions
                    expect(schema.definitions[symbol.name]).toBeDefined();

                    // Each child should be in definitions with qualified name
                    for (const child of symbol.children) {
                        const childPath = `${symbol.name}.${child.name}`;
                        expect(schema.definitions[childPath]).toBeDefined();
                        expect(schema.definitions[childPath]!.name).toBe(child.name);
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: The module schema has a valid $id matching the file path.
     *
     * **Validates: Requirements 2.1**
     */
    it('module schema has valid $id', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                expect(schema.$id).toBeDefined();
                expect(typeof schema.$id).toBe('string');
                expect(schema.$id.length).toBeGreaterThan(0);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: The module schema path matches the extraction URI.
     *
     * **Validates: Requirements 2.1**
     */
    it('module schema path is derived from extraction URI', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema = generateModuleSchema(extraction);

                expect(schema.path).toBeDefined();
                expect(typeof schema.path).toBe('string');
                // Path should be derived from URI (without file:// prefix)
                expect(extraction.uri).toContain('file://');
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Empty extraction produces empty definitions.
     */
    it('empty extraction produces empty definitions', () => {
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

        expect(Object.keys(schema.definitions)).toHaveLength(0);
        expect(schema.symbols).toHaveLength(0);
    });

    /**
     * Property: generateModuleSchema is deterministic - same input produces same output.
     */
    it('is deterministic', () => {
        fc.assert(
            fc.property(arbitraryFileExtraction, (extraction) => {
                const schema1 = generateModuleSchema(extraction);
                const schema2 = generateModuleSchema(extraction);

                // Compare definitions (excluding any timestamp-like fields)
                expect(Object.keys(schema1.definitions)).toEqual(Object.keys(schema2.definitions));

                for (const name of Object.keys(schema1.definitions)) {
                    expect(schema1.definitions[name]!.name).toBe(schema2.definitions[name]!.name);
                    expect(schema1.definitions[name]!.kind).toBe(schema2.definitions[name]!.kind);
                    expect(schema1.definitions[name]!.signature).toBe(schema2.definitions[name]!.signature);
                    expect(schema1.definitions[name]!.description).toBe(schema2.definitions[name]!.description);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: generateSymbolSchema produces valid output for any symbol.
     */
    it('generateSymbolSchema produces valid output', () => {
        fc.assert(
            fc.property(
                arbitraryFileURI.chain((uri) => arbitraryExtractedSymbol(uri)),
                (symbol) => {
                    const schema = generateSymbolSchema(symbol, '/test/module.ts');

                    expect(schema.name).toBe(symbol.name);
                    expect(schema.kind).toBe(symbol.kind);
                    expect(schema.signature).toBe(symbol.signature);
                    expect(typeof schema.description).toBe('string');
                    expect(schema.$id).toBeDefined();
                    expect(schema.qualifiedName).toBeDefined();
                    expect(schema.modifiers).toEqual(symbol.modifiers);
                    expect(schema.source).toEqual(symbol.location);
                }
            ),
            PROPERTY_CONFIG
        );
    });
});

