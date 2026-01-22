/**
 * @fileoverview Breaking change classification rules.
 * Defines rules for determining if changes are breaking and their semver impact.
 *
 * @module core/changelog/rules
 */

import type {
    ChangeType,
    SemverBump,
    SymbolModification,
    APIChange,
    ModuleChange,
    ParameterChange,
    TypeChangeDirection
} from '../../types/changelog.js';

// ============================================================
// Breaking Change Rules
// ============================================================

/**
 * BREAKING CHANGES (require major version bump):
 *
 * 1. Export removed
 * 2. Required parameter added to existing function
 * 3. Parameter removed
 * 4. Parameter reordered (for positional args)
 * 5. Parameter type narrowed (e.g., `string | number` → `string`)
 * 6. Return type widened (e.g., `string` → `string | null`)
 * 7. Property removed from interface/type
 * 8. Enum member removed
 * 9. Class made abstract
 * 10. Method visibility reduced (public → private)
 */

/**
 * NON-BREAKING CHANGES (require minor version bump):
 *
 * 1. Export added
 * 2. Optional parameter added
 * 3. Parameter type widened (e.g., `string` → `string | number`)
 * 4. Return type narrowed (e.g., `string | null` → `string`)
 * 5. Optional property added to interface
 * 6. Deprecation added (not removal)
 * 7. New method added to class
 * 8. New enum member added
 */

/**
 * PATCH CHANGES:
 *
 * 1. Documentation only changes
 * 2. Default value changed (usually)
 * 3. Internal implementation changes (no signature change)
 * 4. Type alias changes that maintain compatibility
 */

// ============================================================
// Covariance/Contravariance Rules
// ============================================================

/**
 * TYPE POSITION RULES:
 *
 * For PARAMETERS (input positions - contravariant):
 * - Widening (supertype) is SAFE: `string` → `string | number`
 *   Consumers can still pass what they were passing before
 * - Narrowing (subtype) is BREAKING: `string | number` → `string`
 *   Consumers may have been passing number, which now fails
 *
 * For RETURN TYPES (output positions - covariant):
 * - Narrowing (subtype) is SAFE: `string | null` → `string`
 *   Consumers get something more specific than they expected
 * - Widening (supertype) is BREAKING: `string` → `string | null`
 *   Consumers now need to handle null they weren't expecting
 *
 * Memory aid: "Be liberal in what you accept, conservative in what you return"
 */

/**
 * Classification result for a change.
 */
export interface ChangeClassification {
    readonly semverImpact: SemverBump;
    readonly description: string;
    readonly breaking: boolean;
    readonly reasons: readonly string[];
}

// ============================================================
// Classification Functions
// ============================================================

/**
 * Classifies a breaking change and returns semver impact + description.
 *
 * @param changeType - The type of change
 * @param modification - Detailed modification info (for 'modified' changes)
 * @param symbolName - Name of the symbol that changed
 * @returns Classification with semver impact and description
 */
export function classifyBreakingChange(
    changeType: ChangeType,
    modification: SymbolModification | null,
    symbolName: string
): { semverImpact: SemverBump; description: string } {
    switch (changeType) {
        case 'added':
            return {
                semverImpact: 'minor',
                description: `New export '${symbolName}'`
            };

        case 'removed':
            return {
                semverImpact: 'major',
                description: `Export '${symbolName}' removed - BREAKING`
            };

        case 'deprecated':
            return {
                semverImpact: 'minor',
                description: `'${symbolName}' deprecated`
            };

        case 'undeprecated':
            return {
                semverImpact: 'patch',
                description: `'${symbolName}' undeprecated`
            };

        case 'renamed':
            return {
                semverImpact: 'major',
                description: `'${symbolName}' renamed - BREAKING`
            };

        case 'modified':
            return classifyModification(modification, symbolName);

        default:
            return {
                semverImpact: 'patch',
                description: `'${symbolName}' changed`
            };
    }
}

/**
 * Classifies a modification change in detail.
 */
function classifyModification(
    modification: SymbolModification | null,
    symbolName: string
): { semverImpact: SemverBump; description: string } {
    if (!modification) {
        return { semverImpact: 'patch', description: `'${symbolName}' modified` };
    }

    const breakingReasons: string[] = [];
    const nonBreakingReasons: string[] = [];

    // Check parameter changes
    for (const paramChange of modification.parameterChanges) {
        if (paramChange.breaking) {
            breakingReasons.push(describeParameterChange(paramChange));
        } else {
            nonBreakingReasons.push(describeParameterChange(paramChange));
        }
    }

    // Check return type change
    if (modification.returnTypeChange?.breaking) {
        breakingReasons.push(
            `Return type ${modification.returnTypeChange.typeChange.explanation}`
        );
    } else if (modification.returnTypeChange) {
        nonBreakingReasons.push(
            `Return type ${modification.returnTypeChange.typeChange.explanation}`
        );
    }

    // Determine overall impact
    if (breakingReasons.length > 0) {
        return {
            semverImpact: 'major',
            description: `'${symbolName}' - BREAKING: ${breakingReasons.join('; ')}`
        };
    }

    if (nonBreakingReasons.length > 0) {
        return {
            semverImpact: 'minor',
            description: `'${symbolName}' - ${nonBreakingReasons.join('; ')}`
        };
    }

    // Documentation or implementation change only
    if (modification.documentationChanged && !modification.signatureChanged) {
        return {
            semverImpact: 'patch',
            description: `'${symbolName}' - documentation updated`
        };
    }

    return {
        semverImpact: 'patch',
        description: `'${symbolName}' modified`
    };
}

/**
 * Describes a parameter change for human-readable output.
 */
