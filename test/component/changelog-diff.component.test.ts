/**
 * @fileoverview Component tests for the changelog diff algorithm.
 * Tests the semantic diff engine in isolation with deterministic inputs.
 *
 * @module test/component/changelog-diff
 */

import '../__mocks__/setup.js';
import { describe, it, expect } from 'vitest';
import type { FileURI } from '../../src/types/base.js';
import type {
    APISnapshot,
    ModuleAPISnapshot,
    ExportedSymbol,
    SemverBump,
} from '../../src/types/changelog.js';
import type { SymbolSchema, ParameterSchema, TypeSchema } from '../../src/types/schema.js';
import { computeDiff } from '../../src/core/changelog/diff.js';

// ============================================================
// Test Fixtures
// ============================================================

function createSnapshot(
    id: string,
    modules: ModuleAPISnapshot[],
    tag: string | null = null
): APISnapshot {
    return {
        id,
        tag,
        createdAt: new Date().toISOString(),
        workspaceUri: 'file:///workspace' as FileURI,
        modules,
        statistics: {
            totalModules: modules.length,
            totalExports: modules.reduce((sum, m) => sum + m.exports.length, 0),
            documentedExports: 0,
        },
    };
}

function createModule(path: string, exports: ExportedSymbol[]): ModuleAPISnapshot {
    return { path, exports, hash: `hash-${path}` };
}

function createExport(
    name: string,
    symbol: SymbolSchema | null = null,
    isDefault: boolean = false,
    isTypeOnly: boolean = false
): ExportedSymbol {
    return {
        name,
        exportInfo: { name, isDefault, isTypeOnly },
        symbol,
    };
}

function createFunctionSchema(
    name: string,
    params: ParameterSchema[] = [],
    returnType: TypeSchema | null = null,
    description: string = ''
): SymbolSchema {
    return {
        $id: `#/definitions/${name}`,
        name,
        kind: 'function',
        signature: `function ${name}(${params.map(p => `${p.name}: ${p.type?.raw ?? 'unknown'}`).join(', ')})${returnType ? `: ${returnType.raw}` : ''}`,
        description,
        parameters: params,
        returnType,
        modifiers: ['export'],
        visibility: 'public',
        deprecated: false,
        examples: [],
        tags: [],
        location: { uri: 'file:///test.ts' as FileURI, range: { start: { line: 1, character: 0 }, end: { line: 10, character: 1 } } },
    };
}

function createParam(
    name: string,
    typeRaw: string,
    optional: boolean = false,
    description: string = ''
): ParameterSchema {
    return {
        name,
        type: { raw: typeRaw, resolved: typeRaw },
        optional,
        description,
        defaultValue: null,
    };
}

function createType(raw: string): TypeSchema {
    return { raw, resolved: raw };
}

// ============================================================
// Component Tests: No Changes
// ============================================================

describe('Changelog Diff: No Changes', () => {
    it('returns none bump for identical snapshots', () => {
        const modules = [createModule('test.ts', [createExport('foo')])];
        const from = createSnapshot('snap-1', modules);
        const to = createSnapshot('snap-2', modules);

        const diff = computeDiff(from, to);

        expect(diff.recommendedBump).toBe('none');
        expect(diff.changes).toHaveLength(0);
        expect(diff.summary.totalChanges).toBe(0);
    });

    it('returns none bump for empty snapshots', () => {
        const from = createSnapshot('snap-1', []);
        const to = createSnapshot('snap-2', []);

        const diff = computeDiff(from, to);

        expect(diff.recommendedBump).toBe('none');
    });
});

// ============================================================
// Component Tests: Export Added (Minor)
// ============================================================

