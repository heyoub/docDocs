/**
 * @fileoverview Lint types for GenDocs extension.
 * Defines interfaces for documentation linting results and fixes.
 * Imports from types/base.ts for location types.
 *
 * @module types/lint
 */

import type { Range, SourceLocation } from './base.js';

// Re-export LintRule and LintSeverity from config.ts for convenience
// Note: LintSeverity in config.ts includes 'off' for configuration,
// but lint results use a runtime severity that excludes 'off'
export type { LintRule } from './config.js';

// ============================================================
// Lint Severity for Results
// ============================================================

/**
 * Severity level for lint results.
 * Unlike LintSeverity in config.ts (which includes 'off'),
 * this type represents actual reported severities.
 * - error: Critical issue that should be fixed
 * - warning: Issue that should be addressed
 * - info: Informational message
 */
export type LintResultSeverity = 'error' | 'warning' | 'info';

// ============================================================
// Text Edit Types
// ============================================================

/**
 * A text edit representing a change to be applied to a document.
 * Used by lint fixes to describe how to correct an issue.
 */
export interface TextEdit {
    /** Range in the document to replace */
    readonly range: Range;
    /** New text to insert (empty string for deletion) */
    readonly newText: string;
}

// ============================================================
// Lint Fix Types
// ============================================================

/**
 * A fix that can be applied to resolve a lint issue.
 * Contains a description and one or more text edits.
 */
export interface LintFix {
    /** Human-readable description of what the fix does */
    readonly description: string;
    /** Text edits to apply to fix the issue */
    readonly edits: readonly TextEdit[];
}

// ============================================================
// Lint Result Types
// ============================================================

/**
 * Result of a lint check on documentation.
 * Contains information about the issue, its location, and optional fix.
 *
 * @example
 * const result: LintResult = {
 *   rule: 'missing-description',
 *   severity: 'warning',
 *   message: 'Function "processData" is missing a description',
 *   location: {
 *     uri: 'file:///src/utils.ts' as FileURI,
 *     range: { start: { line: 10, character: 0 }, end: { line: 10, character: 20 } }
 *   },
 *   fix: {
 *     description: 'Add JSDoc description',
 *     edits: [{ range: {...}, newText: '// Add documentation here' }]
 *   }
 * };
 */
export interface LintResult {
    /** The lint rule that was violated */
    readonly rule: import('./config.js').LintRule;
    /** Severity of the lint issue */
    readonly severity: LintResultSeverity;
    /** Human-readable message describing the issue */
    readonly message: string;
    /** Location in the source file where the issue was found */
    readonly location: SourceLocation;
    /** Optional fix that can be applied to resolve the issue */
    readonly fix?: LintFix;
    /** Paths to relevant spec/doc sections for remediation */
    readonly readPaths?: readonly string[];
    /** Actionable suggestion for fixing the issue */
    readonly suggestion?: string;
}
