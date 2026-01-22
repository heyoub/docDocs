/**
 * @fileoverview Markdown changelog renderer.
 * Generates human-readable changelogs from API diffs with harsh mode support.
 *
 * @module core/changelog/renderer
 */

import type {
    APIDiff,
    APIChange,
    Changelog,
    ChangelogSection,
    SemverBump,
    BeforeAfterComparison,
    CodeSnippet
} from '../../types/changelog.js';
import type { ImpactAnalysis } from '../../types/analysis.js';

// ============================================================
// Configuration
// ============================================================

/**
 * Renderer configuration options.
 */
export interface RendererConfig {
    /** Enable harsh mode (expose documentation gaps) */
    readonly harshMode: boolean;
    /** Include before/after code snippets */
    readonly includeCodeDiffs: boolean;
    /** Include migration examples */
    readonly includeMigrationExamples: boolean;
    /** Include impact analysis */
    readonly includeImpactAnalysis: boolean;
    /** Maximum changes per section before collapsing */
    readonly collapseThreshold: number;
}

const DEFAULT_CONFIG: RendererConfig = {
    harshMode: false,
    includeCodeDiffs: true,
    includeMigrationExamples: true,
    includeImpactAnalysis: true,
    collapseThreshold: 10
};

// ============================================================
// Section Priorities
// ============================================================

type SectionTitle = 'Breaking Changes' | 'Deprecations' | 'New Features' | 'Changes' | 'Other Changes';

const SECTION_PRIORITY: Record<SectionTitle, number> = {
    'Breaking Changes': 1,
    'Deprecations': 2,
    'New Features': 3,
    'Changes': 4,
    'Other Changes': 5
};

// ============================================================
// Main Renderer
// ============================================================

/**
 * Renders a complete changelog from an API diff.
 *
 * @param diff - The API diff to render
 * @param config - Renderer configuration
 * @param impactMap - Optional map of symbol refs to impact analysis
 * @returns Rendered changelog
 *
 * @example
 * const changelog = renderChangelog(diff);
 * console.log(changelog.markdown);
 */
export function renderChangelog(
    diff: APIDiff,
    config: Partial<RendererConfig> = {},
    impactMap?: ReadonlyMap<string, ImpactAnalysis>
): Changelog {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    const fromVersion = diff.fromSnapshot.tag ?? diff.fromSnapshot.id;
    const toVersion = diff.toSnapshot.tag ?? diff.toSnapshot.id;

    // Organize changes into sections
    const sections = organizeSections(diff, fullConfig);

    // Render markdown
    const markdown = renderMarkdown(diff, sections, fullConfig, impactMap);

    return {
        title: 'Changelog',
        fromVersion,
        toVersion,
        generatedAt: new Date().toISOString(),
        recommendedBump: diff.recommendedBump,
        sections,
        summary: diff.summary,
        markdown
    };
}

/**
 * Organizes changes into changelog sections.
 * In harsh mode, includes empty sections with gap markers.
 */
function organizeSections(
    diff: APIDiff,
    config: RendererConfig
): readonly ChangelogSection[] {
    const sections: ChangelogSection[] = [];

    // Breaking Changes section
    const breakingChanges = diff.changes.filter(c => c.breaking);
    const hasBreakingModules = diff.moduleChanges.some(mc => mc.breaking);
    if (breakingChanges.length > 0 || hasBreakingModules) {
        sections.push({
            title: 'Breaking Changes',
            priority: SECTION_PRIORITY['Breaking Changes'],
            changes: breakingChanges
        });
    } else if (config.harshMode) {
        // Harsh mode: show empty section to make it explicit
        sections.push({
            title: 'Breaking Changes',
            priority: SECTION_PRIORITY['Breaking Changes'],
            changes: [] // Empty - rendered with "None" in harsh mode
        });
    }

    // Deprecations section
    const deprecations = diff.changes.filter(c => c.changeType === 'deprecated');
    if (deprecations.length > 0) {
        sections.push({
            title: 'Deprecations',
            priority: SECTION_PRIORITY['Deprecations'],
            changes: deprecations
        });
    }

    // New Features section
    const additions = diff.changes.filter(c => c.changeType === 'added' && !c.breaking);
    if (additions.length > 0) {
        sections.push({
            title: 'New Features',
            priority: SECTION_PRIORITY['New Features'],
            changes: additions
        });
    }

    // Other Changes section
    const otherChanges = diff.changes.filter(c =>
        !c.breaking &&
        c.changeType !== 'deprecated' &&
        c.changeType !== 'added'
    );
    if (otherChanges.length > 0) {
        sections.push({
            title: 'Other Changes',
            priority: SECTION_PRIORITY['Other Changes'],
            changes: otherChanges
        });
    }

    // Harsh mode: check for undocumented changes
    if (config.harshMode) {
        const undocumented = diff.changes.filter(c =>
            !c.beforeSymbol?.description && !c.afterSymbol?.description
        );
        if (undocumented.length > 0) {
            sections.push({
                title: 'Changes' as SectionTitle, // "Changes" maps to undocumented in harsh mode
                priority: SECTION_PRIORITY['Changes'],
                changes: undocumented
            });
        }
    }

    // Sort by priority
    return sections.sort((a, b) => a.priority - b.priority);
}

