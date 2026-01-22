/**
 * @fileoverview Property-based tests for coverage calculation accuracy.
 * Tests Property 21: Coverage Calculation Accuracy from the design document.
 *
 * **Validates: Requirements 39.1**
 *
 * Property Statement:
 * *For any* WorkspaceSchema, the calculated coverage percentage SHALL equal
 * (number of symbols with non-empty description / total number of symbols) * 100,
 * rounded to two decimal places.
 *
 * @module test/property/coverage-calculation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { FileURI, SchemaRef } from '../../src/types/base.js';
import type { SymbolKind, SymbolModifier } from '../../src/types/symbols.js';
import type {
    ModuleSchema,
    SymbolSchema,
    WorkspaceSchema,
    ModuleRef,
    WorkspaceStatistics,
} from '../../src/types/schema.js';
import { calculateCoverage } from '../../src/core/linter/linter.js';

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
// Arbitrary Generators - Symbol Schema
// ============================================================

/**
 * Generates a non-empty, non-whitespace-only string for documentation.
 * Ensures the description will be considered "documented" after trimming.
 */
const arbitraryNonEmptyDescription: fc.Arbitrary<string> = fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9 ]*$/)
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

/**
 * Generates a SymbolSchema with a specific documentation state.
 * @param name - The symbol name
 * @param hasDocumentation - Whether the symbol should have documentation
 * @param uri - The file URI for source location
 */
const arbitrarySymbolSchema = (
    name: string,
    hasDocumentation: boolean,
    uri: FileURI
): fc.Arbitrary<SymbolSchema> =>
    fc.record({
        $id: fc.constant(`#/definitions/${name}` as SchemaRef),
        name: fc.constant(name),
        qualifiedName: fc.constant(`module.${name}`),
        kind: arbitrarySymbolKind,
        signature: fc.string({ minLength: 1, maxLength: 100 }),
        description: hasDocumentation
            ? arbitraryNonEmptyDescription // Non-empty, non-whitespace description
            : fc.constant(''), // Empty description (undocumented)
        modifiers: fc.uniqueArray(arbitrarySymbolModifier, { maxLength: 3 }),
        references: fc.constant([] as readonly SchemaRef[]),
        source: arbitrarySourceLocation(uri),
    });

// ============================================================
// Arbitrary Generators - Module Schema
// ============================================================

/**
 * Generates a ModuleSchema with a specific number of documented and undocumented symbols.
 * @param documentedCount - Number of symbols with documentation
 * @param undocumentedCount - Number of symbols without documentation
 */
const arbitraryModuleSchemaWithCounts = (
    documentedCount: number,
    undocumentedCount: number
): fc.Arbitrary<ModuleSchema> =>
    arbitraryFileURI.chain((uri) => {
        const totalCount = documentedCount + undocumentedCount;

        // Generate unique names for all symbols
        return fc.uniqueArray(arbitrarySymbolName, { minLength: totalCount, maxLength: totalCount })
            .chain((names) => {
                // Split names into documented and undocumented
                const documentedNames = names.slice(0, documentedCount);
                const undocumentedNames = names.slice(documentedCount);

                // Generate symbol schemas
                const documentedSymbols = documentedNames.map((name) =>
                    arbitrarySymbolSchema(name, true, uri)
                );
                const undocumentedSymbols = undocumentedNames.map((name) =>
                    arbitrarySymbolSchema(name, false, uri)
                );

                return fc.tuple(...documentedSymbols, ...undocumentedSymbols).map((symbols) => {
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
                });
            });
    });

/**
 * Generates a random ModuleSchema with varying documentation coverage.
 */
const arbitraryModuleSchema: fc.Arbitrary<ModuleSchema> = fc
    .tuple(
        fc.nat({ max: 10 }), // documented count
        fc.nat({ max: 10 })  // undocumented count
    )
    .filter(([doc, undoc]) => doc + undoc > 0) // At least one symbol
    .chain(([doc, undoc]) => arbitraryModuleSchemaWithCounts(doc, undoc));

// ============================================================
// Arbitrary Generators - Workspace Schema
// ============================================================

/**
 * Generates a ModuleSchema with a specific path.
 */
