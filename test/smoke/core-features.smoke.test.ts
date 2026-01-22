/**
 * @fileoverview Smoke tests for core features.
 * Quick sanity checks that main functionality doesn't blow up.
 *
 * These tests verify basic happy paths work without errors.
 * They're fast to run and catch obvious breakage.
 *
 * @module test/smoke/core-features
 */

import '../__mocks__/setup.js';
import { describe, it, expect } from 'vitest';
import type { FileURI } from '../../src/types/base.js';
import type { ExtractedSymbol, ExtractionResult } from '../../src/types/extraction.js';
import type { SymbolSchema, ModuleSchema } from '../../src/types/schema.js';
import type { APISnapshot, ModuleAPISnapshot, APIDiff, ExportedSymbol } from '../../src/types/changelog.js';

// Core modules under test
import { generateModuleSchema, generateSymbolSchema } from '../../src/core/schema/generator.js';
import { renderModule } from '../../src/core/renderer/markdown.js';
import { renderDependencyGraph, renderCallGraph } from '../../src/core/renderer/mermaid.js';
import { computeDiff } from '../../src/core/changelog/diff.js';
import { renderChangelog } from '../../src/core/changelog/renderer.js';
import { analyzeImpact } from '../../src/core/changelog/impact.js';
import { extractFlowMatrix } from '../../src/core/analysis/flow.js';
import { detectCycles } from '../../src/core/graph/algorithms.js';
import { getDefault as getDefaultConfig } from '../../src/state/config.js';

// ============================================================
// Test Fixtures
// ============================================================

function validLocation(line: number = 1, endLine: number = 1) {
    return {
        uri: 'file:///test/example.ts' as FileURI,
        range: {
            start: { line, character: 0 },
            end: { line: endLine, character: 10 },
        },
    };
}

function createMinimalSymbol(name: string, kind: string = 'function'): ExtractedSymbol {
    return {
        name,
        kind,
        signature: `${kind} ${name}()`,
        location: validLocation(),
        documentation: null,
        modifiers: [],
        children: [],
    };
}

function createMinimalExtraction(symbols: ExtractedSymbol[]): ExtractionResult {
    return {
        uri: 'file:///test/example.ts' as FileURI,
        languageId: 'typescript',
        symbols,
        imports: [],
        exports: [],
        method: 'lsp',
        timestamp: Date.now(),
    };
}

