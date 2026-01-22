/**
 * @fileoverview Unit tests for Mermaid diagram renderer.
 * @module test/unit/mermaid
 */

import { describe, it, expect } from 'vitest';
import {
    renderDependencyGraph,
    renderCallGraph,
    renderSequenceDiagram,
} from '../../src/core/renderer/mermaid.js';
import type { DependencyGraph, CallGraph, CallGraphEdge, DependencyNode, CallGraphNode, GraphNode } from '../../src/types/graph.js';
import type { FileURI } from '../../src/types/base.js';

// ============================================================
// Test Helpers
// ============================================================

const createDependencyNode = (id: string, path: string, exports: string[] = []): GraphNode<DependencyNode> => ({
    id,
    data: { path, exports },
});

const createCallGraphNode = (
    id: string,
    symbol: string,
    module: string,
    isEntryPoint = false,
    isLeaf = false
): GraphNode<CallGraphNode> => ({
    id,
    data: { id, symbol, module, isEntryPoint, isLeaf },
});

const createCallGraphEdge = (
    from: string,
    to: string,
    isRecursive = false,
    callSiteCount = 1
): CallGraphEdge => ({
    from,
    to,
    isRecursive,
    callSites: Array.from({ length: callSiteCount }, () => ({
        uri: 'file:///test.ts' as FileURI,
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
    })),
});

// ============================================================
// renderDependencyGraph Tests
// ============================================================

describe('renderDependencyGraph', () => {
    it('renders empty graph', () => {
        const graph: DependencyGraph = {
            nodes: new Map(),
            edges: [],
        };

        const result = renderDependencyGraph(graph);
        expect(result).toBe('graph TD');
    });

    it('renders single node', () => {
        const graph: DependencyGraph = {
            nodes: new Map([['moduleA', createDependencyNode('moduleA', 'src/moduleA.ts', ['foo'])]]),
            edges: [],
        };

        const result = renderDependencyGraph(graph);
        expect(result).toContain('graph TD');
        expect(result).toContain('moduleA[moduleA.ts]');
    });

    it('renders nodes with edges', () => {
        const graph: DependencyGraph = {
            nodes: new Map([
                ['moduleA', createDependencyNode('moduleA', 'src/moduleA.ts')],
                ['moduleB', createDependencyNode('moduleB', 'src/moduleB.ts')],
            ]),
            edges: [{ from: 'moduleA', to: 'moduleB', imports: ['foo'], isCircular: false }],
        };

        const result = renderDependencyGraph(graph);
        // Edge should show import count label
        expect(result).toContain('moduleA -->|1 import| moduleB');
    });

    it('renders edges without label when no imports', () => {
        const graph: DependencyGraph = {
            nodes: new Map([
                ['moduleA', createDependencyNode('moduleA', 'src/moduleA.ts')],
                ['moduleB', createDependencyNode('moduleB', 'src/moduleB.ts')],
            ]),
            edges: [{ from: 'moduleA', to: 'moduleB', imports: [], isCircular: false }],
        };

        const result = renderDependencyGraph(graph);
        expect(result).toContain('moduleA --> moduleB');
        expect(result).not.toContain('-->|');
    });

    it('shows import count on edges', () => {
        const graph: DependencyGraph = {
            nodes: new Map([
                ['moduleA', createDependencyNode('moduleA', 'src/moduleA.ts')],
                ['moduleB', createDependencyNode('moduleB', 'src/moduleB.ts')],
            ]),
            edges: [{ from: 'moduleA', to: 'moduleB', imports: ['foo', 'bar', 'baz'], isCircular: false }],
        };

        const result = renderDependencyGraph(graph);
        expect(result).toContain('3 imports');
    });

    it('highlights circular dependencies in red', () => {
        const graph: DependencyGraph = {
            nodes: new Map([
                ['moduleA', createDependencyNode('moduleA', 'src/moduleA.ts')],
                ['moduleB', createDependencyNode('moduleB', 'src/moduleB.ts')],
            ]),
            edges: [
                { from: 'moduleA', to: 'moduleB', imports: ['foo'], isCircular: false },
                { from: 'moduleB', to: 'moduleA', imports: ['bar'], isCircular: true },
            ],
        };

        const result = renderDependencyGraph(graph);
        expect(result).toContain('linkStyle 1 stroke:red');
    });

    it('sanitizes special characters in node IDs', () => {
        const graph: DependencyGraph = {
            nodes: new Map([
                ['src/module-a.ts', createDependencyNode('src/module-a.ts', 'src/module-a.ts')],
            ]),
            edges: [],
        };

        const result = renderDependencyGraph(graph);
        // Special chars should be replaced with underscores
        expect(result).toContain('src_module_a_ts');
    });
});

// ============================================================
// renderCallGraph Tests
// ============================================================

