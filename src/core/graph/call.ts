/**
 * @fileoverview Call graph construction and analysis.
 * @module core/graph/call
 * @see Requirements 21.1, 21.2, 21.3
 */

import type { FileExtraction, ExtractedSymbol } from '../../types/extraction.js';
import type { CallGraph, CallGraphNode, CallGraphEdge, GraphNode } from '../../types/graph.js';
import { detectCycles } from './algorithms.js';

// ============================================================
// Internal Types
// ============================================================

interface NodeBuilder {
    readonly id: string;
    readonly symbol: string;
    readonly module: string;
}

// ============================================================
// Helper Functions
// ============================================================

/** Normalizes a module path by removing file:// prefix and normalizing separators. */
function normalizeModulePath(uri: string): string {
    let normalized = uri.replace(/^file:\/\//, '').replace(/\\/g, '/');
    if (/^\/[A-Za-z]:/.test(normalized)) normalized = normalized.slice(1);
    return normalized;
}

/** Creates a unique node ID for a callable symbol. */
function createNodeId(modulePath: string, symbolName: string, parentName: string | null): string {
    return parentName ? `${modulePath}#${parentName}.${symbolName}` : `${modulePath}#${symbolName}`;
}

/** Recursively extracts callable symbols from a symbol tree. */
function extractCallableSymbols(
    symbol: ExtractedSymbol,
    modulePath: string,
    parentName: string | null,
    builders: NodeBuilder[]
): void {
    if (symbol.kind === 'function' || symbol.kind === 'method') {
        builders.push({ id: createNodeId(modulePath, symbol.name, parentName), symbol: symbol.name, module: modulePath });
    }
    const newParent = (symbol.kind === 'class' || symbol.kind === 'interface') ? symbol.name : parentName;
    for (const child of symbol.children) {
        extractCallableSymbols(child, modulePath, newParent, builders);
    }
}

/** Builds node builders from a file extraction. */
function buildNodeBuilders(extraction: FileExtraction): NodeBuilder[] {
    const modulePath = normalizeModulePath(extraction.uri);
    const builders: NodeBuilder[] = [];
    for (const symbol of extraction.symbols) {
        extractCallableSymbols(symbol, modulePath, null, builders);
    }
    return builders;
}

/** Creates a CallGraphNode from a node builder. */
function createCallGraphNode(builder: NodeBuilder, incomingCount: number, outgoingCount: number): CallGraphNode {
    return { id: builder.id, symbol: builder.symbol, module: builder.module, isEntryPoint: incomingCount === 0, isLeaf: outgoingCount === 0 };
}

/** Marks recursive edges using cycle detection. */
function markRecursiveEdges(
    edges: readonly CallGraphEdge[],
    nodes: ReadonlyMap<string, GraphNode<CallGraphNode>>
): readonly CallGraphEdge[] {
    const cycles = detectCycles({ nodes, edges });
    const recursiveKeys = new Set<string>();
    for (const cycle of cycles) {
        for (let i = 0; i < cycle.length; i++) {
            recursiveKeys.add(`${cycle[i]!}|${cycle[(i + 1) % cycle.length]!}`);
        }
    }
    return edges.map((edge) => {
        const isRecursive = recursiveKeys.has(`${edge.from}|${edge.to}`);
        return isRecursive === edge.isRecursive ? edge : { ...edge, isRecursive };
    });
}

// ============================================================
// Public API
// ============================================================

/**
 * Builds a call graph from file extractions by analyzing function/method symbols.
 * Creates nodes for each callable symbol. Actual call edges would be populated
 * from LSP call hierarchy data in Layer 3.
 *
 * @param extractions - Array of file extractions to analyze
 * @returns A CallGraph with nodes for all callable symbols
 * @see Requirements 21.1, 21.2, 21.3
 */
export function buildCallGraph(extractions: readonly FileExtraction[]): CallGraph {
    const allBuilders: NodeBuilder[] = [];
    for (const extraction of extractions) {
        allBuilders.push(...buildNodeBuilders(extraction));
    }

    // Note: edges would be populated from LSP call hierarchy in Layer 3
    const edges: CallGraphEdge[] = [];

    const nodes = new Map<string, GraphNode<CallGraphNode>>();
    for (const builder of allBuilders) {
        // With no edges, all nodes are entry points and leaves
        nodes.set(builder.id, { id: builder.id, data: createCallGraphNode(builder, 0, 0) });
    }

    return { nodes, edges: markRecursiveEdges(edges, nodes) };
}

/**
 * Gets all incoming calls (callers) for a given symbol.
 *
 * @param graph - The call graph to search
 * @param symbol - The symbol ID to find callers for
 * @returns Array of CallGraphEdges representing incoming calls
 * @see Requirements 21.2
 */
export function getIncomingCalls(graph: CallGraph, symbol: string): readonly CallGraphEdge[] {
    if (!graph.nodes.has(symbol)) return [];
    const callEdges: readonly CallGraphEdge[] = graph.edges;
    return callEdges.filter((edge) => edge.to === symbol);
}

/**
 * Gets all outgoing calls (callees) for a given symbol.
 *
 * @param graph - The call graph to search
 * @param symbol - The symbol ID to find callees for
 * @returns Array of CallGraphEdges representing outgoing calls
 * @see Requirements 21.3
 */
export function getOutgoingCalls(graph: CallGraph, symbol: string): readonly CallGraphEdge[] {
    if (!graph.nodes.has(symbol)) return [];
    const callEdges: readonly CallGraphEdge[] = graph.edges;
    return callEdges.filter((edge) => edge.from === symbol);
}
