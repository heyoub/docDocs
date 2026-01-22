/**
 * @fileoverview Dependency graph construction and analysis.
 * Builds dependency graphs from file extractions by analyzing imports,
 * computes transitive dependencies, and marks circular edges.
 *
 * @module core/graph/dependency
 * @see Requirements 17.1, 17.2, 27.1, 27.2
 */

import type { FileExtraction } from '../../types/extraction.js';
import type {
    DependencyGraph,
    DependencyNode,
    DependencyEdge,
    GraphNode,
} from '../../types/graph.js';
import { detectCycles } from './algorithms.js';

// ============================================================
// Internal Types
// ============================================================

/**
 * Intermediate representation for building dependency edges.
 */
interface EdgeBuilder {
    readonly from: string;
    readonly to: string;
    readonly imports: string[];
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Normalizes a module path to a consistent format for use as node ID.
 * Removes file:// prefix and normalizes path separators.
 *
 * @param uri - The file URI or import source
 * @returns Normalized path string
 */
function normalizeModulePath(uri: string): string {
    // Remove file:// prefix if present
    let normalized = uri.replace(/^file:\/\//, '');

    // Normalize path separators to forward slashes
    normalized = normalized.replace(/\\/g, '/');

    // Remove leading slash on Windows paths (e.g., /C:/...)
    if (/^\/[A-Za-z]:/.test(normalized)) {
        normalized = normalized.slice(1);
    }

    return normalized;
}

/**
 * Resolves a relative import path against a base module path.
 *
 * @param basePath - The path of the importing module
 * @param importSource - The import specifier (e.g., './utils', '../types')
 * @returns Resolved absolute path, or the original source if not relative
 */
function resolveImportPath(basePath: string, importSource: string): string {
    // Non-relative imports (packages) - return as-is
    if (!importSource.startsWith('.')) {
        return importSource;
    }

    // Get directory of base path
    const lastSlash = basePath.lastIndexOf('/');
    const baseDir = lastSlash >= 0 ? basePath.slice(0, lastSlash) : '';

    // Split import path into segments
    const segments = importSource.split('/');
    const resultSegments = baseDir ? baseDir.split('/') : [];

    for (const segment of segments) {
        if (segment === '.') {
            // Current directory - no change
            continue;
        } else if (segment === '..') {
            // Parent directory - pop last segment
            resultSegments.pop();
        } else {
            // Regular segment - add to path
            resultSegments.push(segment);
        }
    }

    return resultSegments.join('/');
}

/**
 * Extracts export names from a file extraction.
 *
 * @param extraction - The file extraction to process
 * @returns Array of exported symbol names
 */
function extractExportNames(extraction: FileExtraction): readonly string[] {
    return extraction.exports.map((exp) => exp.name);
}

/**
 * Creates a dependency node from a file extraction.
 *
 * @param extraction - The file extraction
 * @param nodeId - The normalized node ID
 * @returns A DependencyNode
 */
function createDependencyNode(
    extraction: FileExtraction,
    nodeId: string
): DependencyNode {
    return {
        path: nodeId,
        exports: extractExportNames(extraction),
    };
}

/**
 * Builds edge builders from a file extraction's imports.
 *
 * @param extraction - The file extraction
 * @param fromId - The source node ID
 * @param knownModules - Set of known module IDs in the graph
 * @returns Array of edge builders
 */
function buildEdgesFromImports(
    extraction: FileExtraction,
    fromId: string,
    knownModules: Set<string>
): EdgeBuilder[] {
    const edges: EdgeBuilder[] = [];

    for (const importInfo of extraction.imports) {
        const resolvedPath = resolveImportPath(fromId, importInfo.source);

        // Only create edges to known modules (internal dependencies)
        // Skip external package imports
        if (knownModules.has(resolvedPath)) {
            edges.push({
                from: fromId,
                to: resolvedPath,
                imports: [...importInfo.specifiers],
            });
        }
    }

    return edges;
}

/**
 * Merges duplicate edges (same from/to) by combining their imports.
 *
 * @param edges - Array of edge builders
 * @returns Array of merged edge builders
 */
function mergeEdges(edges: EdgeBuilder[]): EdgeBuilder[] {
    const edgeMap = new Map<string, EdgeBuilder>();

    for (const edge of edges) {
        const key = `${edge.from}|${edge.to}`;
        const existing = edgeMap.get(key);

        if (existing) {
            // Merge imports
            const mergedImports = [...new Set([...existing.imports, ...edge.imports])];
            edgeMap.set(key, {
                from: edge.from,
                to: edge.to,
                imports: mergedImports,
            });
        } else {
            edgeMap.set(key, edge);
        }
    }

    return Array.from(edgeMap.values());
}

/**
 * Converts edge builders to dependency edges (without circular marking).
 *
 * @param builders - Array of edge builders
 * @returns Array of dependency edges with isCircular = false
 */
function toDependencyEdges(builders: EdgeBuilder[]): DependencyEdge[] {
    return builders.map((builder) => ({
        from: builder.from,
        to: builder.to,
        imports: builder.imports,
        isCircular: false,
    }));
}

/**
 * Builds an adjacency list for BFS traversal.
 *
 * @param edges - The dependency edges
 * @returns Map from node ID to array of dependency node IDs
 */
function buildAdjacencyList(
    edges: readonly DependencyEdge[]
): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();

    for (const edge of edges) {
        const deps = adjacency.get(edge.from);
        if (deps) {
            deps.push(edge.to);
        } else {
            adjacency.set(edge.from, [edge.to]);
        }
    }

    return adjacency;
}

// ============================================================
// Public API
// ============================================================

/**
 * Builds a dependency graph from file extractions by analyzing imports.
 *
 * Creates nodes for each file and edges for each import relationship.
 * Only internal dependencies (imports between extracted files) are included;
 * external package imports are excluded.
 *
 * @param extractions - Array of file extractions to analyze
 * @returns A DependencyGraph with nodes and edges (circular edges not yet marked)
 *
 * @example
 * ```typescript
 * const extractions: FileExtraction[] = [
 *   { uri: 'file:///src/a.ts' as FileURI, imports: [{ source: './b.js', ... }], ... },
 *   { uri: 'file:///src/b.ts' as FileURI, imports: [], ... }
 * ];
 * const graph = buildDependencyGraph(extractions);
 * // graph.edges contains edge from 'src/a.ts' to 'src/b.ts'
 * ```
 *
 * @see Requirements 17.1, 17.2
 */
export function buildDependencyGraph(
    extractions: readonly FileExtraction[]
): DependencyGraph {
    // First pass: create all nodes and collect known module IDs
    const nodes = new Map<string, GraphNode<DependencyNode>>();
    const knownModules = new Set<string>();

    for (const extraction of extractions) {
        const nodeId = normalizeModulePath(extraction.uri);
        knownModules.add(nodeId);

        const node: GraphNode<DependencyNode> = {
            id: nodeId,
            data: createDependencyNode(extraction, nodeId),
        };
        nodes.set(nodeId, node);
    }

    // Second pass: build edges from imports
    const allEdgeBuilders: EdgeBuilder[] = [];

    for (const extraction of extractions) {
        const fromId = normalizeModulePath(extraction.uri);
        const edgeBuilders = buildEdgesFromImports(extraction, fromId, knownModules);
        allEdgeBuilders.push(...edgeBuilders);
    }

    // Merge duplicate edges and convert to DependencyEdge
    const mergedBuilders = mergeEdges(allEdgeBuilders);
    const edges = toDependencyEdges(mergedBuilders);

    return {
        nodes,
        edges,
    };
}

/**
 * Gets all transitive dependencies of a module using BFS.
 *
 * Returns all modules that the given module depends on, directly or indirectly.
 * Does not include the module itself in the result.
 *
 * @param graph - The dependency graph to search
 * @param module - The module ID to find dependencies for
 * @returns Array of module IDs that are transitive dependencies
 *
 * @example
 * ```typescript
 * // Given: A → B → C, A → D
 * const deps = getTransitiveDeps(graph, 'A');
 * // deps = ['B', 'D', 'C'] (order may vary)
 * ```
 *
 * @see Requirements 17.1, 17.2
 */
export function getTransitiveDeps(
    graph: DependencyGraph,
    module: string
): string[] {
    // Check if module exists in graph
    if (!graph.nodes.has(module)) {
        return [];
    }

    const adjacency = buildAdjacencyList(graph.edges);
    const visited = new Set<string>();
    const result: string[] = [];

    // BFS traversal
    const queue: string[] = [];

    // Initialize with direct dependencies
    const directDeps = adjacency.get(module) ?? [];
    for (const dep of directDeps) {
        if (!visited.has(dep)) {
            visited.add(dep);
            queue.push(dep);
            result.push(dep);
        }
    }

    // Process queue
    while (queue.length > 0) {
        const current = queue.shift()!;
        const deps = adjacency.get(current) ?? [];

        for (const dep of deps) {
            if (!visited.has(dep)) {
                visited.add(dep);
                queue.push(dep);
                result.push(dep);
            }
        }
    }

    return result;
}

/**
 * Marks edges that are part of circular dependencies.
 *
 * Uses the detectCycles algorithm to find all cycles in the graph,
 * then marks edges that participate in those cycles with isCircular = true.
 *
 * @param graph - The dependency graph to analyze
 * @returns A new DependencyGraph with circular edges marked
 *
 * @example
 * ```typescript
 * // Given: A → B → C → A (cycle)
 * const markedGraph = markCircularEdges(graph);
 * // All edges in the cycle have isCircular = true
 * ```
 *
 * @see Requirements 27.1, 27.2
 */
export function markCircularEdges(graph: DependencyGraph): DependencyGraph {
    // Detect all cycles using Tarjan's algorithm
    const cycles = detectCycles(graph);

    // Build a set of circular edge keys for O(1) lookup
    const circularEdgeKeys = new Set<string>();

    for (const cycle of cycles) {
        // A cycle [A, B, C] represents edges A→B, B→C, C→A
        for (let i = 0; i < cycle.length; i++) {
            const from = cycle[i]!;
            const to = cycle[(i + 1) % cycle.length]!;
            circularEdgeKeys.add(`${from}|${to}`);
        }
    }

    // DependencyGraph guarantees edges are DependencyEdge[]
    // TypeScript needs help due to intersection type inference
    const dependencyEdges: readonly DependencyEdge[] = graph.edges;

    // Create new edges with isCircular marked appropriately
    const markedEdges: DependencyEdge[] = dependencyEdges.map((edge) => {
        const key = `${edge.from}|${edge.to}`;
        const isCircular = circularEdgeKeys.has(key);

        if (isCircular === edge.isCircular) {
            // No change needed
            return edge;
        }

        return {
            from: edge.from,
            to: edge.to,
            imports: edge.imports,
            isCircular,
        };
    });

    return {
        nodes: graph.nodes,
        edges: markedEdges,
    };
}