// ============================================================
// Markdown Rendering
// ============================================================

/**
 * Renders the full markdown output.
 */
function renderMarkdown(
    diff: APIDiff,
    sections: readonly ChangelogSection[],
    config: RendererConfig,
    impactMap?: ReadonlyMap<string, ImpactAnalysis>
): string {
    const lines: string[] = [];

    const fromVersion = diff.fromSnapshot.tag ?? diff.fromSnapshot.id;
    const toVersion = diff.toSnapshot.tag ?? diff.toSnapshot.id;

    // Header
    lines.push('# Changelog');
    lines.push('');
    lines.push(`> Comparing ${fromVersion} to ${toVersion}`);
    lines.push('');

    // Semver recommendation (prominent)
    lines.push(`## Recommended Version Bump: **${diff.recommendedBump.toUpperCase()}**`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total changes: ${diff.summary.totalChanges}`);
    lines.push(`- Breaking changes: ${diff.summary.breakingChanges}`);
    lines.push(`- Additions: ${diff.summary.additions}`);
    lines.push(`- Modifications: ${diff.summary.modifications}`);
    lines.push(`- Deprecations: ${diff.summary.deprecations}`);
    lines.push(`- Modules affected: ${diff.summary.modulesAffected}`);
    lines.push('');

    // Harsh mode warning
    if (config.harshMode && diff.summary.breakingChanges > 0) {
        lines.push('> **WARNING**: This release contains breaking changes!');
        lines.push('');
    }

    // Module changes
    if (diff.moduleChanges.length > 0) {
        lines.push('## Module Changes');
        lines.push('');
        for (const mc of diff.moduleChanges) {
            const icon = mc.changeType === 'added' ? '+' : '-';
            const breaking = mc.breaking ? ' **BREAKING**' : '';
            lines.push(`- ${icon} \`${mc.modulePath}\`${breaking}`);
        }
        lines.push('');
    }

    // Sections
    for (const section of sections) {
        lines.push(`## ${section.title}`);
        lines.push('');

        // Group by module
        const byModule = groupByModule(section.changes);

        for (const [modulePath, changes] of byModule) {
            if (byModule.size > 1) {
                lines.push(`### ${modulePath}`);
                lines.push('');
            }

            for (const change of changes) {
                lines.push(...renderChange(change, config, impactMap?.get(change.symbolRef ?? '')));
            }
        }
    }

    // Harsh mode gaps
    if (config.harshMode) {
        lines.push(...renderHarshModeGaps(diff));
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`*Generated at ${new Date().toISOString()}*`);

    return lines.join('\n');
}

/**
 * Groups changes by module path.
 */
function groupByModule(changes: readonly APIChange[]): Map<string, APIChange[]> {
    const byModule = new Map<string, APIChange[]>();

    for (const change of changes) {
        const existing = byModule.get(change.modulePath) ?? [];
        existing.push(change);
        byModule.set(change.modulePath, existing);
    }

    return byModule;
}

/**
 * Renders a single change.
 */
