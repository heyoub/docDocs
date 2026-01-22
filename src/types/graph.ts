/**
 * @fileoverview Graph types for dependency and call graph analysis.
 * This module defines generic graph structures and specialized types
 * for dependency graphs and call graphs used in documentation generation.
 *
 * @module types/graph
 */

import type { SourceLocation } from './base.js';

// ============================================================
// Generic Graph Types
// ============================================================

/**
 * A node in a graph with associated data.
 *
 * @typeParam T - The type of data stored in the node
 */
export interface GraphNode<T> {
    /** Unique identifier for the node */
    readonly id: string;
    /** Data associated with this node */
    readonly data: T;
}

/**
 * An edge connecting two nodes in a graph.
 */
export interface GraphEdge {
    /** ID of the source node */
    readonly from: string;
    /** ID of the target node */
    readonly to: string;
    /** Optional weight for weighted graphs */
    readonly weight?: number;
}

/**
 * A generic graph structure with typed nodes and edges.
 *
 * @typeParam T - The type of data stored in nodes
 */
export interface Graph<T> {
    /** Map of node IDs to nodes */
    readonly nodes: ReadonlyMap<string, GraphNode<T>>;
    /** List of edges in the graph */
    readonly edges: readonly GraphEdge[];
}

// ============================================================
// Dependency Graph Types
// ============================================================

/**
 * Data for a node in a dependency graph.
 * Represents a module with its exported symbols.
 */
export interface DependencyNode {
    /** File path of the module */
    readonly path: string;
    /** List of exported symbol names */
    readonly exports: readonly string[];
}

/**
 * An edge in a dependency graph representing an import relationship.
 * Extends GraphEdge with import-specific information.
 */
export interface DependencyEdge extends GraphEdge {
    /** List of imported symbol names */
    readonly imports: readonly string[];
    /** Whether this edge is part of a circular dependency */
    readonly isCircular: boolean;
}

/**
 * A dependency graph representing module import/export relationships.
 * Used for analyzing module dependencies and detecting circular imports.
 *
 * @see Requirements 17.1, 17.2
 */
export type DependencyGraph = Graph<DependencyNode> & {
    /** Edges with import information */
    readonly edges: readonly DependencyEdge[];
};

// ============================================================
// Call Graph Types
// ============================================================

/**
 * Data for a node in a call graph.
 * Represents a callable symbol (function, method) in the codebase.
 */
export interface CallGraphNode {
    /** Unique identifier for the call graph node */
    readonly id: string;
    /** Symbol name (function or method name) */
    readonly symbol: string;
    /** Module path where the symbol is defined */
    readonly module: string;
    /** Whether this is an entry point (not called by other functions) */
    readonly isEntryPoint: boolean;
    /** Whether this is a leaf node (doesn't call other functions) */
    readonly isLeaf: boolean;
}

/**
 * An edge in a call graph representing a function call relationship.
 * Extends GraphEdge with call-specific information.
 */
export interface CallGraphEdge extends GraphEdge {
    /** Locations where the call occurs in source code */
    readonly callSites: readonly SourceLocation[];
    /** Whether this is a recursive call (direct or indirect) */
    readonly isRecursive: boolean;
}

/**
 * A call graph representing function call relationships.
 * Used for analyzing call hierarchies and impact analysis.
 *
 * @see Requirements 21.2, 21.3
 */
export type CallGraph = Graph<CallGraphNode> & {
    /** Edges with call site information */
    readonly edges: readonly CallGraphEdge[];
};

// ============================================================
// Circular Dependency Types
// ============================================================

/**
 * Represents a detected circular dependency in the module graph.
 * Contains the cycle path and severity classification.
 *
 * @see Requirements 27.1
 */
export interface CircularDependency {
    /** 
     * The cycle path as an array of module IDs.
     * The first and last elements are the same, forming a closed cycle.
     * Example: ['A', 'B', 'C', 'A'] represents A → B → C → A
     */
    readonly cycle: readonly string[];
    /** 
     * Severity of the circular dependency.
     * - 'warning': May indicate design issues but doesn't break functionality
     * - 'error': Causes runtime issues or prevents proper initialization
     */
    readonly severity: 'warning' | 'error';
}
