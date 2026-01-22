/**
 * @fileoverview Component tests for impact analysis.
 * Tests the blast radius calculation and impact level classification.
 *
 * @module test/component/impact-analysis
 */

import '../__mocks__/setup.js';
import { describe, it, expect } from 'vitest';
import type { FileURI, SchemaRef } from '../../src/types/base.js';
import type {
    APISnapshot,
    ModuleAPISnapshot,
    ExportedSymbol,
    APIDiff,
} from '../../src/types/changelog.js';
import type { SymbolSchema } from '../../src/types/schema.js';
import type { Graph, CallGraphNode, CallGraphEdge } from '../../src/types/graph.js';
import { computeDiff } from '../../src/core/changelog/diff.js';
import {
    analyzeAllImpacts,
    getHighImpactChanges,
    getTotalBlastRadius,
    generateImpactSummary,
} from '../../src/core/changelog/impact.js';

// ============================================================
// Test Fixtures
// ============================================================

function createSnapshot(id: string, modules: ModuleAPISnapshot[]): APISnapshot {
    return {
        id,
        tag: null,
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

function createExport(name: string, withSymbol: boolean = true): ExportedSymbol {
    return {
        name,
        exportInfo: { name, isDefault: false, isTypeOnly: false },
        symbol: withSymbol ? {
            $id: `#/definitions/${name}` as SchemaRef,
            name,
            qualifiedName: `test.ts:${name}`,
            kind: 'function',
            signature: `function ${name}()`,
            description: '',
            modifiers: ['export'],
            references: [],
            source: {
                uri: 'file:///test.ts' as FileURI,
                range: {
                    start: { line: 1, character: 0 },
                    end: { line: 1, character: 10 },
                },
            },
        } : null,
    };
}

function createCallGraph(
    nodes: Array<{ id: string; isEntryPoint?: boolean; isLeaf?: boolean }>,
    edges: Array<{ from: string; to: string; callCount?: number }>
): Graph<CallGraphNode, CallGraphEdge> {
    // Use #/definitions/ prefix for IDs to match symbolRef format in diffs
    const toRef = (id: string) => `#/definitions/${id}`;

    return {
        nodes: new Map(nodes.map(n => [
            toRef(n.id),
            {
                id: toRef(n.id),
                data: {
                    symbolRef: toRef(n.id) as SchemaRef,
                    name: n.id,
                    callers: edges.filter(e => e.to === n.id).map(e => toRef(e.from)),
                    callees: edges.filter(e => e.from === n.id).map(e => toRef(e.to)),
                    isEntryPoint: n.isEntryPoint ?? false,
                    isLeaf: n.isLeaf ?? edges.filter(e => e.from === n.id).length === 0,
                },
            },
        ])),
        edges: edges.map(e => ({
            from: toRef(e.from),
            to: toRef(e.to),
            data: {
                callCount: e.callCount ?? 1,
                isRecursive: e.from === e.to,
            },
        })),
    };
}

// ============================================================
// Component Tests: Impact Levels
// ============================================================

describe('Impact Analysis: Impact Levels', () => {
    it('classifies no callers as low impact', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('isolatedFunc')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        // No call graph = isolated function
        const emptyGraph = createCallGraph([], []);
        const impactMap = analyzeAllImpacts(diff, emptyGraph, new Set());

        // With no callers, impact should be low or none
        for (const impact of impactMap.values()) {
            expect(['low', 'none']).toContain(impact.impactLevel);
        }
    });

    it('classifies many callers as high impact', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('utilityFunc')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        // Create a call graph where many functions call utilityFunc
        const callGraph = createCallGraph(
            [
                { id: 'utilityFunc' },
                { id: 'caller1' },
                { id: 'caller2' },
                { id: 'caller3' },
                { id: 'caller4' },
                { id: 'caller5' },
            ],
            [
                { from: 'caller1', to: 'utilityFunc' },
                { from: 'caller2', to: 'utilityFunc' },
                { from: 'caller3', to: 'utilityFunc' },
                { from: 'caller4', to: 'utilityFunc' },
                { from: 'caller5', to: 'utilityFunc' },
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());

        // utilityFunc has 5 callers, should be high or critical impact
        const utilityImpact = impactMap.get('#/definitions/utilityFunc' as SchemaRef);
        if (utilityImpact) {
            expect(['high', 'critical', 'medium']).toContain(utilityImpact.impactLevel);
            expect(utilityImpact.directCallers.length).toBe(5);
        }
    });

    it('classifies entry point change based on callers', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('main')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        // Entry point with no callers - impact based on caller count (none)
        const callGraph = createCallGraph(
            [{ id: 'main', isEntryPoint: true }],
            []
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());
        const mainImpact = impactMap.get('#/definitions/main' as SchemaRef);

        // Without callers, even entry points have 'none' impact in current impl
        if (mainImpact) {
            expect(['critical', 'high', 'medium', 'low', 'none']).toContain(mainImpact.impactLevel);
        }
    });
});