const arbitraryModuleSchemaWithPath = (path: string): fc.Arbitrary<ModuleSchema> =>
    fc
        .tuple(
            fc.nat({ max: 10 }), // documented count
            fc.nat({ max: 10 })  // undocumented count
        )
        .filter(([doc, undoc]) => doc + undoc > 0) // At least one symbol
        .chain(([documentedCount, undocumentedCount]) => {
            const totalCount = documentedCount + undocumentedCount;
            const uri = `file:///${path}` as FileURI;

            return fc.uniqueArray(arbitrarySymbolName, { minLength: totalCount, maxLength: totalCount })
                .chain((names) => {
                    const documentedNames = names.slice(0, documentedCount);
                    const undocumentedNames = names.slice(documentedCount);

                    const documentedSymbols = documentedNames.map((name) =>
                        arbitrarySymbolSchema(name, true, uri)
                    );
                    const undocumentedSymbols = undocumentedNames.map((name) =>
                        arbitrarySymbolSchema(name, false, uri)
                    );

                    return fc.tuple(...documentedSymbols, ...undocumentedSymbols).map((symbols) => {
                        const definitions: Record<string, SymbolSchema> = {};
                        const symbolRefs: SchemaRef[] = [];

                        for (const symbol of symbols) {
                            definitions[symbol.name] = symbol;
                            symbolRefs.push(`#/definitions/${symbol.name}` as SchemaRef);
                        }

                        const moduleSchema: ModuleSchema = {
                            $id: uri as unknown as SchemaRef,
                            path,
                            symbols: symbolRefs,
                            imports: [],
                            exports: [],
                            definitions,
                        };

                        return moduleSchema;
                    });
                });
        });

/**
 * Generates unique module paths.
 */
const arbitraryUniquePaths = (count: number): fc.Arbitrary<string[]> =>
    fc.uniqueArray(
        fc.stringMatching(/^[a-z][a-z0-9_]*$/).filter((s) => s.length > 0 && s.length <= 20),
        { minLength: count, maxLength: count }
    ).map((names) => names.map((name) => `${name}.ts`));

/**
 * Generates a WorkspaceSchema with associated ModuleSchemas.
 * Ensures unique module paths to avoid Map key collisions.
 */
const arbitraryWorkspaceWithModules: fc.Arbitrary<{
    workspace: WorkspaceSchema;
    modules: ReadonlyMap<string, ModuleSchema>;
}> = fc
    .integer({ min: 1, max: 5 })
    .chain((moduleCount) =>
        arbitraryUniquePaths(moduleCount).chain((paths) =>
            fc.tuple(...paths.map((path) => arbitraryModuleSchemaWithPath(path)))
        )
    )
    .map((moduleSchemas) => {
        const modules = new Map<string, ModuleSchema>();
        const moduleRefs: ModuleRef[] = [];

        for (const moduleSchema of moduleSchemas) {
            modules.set(moduleSchema.path, moduleSchema);

            const totalSymbols = Object.keys(moduleSchema.definitions).length;
            const documentedSymbols = Object.values(moduleSchema.definitions).filter(
                (s) => s.description.trim().length > 0
            ).length;

            moduleRefs.push({
                $ref: `./modules/${moduleSchema.path}.schema.json` as SchemaRef,
                path: moduleSchema.path,
                exports: totalSymbols,
                documented: documentedSymbols,
                freshness: 'fresh',
            });
        }

        const statistics: WorkspaceStatistics = {
            totalModules: moduleSchemas.length,
            totalSymbols: 0,
            documentedSymbols: 0,
            coveragePercent: 0,
            freshModules: moduleSchemas.length,
            staleModules: 0,
            circularDependencies: 0,
        };

        const workspace: WorkspaceSchema = {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            modules: moduleRefs,
            statistics,
        };

        return { workspace, modules };
    });

/**
 * Generates an empty workspace (no modules).
 */
const arbitraryEmptyWorkspace: fc.Arbitrary<{
    workspace: WorkspaceSchema;
    modules: ReadonlyMap<string, ModuleSchema>;
}> = fc.constant({
    workspace: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        modules: [],
        statistics: {
            totalModules: 0,
            totalSymbols: 0,
            documentedSymbols: 0,
            coveragePercent: 0,
            freshModules: 0,
            staleModules: 0,
            circularDependencies: 0,
        },
    },
    modules: new Map<string, ModuleSchema>(),
});