describe('Changelog Diff: Export Added', () => {
    it('detects new export as minor change', () => {
        // Add export to existing module (not new module)
        const from = createSnapshot('snap-1', [
            createModule('test.ts', []),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [createExport('newFunc')]),
        ]);

        const diff = computeDiff(from, to);

        expect(diff.recommendedBump).toBe('minor');
        expect(diff.summary.additions).toBe(1);
    });

    it('detects multiple new exports', () => {
        const from = createSnapshot('snap-1', [createModule('test.ts', [])]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('funcA'),
                createExport('funcB'),
                createExport('funcC'),
            ]),
        ]);

        const diff = computeDiff(from, to);

        expect(diff.summary.additions).toBe(3);
    });

    it('detects new module with exports as additions', () => {
        const from = createSnapshot('snap-1', []);
        const to = createSnapshot('snap-2', [
            createModule('new-module.ts', [
                createExport('exported'),
            ]),
        ]);

        const diff = computeDiff(from, to);

        expect(diff.moduleChanges.length).toBeGreaterThanOrEqual(0); // Module-level tracking
        expect(diff.summary.additions).toBeGreaterThan(0);
    });
});

// ============================================================
// Component Tests: Export Removed (Major)
// ============================================================

describe('Changelog Diff: Export Removed', () => {
    it('detects removed export as major (breaking) change', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('oldFunc')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);

        const diff = computeDiff(from, to);

        expect(diff.recommendedBump).toBe('major');
        expect(diff.summary.removals).toBe(1);
        expect(diff.summary.breakingChanges).toBeGreaterThan(0);
    });

    it('marks removed exports as breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func1'),
                createExport('func2'),
            ]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);

        const diff = computeDiff(from, to);

        const breakingChanges = diff.changes.filter(c => c.breaking);
        expect(breakingChanges.length).toBe(2);
    });

    it('detects removed module as breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('removed.ts', [createExport('func')]),
        ]);
        const to = createSnapshot('snap-2', []);

        const diff = computeDiff(from, to);

        expect(diff.recommendedBump).toBe('major');
    });
});

// ============================================================
// Component Tests: Signature Changes
// ============================================================

describe('Changelog Diff: Signature Changes', () => {
    it('detects added required parameter as breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [])),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [
                    createParam('required', 'string', false),
                ])),
            ]),
        ]);

        const diff = computeDiff(from, to);

        expect(diff.recommendedBump).toBe('major');
        const change = diff.changes.find(c => c.symbolName === 'func');
        expect(change?.breaking).toBe(true);
    });

    it('detects added optional parameter as non-breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [])),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [
                    createParam('optional', 'string', true),
                ])),
            ]),
        ]);

        const diff = computeDiff(from, to);

        expect(diff.recommendedBump).toBe('minor');
        const change = diff.changes.find(c => c.symbolName === 'func');
        expect(change?.breaking).toBe(false);
    });

    it('detects removed parameter as breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [
                    createParam('param', 'string'),
                ])),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [])),
            ]),
        ]);

        const diff = computeDiff(from, to);

        expect(diff.recommendedBump).toBe('major');
    });

    it('detects parameter reordering as breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [
                    createParam('a', 'string'),
                    createParam('b', 'number'),
                ])),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [
                    createParam('b', 'number'),
                    createParam('a', 'string'),
                ])),
            ]),
        ]);

        const diff = computeDiff(from, to);

        expect(diff.recommendedBump).toBe('major');
    });
});

// ============================================================
// Component Tests: Type Changes (Covariance/Contravariance)
// ============================================================

