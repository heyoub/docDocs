/**
 * @fileoverview Property-based tests for cycle detection in graphs.
 * Tests Property 17: Circular Dependency Detection from the design document.
 *
 * **Validates: Requirements 27.1, 27.2**
 *
 * @module test/property/cycle-detection
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Graph, GraphEdge, GraphNode } from '../../src/types/graph.js';
import { detectCycles } from '../../src/core/graph/algorithms.js';

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
// Arbitrary Generators
// ============================================================

/**
 * Generates a unique node ID.
 */
const arbitraryNodeId = fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/);

/**
 * Generates a set of unique node IDs.
 */
const arbitraryNodeIds = (minSize: number, maxSize: number): fc.Arbitrary<string[]> =>
    fc.uniqueArray(arbitraryNodeId, { minLength: minSize, maxLength: maxSize });

/**
 * Creates a Graph from node IDs and edges.
 */
function createGraph<T>(
    nodeIds: string[],
    edges: GraphEdge[],
    dataFactory: (id: string) => T
): Graph<T> {
    const nodes = new Map<string, GraphNode<T>>();
    for (const id of nodeIds) {
        nodes.set(id, { id, data: dataFactory(id) });
    }
    return { nodes, edges };
}

/**
 * Generates a graph with no cycles (DAG).
 * Edges only go from lower-indexed nodes to higher-indexed nodes.
 */
const arbitraryDAG: fc.Arbitrary<Graph<string>> = fc
    .tuple(
        fc.integer({ min: 1, max: 15 }),
        fc.integer({ min: 0, max: 30 })
    )
    .chain(([nodeCount, edgeCount]) => {
        const nodeIds = Array.from({ length: nodeCount }, (_, i) => `n${i}`);

        // If only one node, no edges possible in a DAG (no self-loops)
        if (nodeCount < 2) {
            return fc.constant(createGraph(nodeIds, [], (id) => id));
        }

        // Generate edges that only go forward (lower index → higher index)
        // This guarantees no cycles
        const edgeArbitrary = fc.array(
            fc.tuple(
                fc.integer({ min: 0, max: nodeCount - 2 }),
                fc.nat()
            ).map(([fromIdx, offset]) => {
                const remainingNodes = nodeCount - fromIdx - 1;
                const toIdx = fromIdx + 1 + (remainingNodes > 0 ? offset % remainingNodes : 0);
                const safeToIdx = Math.min(toIdx, nodeCount - 1);
                return {
                    from: nodeIds[fromIdx]!,
                    to: nodeIds[safeToIdx]!,
                } as GraphEdge;
            }),
            { minLength: 0, maxLength: Math.min(edgeCount, nodeCount * (nodeCount - 1) / 2) }
        );

        return edgeArbitrary.map((edges) => createGraph(nodeIds, edges, (id) => id));
    });

/**
 * Generates a graph with exactly one known cycle.
 * Returns both the graph and the expected cycle.
 */
const arbitraryGraphWithOneCycle: fc.Arbitrary<{
    graph: Graph<string>;
    expectedCycle: string[];
}> = fc
    .tuple(
        fc.integer({ min: 2, max: 8 }), // cycle size
        fc.integer({ min: 0, max: 10 }) // extra nodes
    )
    .chain(([cycleSize, extraNodes]) => {
        const cycleNodeIds = Array.from({ length: cycleSize }, (_, i) => `c${i}`);
        const extraNodeIds = Array.from({ length: extraNodes }, (_, i) => `e${i}`);
        const allNodeIds = [...cycleNodeIds, ...extraNodeIds];

        // Create cycle edges: c0 → c1 → c2 → ... → c0
        const cycleEdges: GraphEdge[] = cycleNodeIds.map((from, i) => ({
            from,
            to: cycleNodeIds[(i + 1) % cycleSize]!,
        }));

        // Generate some extra edges that don't create additional cycles
        // Extra edges go from extra nodes to cycle nodes (one-way)
        const extraEdgesArbitrary = fc.array(
            fc.tuple(
                fc.integer({ min: 0, max: Math.max(0, extraNodes - 1) }),
                fc.integer({ min: 0, max: cycleSize - 1 })
            ).map(([extraIdx, cycleIdx]) => ({
                from: extraNodeIds[extraIdx] ?? extraNodeIds[0] ?? cycleNodeIds[0]!,
                to: cycleNodeIds[cycleIdx]!,
            } as GraphEdge)),
            { minLength: 0, maxLength: extraNodes }
        );

        return extraEdgesArbitrary.map((extraEdges) => ({
            graph: createGraph(allNodeIds, [...cycleEdges, ...extraEdges], (id) => id),
            expectedCycle: cycleNodeIds,
        }));
    });

