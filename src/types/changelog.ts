/**
 * @fileoverview Changelog types for GenDocs extension.
 * Defines types for API snapshots, semantic diffs, and changelog generation.
 * Imports only from types/base.ts and types/schema.ts - Layer 1 of the type system.
 *
 * @module types/changelog
 */

import type { FileURI, SchemaRef } from './base.js';
import type { SymbolSchema, TypeSchema, ParameterSchema, ExportSchema } from './schema.js';

// ============================================================
// Semver Types
// ============================================================

/**
 * Semantic version bump recommendation.
 * - major: Breaking changes that require consumer updates
 * - minor: Backwards-compatible feature additions
 * - patch: Backwards-compatible bug fixes or documentation changes
 * - none: No changes detected
 */
export type SemverBump = 'major' | 'minor' | 'patch' | 'none';

// ============================================================
// Change Types
// ============================================================

/**
 * Type of change detected between API versions.
 */
export type ChangeType =
    | 'added'
    | 'removed'
    | 'modified'
    | 'renamed'
    | 'deprecated'
    | 'undeprecated';

/**
 * Direction of type change for covariance/contravariance analysis.
 * - covariant: Type narrowed (subtype of original)
 * - contravariant: Type widened (supertype of original)
 * - invariant: Type changed incompatibly
 */
export type TypeChangeDirection = 'covariant' | 'contravariant' | 'invariant';

/**
 * Analysis of a type change for breaking change detection.
 *
 * @example
 * // Parameter type widened (safe)
 * const analysis: TypeChangeAnalysis = {
 *   direction: 'contravariant',
 *   breaking: false,
 *   explanation: 'Parameter type widened from string to string | number'
 * };
 */
export interface TypeChangeAnalysis {
    /** Direction of the type change */
    readonly direction: TypeChangeDirection;
    /** Whether this change is breaking */
    readonly breaking: boolean;
    /** Human-readable explanation of the change */
    readonly explanation: string;
}

// ============================================================
// Exported Symbol Types
// ============================================================

/**
 * A symbol exported from a module with its full schema.
 * Used for API surface tracking in snapshots.
 *
 * @example
 * const exported: ExportedSymbol = {
 *   name: 'createUser',
 *   exportInfo: { name: 'createUser', isDefault: false, isTypeOnly: false },
 *   symbol: { $id: '#/definitions/createUser', name: 'createUser', ... }
 * };
 */
export interface ExportedSymbol {
    /** Name of the export */
    readonly name: string;
    /** Export information (default, type-only, etc.) */
    readonly exportInfo: ExportSchema;
    /** Full symbol schema if resolvable */
    readonly symbol: SymbolSchema | null;
}

// ============================================================
// Snapshot Types
// ============================================================

/**
 * Snapshot of a single module's public API.
 *
 * @example
 * const moduleSnapshot: ModuleAPISnapshot = {
 *   path: 'src/utils.ts',
 *   exports: [{ name: 'formatDate', exportInfo: {...}, symbol: {...} }],
 *   hash: 'abc123...'
 * };
 */
export interface ModuleAPISnapshot {
    /** File path of the module */
    readonly path: string;
    /** All exported symbols with their schemas */
    readonly exports: readonly ExportedSymbol[];
    /** Content hash of the module at snapshot time */
    readonly hash: string;
}

/**
 * Complete snapshot of a workspace's public API at a point in time.
 *
 * @example
 * const snapshot: APISnapshot = {
 *   id: 'snap_20240115_103000',
 *   tag: 'v1.0.0',
 *   createdAt: '2024-01-15T10:30:00Z',
 *   workspaceUri: 'file:///path/to/workspace',
 *   modules: [...],
 *   statistics: { totalModules: 10, totalExports: 50, documentedExports: 45 }
 * };
 */