/**
 * Generates a workspace where all symbols are documented.
 */
const arbitraryFullyDocumentedWorkspace: fc.Arbitrary<{
    workspace: WorkspaceSchema;
    modules: ReadonlyMap<string, ModuleSchema>;
}> = fc
    .integer({ min: 1, max: 3 })
    .chain((moduleCount) =>
        arbitraryUniquePaths(moduleCount).chain((paths) =>
            fc.tuple(
                ...paths.map((path) => {
                    const uri = `file:///${path}` as FileURI;
                    return fc
                        .integer({ min: 1, max: 10 })
                        .chain((symbolCount) =>
                            fc.uniqueArray(arbitrarySymbolName, { minLength: symbolCount, maxLength: symbolCount })
                                .chain((names) =>
                                    fc.tuple(...names.map((name) => arbitrarySymbolSchema(name, true, uri)))
                                        .map((symbols) => {
                                            const definitions: Record<string, SymbolSchema> = {};
                                            const symbolRefs: SchemaRef[] = [];

                                            for (const symbol of symbols) {
                                                definitions[symbol.name] = symbol;
                                                symbolRefs.push(`#/definitions/${symbol.name}` as SchemaRef);
                                            }

                                            const moduleSchema: ModuleSchema = {
                                                $id: uri as unknown as SchemaRef,
                                                path,
                                                symbols: symbolRefs,
                                                imports: [],
                                                exports: [],
                                                definitions,
                                            };

                                            return moduleSchema;
                                        })
                                )
                        );
                })
            )
        )
    )
    .map((moduleSchemas) => {
        const modules = new Map<string, ModuleSchema>();
        const moduleRefs: ModuleRef[] = [];

        for (const moduleSchema of moduleSchemas) {
            modules.set(moduleSchema.path, moduleSchema);
            const totalSymbols = Object.keys(moduleSchema.definitions).length;

            moduleRefs.push({
                $ref: `./modules/${moduleSchema.path}.schema.json` as SchemaRef,
                path: moduleSchema.path,
                exports: totalSymbols,
                documented: totalSymbols,
                freshness: 'fresh',
            });
        }

        const workspace: WorkspaceSchema = {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            modules: moduleRefs,
            statistics: {
                totalModules: moduleSchemas.length,
                totalSymbols: 0,
                documentedSymbols: 0,
                coveragePercent: 0,
                freshModules: moduleSchemas.length,
                staleModules: 0,
                circularDependencies: 0,
            },
        };

        return { workspace, modules };
    });

/**
 * Generates a workspace where no symbols are documented.
 */
const arbitraryUndocumentedWorkspace: fc.Arbitrary<{
    workspace: WorkspaceSchema;
    modules: ReadonlyMap<string, ModuleSchema>;
}> = fc
    .integer({ min: 1, max: 3 })
    .chain((moduleCount) =>
        arbitraryUniquePaths(moduleCount).chain((paths) =>
            fc.tuple(
                ...paths.map((path) => {
                    const uri = `file:///${path}` as FileURI;
                    return fc
                        .integer({ min: 1, max: 10 })
                        .chain((symbolCount) =>
                            fc.uniqueArray(arbitrarySymbolName, { minLength: symbolCount, maxLength: symbolCount })
                                .chain((names) =>
                                    fc.tuple(...names.map((name) => arbitrarySymbolSchema(name, false, uri)))
                                        .map((symbols) => {
                                            const definitions: Record<string, SymbolSchema> = {};
                                            const symbolRefs: SchemaRef[] = [];

                                            for (const symbol of symbols) {
                                                definitions[symbol.name] = symbol;
                                                symbolRefs.push(`#/definitions/${symbol.name}` as SchemaRef);
                                            }

                                            const moduleSchema: ModuleSchema = {
                                                $id: uri as unknown as SchemaRef,
                                                path,
                                                symbols: symbolRefs,
                                                imports: [],
                                                exports: [],
                                                definitions,
                                            };

                                            return moduleSchema;
                                        })
                                )
                        );
                })
            )
        )
    )
    .map((moduleSchemas) => {
        const modules = new Map<string, ModuleSchema>();
        const moduleRefs: ModuleRef[] = [];

        for (const moduleSchema of moduleSchemas) {
            modules.set(moduleSchema.path, moduleSchema);
            const totalSymbols = Object.keys(moduleSchema.definitions).length;

            moduleRefs.push({
                $ref: `./modules/${moduleSchema.path}.schema.json` as SchemaRef,
                path: moduleSchema.path,
                exports: totalSymbols,
                documented: 0,
                freshness: 'fresh',
            });
        }

        const workspace: WorkspaceSchema = {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            modules: moduleRefs,
            statistics: {
                totalModules: moduleSchemas.length,
                totalSymbols: 0,
                documentedSymbols: 0,
                coveragePercent: 0,
                freshModules: moduleSchemas.length,
                staleModules: 0,
                circularDependencies: 0,
            },
        };

        return { workspace, modules };
    });