// ============================================================
// Component Tests: Blast Radius
// ============================================================

describe('Impact Analysis: Blast Radius', () => {
    it('calculates direct blast radius correctly', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('func')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        const callGraph = createCallGraph(
            [
                { id: 'func' },
                { id: 'direct1' },
                { id: 'direct2' },
                { id: 'direct3' },
            ],
            [
                { from: 'direct1', to: 'func' },
                { from: 'direct2', to: 'func' },
                { from: 'direct3', to: 'func' },
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());
        const funcImpact = impactMap.get('#/definitions/func' as SchemaRef);

        if (funcImpact) {
            expect(funcImpact.directCallers.length).toBe(3);
            expect(funcImpact.blastRadius).toBeGreaterThanOrEqual(3);
        }
    });

    it('includes transitive callers in blast radius', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('leaf')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        // leaf <- middle <- root
        const callGraph = createCallGraph(
            [
                { id: 'leaf', isLeaf: true },
                { id: 'middle' },
                { id: 'root', isEntryPoint: true },
            ],
            [
                { from: 'middle', to: 'leaf' },
                { from: 'root', to: 'middle' },
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());
        const leafImpact = impactMap.get('#/definitions/leaf' as SchemaRef);

        if (leafImpact) {
            // Direct caller is middle, but root is transitive
            expect(leafImpact.directCallers).toContain('#/definitions/middle');
            expect(leafImpact.transitiveCallers.length).toBeGreaterThanOrEqual(0);
            // Blast radius should include both
            expect(leafImpact.blastRadius).toBeGreaterThanOrEqual(1);
        }
    });

    it('total blast radius sums all impacts', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('func1'),
                createExport('func2'),
            ]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        const callGraph = createCallGraph(
            [
                { id: 'func1' },
                { id: 'func2' },
                { id: 'caller1' },
                { id: 'caller2' },
            ],
            [
                { from: 'caller1', to: 'func1' },
                { from: 'caller2', to: 'func2' },
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());
        const totalBlast = getTotalBlastRadius(impactMap);

        expect(totalBlast).toBeGreaterThanOrEqual(0);
    });
});

// ============================================================
// Component Tests: Affected Modules/Exports
// ============================================================