export interface APISnapshot {
    /** Unique identifier for this snapshot */
    readonly id: string;
    /** Optional version tag (e.g., "v1.0.0") */
    readonly tag: string | null;
    /** ISO 8601 timestamp when snapshot was created */
    readonly createdAt: string;
    /** URI of the workspace this snapshot is for */
    readonly workspaceUri: FileURI;
    /** Snapshots of all modules */
    readonly modules: readonly ModuleAPISnapshot[];
    /** Summary statistics */
    readonly statistics: SnapshotStatistics;
}

/**
 * Statistics about a snapshot.
 */
export interface SnapshotStatistics {
    /** Total number of modules in the snapshot */
    readonly totalModules: number;
    /** Total number of exported symbols */
    readonly totalExports: number;
    /** Number of exports with documentation */
    readonly documentedExports: number;
}

// ============================================================
// Change Detail Types
// ============================================================

/**
 * Details about a parameter change.
 */
export interface ParameterChange {
    /** Name of the parameter */
    readonly name: string;
    /** Type of change */
    readonly changeType: 'added' | 'removed' | 'modified' | 'reordered';
    /** Previous parameter schema (if modified/removed) */
    readonly before: ParameterSchema | null;
    /** Current parameter schema (if added/modified) */
    readonly after: ParameterSchema | null;
    /** Type change analysis (if type changed) */
    readonly typeChange: TypeChangeAnalysis | null;
    /** Whether this parameter change is breaking */
    readonly breaking: boolean;
}

/**
 * Details about a return type change.
 */
export interface ReturnTypeChange {
    /** Previous return type */
    readonly before: TypeSchema | null;
    /** Current return type */
    readonly after: TypeSchema | null;
    /** Type change analysis */
    readonly typeChange: TypeChangeAnalysis;
    /** Whether this return type change is breaking */
    readonly breaking: boolean;
}

/**
 * Details about a symbol modification.
 */
export interface SymbolModification {
    /** Changes to parameters (for functions/methods) */
    readonly parameterChanges: readonly ParameterChange[];
    /** Change to return type (for functions/methods) */
    readonly returnTypeChange: ReturnTypeChange | null;
    /** Whether signature changed */
    readonly signatureChanged: boolean;
    /** Previous signature */
    readonly previousSignature: string | null;
    /** Current signature */
    readonly currentSignature: string | null;
    /** Whether documentation changed */
    readonly documentationChanged: boolean;
    /** Whether deprecation status changed */
    readonly deprecationChanged: boolean;
}

// ============================================================
// API Change Types
// ============================================================

/**
 * A single change in the API between two versions.
 *
 * @example
 * const change: APIChange = {
 *   changeType: 'removed',
 *   modulePath: 'src/api.ts',
 *   symbolName: 'legacyFetch',
 *   symbolRef: '#/definitions/legacyFetch',
 *   breaking: true,
 *   semverImpact: 'major',
 *   description: 'Export removed',
 *   beforeSymbol: {...},
 *   afterSymbol: null,
 *   modification: null
 * };
 */
export interface APIChange {
    /** Type of change */
    readonly changeType: ChangeType;
    /** Module path where change occurred */
    readonly modulePath: string;
    /** Name of the symbol that changed */
    readonly symbolName: string;
    /** Schema reference to the symbol */
    readonly symbolRef: SchemaRef | null;
    /** Whether this is a breaking change */
    readonly breaking: boolean;
    /** Semver impact of this change */
    readonly semverImpact: SemverBump;
    /** Human-readable description of the change */
    readonly description: string;
    /** Symbol schema before the change (null if added) */
    readonly beforeSymbol: SymbolSchema | null;
    /** Symbol schema after the change (null if removed) */
    readonly afterSymbol: SymbolSchema | null;
    /** Detailed modification info (for 'modified' changes) */
    readonly modification: SymbolModification | null;
}

/**
 * Change at the module level (module added/removed).
 */
