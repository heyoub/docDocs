/**
 * @fileoverview Mermaid diagram renderer for GenDocs extension.
 * Generates Mermaid flowcharts and sequence diagrams from graph data.
 * Layer 2 - imports only from Layer 0 (types) and Layer 1 (utils, templates).
 *
 * @module core/renderer/mermaid
 * @see Requirements 17.4, 21.4, 36.1
 */

import type { DependencyGraph, CallGraph, CallGraphEdge } from '../../types/graph.js';

// ============================================================
// Constants
// ============================================================

/** Mermaid graph direction: top-down */
const GRAPH_DIRECTION = 'TD';

/** Style for circular dependency edges (red stroke) */
const CIRCULAR_EDGE_STYLE = 'stroke:red,stroke-width:2px';

/** Style for recursive call edges (orange stroke) */
const RECURSIVE_EDGE_STYLE = 'stroke:orange,stroke-width:2px';

/** Style for entry point nodes (green fill) */
const ENTRY_POINT_STYLE = 'fill:#90EE90,stroke:#228B22';

/** Style for leaf nodes (light blue fill) */
const LEAF_NODE_STYLE = 'fill:#ADD8E6,stroke:#4682B4';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Sanitizes a string for use as a Mermaid node ID.
 * Removes special characters and replaces with underscores.
 * @param id - The raw identifier string
 * @returns Sanitized ID safe for Mermaid
 */
const sanitizeId = (id: string): string =>
    id.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'node';

/**
 * Escapes special characters in Mermaid labels.
 * @param label - The raw label text
 * @returns Escaped label safe for Mermaid
 */
const escapeLabel = (label: string | null | undefined): string => {
    if (!label) return 'unknown';
    return label.replace(/"/g, "'").replace(/[[\](){}]/g, '');
};

/**
 * Extracts the filename from a file path.
 * @param path - Full file path
 * @returns Just the filename portion
 */
const getFileName = (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1] ?? path;
};

/**
 * Creates a Mermaid node definition with label.
 * @param id - Node identifier
 * @param label - Display label
 * @param shape - Node shape: 'rect' | 'rounded' | 'stadium'
 * @returns Mermaid node definition string
 */
const createNode = (id: string, label: string, shape: 'rect' | 'rounded' | 'stadium' = 'rect'): string => {
    const safeId = sanitizeId(id);
    const safeLabel = escapeLabel(label);
    switch (shape) {
        case 'rounded':
            return `    ${safeId}(${safeLabel})`;
        case 'stadium':
            return `    ${safeId}([${safeLabel}])`;
        default:
            return `    ${safeId}[${safeLabel}]`;
    }
};

/**
 * Creates a Mermaid edge definition.
 * @param from - Source node ID
 * @param to - Target node ID
 * @param label - Optional edge label
 * @returns Mermaid edge definition string
 */
const createEdge = (from: string, to: string, label?: string): string => {
    const safeFrom = sanitizeId(from);
    const safeTo = sanitizeId(to);
    return label ? `    ${safeFrom} -->|${escapeLabel(label)}| ${safeTo}` : `    ${safeFrom} --> ${safeTo}`;
};

/**
 * Creates a Mermaid linkStyle directive for styling edges.
 * @param edgeIndex - Zero-based index of the edge
 * @param style - CSS-like style string
 * @returns Mermaid linkStyle directive
 */
const createLinkStyle = (edgeIndex: number, style: string): string => `    linkStyle ${edgeIndex} ${style}`;

/**
 * Creates a Mermaid style directive for styling nodes.
 * @param nodeId - Node identifier
 * @param style - CSS-like style string
 * @returns Mermaid style directive
 */
const createNodeStyle = (nodeId: string, style: string): string => `    style ${sanitizeId(nodeId)} ${style}`;

// ============================================================
// Dependency Graph Rendering
// ============================================================