// ============================================================
// Helper Functions
// ============================================================

/**
 * Rounds a number to two decimal places.
 * This must match the implementation in linter.ts.
 */
function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Manually calculates expected coverage from module schemas.
 * This is the reference implementation for testing.
 */
function calculateExpectedCoverage(modules: ReadonlyMap<string, ModuleSchema>): {
    totalSymbols: number;
    documentedSymbols: number;
    coveragePercent: number;
} {
    let totalSymbols = 0;
    let documentedSymbols = 0;

    for (const module of modules.values()) {
        for (const symbol of Object.values(module.definitions)) {
            totalSymbols++;
            if (symbol.description.trim().length > 0) {
                documentedSymbols++;
            }
        }
    }

    const coveragePercent =
        totalSymbols > 0
            ? roundToTwoDecimals((documentedSymbols / totalSymbols) * 100)
            : 100;

    return { totalSymbols, documentedSymbols, coveragePercent };
}

// ============================================================
// Property Tests
// ============================================================

describe('Feature: gendocs-extension, Property 21: Coverage Calculation Accuracy', () => {
    /**
     * Property: Coverage percentage equals (documented/total) * 100, rounded to 2 decimals.
     *
     * **Validates: Requirements 39.1**
     */
    it('coverage equals documented/total * 100 rounded to 2 decimals', () => {
        fc.assert(
            fc.property(arbitraryWorkspaceWithModules, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);
                const expected = calculateExpectedCoverage(modules);

                expect(report.totalSymbols).toBe(expected.totalSymbols);
                expect(report.documentedSymbols).toBe(expected.documentedSymbols);
                expect(report.coveragePercent).toBe(expected.coveragePercent);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Coverage is always between 0 and 100 (inclusive).
     *
     * **Validates: Requirements 39.1**
     */
    it('coverage percentage is always between 0 and 100', () => {
        fc.assert(
            fc.property(arbitraryWorkspaceWithModules, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);

                expect(report.coveragePercent).toBeGreaterThanOrEqual(0);
                expect(report.coveragePercent).toBeLessThanOrEqual(100);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: documentedSymbols is always <= totalSymbols.
     *
     * **Validates: Requirements 39.1**
     */
    it('documented symbols count is always <= total symbols count', () => {
        fc.assert(
            fc.property(arbitraryWorkspaceWithModules, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);

                expect(report.documentedSymbols).toBeLessThanOrEqual(report.totalSymbols);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Per-module coverage sums match workspace totals.
     *
     * **Validates: Requirements 39.1**
     */
    it('per-module coverage sums match workspace totals', () => {
        fc.assert(
            fc.property(arbitraryWorkspaceWithModules, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);

                const sumTotal = report.byModule.reduce((sum, m) => sum + m.totalSymbols, 0);
                const sumDocumented = report.byModule.reduce((sum, m) => sum + m.documentedSymbols, 0);

                expect(sumTotal).toBe(report.totalSymbols);
                expect(sumDocumented).toBe(report.documentedSymbols);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Each module coverage is calculated correctly.
     *
     * **Validates: Requirements 39.1**
     */
    it('each module coverage is calculated correctly', () => {
        fc.assert(
            fc.property(arbitraryWorkspaceWithModules, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);

                for (const moduleCoverage of report.byModule) {
                    const moduleSchema = modules.get(moduleCoverage.path);
                    expect(moduleSchema).toBeDefined();

                    if (moduleSchema) {
                        const symbols = Object.values(moduleSchema.definitions);
                        const expectedTotal = symbols.length;
                        const expectedDocumented = symbols.filter(
                            (s) => s.description.trim().length > 0
                        ).length;
                        const expectedPercent =
                            expectedTotal > 0
                                ? roundToTwoDecimals((expectedDocumented / expectedTotal) * 100)
                                : 100;

                        expect(moduleCoverage.totalSymbols).toBe(expectedTotal);
                        expect(moduleCoverage.documentedSymbols).toBe(expectedDocumented);
                        expect(moduleCoverage.coveragePercent).toBe(expectedPercent);
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Edge case: Empty workspace returns 100% coverage (no symbols to document).
     *
     * **Validates: Requirements 39.1**
     */
    it('empty workspace returns 100% coverage', () => {
        fc.assert(
            fc.property(arbitraryEmptyWorkspace, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);

                expect(report.totalSymbols).toBe(0);
                expect(report.documentedSymbols).toBe(0);
                expect(report.coveragePercent).toBe(100);
                expect(report.byModule).toHaveLength(0);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Edge case: Fully documented workspace returns 100% coverage.
     *
     * **Validates: Requirements 39.1**
     */
    it('fully documented workspace returns 100% coverage', () => {
        fc.assert(
            fc.property(arbitraryFullyDocumentedWorkspace, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);

                expect(report.coveragePercent).toBe(100);
                expect(report.documentedSymbols).toBe(report.totalSymbols);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Edge case: Completely undocumented workspace returns 0% coverage.
     *
     * **Validates: Requirements 39.1**
     */
    it('undocumented workspace returns 0% coverage', () => {
        fc.assert(
            fc.property(arbitraryUndocumentedWorkspace, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);

                expect(report.coveragePercent).toBe(0);
                expect(report.documentedSymbols).toBe(0);
                expect(report.totalSymbols).toBeGreaterThan(0);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Coverage calculation is deterministic.
     *
     * **Validates: Requirements 39.1**
     */
    it('coverage calculation is deterministic', () => {
        fc.assert(
            fc.property(arbitraryWorkspaceWithModules, ({ workspace, modules }) => {
                const report1 = calculateCoverage(workspace, modules);
                const report2 = calculateCoverage(workspace, modules);

                expect(report1.totalSymbols).toBe(report2.totalSymbols);
                expect(report1.documentedSymbols).toBe(report2.documentedSymbols);
                expect(report1.coveragePercent).toBe(report2.coveragePercent);
                expect(report1.byModule.length).toBe(report2.byModule.length);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Coverage percentage is rounded to exactly 2 decimal places.
     *
     * **Validates: Requirements 39.1**
     */
    it('coverage percentage is rounded to 2 decimal places', () => {
        fc.assert(
            fc.property(arbitraryWorkspaceWithModules, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);

                // Check that the coverage has at most 2 decimal places
                const coverageStr = report.coveragePercent.toString();
                const decimalIndex = coverageStr.indexOf('.');
                if (decimalIndex !== -1) {
                    const decimalPlaces = coverageStr.length - decimalIndex - 1;
                    expect(decimalPlaces).toBeLessThanOrEqual(2);
                }

                // Also verify by rounding
                expect(report.coveragePercent).toBe(roundToTwoDecimals(report.coveragePercent));
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: byModule array has one entry per module in workspace.
     *
     * **Validates: Requirements 39.1**
     */
    it('byModule array has one entry per module', () => {
        fc.assert(
            fc.property(arbitraryWorkspaceWithModules, ({ workspace, modules }) => {
                const report = calculateCoverage(workspace, modules);

                expect(report.byModule.length).toBe(workspace.modules.length);

                // Each module path should appear exactly once
                const paths = report.byModule.map((m) => m.path);
                const uniquePaths = new Set(paths);
                expect(uniquePaths.size).toBe(paths.length);
            }),
            PROPERTY_CONFIG
        );
    });
});