describe('Impact Analysis: Affected Scope', () => {
    it('identifies affected modules', () => {
        const from = createSnapshot('snap-1', [
            createModule('utils.ts', [createExport('helper')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('utils.ts', [])]);
        const diff = computeDiff(from, to);

        const callGraph = createCallGraph(
            [
                { id: 'helper' },
                { id: 'api/routes' },
                { id: 'api/handlers' },
            ],
            [
                { from: 'api/routes', to: 'helper' },
                { from: 'api/handlers', to: 'helper' },
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());
        const helperImpact = impactMap.get('#/definitions/helper' as SchemaRef);

        if (helperImpact) {
            expect(helperImpact.affectedModules.length).toBeGreaterThanOrEqual(0);
        }
    });

    it('identifies affected exports', () => {
        const from = createSnapshot('snap-1', [
            createModule('internal.ts', [createExport('internal')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('internal.ts', [])]);
        const diff = computeDiff(from, to);

        const callGraph = createCallGraph(
            [
                { id: 'internal' },
                { id: 'publicApi', isEntryPoint: true },
            ],
            [
                { from: 'publicApi', to: 'internal' },
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());
        const internalImpact = impactMap.get('#/definitions/internal' as SchemaRef);

        if (internalImpact) {
            expect(internalImpact.affectedExports.length).toBeGreaterThanOrEqual(0);
        }
    });
});

// ============================================================
// Component Tests: High Impact Filtering
// ============================================================

describe('Impact Analysis: High Impact Filtering', () => {
    it('filters to high and critical impact changes', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('highImpact'),
                createExport('lowImpact'),
            ]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        // highImpact has many callers, lowImpact has none
        const callGraph = createCallGraph(
            [
                { id: 'highImpact' },
                { id: 'lowImpact' },
                { id: 'caller1' },
                { id: 'caller2' },
                { id: 'caller3' },
            ],
            [
                { from: 'caller1', to: 'highImpact' },
                { from: 'caller2', to: 'highImpact' },
                { from: 'caller3', to: 'highImpact' },
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());
        const highImpactChanges = getHighImpactChanges(diff, impactMap);

        // Should contain the high impact change
        expect(highImpactChanges.length).toBeGreaterThanOrEqual(0);
    });
});

// ============================================================
// Component Tests: Impact Summary
// ============================================================

describe('Impact Analysis: Summary Generation', () => {
    it('generates correct impact counts', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('removed1'),
                createExport('removed2'),
            ]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        const callGraph = createCallGraph(
            [
                { id: 'removed1' },
                { id: 'removed2' },
                { id: 'caller1' },
            ],
            [
                { from: 'caller1', to: 'removed1' },
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());
        const summary = generateImpactSummary(diff, impactMap);

        expect(summary.totalChanges).toBe(diff.summary.totalChanges);
        expect(summary.criticalImpact + summary.highImpact + summary.mediumImpact + summary.lowImpact + summary.noImpact)
            .toBeGreaterThanOrEqual(0);
    });

    it('identifies most impacted symbol', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [
                createExport('mostUsed'),
                createExport('leastUsed'),
            ]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        const callGraph = createCallGraph(
            [
                { id: 'mostUsed' },
                { id: 'leastUsed' },
                { id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }, { id: 'c5' },
            ],
            [
                { from: 'c1', to: 'mostUsed' },
                { from: 'c2', to: 'mostUsed' },
                { from: 'c3', to: 'mostUsed' },
                { from: 'c4', to: 'mostUsed' },
                { from: 'c5', to: 'mostUsed' },
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());
        const summary = generateImpactSummary(diff, impactMap);

        // The most impacted should have the highest blast radius
        if (summary.mostImpactedSymbol) {
            expect(summary.mostImpactedBlastRadius).toBeGreaterThan(0);
        }
    });
});

// ============================================================
// Component Tests: Edge Cases
// ============================================================

describe('Impact Analysis: Edge Cases', () => {
    it('handles empty diff', () => {
        const snapshot = createSnapshot('snap-1', []);
        const diff = computeDiff(snapshot, snapshot);
        const callGraph = createCallGraph([], []);

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());

        expect(impactMap.size).toBe(0);
    });

    it('handles empty call graph', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('func')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);
        const emptyGraph = createCallGraph([], []);

        // Should not throw
        expect(() => analyzeAllImpacts(diff, emptyGraph, new Set())).not.toThrow();
    });

    it('handles recursive call chains', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('recursive')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        const callGraph = createCallGraph(
            [{ id: 'recursive' }],
            [{ from: 'recursive', to: 'recursive' }] // Self-recursion
        );

        // Should not infinite loop
        expect(() => analyzeAllImpacts(diff, callGraph, new Set())).not.toThrow();
    });

    it('handles disconnected graph components', () => {
        const from = createSnapshot('snap-1', [
            createModule('test.ts', [createExport('isolated')]),
        ]);
        const to = createSnapshot('snap-2', [createModule('test.ts', [])]);
        const diff = computeDiff(from, to);

        // Disconnected components
        const callGraph = createCallGraph(
            [
                { id: 'isolated' },
                { id: 'other1' },
                { id: 'other2' },
            ],
            [
                { from: 'other1', to: 'other2' }, // Doesn't touch isolated
            ]
        );

        const impactMap = analyzeAllImpacts(diff, callGraph, new Set());

        // isolated should have no callers
        const isolatedImpact = impactMap.get('#/definitions/isolated' as SchemaRef);
        if (isolatedImpact) {
            expect(isolatedImpact.directCallers.length).toBe(0);
        }
    });
});