describe('renderCallGraph', () => {
    it('renders empty graph', () => {
        const graph: CallGraph = {
            nodes: new Map(),
            edges: [],
        };

        const result = renderCallGraph(graph);
        expect(result).toBe('graph TD');
    });

    it('renders entry points with stadium shape', () => {
        const graph: CallGraph = {
            nodes: new Map([['main', createCallGraphNode('main', 'main', 'index.ts', true, false)]]),
            edges: [],
        };

        const result = renderCallGraph(graph);
        expect(result).toContain('main([main])');
    });

    it('renders leaf nodes with rounded shape', () => {
        const graph: CallGraph = {
            nodes: new Map([['helper', createCallGraphNode('helper', 'helper', 'utils.ts', false, true)]]),
            edges: [],
        };

        const result = renderCallGraph(graph);
        expect(result).toContain('helper(helper)');
    });

    it('renders regular nodes with rect shape', () => {
        const graph: CallGraph = {
            nodes: new Map([['process', createCallGraphNode('process', 'process', 'core.ts', false, false)]]),
            edges: [],
        };

        const result = renderCallGraph(graph);
        expect(result).toContain('process[process]');
    });

    it('styles entry points with green', () => {
        const graph: CallGraph = {
            nodes: new Map([['main', createCallGraphNode('main', 'main', 'index.ts', true, false)]]),
            edges: [],
        };

        const result = renderCallGraph(graph);
        expect(result).toContain('style main fill:#90EE90');
    });

    it('styles leaf nodes with light blue', () => {
        const graph: CallGraph = {
            nodes: new Map([['helper', createCallGraphNode('helper', 'helper', 'utils.ts', false, true)]]),
            edges: [],
        };

        const result = renderCallGraph(graph);
        expect(result).toContain('style helper fill:#ADD8E6');
    });

    it('highlights recursive calls in orange', () => {
        const graph: CallGraph = {
            nodes: new Map([
                ['factorial', createCallGraphNode('factorial', 'factorial', 'math.ts', false, false)],
            ]),
            edges: [createCallGraphEdge('factorial', 'factorial', true)],
        };

        const result = renderCallGraph(graph);
        expect(result).toContain('linkStyle 0 stroke:orange');
    });

    it('shows call count on edges with multiple calls', () => {
        const graph: CallGraph = {
            nodes: new Map([
                ['main', createCallGraphNode('main', 'main', 'index.ts', true, false)],
                ['helper', createCallGraphNode('helper', 'helper', 'utils.ts', false, true)],
            ]),
            edges: [createCallGraphEdge('main', 'helper', false, 3)],
        };

        const result = renderCallGraph(graph);
        expect(result).toContain('3 calls');
    });
});

// ============================================================
// renderSequenceDiagram Tests
// ============================================================

describe('renderSequenceDiagram', () => {
    it('renders empty call list with note', () => {
        const result = renderSequenceDiagram([]);
        expect(result).toContain('sequenceDiagram');
        expect(result).toContain('No calls to display');
    });

    it('renders participants in order of appearance', () => {
        const calls: CallGraphEdge[] = [
            createCallGraphEdge('main', 'helper'),
            createCallGraphEdge('helper', 'util'),
        ];

        const result = renderSequenceDiagram(calls);
        const mainIndex = result.indexOf('participant main');
        const helperIndex = result.indexOf('participant helper');
        const utilIndex = result.indexOf('participant util');

        expect(mainIndex).toBeLessThan(helperIndex);
        expect(helperIndex).toBeLessThan(utilIndex);
    });

    it('renders call arrows', () => {
        const calls: CallGraphEdge[] = [createCallGraphEdge('main', 'helper')];

        const result = renderSequenceDiagram(calls);
        expect(result).toContain('main->>helper: call');
    });

    it('uses different arrow for recursive calls', () => {
        const calls: CallGraphEdge[] = [createCallGraphEdge('factorial', 'factorial', true)];

        const result = renderSequenceDiagram(calls);
        expect(result).toContain('factorial-->>factorial');
    });

    it('adds note for recursive calls', () => {
        const calls: CallGraphEdge[] = [createCallGraphEdge('factorial', 'factorial', true)];

        const result = renderSequenceDiagram(calls);
        expect(result).toContain('Note right of factorial: recursive');
    });

    it('shows call count for multiple calls', () => {
        const calls: CallGraphEdge[] = [createCallGraphEdge('main', 'helper', false, 5)];

        const result = renderSequenceDiagram(calls);
        expect(result).toContain('5 calls');
    });

    it('does not duplicate participants', () => {
        const calls: CallGraphEdge[] = [
            createCallGraphEdge('main', 'helper'),
            createCallGraphEdge('main', 'helper'),
        ];

        const result = renderSequenceDiagram(calls);
        const mainMatches = result.match(/participant main/g);
        const helperMatches = result.match(/participant helper/g);

        expect(mainMatches?.length).toBe(1);
        expect(helperMatches?.length).toBe(1);
    });

    it('sanitizes special characters in participant names', () => {
        const calls: CallGraphEdge[] = [createCallGraphEdge('my-func', 'other.func')];

        const result = renderSequenceDiagram(calls);
        expect(result).toContain('participant my_func');
        expect(result).toContain('participant other_func');
    });
});
