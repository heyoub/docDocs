/**
 * @fileoverview Graph algorithms for dependency analysis and circular dependency detection.
 * Implements Tarjan's algorithm for strongly connected components (cycle detection),
 * topological sorting, and path finding.
 *
 * @module core/graph/algorithms
 * @see Requirements 27.1, 27.2
 */

import type { Graph, GraphEdge } from '../../types/graph.js';

// ============================================================
// Internal Types
// ============================================================

/**
 * Internal state for Tarjan's algorithm.
 */
interface TarjanState {
    /** Current index counter */
    index: number;
    /** Stack of node IDs being processed */
    stack: string[];
    /** Set of node IDs currently on stack */
    onStack: Set<string>;
    /** Discovery index for each node */
    indices: Map<string, number>;
    /** Low-link value for each node */
    lowLinks: Map<string, number>;
    /** Collected strongly connected components */
    sccs: string[][];
}

/**
 * Internal state for BFS path finding.
 */
interface BFSState {
    /** Queue of node IDs to visit */
    queue: string[];
    /** Map from node ID to its predecessor in the path */
    predecessors: Map<string, string | null>;
    /** Set of visited node IDs */
    visited: Set<string>;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Builds an adjacency list from graph edges.
 *
 * @param edges - The edges of the graph
 * @returns Map from node ID to array of successor node IDs
 */
function buildAdjacencyList(edges: readonly GraphEdge[]): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();

    for (const edge of edges) {
        const successors = adjacency.get(edge.from);
        if (successors) {
            successors.push(edge.to);
        } else {
            adjacency.set(edge.from, [edge.to]);
        }
    }

    return adjacency;
}

/**
 * Initializes Tarjan's algorithm state.
 *
 * @returns Fresh TarjanState
 */
function initTarjanState(): TarjanState {
    return {
        index: 0,
        stack: [],
        onStack: new Set(),
        indices: new Map(),
        lowLinks: new Map(),
        sccs: [],
    };
}

/**
 * Performs the strong connect operation for Tarjan's algorithm.
 * This is the core recursive function that discovers SCCs.
 *
 * @param nodeId - Current node being processed
 * @param adjacency - Adjacency list representation of the graph
 * @param state - Mutable algorithm state
 */
function strongConnect(
    nodeId: string,
    adjacency: Map<string, string[]>,
    state: TarjanState
): void {
    // Set the depth index for this node
    state.indices.set(nodeId, state.index);
    state.lowLinks.set(nodeId, state.index);
    state.index++;
    state.stack.push(nodeId);
    state.onStack.add(nodeId);

    // Consider successors of this node
    const successors = adjacency.get(nodeId) ?? [];
    for (const successor of successors) {
        if (!state.indices.has(successor)) {
            // Successor has not been visited; recurse on it
            strongConnect(successor, adjacency, state);
            const successorLowLink = state.lowLinks.get(successor) ?? 0;
            const currentLowLink = state.lowLinks.get(nodeId) ?? 0;
            state.lowLinks.set(nodeId, Math.min(currentLowLink, successorLowLink));
        } else if (state.onStack.has(successor)) {
            // Successor is on stack and hence in the current SCC
            const successorIndex = state.indices.get(successor) ?? 0;
            const currentLowLink = state.lowLinks.get(nodeId) ?? 0;
            state.lowLinks.set(nodeId, Math.min(currentLowLink, successorIndex));
        }
    }

    // If this node is a root node, pop the stack and generate an SCC
    const nodeIndex = state.indices.get(nodeId) ?? 0;
    const nodeLowLink = state.lowLinks.get(nodeId) ?? 0;

    if (nodeLowLink === nodeIndex) {
        const scc: string[] = [];
        let poppedNode: string | undefined;

        do {
            poppedNode = state.stack.pop();
            if (poppedNode !== undefined) {
                state.onStack.delete(poppedNode);
                scc.push(poppedNode);
            }
        } while (poppedNode !== nodeId && poppedNode !== undefined);

        // Only keep SCCs with more than one node (actual cycles)
        if (scc.length > 1) {
            // Reverse to get the cycle in traversal order
            scc.reverse();
            state.sccs.push(scc);
        }
    }
}

/**
 * Reconstructs the path from source to target using predecessor map.
 *
 * @param predecessors - Map from node to its predecessor
 * @param source - Starting node
 * @param target - Ending node
 * @returns Array of node IDs forming the path, or null if no path exists
 */
function reconstructPath(
    predecessors: Map<string, string | null>,
    source: string,
    target: string
): string[] | null {
    if (!predecessors.has(target)) {
        return null;
    }

    const path: string[] = [];
    let current: string | null = target;

    while (current !== null) {
        path.push(current);
        current = predecessors.get(current) ?? null;
    }

    // Path is built backwards, reverse it
    path.reverse();

    // Verify the path starts at source
    if (path[0] !== source) {
        return null;
    }

    return path;
}

// ============================================================
// Public API
// ============================================================