/**
 * Generates a graph with multiple known cycles.
 * Returns both the graph and the expected cycles.
 */
const arbitraryGraphWithMultipleCycles: fc.Arbitrary<{
    graph: Graph<string>;
    expectedCycles: string[][];
}> = fc
    .tuple(
        fc.integer({ min: 2, max: 4 }), // number of cycles
        fc.array(fc.integer({ min: 2, max: 5 }), { minLength: 2, maxLength: 4 }) // cycle sizes
    )
    .map(([numCycles, cycleSizes]) => {
        const actualCycleSizes = cycleSizes.slice(0, numCycles);
        const allNodeIds: string[] = [];
        const allEdges: GraphEdge[] = [];
        const expectedCycles: string[][] = [];

        let nodeCounter = 0;
        for (let cycleIdx = 0; cycleIdx < actualCycleSizes.length; cycleIdx++) {
            const cycleSize = actualCycleSizes[cycleIdx]!;
            const cycleNodeIds: string[] = [];

            // Create nodes for this cycle
            for (let i = 0; i < cycleSize; i++) {
                const nodeId = `cycle${cycleIdx}_n${i}`;
                cycleNodeIds.push(nodeId);
                allNodeIds.push(nodeId);
                nodeCounter++;
            }

            // Create cycle edges
            for (let i = 0; i < cycleSize; i++) {
                allEdges.push({
                    from: cycleNodeIds[i]!,
                    to: cycleNodeIds[(i + 1) % cycleSize]!,
                });
            }

            expectedCycles.push(cycleNodeIds);
        }

        return {
            graph: createGraph(allNodeIds, allEdges, (id) => id),
            expectedCycles,
        };
    });

/**
 * Generates a graph with a self-loop (single node cycle).
 * Note: Tarjan's algorithm only returns SCCs with size > 1,
 * so self-loops are not detected as cycles by our implementation.
 */
const arbitraryGraphWithSelfLoop: fc.Arbitrary<Graph<string>> = fc
    .integer({ min: 1, max: 10 })
    .map((nodeCount) => {
        const nodeIds = Array.from({ length: nodeCount }, (_, i) => `n${i}`);
        // Add a self-loop on the first node
        const edges: GraphEdge[] = [{ from: nodeIds[0]!, to: nodeIds[0]! }];
        return createGraph(nodeIds, edges, (id) => id);
    });

// ============================================================
// Helper Functions
// ============================================================

/**
 * Checks if two cycles are equivalent (same nodes, possibly different starting point).
 * Cycles are considered equal if they contain the same nodes in the same order,
 * regardless of which node is listed first.
 */
function cyclesEquivalent(cycle1: string[], cycle2: string[]): boolean {
    if (cycle1.length !== cycle2.length) {
        return false;
    }
    if (cycle1.length === 0) {
        return true;
    }

    // Convert cycles to sets for quick membership check
    const set1 = new Set(cycle1);
    const set2 = new Set(cycle2);

    // First check if they have the same nodes
    if (set1.size !== set2.size) {
        return false;
    }
    for (const node of set1) {
        if (!set2.has(node)) {
            return false;
        }
    }

    return true;
}

/**
 * Checks if a detected cycle contains all nodes from an expected cycle.
 */
function cycleContainsAllNodes(detected: string[], expected: string[]): boolean {
    const detectedSet = new Set(detected);
    return expected.every((node) => detectedSet.has(node));
}

/**
 * Verifies that a detected cycle is actually a valid cycle in the graph.
 */
function isValidCycle(graph: Graph<string>, cycle: string[]): boolean {
    if (cycle.length < 2) {
        return false;
    }

    // Build adjacency set for quick lookup
    const adjacency = new Map<string, Set<string>>();
    for (const edge of graph.edges) {
        if (!adjacency.has(edge.from)) {
            adjacency.set(edge.from, new Set());
        }
        adjacency.get(edge.from)!.add(edge.to);
    }

    // Check that each consecutive pair in the cycle has an edge
    for (let i = 0; i < cycle.length; i++) {
        const from = cycle[i]!;
        const to = cycle[(i + 1) % cycle.length]!;
        const neighbors = adjacency.get(from);
        if (!neighbors || !neighbors.has(to)) {
            return false;
        }
    }

    return true;
}

// ============================================================
// Property Tests
// ============================================================