function renderChange(
    change: APIChange,
    config: RendererConfig,
    impact?: ImpactAnalysis
): string[] {
    const lines: string[] = [];

    // Change header
    const icon = getChangeIcon(change);
    const breaking = change.breaking ? ' **BREAKING**' : '';
    lines.push(`- ${icon} \`${change.symbolName}\`${breaking}`);

    // Description
    lines.push(`  - ${change.description}`);

    // Modification details
    if (change.modification && config.includeCodeDiffs) {
        if (change.modification.signatureChanged) {
            lines.push('  - Signature changed:');
            if (change.modification.previousSignature) {
                lines.push(`    - Before: \`${change.modification.previousSignature}\``);
            }
            if (change.modification.currentSignature) {
                lines.push(`    - After: \`${change.modification.currentSignature}\``);
            }
        }

        // Parameter changes
        if (change.modification.parameterChanges.length > 0) {
            lines.push('  - Parameter changes:');
            for (const pc of change.modification.parameterChanges) {
                const pcBreaking = pc.breaking ? ' *(breaking)*' : '';
                lines.push(`    - \`${pc.name}\`: ${pc.changeType}${pcBreaking}`);
                if (pc.typeChange) {
                    lines.push(`      - ${pc.typeChange.explanation}`);
                }
            }
        }

        // Return type change
        if (change.modification.returnTypeChange) {
            const rtc = change.modification.returnTypeChange;
            const rtBreaking = rtc.breaking ? ' *(breaking)*' : '';
            lines.push(`  - Return type changed${rtBreaking}:`);
            lines.push(`    - ${rtc.typeChange.explanation}`);
        }
    }

    // Code diff
    if (config.includeCodeDiffs && change.beforeSymbol && change.afterSymbol) {
        lines.push(...renderCodeDiff(change));
    }

    // Migration example
    if (config.includeMigrationExamples && change.breaking) {
        lines.push(...renderMigrationExample(change));
    }

    // Impact analysis
    if (config.includeImpactAnalysis && impact) {
        lines.push(...renderImpact(impact));
    }

    lines.push('');
    return lines;
}

/**
 * Gets the icon for a change type.
 */
function getChangeIcon(change: APIChange): string {
    switch (change.changeType) {
        case 'added': return '**+**';
        case 'removed': return '**-**';
        case 'modified': return '**~**';
        case 'deprecated': return '**⚠**';
        case 'renamed': return '**→**';
        default: return '**•**';
    }
}

/**
 * Renders before/after code diff.
 */
function renderCodeDiff(change: APIChange): string[] {
    const lines: string[] = [];

    if (change.beforeSymbol?.signature && change.afterSymbol?.signature) {
        lines.push('');
        lines.push('  <details>');
        lines.push('  <summary>Code diff</summary>');
        lines.push('');
        lines.push('  **Before:**');
        lines.push('  ```typescript');
        lines.push(`  ${change.beforeSymbol.signature}`);
        lines.push('  ```');
        lines.push('');
        lines.push('  **After:**');
        lines.push('  ```typescript');
        lines.push(`  ${change.afterSymbol.signature}`);
        lines.push('  ```');
        lines.push('');
        lines.push('  </details>');
    }

    return lines;
}

/**
 * Renders migration example for breaking changes.
 */
function renderMigrationExample(change: APIChange): string[] {
    const lines: string[] = [];

    // Generate migration example based on change type
    if (change.changeType === 'removed') {
        lines.push('');
        lines.push('  <details>');
        lines.push('  <summary>Migration</summary>');
        lines.push('');
        lines.push(`  The \`${change.symbolName}\` export has been removed.`);
        lines.push('  Please update your code to use the recommended alternative.');
        lines.push('');
        lines.push('  </details>');
    } else if (change.modification?.parameterChanges.some(p => p.changeType === 'added' && !p.after?.optional)) {
        const addedParams = change.modification.parameterChanges
            .filter(p => p.changeType === 'added' && !p.after?.optional);

        lines.push('');
        lines.push('  <details>');
        lines.push('  <summary>Migration</summary>');
        lines.push('');
        lines.push('  **Old:**');
        lines.push('  ```typescript');
        lines.push(`  ${change.symbolName}(existingArgs);`);
        lines.push('  ```');
        lines.push('');
        lines.push('  **New:**');
        lines.push('  ```typescript');
        const newParams = addedParams.map(p => `${p.name}: ${p.after?.type.raw ?? 'unknown'}`).join(', ');
        lines.push(`  ${change.symbolName}(existingArgs, { ${newParams} });`);
        lines.push('  ```');
        lines.push('');
        lines.push('  </details>');
    }

    return lines;
}

/**
 * Renders impact analysis.
 */
