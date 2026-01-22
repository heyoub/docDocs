/**
 * @fileoverview Changelog module exports.
 * Re-exports all changelog-related functions and types.
 *
 * @module core/changelog
 */

// Diff algorithm
export { computeDiff } from './diff.js';

// Breaking change rules
export {
    classifyBreakingChange,
    computeSemverImpact,
    classifyChange,
    isTypeSafe,
    isNullableBreaking,
    isNonNullableBreaking
} from './rules.js';

export type { ChangeClassification } from './rules.js';

// Changelog rendering
export {
    renderChangelog,
    createCodeSnippet,
    createComparison,
    formatSemverBadge
} from './renderer.js';

export type { RendererConfig } from './renderer.js';

// Impact analysis
export {
    analyzeImpact,
    analyzeAllImpacts,
    getHighImpactChanges,
    getTotalBlastRadius,
    generateImpactSummary
} from './impact.js';

export type { ImpactSummary } from './impact.js';