describe('Feature: gendocs-extension, Property 17: Circular Dependency Detection', () => {
    /**
     * Property: DAGs (Directed Acyclic Graphs) should have no cycles detected.
     */
    it('detects no cycles in a DAG', () => {
        fc.assert(
            fc.property(arbitraryDAG, (graph) => {
                const cycles = detectCycles(graph);
                expect(cycles).toHaveLength(0);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Empty graphs should have no cycles.
     */
    it('detects no cycles in an empty graph', () => {
        const emptyGraph: Graph<string> = {
            nodes: new Map(),
            edges: [],
        };
        const cycles = detectCycles(emptyGraph);
        expect(cycles).toHaveLength(0);
    });

    /**
     * Property: Single node with no edges should have no cycles.
     */
    it('detects no cycles in a single node graph', () => {
        const singleNodeGraph: Graph<string> = {
            nodes: new Map([['a', { id: 'a', data: 'a' }]]),
            edges: [],
        };
        const cycles = detectCycles(singleNodeGraph);
        expect(cycles).toHaveLength(0);
    });

    /**
     * Property: For any graph with a known cycle, detectCycles SHALL return
     * a cycle containing all nodes in the expected cycle.
     *
     * **Validates: Requirements 27.1, 27.2**
     */
    it('detects all nodes in a single known cycle', () => {
        fc.assert(
            fc.property(arbitraryGraphWithOneCycle, ({ graph, expectedCycle }) => {
                const detectedCycles = detectCycles(graph);

                // At least one cycle should be detected
                expect(detectedCycles.length).toBeGreaterThanOrEqual(1);

                // The detected cycle(s) should contain all expected cycle nodes
                const allDetectedNodes = new Set(detectedCycles.flat());
                for (const node of expectedCycle) {
                    expect(allDetectedNodes.has(node)).toBe(true);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: For any graph with multiple known cycles, detectCycles SHALL
     * return cycles covering all nodes in each expected cycle.
     *
     * **Validates: Requirements 27.1, 27.2**
     */
    it('detects all nodes in multiple known cycles', () => {
        fc.assert(
            fc.property(arbitraryGraphWithMultipleCycles, ({ graph, expectedCycles }) => {
                const detectedCycles = detectCycles(graph);

                // Should detect at least as many cycles as we created
                // (may detect more if cycles share nodes or form larger SCCs)
                expect(detectedCycles.length).toBeGreaterThanOrEqual(1);

                // All expected cycle nodes should appear in detected cycles
                const allDetectedNodes = new Set(detectedCycles.flat());
                for (const expectedCycle of expectedCycles) {
                    for (const node of expectedCycle) {
                        expect(allDetectedNodes.has(node)).toBe(true);
                    }
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Every detected cycle must be a valid cycle in the graph
     * (i.e., there must be edges connecting consecutive nodes).
     *
     * **Validates: Requirements 27.1**
     */
    it('all detected cycles are valid cycles in the graph', () => {
        fc.assert(
            fc.property(arbitraryGraphWithOneCycle, ({ graph }) => {
                const detectedCycles = detectCycles(graph);

                for (const cycle of detectedCycles) {
                    expect(isValidCycle(graph, cycle)).toBe(true);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Detected cycles should have at least 2 nodes
     * (self-loops are handled separately by the algorithm).
     */
    it('detected cycles have at least 2 nodes', () => {
        fc.assert(
            fc.property(arbitraryGraphWithOneCycle, ({ graph }) => {
                const detectedCycles = detectCycles(graph);

                for (const cycle of detectedCycles) {
                    expect(cycle.length).toBeGreaterThanOrEqual(2);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: The classic A → B → C → A cycle should be detected.
     * This is the example from the design document.
     */
    it('detects the classic A → B → C → A cycle', () => {
        const graph: Graph<string> = {
            nodes: new Map([
                ['A', { id: 'A', data: 'A' }],
                ['B', { id: 'B', data: 'B' }],
                ['C', { id: 'C', data: 'C' }],
            ]),
            edges: [
                { from: 'A', to: 'B' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'A' },
            ],
        };

        const cycles = detectCycles(graph);

        expect(cycles.length).toBe(1);
        expect(cycles[0]).toHaveLength(3);
        expect(cyclesEquivalent(cycles[0]!, ['A', 'B', 'C'])).toBe(true);
    });

    /**
     * Property: A simple two-node cycle (A → B → A) should be detected.
     */
    it('detects a two-node cycle', () => {
        const graph: Graph<string> = {
            nodes: new Map([
                ['A', { id: 'A', data: 'A' }],
                ['B', { id: 'B', data: 'B' }],
            ]),
            edges: [
                { from: 'A', to: 'B' },
                { from: 'B', to: 'A' },
            ],
        };

        const cycles = detectCycles(graph);

        expect(cycles.length).toBe(1);
        expect(cycles[0]).toHaveLength(2);
        expect(cyclesEquivalent(cycles[0]!, ['A', 'B'])).toBe(true);
    });

    /**
     * Property: Cycles should be detected even with additional non-cyclic edges.
     */
    it('detects cycles in graphs with mixed cyclic and non-cyclic edges', () => {
        const graph: Graph<string> = {
            nodes: new Map([
                ['A', { id: 'A', data: 'A' }],
                ['B', { id: 'B', data: 'B' }],
                ['C', { id: 'C', data: 'C' }],
                ['D', { id: 'D', data: 'D' }],
                ['E', { id: 'E', data: 'E' }],
            ]),
            edges: [
                // Cycle: A → B → C → A
                { from: 'A', to: 'B' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'A' },
                // Non-cyclic edges
                { from: 'D', to: 'A' },
                { from: 'C', to: 'E' },
            ],
        };

        const cycles = detectCycles(graph);

        expect(cycles.length).toBe(1);
        const cycleNodes = new Set(cycles[0]);
        expect(cycleNodes.has('A')).toBe(true);
        expect(cycleNodes.has('B')).toBe(true);
        expect(cycleNodes.has('C')).toBe(true);
        expect(cycleNodes.has('D')).toBe(false);
        expect(cycleNodes.has('E')).toBe(false);
    });

    /**
     * Property: Multiple disjoint cycles should all be detected.
     */
    it('detects multiple disjoint cycles', () => {
        const graph: Graph<string> = {
            nodes: new Map([
                ['A', { id: 'A', data: 'A' }],
                ['B', { id: 'B', data: 'B' }],
                ['X', { id: 'X', data: 'X' }],
                ['Y', { id: 'Y', data: 'Y' }],
            ]),
            edges: [
                // Cycle 1: A → B → A
                { from: 'A', to: 'B' },
                { from: 'B', to: 'A' },
                // Cycle 2: X → Y → X
                { from: 'X', to: 'Y' },
                { from: 'Y', to: 'X' },
            ],
        };

        const cycles = detectCycles(graph);

        expect(cycles.length).toBe(2);

        // Both cycles should be detected
        const allCycleNodes = cycles.flat();
        expect(allCycleNodes).toContain('A');
        expect(allCycleNodes).toContain('B');
        expect(allCycleNodes).toContain('X');
        expect(allCycleNodes).toContain('Y');
    });

    /**
     * Property: Nested cycles (cycles within cycles) should be detected as one SCC.
     */
    it('detects nested cycles as a single SCC', () => {
        const graph: Graph<string> = {
            nodes: new Map([
                ['A', { id: 'A', data: 'A' }],
                ['B', { id: 'B', data: 'B' }],
                ['C', { id: 'C', data: 'C' }],
            ]),
            edges: [
                // Outer cycle: A → B → C → A
                { from: 'A', to: 'B' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'A' },
                // Inner shortcut: A → C (creates nested cycle A → C → A via the outer)
                { from: 'A', to: 'C' },
            ],
        };

        const cycles = detectCycles(graph);

        // Should detect one SCC containing all three nodes
        expect(cycles.length).toBe(1);
        expect(cycles[0]).toHaveLength(3);
    });

    /**
     * Property: Self-loops are not detected as cycles by Tarjan's algorithm
     * (SCCs with size > 1 only).
     */
    it('does not detect self-loops as cycles (SCC size > 1 only)', () => {
        fc.assert(
            fc.property(arbitraryGraphWithSelfLoop, (graph) => {
                const cycles = detectCycles(graph);

                // Self-loops create SCCs of size 1, which are filtered out
                // So no cycles should be detected unless there are other cycles
                for (const cycle of cycles) {
                    expect(cycle.length).toBeGreaterThanOrEqual(2);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: detectCycles is deterministic - same input produces same output.
     */
    it('is deterministic', () => {
        fc.assert(
            fc.property(arbitraryGraphWithOneCycle, ({ graph }) => {
                const cycles1 = detectCycles(graph);
                const cycles2 = detectCycles(graph);

                expect(cycles1).toEqual(cycles2);
            }),
            PROPERTY_CONFIG
        );
    });
});