function createMinimalSnapshot(id: string, modules: ModuleAPISnapshot[]): APISnapshot {
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

function createMinimalModuleSnapshot(path: string, exports: ExportedSymbol[]): ModuleAPISnapshot {
    return {
        path,
        exports,
        hash: 'abc123',
    };
}

// ============================================================
// Smoke Tests: Schema Generation
// ============================================================

describe('Smoke: Schema Generation', () => {
    it('generates module schema without throwing', () => {
        const extraction = createMinimalExtraction([
            createMinimalSymbol('foo'),
            createMinimalSymbol('bar'),
        ]);

        expect(() => generateModuleSchema(extraction)).not.toThrow();
    });

    it('generates symbol schema without throwing', () => {
        const symbol = createMinimalSymbol('testFunc', 'function');

        expect(() => generateSymbolSchema(symbol, 'file:///test.ts' as FileURI)).not.toThrow();
    });

    it('handles empty extraction', () => {
        const extraction = createMinimalExtraction([]);
        const schema = generateModuleSchema(extraction);

        expect(schema).toBeDefined();
        expect(Object.keys(schema.definitions)).toHaveLength(0);
    });

    it('handles symbols with all optional fields', () => {
        const symbol: ExtractedSymbol = {
            name: 'complex',
            kind: 'function',
            signature: 'function complex(a: string, b: number): boolean',
            location: validLocation(10, 20),
            documentation: {
                summary: 'A complex function',
                description: 'Does complex things',
                params: [
                    { name: 'a', type: 'string', description: 'First param' },
                    { name: 'b', type: 'number', description: 'Second param' },
                ],
                returns: { type: 'boolean', description: 'The result' },
                examples: ['complex("hello", 42)'],
                tags: [{ name: 'since', value: '1.0.0' }],
            },
            modifiers: ['export', 'async'],
            children: [],
        };

        expect(() => generateSymbolSchema(symbol, 'file:///test.ts' as FileURI)).not.toThrow();
    });
});

// ============================================================
// Smoke Tests: Markdown Rendering
// ============================================================

describe('Smoke: Markdown Rendering', () => {
    it('renders module schema without throwing', () => {
        const extraction = createMinimalExtraction([createMinimalSymbol('test')]);
        const schema = generateModuleSchema(extraction);

        expect(() => renderModule(schema)).not.toThrow();
    });

    it('renders empty module', () => {
        const extraction = createMinimalExtraction([]);
        const schema = generateModuleSchema(extraction);
        const markdown = renderModule(schema);

        expect(markdown).toContain('#');
        expect(typeof markdown).toBe('string');
    });

    it('renders with harsh mode enabled', () => {
        const extraction = createMinimalExtraction([createMinimalSymbol('undocumented')]);
        const schema = generateModuleSchema(extraction);

        expect(() => renderModule(schema, undefined, { harshMode: true })).not.toThrow();
    });
});

// ============================================================
// Smoke Tests: Mermaid Diagrams
// ============================================================

describe('Smoke: Mermaid Diagrams', () => {
    it('renders dependency graph without throwing', () => {
        const graph = {
            nodes: new Map([
                ['a', { id: 'a', data: { path: 'a.ts', imports: ['b'], exports: ['foo'] } }],
                ['b', { id: 'b', data: { path: 'b.ts', imports: [], exports: ['bar'] } }],
            ]),
            edges: [{ from: 'a', to: 'b', data: { importCount: 1 } }],
        };

        expect(() => renderDependencyGraph(graph)).not.toThrow();
    });

    it('renders call graph without throwing', () => {
        const graph = {
            nodes: new Map([
                ['main', { id: 'main', data: { name: 'main', isEntryPoint: true, isLeaf: false } }],
                ['helper', { id: 'helper', data: { name: 'helper', isEntryPoint: false, isLeaf: true } }],
            ]),
            edges: [{ from: 'main', to: 'helper', data: { callCount: 1, isRecursive: false } }],
        };

        expect(() => renderCallGraph(graph)).not.toThrow();
    });

    it('handles empty graphs', () => {
        const emptyGraph = { nodes: new Map(), edges: [] };

        expect(() => renderDependencyGraph(emptyGraph)).not.toThrow();
        expect(() => renderCallGraph(emptyGraph)).not.toThrow();
    });
});

// ============================================================
// Smoke Tests: Changelog Diff
// ============================================================

describe('Smoke: Changelog Diff', () => {
    it('computes diff between empty snapshots', () => {
        const from = createMinimalSnapshot('snap-1', []);
        const to = createMinimalSnapshot('snap-2', []);

        expect(() => computeDiff(from, to)).not.toThrow();
    });

    it('computes diff with added exports', () => {
        const from = createMinimalSnapshot('snap-1', []);
        const to = createMinimalSnapshot('snap-2', [
            createMinimalModuleSnapshot('test.ts', [
                { name: 'newFunc', exportInfo: { name: 'newFunc', isDefault: false, isTypeOnly: false }, symbol: null },
            ]),
        ]);

        const diff = computeDiff(from, to);
        expect(diff).toBeDefined();
        expect(diff.recommendedBump).toBeDefined();
    });

    it('computes diff with removed exports', () => {
        const from = createMinimalSnapshot('snap-1', [
            createMinimalModuleSnapshot('test.ts', [
                { name: 'oldFunc', exportInfo: { name: 'oldFunc', isDefault: false, isTypeOnly: false }, symbol: null },
            ]),
        ]);
        const to = createMinimalSnapshot('snap-2', []);

        const diff = computeDiff(from, to);
        expect(diff).toBeDefined();
    });
});

// ============================================================
// Smoke Tests: Changelog Rendering
// ============================================================

describe('Smoke: Changelog Rendering', () => {
    it('renders changelog without throwing', () => {
        const from = createMinimalSnapshot('snap-1', []);
        const to = createMinimalSnapshot('snap-2', [
            createMinimalModuleSnapshot('test.ts', [
                { name: 'newFunc', exportInfo: { name: 'newFunc', isDefault: false, isTypeOnly: false }, symbol: null },
            ]),
        ]);
        const diff = computeDiff(from, to);

        expect(() => renderChangelog(diff)).not.toThrow();
    });

    it('renders changelog with all config options', () => {
        const from = createMinimalSnapshot('snap-1', []);
        const to = createMinimalSnapshot('snap-2', []);
        const diff = computeDiff(from, to);

        expect(() => renderChangelog(diff, {
            harshMode: true,
            includeCodeDiffs: true,
            includeMigrationExamples: true,
            includeImpactAnalysis: true,
            collapseThreshold: 5,
        })).not.toThrow();
    });
});

// ============================================================
// Smoke Tests: Impact Analysis
// ============================================================

describe('Smoke: Impact Analysis', () => {
    it('analyzes impact without throwing', () => {
        const from = createMinimalSnapshot('snap-1', []);
        const to = createMinimalSnapshot('snap-2', []);
        const diff = computeDiff(from, to);
        const callGraph = { nodes: new Map(), edges: [] };

        expect(() => analyzeImpact(diff, callGraph)).not.toThrow();
    });
});

// ============================================================
// Smoke Tests: Flow Analysis
// ============================================================

describe('Smoke: Flow Analysis', () => {
    it('extracts flow matrix from simple function', () => {
        const code = `
function simple() {
    return 42;
}`;
        const signature = 'function simple(): number';

        expect(() => extractFlowMatrix(code, signature)).not.toThrow();
    });

    it('extracts flow matrix from complex function', () => {
        const code = `
function complex(x: number) {
    if (x < 0) {
        throw new Error('negative');
    }
    if (x === 0) {
        return 0;
    }
    for (let i = 0; i < x; i++) {
        console.log(i);
    }
    return x * 2;
}`;
        const signature = 'function complex(x: number): number';

        const matrix = extractFlowMatrix(code, signature);
        expect(matrix).toBeDefined();
        expect(matrix.branches).toBeGreaterThan(0);
    });

    it('handles empty function', () => {
        const code = 'function empty() {}';
        const signature = 'function empty(): void';

        expect(() => extractFlowMatrix(code, signature)).not.toThrow();
    });
});

// ============================================================
// Smoke Tests: Cycle Detection
// ============================================================

describe('Smoke: Cycle Detection', () => {
    it('detects no cycles in empty graph', () => {
        const graph = { nodes: new Map(), edges: [] };
        const cycles = detectCycles(graph);

        expect(cycles).toHaveLength(0);
    });

    it('detects cycles in cyclic graph', () => {
        const graph = {
            nodes: new Map([
                ['a', { id: 'a', data: 'a' }],
                ['b', { id: 'b', data: 'b' }],
                ['c', { id: 'c', data: 'c' }],
            ]),
            edges: [
                { from: 'a', to: 'b', data: null },
                { from: 'b', to: 'c', data: null },
                { from: 'c', to: 'a', data: null },
            ],
        };

        const cycles = detectCycles(graph);
        expect(cycles.length).toBeGreaterThan(0);
    });
});

// ============================================================
// Smoke Tests: Configuration
// ============================================================

describe('Smoke: Configuration', () => {
    it('returns valid default config', () => {
        const config = getDefaultConfig();

        expect(config).toBeDefined();
        expect(config.version).toBe(1);
        expect(config.output).toBeDefined();
        expect(config.source).toBeDefined();
        expect(config.ml).toBeDefined();
        expect(config.changelog).toBeDefined();
    });
});
