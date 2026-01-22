/**
 * @fileoverview Impact analysis for API changes using call graph.
 * Determines the "blast radius" of changes by analyzing callers.
 *
 * @module core/changelog/impact
 */

import type { SchemaRef } from '../../types/base.js';
import type { CallGraph } from '../../types/graph.js';
import type { ImpactAnalysis, ImpactLevel } from '../../types/analysis.js';
import type { APIChange, APIDiff } from '../../types/changelog.js';

// ============================================================
// Impact Analysis Functions
// ============================================================

/**
 * Analyzes the impact of a change using the call graph.
 *
 * @param symbolRef - Reference to the changed symbol
 * @param callGraph - The workspace call graph
 * @param exportedSymbols - Set of exported symbol refs (public API)
 * @returns Impact analysis result
 */
export function analyzeImpact(
    symbolRef: SchemaRef,
    callGraph: CallGraph,
    exportedSymbols: ReadonlySet<string>
): ImpactAnalysis {
    // Find direct callers
    const directCallers = findDirectCallers(symbolRef, callGraph);

    // Find transitive callers (callers of callers)
    const transitiveCallers = findTransitiveCallers(symbolRef, callGraph, new Set(directCallers));

    // Find affected modules
    const affectedModules = findAffectedModules(directCallers, transitiveCallers, callGraph);

    // Find affected public exports
    const affectedExports = findAffectedExports(
        directCallers,
        transitiveCallers,
        exportedSymbols
    );

    // Calculate blast radius
    const blastRadius = directCallers.length + transitiveCallers.length;

    // Determine impact level
    const impactLevel = calculateImpactLevel(
        directCallers.length,
        transitiveCallers.length,
        affectedExports.length
    );

    return {
        symbolRef,
        directCallers,
        transitiveCallers,
        affectedModules,
        affectedExports,
        impactLevel,
        blastRadius
    };
}

/**
 * Finds direct callers of a symbol from the call graph.
 */
function findDirectCallers(symbolRef: SchemaRef, callGraph: CallGraph): readonly string[] {
    const callers: string[] = [];

    // Find incoming edges to this node
    for (const edge of callGraph.edges) {
        if (edge.to === symbolRef) {
            callers.push(edge.from);
        }
    }

    return callers;
}

/**
 * Finds transitive callers (callers of direct callers).
 */
function findTransitiveCallers(
    symbolRef: SchemaRef,
    callGraph: CallGraph,
    directCallers: ReadonlySet<string>,
    maxDepth: number = 3
): readonly string[] {
    const visited = new Set<string>([symbolRef as string, ...directCallers]);
    const transitive: string[] = [];
    const queue = [...directCallers];
    let depth = 0;

    while (queue.length > 0 && depth < maxDepth) {
        const levelSize = queue.length;

        for (let i = 0; i < levelSize; i++) {
            const current = queue.shift();
            if (!current) continue;

            // Find callers of current
            for (const edge of callGraph.edges) {
                if (edge.to === current && !visited.has(edge.from)) {
                    visited.add(edge.from);
                    transitive.push(edge.from);
                    queue.push(edge.from);
                }
            }
        }

        depth++;
    }

    return transitive;
}

/**
 * Finds modules containing affected callers.
 */
function findAffectedModules(
    directCallers: readonly string[],
    transitiveCallers: readonly string[],
    callGraph: CallGraph
): readonly string[] {
    const modules = new Set<string>();

    const allCallers = [...directCallers, ...transitiveCallers];

    for (const caller of allCallers) {
        // Extract module from symbol ref (format: "modulePath:symbolName")
        const node = callGraph.nodes.get(caller);
        if (node) {
            // Parse the module from the node's data
            modules.add(node.data.module);
        } else {
            // Fallback: try to extract from the caller ref itself
            const modulePath = extractModulePath(caller);
            if (modulePath) {
                modules.add(modulePath);
            }
        }
    }

    return Array.from(modules);
}

/**
 * Extracts module path from a symbol reference.
 */
function extractModulePath(symbolRef: string): string | null {
    // Format: "path/to/module.ts:SymbolName" or "#/definitions/SymbolName"
    if (symbolRef.includes(':')) {
        const modulePath = symbolRef.split(':')[0];
        return modulePath ?? null;
    }
    if (symbolRef.startsWith('#/')) {
        // JSON Schema ref format - extract from definitions path if possible
        return null;
    }
    return null;
}

/**
 * Finds public exports that are affected by the change.
 */
function findAffectedExports(
    directCallers: readonly string[],
    transitiveCallers: readonly string[],
    exportedSymbols: ReadonlySet<string>
): readonly string[] {
    const affected: string[] = [];

    const allCallers = [...directCallers, ...transitiveCallers];

    for (const caller of allCallers) {
        if (exportedSymbols.has(caller)) {
            affected.push(caller);
        }
    }

    return affected;
}