export interface ModuleChange {
    /** Type of change */
    readonly changeType: 'added' | 'removed';
    /** Module path */
    readonly modulePath: string;
    /** Module snapshot (before for removed, after for added) */
    readonly module: ModuleAPISnapshot;
    /** Whether this is a breaking change */
    readonly breaking: boolean;
    /** Semver impact */
    readonly semverImpact: SemverBump;
}

// ============================================================
// Diff Types
// ============================================================

/**
 * Complete semantic diff between two API snapshots.
 *
 * @example
 * const diff: APIDiff = {
 *   fromSnapshot: { id: 'snap_1', ... },
 *   toSnapshot: { id: 'snap_2', ... },
 *   changes: [...],
 *   moduleChanges: [...],
 *   summary: { totalChanges: 5, breakingChanges: 1, ... },
 *   recommendedBump: 'major'
 * };
 */
export interface APIDiff {
    /** Source snapshot (older) */
    readonly fromSnapshot: APISnapshot;
    /** Target snapshot (newer) */
    readonly toSnapshot: APISnapshot;
    /** All symbol-level changes */
    readonly changes: readonly APIChange[];
    /** Module-level changes (entire modules added/removed) */
    readonly moduleChanges: readonly ModuleChange[];
    /** Summary statistics */
    readonly summary: DiffSummary;
    /** Recommended semver bump based on changes */
    readonly recommendedBump: SemverBump;
}

/**
 * Summary statistics for a diff.
 */
export interface DiffSummary {
    /** Total number of changes */
    readonly totalChanges: number;
    /** Number of breaking changes */
    readonly breakingChanges: number;
    /** Number of additions */
    readonly additions: number;
    /** Number of removals */
    readonly removals: number;
    /** Number of modifications */
    readonly modifications: number;
    /** Number of deprecations */
    readonly deprecations: number;
    /** Modules affected */
    readonly modulesAffected: number;
}

// ============================================================
// Changelog Types
// ============================================================

/**
 * Section of a changelog.
 */
export interface ChangelogSection {
    /** Section title */
    readonly title: string;
    /** Section priority (for ordering) */
    readonly priority: number;
    /** Changes in this section */
    readonly changes: readonly APIChange[];
}

/**
 * Rendered changelog output.
 *
 * @example
 * const changelog: Changelog = {
 *   title: 'Changelog',
 *   fromVersion: 'v1.0.0',
 *   toVersion: 'v1.1.0',
 *   generatedAt: '2024-01-15T10:30:00Z',
 *   recommendedBump: 'minor',
 *   sections: [...],
 *   summary: {...},
 *   markdown: '# Changelog\n\n...'
 * };
 */
export interface Changelog {
    /** Changelog title */
    readonly title: string;
    /** Version/tag we're comparing from */
    readonly fromVersion: string;
    /** Version/tag we're comparing to */
    readonly toVersion: string;
    /** ISO 8601 timestamp when changelog was generated */
    readonly generatedAt: string;
    /** Recommended version bump */
    readonly recommendedBump: SemverBump;
    /** Organized sections */
    readonly sections: readonly ChangelogSection[];
    /** Summary statistics */
    readonly summary: DiffSummary;
    /** Rendered markdown content */
    readonly markdown: string;
}

// ============================================================
// Before/After Code Display
// ============================================================

/**
 * Code snippet for before/after display.
 */
export interface CodeSnippet {
    /** The code */
    readonly code: string;
    /** Language for syntax highlighting */
    readonly language: string;
}

/**
 * Before/after comparison for a change.
 */
export interface BeforeAfterComparison {
    /** Code before the change */
    readonly before: CodeSnippet | null;
    /** Code after the change */
    readonly after: CodeSnippet | null;
    /** Optional migration example */
    readonly migration: CodeSnippet | null;
}

/**
 * Extended API change with code comparison.
 */
export interface APIChangeWithCode extends APIChange {
    /** Before/after code snippets */
    readonly comparison: BeforeAfterComparison;
}