function renderImpact(impact: ImpactAnalysis): string[] {
    const lines: string[] = [];

    lines.push('');
    lines.push('  <details>');
    lines.push('  <summary>Impact Analysis</summary>');
    lines.push('');
    lines.push(`  - **Blast radius**: ${impact.impactLevel.toUpperCase()}`);
    lines.push(`  - Direct callers: ${impact.directCallers.length}`);
    lines.push(`  - Transitive callers: ${impact.transitiveCallers.length}`);
    lines.push(`  - Affected modules: ${impact.affectedModules.length}`);

    if (impact.affectedExports.length > 0) {
        lines.push(`  - Affected public exports: ${impact.affectedExports.join(', ')}`);
    }

    lines.push('');
    lines.push('  </details>');

    return lines;
}

// ============================================================
// Harsh Mode Gaps
// ============================================================

/**
 * Renders harsh mode documentation gaps.
 */
function renderHarshModeGaps(diff: APIDiff): string[] {
    const lines: string[] = [];

    lines.push('## Documentation Gaps');
    lines.push('');
    lines.push('<!-- HARSH MODE: Exposing documentation gaps instead of hiding them -->');
    lines.push('');

    // Find undocumented changes
    const undocumented: APIChange[] = [];
    for (const change of diff.changes) {
        if (change.afterSymbol && (!change.afterSymbol.description || change.afterSymbol.description.length === 0)) {
            undocumented.push(change);
        }
    }

    if (undocumented.length > 0) {
        lines.push('### Undocumented Symbols');
        lines.push('');
        lines.push('<!-- These symbols are part of the public API but have no documentation -->');
        lines.push('');
        for (const change of undocumented) {
            lines.push(`- \`${change.modulePath}:${change.symbolName}\` - **NO DESCRIPTION**`);
        }
        lines.push('');
    }

    // Find symbols with missing parameter docs
    const missingParamDocs: APIChange[] = [];
    for (const change of diff.changes) {
        if (change.afterSymbol?.parameters) {
            const undocParams = change.afterSymbol.parameters.filter(p => !p.description);
            if (undocParams.length > 0) {
                missingParamDocs.push(change);
            }
        }
    }

    if (missingParamDocs.length > 0) {
        lines.push('### Missing Parameter Documentation');
        lines.push('');
        lines.push('<!-- These functions have parameters without descriptions -->');
        lines.push('');
        for (const change of missingParamDocs) {
            const params = change.afterSymbol?.parameters;
            if (!params) continue;
            const undocParams = params
                .filter(p => !p.description)
                .map(p => p.name);
            lines.push(`- \`${change.symbolName}\`: params [${undocParams.join(', ')}] have **NO DESCRIPTION**`);
        }
        lines.push('');
    }

    // Find symbols with no examples
    const noExamples: APIChange[] = [];
    for (const change of diff.changes) {
        if (change.afterSymbol && (!change.afterSymbol.examples || change.afterSymbol.examples.length === 0)) {
            noExamples.push(change);
        }
    }

    if (noExamples.length > 0) {
        lines.push('### Missing Examples');
        lines.push('');
        lines.push('<!-- Public API without usage examples -->');
        lines.push('');
        for (const change of noExamples.slice(0, 10)) { // Limit to first 10
            lines.push(`- \`${change.symbolName}\` - **NO EXAMPLES**`);
        }
        if (noExamples.length > 10) {
            lines.push(`- ...and ${noExamples.length - 10} more`);
        }
        lines.push('');
    }

    return lines;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Creates a code snippet.
 */
export function createCodeSnippet(code: string, language: string = 'typescript'): CodeSnippet {
    return { code, language };
}

/**
 * Creates a before/after comparison.
 */
export function createComparison(
    before: string | null,
    after: string | null,
    migration?: string,
    language: string = 'typescript'
): BeforeAfterComparison {
    return {
        before: before ? createCodeSnippet(before, language) : null,
        after: after ? createCodeSnippet(after, language) : null,
        migration: migration ? createCodeSnippet(migration, language) : null
    };
}

/**
 * Formats a semver bump as a badge.
 */
export function formatSemverBadge(bump: SemverBump): string {
    const colors: Record<SemverBump, string> = {
        major: 'red',
        minor: 'yellow',
        patch: 'green',
        none: 'gray'
    };
    return `![${bump}](https://img.shields.io/badge/semver-${bump}-${colors[bump]})`;
}