function describeParameterChange(change: ParameterChange): string {
    switch (change.changeType) {
        case 'added':
            if (change.after?.optional) {
                return `Optional parameter '${change.name}' added`;
            }
            return `Required parameter '${change.name}' added`;

        case 'removed':
            return `Parameter '${change.name}' removed`;

        case 'reordered':
            return `Parameter '${change.name}' position changed`;

        case 'modified':
            const parts: string[] = [];
            if (change.typeChange) {
                parts.push(`type ${change.typeChange.explanation}`);
            }
            if (change.before?.optional !== change.after?.optional) {
                if (change.after?.optional) {
                    parts.push('made optional');
                } else {
                    parts.push('made required');
                }
            }
            return `Parameter '${change.name}': ${parts.join(', ')}`;

        default:
            return `Parameter '${change.name}' changed`;
    }
}

// ============================================================
// Semver Impact Computation
// ============================================================

/**
 * Computes the overall semver impact from all changes.
 *
 * @param changes - All API changes
 * @param moduleChanges - All module-level changes
 * @returns The recommended semver bump
 */
export function computeSemverImpact(
    changes: readonly APIChange[],
    moduleChanges: readonly ModuleChange[]
): SemverBump {
    // Check for any breaking changes
    const hasBreaking =
        changes.some(c => c.breaking) ||
        moduleChanges.some(mc => mc.breaking);

    if (hasBreaking) {
        return 'major';
    }

    // Check for any additions or changes classified as minor
    const hasMinorChanges =
        changes.some(c => c.changeType === 'added' || c.semverImpact === 'minor') ||
        moduleChanges.some(mc => mc.changeType === 'added');

    if (hasMinorChanges) {
        return 'minor';
    }

    // Check if there are any changes at all
    if (changes.length > 0 || moduleChanges.length > 0) {
        return 'patch';
    }

    return 'none';
}

// ============================================================
// Full Classification
// ============================================================

/**
 * Performs full classification of a change with detailed reasons.
 *
 * @param change - The API change to classify
 * @returns Full classification with reasons
 */
export function classifyChange(change: APIChange): ChangeClassification {
    const reasons: string[] = [];

    // Base classification
    if (change.changeType === 'removed') {
        reasons.push('Export removed from public API');
        return {
            semverImpact: 'major',
            description: `Export '${change.symbolName}' removed`,
            breaking: true,
            reasons
        };
    }

    if (change.changeType === 'added') {
        reasons.push('New export added to public API');
        return {
            semverImpact: 'minor',
            description: `New export '${change.symbolName}'`,
            breaking: false,
            reasons
        };
    }

    if (change.changeType === 'deprecated') {
        reasons.push('Symbol marked as deprecated');
        return {
            semverImpact: 'minor',
            description: `'${change.symbolName}' deprecated`,
            breaking: false,
            reasons
        };
    }

    // For modifications, analyze in detail
    if (change.modification) {
        const mod = change.modification;

        // Parameter analysis
        for (const pc of mod.parameterChanges) {
            if (pc.changeType === 'removed') {
                reasons.push(`Parameter '${pc.name}' removed`);
            } else if (pc.changeType === 'added' && !pc.after?.optional) {
                reasons.push(`Required parameter '${pc.name}' added`);
            } else if (pc.changeType === 'reordered') {
                reasons.push(`Parameter '${pc.name}' position changed`);
            } else if (pc.typeChange?.breaking) {
                reasons.push(`Parameter '${pc.name}' type narrowed (contravariant breaking)`);
            }
        }

        // Return type analysis
        if (mod.returnTypeChange?.breaking) {
            reasons.push('Return type widened (covariant breaking)');
        }

        // Signature change without parameter changes
        if (mod.signatureChanged && mod.parameterChanges.length === 0 && !mod.returnTypeChange) {
            reasons.push('Signature changed');
        }
    }

    const breaking = reasons.length > 0 &&
        (change.breaking || reasons.some(r =>
            r.includes('removed') ||
            r.includes('Required') ||
            r.includes('breaking') ||
            r.includes('position changed')
        ));

    return {
        semverImpact: breaking ? 'major' : (reasons.length > 0 ? 'minor' : 'patch'),
        description: `'${change.symbolName}' modified`,
        breaking,
        reasons
    };
}

// ============================================================
// Type Position Analysis
// ============================================================

/**
 * Determines if a type change is safe given its position.
 *
 * @param direction - The direction of the type change
 * @param position - Whether the type is in input (parameter) or output (return) position
 * @returns Whether the change is safe
 */
export function isTypeSafe(
    direction: TypeChangeDirection,
    position: 'input' | 'output'
): boolean {
    // Input (parameters) - contravariant position
    // Safe: widening (contravariant direction)
    // Breaking: narrowing (covariant direction)

    // Output (return) - covariant position
    // Safe: narrowing (covariant direction)
    // Breaking: widening (contravariant direction)

    if (position === 'input') {
        return direction === 'contravariant';
    } else {
        return direction === 'covariant';
    }
}

/**
 * Checks if adding null/undefined to a type is breaking.
 *
 * @param position - The type position
 * @returns Whether adding null/undefined is breaking
 */
export function isNullableBreaking(position: 'input' | 'output'): boolean {
    // Adding null to parameter (input) is SAFE - widening
    // Adding null to return (output) is BREAKING - widening
    return position === 'output';
}

/**
 * Checks if removing null/undefined from a type is breaking.
 *
 * @param position - The type position
 * @returns Whether removing null/undefined is breaking
 */
export function isNonNullableBreaking(position: 'input' | 'output'): boolean {
    // Removing null from parameter (input) is BREAKING - narrowing
    // Removing null from return (output) is SAFE - narrowing
    return position === 'input';
}