/**
 * Renders a dependency graph as a Mermaid flowchart.
 * Highlights circular dependencies with red edges.
 *
 * @param graph - The dependency graph to render
 * @returns Mermaid flowchart diagram string
 *
 * @example
 * ```typescript
 * const mermaid = renderDependencyGraph(depGraph);
 * // Returns:
 * // graph TD
 * //     moduleA[module-a.ts]
 * //     moduleB[module-b.ts]
 * //     moduleA --> moduleB
 * ```
 *
 * @see Requirements 17.4
 */
export function renderDependencyGraph(graph: DependencyGraph): string {
    const lines: string[] = [`graph ${GRAPH_DIRECTION}`];
    const circularEdgeIndices: number[] = [];

    // Render nodes
    for (const [id, node] of graph.nodes) {
        const label = getFileName(node.data.path);
        lines.push(createNode(id, label, 'rect'));
    }

    // Render edges and track circular ones
    let edgeIndex = 0;
    for (const edge of graph.edges) {
        // Support both { imports: [...] } and { importCount: N } for backwards compat
        const edgeData = edge as { imports?: readonly string[]; importCount?: number; isCircular?: boolean; data?: { importCount?: number; isCircular?: boolean } };
        const importCount = edgeData.imports?.length ?? edgeData.importCount ?? edgeData.data?.importCount ?? 0;
        const label = importCount > 0 ? `${importCount} import${importCount > 1 ? 's' : ''}` : undefined;
        lines.push(createEdge(edge.from, edge.to, label));

        const isCircular = edgeData.isCircular ?? edgeData.data?.isCircular ?? false;
        if (isCircular) {
            circularEdgeIndices.push(edgeIndex);
        }
        edgeIndex++;
    }

    // Apply styles to circular edges
    for (const idx of circularEdgeIndices) {
        lines.push(createLinkStyle(idx, CIRCULAR_EDGE_STYLE));
    }

    return lines.join('\n');
}

// ============================================================
// Call Graph Rendering
// ============================================================

/**
 * Determines the appropriate node shape based on call graph node properties.
 * @param node - The call graph node
 * @returns Node shape for Mermaid
 */
const getCallNodeShape = (node: { isEntryPoint?: boolean; isLeaf?: boolean }): 'rect' | 'rounded' | 'stadium' => {
    if (node.isEntryPoint) return 'stadium';
    if (node.isLeaf) return 'rounded';
    return 'rect';
};

/**
 * Renders a call graph as a Mermaid flowchart.
 * Entry points are shown with stadium shape (rounded ends).
 * Leaf nodes are shown with rounded corners.
 * Recursive calls are highlighted with orange edges.
 *
 * @param graph - The call graph to render
 * @returns Mermaid flowchart diagram string
 *
 * @example
 * ```typescript
 * const mermaid = renderCallGraph(callGraph);
 * // Returns:
 * // graph TD
 * //     main([main])
 * //     helper(helper)
 * //     main --> helper
 * //     style main fill:#90EE90,stroke:#228B22
 * ```
 *
 * @see Requirements 21.4
 */
export function renderCallGraph(graph: CallGraph): string {
    const lines: string[] = [`graph ${GRAPH_DIRECTION}`];
    const recursiveEdgeIndices: number[] = [];
    const entryPoints: string[] = [];
    const leafNodes: string[] = [];

    // Render nodes with appropriate shapes
    for (const [id, node] of graph.nodes) {
        const nodeData = node.data as { symbol?: string; name?: string; isEntryPoint?: boolean; isLeaf?: boolean };
        // Support both { symbol: '...' } and { name: '...' } for backwards compat
        const label = nodeData.symbol ?? nodeData.name ?? id;
        const shape = getCallNodeShape(nodeData);
        lines.push(createNode(id, label, shape));

        if (nodeData.isEntryPoint) entryPoints.push(id);
        if (nodeData.isLeaf) leafNodes.push(id);
    }

    // Render edges and track recursive ones
    let edgeIndex = 0;
    for (const edge of graph.edges) {
        // Support both { callSites: [...] } and { callCount: N } for backwards compat
        const edgeData = edge as { callSites?: readonly unknown[]; callCount?: number; data?: { callCount?: number; isRecursive?: boolean }; isRecursive?: boolean };
        const callCount = edgeData.callSites?.length ?? edgeData.callCount ?? edgeData.data?.callCount ?? 1;
        const label = callCount > 1 ? `${callCount} calls` : undefined;
        lines.push(createEdge(edge.from, edge.to, label));

        const isRecursive = edgeData.isRecursive ?? edgeData.data?.isRecursive ?? false;
        if (isRecursive) {
            recursiveEdgeIndices.push(edgeIndex);
        }
        edgeIndex++;
    }

    // Apply styles to entry points
    for (const nodeId of entryPoints) {
        lines.push(createNodeStyle(nodeId, ENTRY_POINT_STYLE));
    }

    // Apply styles to leaf nodes
    for (const nodeId of leafNodes) {
        lines.push(createNodeStyle(nodeId, LEAF_NODE_STYLE));
    }

    // Apply styles to recursive edges
    for (const idx of recursiveEdgeIndices) {
        lines.push(createLinkStyle(idx, RECURSIVE_EDGE_STYLE));
    }

    return lines.join('\n');
}