/**
 * Detects all cycles in a graph using Tarjan's strongly connected components algorithm.
 *
 * A cycle is represented as an array of node IDs in traversal order.
 * For example, a cycle A → B → C → A would be returned as ['A', 'B', 'C'].
 *
 * @typeParam T - The type of data stored in graph nodes
 * @param graph - The graph to analyze
 * @returns Array of cycles, where each cycle is an array of node IDs
 *
 * @example
 * ```typescript
 * const graph: Graph<string> = {
 *   nodes: new Map([['A', { id: 'A', data: 'a' }], ['B', { id: 'B', data: 'b' }]]),
 *   edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }]
 * };
 * const cycles = detectCycles(graph);
 * // cycles = [['A', 'B']] or [['B', 'A']]
 * ```
 *
 * @see Requirements 27.1, 27.2
 */
export function detectCycles<T>(graph: Graph<T>): string[][] {
    const adjacency = buildAdjacencyList(graph.edges);
    const state = initTarjanState();

    // Run Tarjan's algorithm from each unvisited node
    for (const nodeId of graph.nodes.keys()) {
        if (!state.indices.has(nodeId)) {
            strongConnect(nodeId, adjacency, state);
        }
    }

    return state.sccs;
}

/**
 * Performs a topological sort on a directed acyclic graph (DAG).
 *
 * Returns nodes in dependency order - if A depends on B, then B appears before A.
 * Throws an error if the graph contains cycles.
 *
 * Uses Kahn's algorithm for topological sorting.
 *
 * @typeParam T - The type of data stored in graph nodes
 * @param graph - The graph to sort (must be a DAG)
 * @returns Array of node IDs in topological order
 * @throws Error if the graph contains cycles
 *
 * @example
 * ```typescript
 * const graph: Graph<string> = {
 *   nodes: new Map([['A', { id: 'A', data: 'a' }], ['B', { id: 'B', data: 'b' }]]),
 *   edges: [{ from: 'A', to: 'B' }]  // A depends on B
 * };
 * const sorted = topologicalSort(graph);
 * // sorted = ['B', 'A'] (B comes before A since A depends on B)
 * ```
 *
 * @see Requirements 27.1
 */
export function topologicalSort<T>(graph: Graph<T>): string[] {
    // First check for cycles
    const cycles = detectCycles(graph);
    if (cycles.length > 0) {
        const firstCycle = cycles[0];
        if (firstCycle && firstCycle.length > 0) {
            const cycleStr = firstCycle.join(' → ') + ' → ' + firstCycle[0];
            throw new Error(`Cannot topologically sort a graph with cycles: ${cycleStr}`);
        }
        throw new Error('Cannot topologically sort a graph with cycles');
    }

    // Calculate in-degrees for all nodes
    const inDegree = new Map<string, number>();
    for (const nodeId of graph.nodes.keys()) {
        inDegree.set(nodeId, 0);
    }

    for (const edge of graph.edges) {
        const currentDegree = inDegree.get(edge.to) ?? 0;
        inDegree.set(edge.to, currentDegree + 1);
    }

    // Build adjacency list for forward traversal
    const adjacency = buildAdjacencyList(graph.edges);

    // Initialize queue with nodes that have no incoming edges
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
        if (degree === 0) {
            queue.push(nodeId);
        }
    }

    const result: string[] = [];

    while (queue.length > 0) {
        const node = queue.shift()!;
        result.push(node);

        // Reduce in-degree for all successors
        const successors = adjacency.get(node) ?? [];
        for (const successor of successors) {
            const newDegree = (inDegree.get(successor) ?? 1) - 1;
            inDegree.set(successor, newDegree);

            if (newDegree === 0) {
                queue.push(successor);
            }
        }
    }

    return result;
}

/**
 * Finds the shortest path between two nodes in a graph using BFS.
 *
 * Returns the path as an array of node IDs from source to target (inclusive),
 * or null if no path exists.
 *
 * @typeParam T - The type of data stored in graph nodes
 * @param graph - The graph to search
 * @param from - The source node ID
 * @param to - The target node ID
 * @returns Array of node IDs forming the shortest path, or null if no path exists
 *
 * @example
 * ```typescript
 * const graph: Graph<string> = {
 *   nodes: new Map([
 *     ['A', { id: 'A', data: 'a' }],
 *     ['B', { id: 'B', data: 'b' }],
 *     ['C', { id: 'C', data: 'c' }]
 *   ]),
 *   edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }]
 * };
 * const path = findPath(graph, 'A', 'C');
 * // path = ['A', 'B', 'C']
 * ```
 *
 * @see Requirements 27.2
 */
export function findPath<T>(
    graph: Graph<T>,
    from: string,
    to: string
): string[] | null {
    // Handle edge cases
    if (!graph.nodes.has(from) || !graph.nodes.has(to)) {
        return null;
    }

    // Same node - trivial path
    if (from === to) {
        return [from];
    }

    const adjacency = buildAdjacencyList(graph.edges);

    // BFS initialization
    const state: BFSState = {
        queue: [from],
        predecessors: new Map([[from, null]]),
        visited: new Set([from]),
    };

    while (state.queue.length > 0) {
        const current = state.queue.shift()!;

        // Check all successors
        const successors = adjacency.get(current) ?? [];
        for (const successor of successors) {
            if (state.visited.has(successor)) {
                continue;
            }

            state.visited.add(successor);
            state.predecessors.set(successor, current);

            // Found the target
            if (successor === to) {
                return reconstructPath(state.predecessors, from, to);
            }

            state.queue.push(successor);
        }
    }

    // No path found
    return null;
}
