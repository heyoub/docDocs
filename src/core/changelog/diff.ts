/**
 * @fileoverview Semantic diff algorithm for API changelog detection.
 * Computes differences between API snapshots at the semantic level.
 *
 * @module core/changelog/diff
 */

import type { SymbolSchema, ParameterSchema, TypeSchema } from '../../types/schema.js';
import type {
    APISnapshot,
    ModuleAPISnapshot,
    APIDiff,
    APIChange,
    ModuleChange,
    DiffSummary,
    ChangeType,
    ParameterChange,
    ReturnTypeChange,
    SymbolModification,
    TypeChangeAnalysis
} from '../../types/changelog.js';
import { classifyBreakingChange, computeSemverImpact } from './rules.js';

// ============================================================
// Type Comparison
// ============================================================

/**
 * Compares two types and determines if they are compatible.
 */
function compareTypes(
    before: TypeSchema | undefined,
    after: TypeSchema | undefined
): TypeChangeAnalysis | null {
    if (!before && !after) {
        return null;
    }

    if (!before && after) {
        return {
            direction: 'contravariant',
            breaking: false,
            explanation: `Type added: ${after.raw}`
        };
    }

    if (before && !after) {
        return {
            direction: 'covariant',
            breaking: true,
            explanation: `Type removed: ${before.raw}`
        };
    }

    // Both exist - compare them
    const beforeRaw = before!.raw;
    const afterRaw = after!.raw;

    if (beforeRaw === afterRaw) {
        return null; // No change
    }

    // Detect widening vs narrowing
    // Widening: adding to union, making optional, adding null/undefined
    // Narrowing: removing from union, making required, removing null/undefined

    const isWidened = isTypeWidened(beforeRaw, afterRaw);
    const isNarrowed = isTypeNarrowed(beforeRaw, afterRaw);

    if (isWidened) {
        return {
            direction: 'contravariant',
            breaking: false,
            explanation: `Type widened from ${beforeRaw} to ${afterRaw}`
        };
    }

    if (isNarrowed) {
        return {
            direction: 'covariant',
            breaking: true,
            explanation: `Type narrowed from ${beforeRaw} to ${afterRaw}`
        };
    }

    // Incompatible change
    return {
        direction: 'invariant',
        breaking: true,
        explanation: `Type changed incompatibly from ${beforeRaw} to ${afterRaw}`
    };
}

/**
 * Checks if a type was widened (made more permissive).
 */