// ============================================================
// Sequence Diagram Rendering
// ============================================================

/**
 * Extracts unique participants from call edges.
 * @param calls - Array of call graph edges
 * @returns Array of unique participant IDs in order of first appearance
 */
const extractParticipants = (calls: readonly CallGraphEdge[]): readonly string[] => {
    const seen = new Set<string>();
    const participants: string[] = [];

    for (const call of calls) {
        if (!seen.has(call.from)) {
            seen.add(call.from);
            participants.push(call.from);
        }
        if (!seen.has(call.to)) {
            seen.add(call.to);
            participants.push(call.to);
        }
    }

    return participants;
};

/**
 * Creates a Mermaid participant declaration.
 * @param id - Participant identifier
 * @returns Mermaid participant declaration string
 */
const createParticipant = (id: string): string => `    participant ${sanitizeId(id)} as ${escapeLabel(id)}`;

/**
 * Creates a Mermaid sequence diagram arrow.
 * @param from - Source participant
 * @param to - Target participant
 * @param label - Optional message label
 * @param isRecursive - Whether this is a recursive call
 * @returns Mermaid sequence arrow string
 */
const createSequenceArrow = (from: string, to: string, label?: string, isRecursive?: boolean): string => {
    const safeFrom = sanitizeId(from);
    const safeTo = sanitizeId(to);
    const arrow = isRecursive ? '-->>' : '->>';
    const message = label ? escapeLabel(label) : 'call';
    return `    ${safeFrom}${arrow}${safeTo}: ${message}`;
};

/**
 * Renders a sequence diagram from call graph edges.
 * Shows the order of function calls as a sequence.
 *
 * @param calls - Array of call graph edges representing the call sequence
 * @returns Mermaid sequence diagram string
 *
 * @example
 * ```typescript
 * const mermaid = renderSequenceDiagram(callEdges);
 * // Returns:
 * // sequenceDiagram
 * //     participant main as main
 * //     participant helper as helper
 * //     main->>helper: call
 * ```
 *
 * @see Requirements 36.1
 */
export function renderSequenceDiagram(calls: readonly CallGraphEdge[]): string {
    if (calls.length === 0) {
        return 'sequenceDiagram\n    Note over System: No calls to display';
    }

    const lines: string[] = ['sequenceDiagram'];

    // Declare participants in order of appearance
    const participants = extractParticipants(calls);
    for (const participant of participants) {
        lines.push(createParticipant(participant));
    }

    // Add blank line for readability
    lines.push('');

    // Render call sequence
    for (const call of calls) {
        // Support both { callSites: [...] } and { callCount: N } for backwards compat
        const callData = call as { callSites?: readonly unknown[]; callCount?: number; isRecursive?: boolean };
        const callCount = callData.callSites?.length ?? callData.callCount ?? 1;
        const label = callCount > 1 ? `${callCount} calls` : undefined;
        lines.push(createSequenceArrow(call.from, call.to, label, callData.isRecursive ?? false));

        // Add note for recursive calls
        if (callData.isRecursive) {
            lines.push(`    Note right of ${sanitizeId(call.to)}: recursive`);
        }
    }

    return lines.join('\n');
}