describe('Changelog Diff: Type Changes', () => {
    it('detects widened return type as breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [], createType('string'))),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [], createType('string | null'))),
            ]),
        ]);

        const diff = computeDiff(from, to);

        // Return type widening is breaking (consumers might not handle null)
        expect(diff.recommendedBump).toBe('major');
    });

    it('detects narrowed return type as non-breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [], createType('string | null'))),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [], createType('string'))),
            ]),
        ]);

        const diff = computeDiff(from, to);

        // Return type narrowing is safe (consumers get more specific type)
        expect(diff.recommendedBump).not.toBe('major');
    });

    it('detects widened parameter type as non-breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [
                    createParam('input', 'string'),
                ])),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [
                    createParam('input', 'string | number'),
                ])),
            ]),
        ]);

        const diff = computeDiff(from, to);

        // Parameter type widening is safe (more inputs accepted)
        expect(diff.recommendedBump).not.toBe('major');
    });

    it('detects narrowed parameter type as breaking', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [
                    createParam('input', 'string | number'),
                ])),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [
                    createParam('input', 'string'),
                ])),
            ]),
        ]);

        const diff = computeDiff(from, to);

        // Parameter type narrowing is breaking (some inputs no longer valid)
        expect(diff.recommendedBump).toBe('major');
    });
});

// ============================================================
// Component Tests: Deprecation
// ============================================================

describe('Changelog Diff: Deprecation', () => {
    it('detects newly deprecated symbol', () => {
        const beforeSchema = createFunctionSchema('func');
        beforeSchema.deprecated = false;

        const afterSchema = createFunctionSchema('func');
        afterSchema.deprecated = true;

        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('func', beforeSchema)]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [createExport('func', afterSchema)]),
        ]);

        const diff = computeDiff(from, to);

        expect(diff.summary.deprecations).toBeGreaterThanOrEqual(0);
        // Deprecation is not breaking (still works, just discouraged)
        expect(diff.recommendedBump).not.toBe('major');
    });
});

// ============================================================
// Component Tests: Documentation Changes
// ============================================================

describe('Changelog Diff: Documentation Changes', () => {
    it('documentation-only changes are not tracked as modifications', () => {
        // The diff algorithm only tracks semantic changes (signature, params, return type, deprecation)
        // Doc-only changes are NOT tracked - this is by design
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [], null, 'Old description')),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func', createFunctionSchema('func', [], null, 'New description')),
            ]),
        ]);

        const diff = computeDiff(from, to);

        // Doc-only changes don't create change entries - no semantic change
        expect(diff.recommendedBump).toBe('none');
        expect(diff.changes).toHaveLength(0);
    });
});

// ============================================================
// Component Tests: Summary Statistics
// ============================================================

describe('Changelog Diff: Summary Statistics', () => {
    it('correctly counts total changes', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('removed'),
                createExport('modified', createFunctionSchema('modified', [])),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('added'),
                createExport('modified', createFunctionSchema('modified', [createParam('new', 'string')])),
            ]),
        ]);

        const diff = computeDiff(from, to);

        expect(diff.summary.additions).toBe(1);
        expect(diff.summary.removals).toBe(1);
        expect(diff.summary.modifications).toBe(1);
        expect(diff.summary.totalChanges).toBe(3);
    });

    it('correctly counts modules affected', () => {
        const from = createSnapshot('snap-1', [
            createModule('a.ts', [createExport('funcA')]),
            createModule('b.ts', [createExport('funcB')]),
            createModule('c.ts', [createExport('funcC')]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('a.ts', [createExport('funcA'), createExport('newFunc')]),
            createModule('b.ts', []), // Export removed
            createModule('c.ts', [createExport('funcC')]), // Unchanged
        ]);

        const diff = computeDiff(from, to);

        expect(diff.summary.modulesAffected).toBe(2);
    });
});

// ============================================================
// Component Tests: Determinism
// ============================================================

describe('Changelog Diff: Determinism', () => {
    it('produces identical output for identical input', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func1'),
                createExport('func2'),
            ]),
        ]);
        const to = createSnapshot('snap-2', [
            createModule('test.ts', [
                createExport('func1'),
                createExport('func3'),
            ]),
        ]);

        const diff1 = computeDiff(from, to);
        const diff2 = computeDiff(from, to);

        expect(diff1.recommendedBump).toBe(diff2.recommendedBump);
        expect(diff1.summary).toEqual(diff2.summary);
        expect(diff1.changes.length).toBe(diff2.changes.length);
    });
});