function isTypeWidened(before: string, after: string): boolean {
    // Simple heuristics for common patterns
    // Check if after adds to a union
    if (after.includes('|') && !before.includes('|')) {
        if (after.includes(before)) return true;
    }

    // Check if after adds null/undefined
    if (!before.includes('null') && after.includes('null')) return true;
    if (!before.includes('undefined') && after.includes('undefined')) return true;

    // Check if after is a superset union
    if (before.includes('|') && after.includes('|')) {
        const beforeParts = before.split('|').map(p => p.trim());
        const afterParts = after.split('|').map(p => p.trim());
        if (beforeParts.every(p => afterParts.includes(p)) && afterParts.length > beforeParts.length) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if a type was narrowed (made more restrictive).
 */
function isTypeNarrowed(before: string, after: string): boolean {
    // Check if before had null/undefined that after doesn't
    if (before.includes('null') && !after.includes('null')) return true;
    if (before.includes('undefined') && !after.includes('undefined')) return true;

    // Check if before was a union that was narrowed
    if (before.includes('|') && !after.includes('|')) {
        if (before.includes(after)) return true;
    }

    // Check if before is a superset union
    if (before.includes('|') && after.includes('|')) {
        const beforeParts = before.split('|').map(p => p.trim());
        const afterParts = after.split('|').map(p => p.trim());
        if (afterParts.every(p => beforeParts.includes(p)) && beforeParts.length > afterParts.length) {
            return true;
        }
    }

    return false;
}

// ============================================================
// Parameter Comparison
// ============================================================

/**
 * Compares parameters between two function signatures.
 */
function compareParameters(
    before: readonly ParameterSchema[] | undefined,
    after: readonly ParameterSchema[] | undefined
): readonly ParameterChange[] {
    const changes: ParameterChange[] = [];
    const beforeParams = before ?? [];
    const afterParams = after ?? [];

    // Create maps for quick lookup
    const beforeMap = new Map(beforeParams.map(p => [p.name, p]));
    const afterMap = new Map(afterParams.map(p => [p.name, p]));

    // Find removed parameters
    for (const param of beforeParams) {
        if (!afterMap.has(param.name)) {
            changes.push({
                name: param.name,
                changeType: 'removed',
                before: param,
                after: null,
                typeChange: null,
                breaking: true
            });
        }
    }

    // Find added parameters
    for (const param of afterParams) {
        if (!beforeMap.has(param.name)) {
            // Adding required parameter is breaking
            const breaking = !param.optional && param.defaultValue === null;
            changes.push({
                name: param.name,
                changeType: 'added',
                before: null,
                after: param,
                typeChange: null,
                breaking
            });
        }
    }

    // Find modified parameters
    for (const afterParam of afterParams) {
        const beforeParam = beforeMap.get(afterParam.name);
        if (beforeParam) {
            const typeChange = compareTypes(beforeParam.type, afterParam.type);
            const optionalityChanged = beforeParam.optional !== afterParam.optional;

            // Check for reordering
            const beforeIndex = beforeParams.findIndex(p => p.name === afterParam.name);
            const afterIndex = afterParams.findIndex(p => p.name === afterParam.name);
            const reordered = beforeIndex !== afterIndex;

            if (typeChange || optionalityChanged || reordered) {
                let breaking = false;

                // Making required → optional is safe
                // Making optional → required is breaking
                if (optionalityChanged && !afterParam.optional) {
                    breaking = true;
                }

                // Type change breaking-ness
                if (typeChange?.breaking) {
                    breaking = true;
                }

                // Reordering positional params is breaking for non-named-argument languages
                if (reordered) {
                    breaking = true;
                }

                changes.push({
                    name: afterParam.name,
                    changeType: reordered ? 'reordered' : 'modified',
                    before: beforeParam,
                    after: afterParam,
                    typeChange,
                    breaking
                });
            }
        }
    }

    return changes;
}

// ============================================================
// Symbol Comparison
// ============================================================

/**
 * Compares two symbols and computes modification details.
 */
function compareSymbols(
    before: SymbolSchema,
    after: SymbolSchema
): SymbolModification {
    const parameterChanges = compareParameters(before.parameters, after.parameters);

    let returnTypeChange: ReturnTypeChange | null = null;
    if (before.returnType || after.returnType) {
        const typeChange = compareTypes(before.returnType, after.returnType);
        if (typeChange) {
            // For return types, covariance rules are reversed from parameters
            // Widening return type (adding null) is BREAKING
            // Narrowing return type (removing null) is SAFE
            const breaking = typeChange.direction === 'contravariant';
            returnTypeChange = {
                before: before.returnType ?? null,
                after: after.returnType ?? null,
                typeChange: {
                    ...typeChange,
                    breaking
                },
                breaking
            };
        }
    }

    const signatureChanged = before.signature !== after.signature;
    const documentationChanged = before.description !== after.description;
    const deprecationChanged = !!before.deprecated !== !!after.deprecated;

    return {
        parameterChanges,
        returnTypeChange,
        signatureChanged,
        previousSignature: signatureChanged ? before.signature : null,
        currentSignature: signatureChanged ? after.signature : null,
        documentationChanged,
        deprecationChanged
    };
}

// ============================================================
// Export Comparison
// ============================================================

/**
 * Compares exports between two modules.
 */
function compareModuleExports(
    beforeModule: ModuleAPISnapshot,
    afterModule: ModuleAPISnapshot,
    modulePath: string
): readonly APIChange[] {
    const changes: APIChange[] = [];

    // Create maps for quick lookup
    const beforeMap = new Map(beforeModule.exports.map(e => [e.name, e]));
    const afterMap = new Map(afterModule.exports.map(e => [e.name, e]));

    // Find removed exports
    for (const [name, beforeExport] of beforeMap) {
        if (!afterMap.has(name)) {
            changes.push({
                changeType: 'removed',
                modulePath,
                symbolName: name,
                symbolRef: beforeExport.symbol?.$id ?? null,
                breaking: true,
                semverImpact: 'major',
                description: `Export '${name}' was removed`,
                beforeSymbol: beforeExport.symbol,
                afterSymbol: null,
                modification: null
            });
        }
    }

    // Find added exports
    for (const [name, afterExport] of afterMap) {
        if (!beforeMap.has(name)) {
            changes.push({
                changeType: 'added',
                modulePath,
                symbolName: name,
                symbolRef: afterExport.symbol?.$id ?? null,
                breaking: false,
                semverImpact: 'minor',
                description: `New export '${name}' was added`,
                beforeSymbol: null,
                afterSymbol: afterExport.symbol,
                modification: null
            });
        }
    }

    // Find modified exports
    for (const [name, afterExport] of afterMap) {
        const beforeExport = beforeMap.get(name);
        if (beforeExport && beforeExport.symbol && afterExport.symbol) {
            const modification = compareSymbols(beforeExport.symbol, afterExport.symbol);

            // Check if anything actually changed
            const hasChanges =
                modification.parameterChanges.length > 0 ||
                modification.returnTypeChange !== null ||
                modification.signatureChanged ||
                modification.deprecationChanged;

            if (hasChanges) {
                // Determine if breaking
                const breaking =
                    modification.parameterChanges.some(p => p.breaking) ||
                    modification.returnTypeChange?.breaking === true;

                // Check for deprecation change
                let changeType: ChangeType = 'modified';
                if (modification.deprecationChanged) {
                    changeType = afterExport.symbol.deprecated ? 'deprecated' : 'undeprecated';
                }

                const { semverImpact, description } = classifyBreakingChange(
                    changeType,
                    modification,
                    name
                );

                changes.push({
                    changeType,
                    modulePath,
                    symbolName: name,
                    symbolRef: afterExport.symbol.$id,
                    breaking,
                    semverImpact,
                    description,
                    beforeSymbol: beforeExport.symbol,
                    afterSymbol: afterExport.symbol,
                    modification
                });
            }
        }
    }

    return changes;
}

// ============================================================
// Main Diff Function
// ============================================================

/**
 * Computes a semantic diff between two API snapshots.
 *
 * @param from - The source snapshot (older version)
 * @param to - The target snapshot (newer version)
 * @returns Complete diff with all changes and summary
 *
 * @example
 * const diff = computeDiff(oldSnapshot, newSnapshot);
 * console.log(`Recommended bump: ${diff.recommendedBump}`);
 * console.log(`Breaking changes: ${diff.summary.breakingChanges}`);
 */
export function computeDiff(from: APISnapshot, to: APISnapshot): APIDiff {
    const changes: APIChange[] = [];
    const moduleChanges: ModuleChange[] = [];

    // Create maps for module lookup
    const fromModules = new Map(from.modules.map(m => [m.path, m]));
    const toModules = new Map(to.modules.map(m => [m.path, m]));

    // Find removed modules
    for (const [path, module] of fromModules) {
        if (!toModules.has(path)) {
            moduleChanges.push({
                changeType: 'removed',
                modulePath: path,
                module,
                breaking: module.exports.length > 0, // Breaking if had exports
                semverImpact: module.exports.length > 0 ? 'major' : 'patch'
            });

            // Add individual export removals
            for (const exp of module.exports) {
                changes.push({
                    changeType: 'removed',
                    modulePath: path,
                    symbolName: exp.name,
                    symbolRef: exp.symbol?.$id ?? null,
                    breaking: true,
                    semverImpact: 'major',
                    description: `Export '${exp.name}' was removed (module deleted)`,
                    beforeSymbol: exp.symbol,
                    afterSymbol: null,
                    modification: null
                });
            }
        }
    }

    // Find added modules
    for (const [path, module] of toModules) {
        if (!fromModules.has(path)) {
            moduleChanges.push({
                changeType: 'added',
                modulePath: path,
                module,
                breaking: false,
                semverImpact: module.exports.length > 0 ? 'minor' : 'patch'
            });

            // Add individual export additions
            for (const exp of module.exports) {
                changes.push({
                    changeType: 'added',
                    modulePath: path,
                    symbolName: exp.name,
                    symbolRef: exp.symbol?.$id ?? null,
                    breaking: false,
                    semverImpact: 'minor',
                    description: `New export '${exp.name}' was added (new module)`,
                    beforeSymbol: null,
                    afterSymbol: exp.symbol,
                    modification: null
                });
            }
        }
    }

    // Compare existing modules
    for (const [path, toModule] of toModules) {
        const fromModule = fromModules.get(path);
        if (fromModule) {
            const moduleExportChanges = compareModuleExports(fromModule, toModule, path);
            changes.push(...moduleExportChanges);
        }
    }

    // Compute summary
    const summary = computeSummary(changes, moduleChanges);

    // Determine recommended bump
    const recommendedBump = computeSemverImpact(changes, moduleChanges);

    return {
        fromSnapshot: from,
        toSnapshot: to,
        changes,
        moduleChanges,
        summary,
        recommendedBump
    };
}

/**
 * Computes summary statistics for a diff.
 */
function computeSummary(
    changes: readonly APIChange[],
    moduleChanges: readonly ModuleChange[]
): DiffSummary {
    const affectedModules = new Set<string>();

    for (const change of changes) {
        affectedModules.add(change.modulePath);
    }
    for (const mc of moduleChanges) {
        affectedModules.add(mc.modulePath);
    }

    return {
        totalChanges: changes.length + moduleChanges.length,
        breakingChanges: changes.filter(c => c.breaking).length +
                        moduleChanges.filter(mc => mc.breaking).length,
        additions: changes.filter(c => c.changeType === 'added').length +
                  moduleChanges.filter(mc => mc.changeType === 'added').length,
        removals: changes.filter(c => c.changeType === 'removed').length +
                 moduleChanges.filter(mc => mc.changeType === 'removed').length,
        modifications: changes.filter(c => c.changeType === 'modified').length,
        deprecations: changes.filter(c => c.changeType === 'deprecated').length,
        modulesAffected: affectedModules.size
    };
}