/**
 * Calculates the impact level based on caller counts.
 */
function calculateImpactLevel(
    directCount: number,
    transitiveCount: number,
    exportedCount: number
): ImpactLevel {
    // Critical if affects many public exports
    if (exportedCount >= 5) {
        return 'critical';
    }

    // High if many direct callers or affects public exports
    if (directCount >= 10 || exportedCount >= 2) {
        return 'high';
    }

    // Medium if moderate callers
    if (directCount >= 3 || transitiveCount >= 10) {
        return 'medium';
    }

    // Low if few callers
    if (directCount >= 1) {
        return 'low';
    }

    // None if no callers found
    return 'none';
}

// ============================================================
// Batch Impact Analysis
// ============================================================

/**
 * Analyzes impact for all changes in a diff.
 *
 * @param diff - The API diff
 * @param callGraph - The workspace call graph
 * @param exportedSymbols - Set of exported symbol refs
 * @returns Map of symbol refs to their impact analysis
 */
export function analyzeAllImpacts(
    diff: APIDiff,
    callGraph: CallGraph,
    exportedSymbols: ReadonlySet<string>
): ReadonlyMap<string, ImpactAnalysis> {
    const impactMap = new Map<string, ImpactAnalysis>();

    for (const change of diff.changes) {
        if (change.symbolRef) {
            const impact = analyzeImpact(change.symbolRef, callGraph, exportedSymbols);
            impactMap.set(change.symbolRef, impact);
        }
    }

    return impactMap;
}

/**
 * Filters changes to only those with high or critical impact.
 *
 * @param diff - The API diff
 * @param impactMap - Map of impacts
 * @returns Changes with high/critical impact
 */
export function getHighImpactChanges(
    diff: APIDiff,
    impactMap: ReadonlyMap<string, ImpactAnalysis>
): readonly APIChange[] {
    return diff.changes.filter(change => {
        if (!change.symbolRef) return false;
        const impact = impactMap.get(change.symbolRef);
        return impact && (impact.impactLevel === 'high' || impact.impactLevel === 'critical');
    });
}

/**
 * Gets total blast radius for a diff.
 *
 * @param impactMap - Map of impacts
 * @returns Total number of affected call sites
 */
export function getTotalBlastRadius(impactMap: ReadonlyMap<string, ImpactAnalysis>): number {
    let total = 0;
    for (const impact of impactMap.values()) {
        total += impact.blastRadius;
    }
    return total;
}

// ============================================================
// Impact Summary
// ============================================================

/**
 * Summary of impact analysis for a diff.
 */
export interface ImpactSummary {
    readonly totalChanges: number;
    readonly criticalImpact: number;
    readonly highImpact: number;
    readonly mediumImpact: number;
    readonly lowImpact: number;
    readonly noImpact: number;
    readonly totalBlastRadius: number;
    readonly mostImpactedSymbol: string | null;
    readonly mostImpactedBlastRadius: number;
}

/**
 * Generates an impact summary for a diff.
 * Cross-references diff changes with impact analysis.
 */
export function generateImpactSummary(
    diff: APIDiff,
    impactMap: ReadonlyMap<string, ImpactAnalysis>
): ImpactSummary {
    let criticalImpact = 0;
    let highImpact = 0;
    let mediumImpact = 0;
    let lowImpact = 0;
    let noImpact = 0;
    let totalBlastRadius = 0;
    let mostImpactedSymbol: string | null = null;
    let mostImpactedBlastRadius = 0;

    // Process impact map entries
    for (const [symbolRef, impact] of impactMap) {
        switch (impact.impactLevel) {
            case 'critical': criticalImpact++; break;
            case 'high': highImpact++; break;
            case 'medium': mediumImpact++; break;
            case 'low': lowImpact++; break;
            case 'none': noImpact++; break;
        }

        totalBlastRadius += impact.blastRadius;

        if (impact.blastRadius > mostImpactedBlastRadius) {
            mostImpactedBlastRadius = impact.blastRadius;
            mostImpactedSymbol = symbolRef;
        }
    }

    // Cross-reference with diff: any breaking change without impact analysis
    // is automatically critical (we don't know its blast radius)
    for (const change of diff.changes) {
        if (change.breaking && change.symbolRef && !impactMap.has(change.symbolRef)) {
            criticalImpact++; // Unknown blast radius for breaking change = critical
        }
    }

    // Module-level breaking changes also count
    const breakingModuleChanges = diff.moduleChanges.filter(mc => mc.breaking);
    criticalImpact += breakingModuleChanges.length;

    return {
        totalChanges: diff.summary.totalChanges,
        criticalImpact,
        highImpact,
        mediumImpact,
        lowImpact,
        noImpact,
        totalBlastRadius,
        mostImpactedSymbol,
        mostImpactedBlastRadius
    };
}
