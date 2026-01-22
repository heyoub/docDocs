/**
 * @fileoverview Extended analysis types for GenDocs extension.
 * Defines types for control flow matrix, impact analysis, traceability, and hardening.
 * Imports only from types/base.ts - Layer 1 of the type system.
 *
 * @module types/analysis
 */

import type { FileURI, SchemaRef } from './base.js';

// ============================================================
// Control Flow Matrix Types
// ============================================================

/**
 * Complexity classification for functions.
 */
export type ComplexityLevel =
    | 'trivial'    // 0-1 branches
    | 'simple'     // 2-3 branches
    | 'moderate'   // 4-7 branches
    | 'complex'    // 8-15 branches
    | 'galaxy-brain';  // 16+ branches

/**
 * Control flow analysis for a function.
 * Captures the decision tree structure explicitly.
 *
 * @example
 * const flow: FunctionFlowMatrix = {
 *   branches: 4,
 *   earlyReturns: 2,
 *   errorPaths: 1,
 *   happyPath: 'Returns processed user data on success',
 *   complexity: 'simple',
 *   conditionals: ['user exists check', 'permission validation'],
 *   loops: 0,
 *   asyncBoundaries: 1
 * };
 */
export interface FunctionFlowMatrix {
    /** Number of conditional branches (if/else/match arms) */
    readonly branches: number;
    /** Number of early return statements */
    readonly earlyReturns: number;
    /** Number of error/exception paths (throw/Err/panic) */
    readonly errorPaths: number;
    /** Description of the main success path */
    readonly happyPath: string;
    /** Computed complexity classification */
    readonly complexity: ComplexityLevel;
    /** Descriptions of each conditional */
    readonly conditionals: readonly string[];
    /** Number of loops */
    readonly loops: number;
    /** Number of async boundaries (await points) */
    readonly asyncBoundaries: number;
    /** Error types that can be thrown */
    readonly errorTypes: readonly string[];
}

/**
 * Change in flow matrix between versions.
 */
export interface FlowMatrixChange {
    /** Previous flow matrix */
    readonly before: FunctionFlowMatrix | null;
    /** Current flow matrix */
    readonly after: FunctionFlowMatrix | null;
    /** Change in branch count */
    readonly branchDelta: number;
    /** Change in error paths */
    readonly errorPathDelta: number;
    /** Complexity level change */
    readonly complexityChange: {
        readonly from: ComplexityLevel | null;
        readonly to: ComplexityLevel | null;
    };
    /** New error types that consumers must handle */
    readonly newErrorTypes: readonly string[];
    /** Whether this represents a breaking change */
    readonly breaking: boolean;
}

// ============================================================
// Impact Analysis Types
// ============================================================

/**
 * Impact level classification.
 */
export type ImpactLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Impact analysis for a symbol change.
 * Shows the "blast radius" of a change.
 *
 * @example
 * const impact: ImpactAnalysis = {
 *   symbolRef: '#/definitions/validateEmail',
 *   directCallers: ['createUser', 'updateUser', 'inviteUser'],
 *   transitiveCallers: [...12 more functions],
 *   affectedModules: ['src/users.ts', 'src/auth.ts', 'src/admin.ts'],
 *   affectedExports: ['UserService.create', 'UserService.update'],
 *   impactLevel: 'high',
 *   blastRadius: 15
 * };
 */
export interface ImpactAnalysis {
    /** Reference to the changed symbol */
    readonly symbolRef: SchemaRef;
    /** Functions that directly call this symbol */
    readonly directCallers: readonly string[];
    /** Functions that transitively call this symbol */
    readonly transitiveCallers: readonly string[];
    /** Modules containing callers */
    readonly affectedModules: readonly string[];
    /** Public exports affected by this change */
    readonly affectedExports: readonly string[];
    /** Computed impact level */
    readonly impactLevel: ImpactLevel;
    /** Total number of affected call sites */
    readonly blastRadius: number;
}

/**
 * Integration surface tracking for a symbol.
 * Shows how a symbol is exposed across different surfaces.
 *
 * @example
 * const surface: IntegrationSurface = {
 *   exported: true,
 *   reExported: true,
 *   inPublicType: true,
 *   inPublicFunction: true,
 *   documentedInReadme: false
 * };
 */
export interface IntegrationSurface {
    /** Whether symbol is directly exported from its module */
    readonly exported: boolean;
    /** Whether symbol is re-exported from index/lib */
    readonly reExported: boolean;
    /** Whether symbol is used in a public type signature */
    readonly inPublicType: boolean;
    /** Whether symbol is used in a public function signature */
    readonly inPublicFunction: boolean;
    /** Whether symbol is mentioned in README/docs */
    readonly documentedInReadme: boolean;
}

// ============================================================
// Traceability Types
// ============================================================

/**
 * A requirement or spec reference found in documentation.
 */
export interface SpecReference {
    /** Identifier for the spec (e.g., "REQ-001", "SPEC.md:45") */
    readonly id: string;
    /** Source file where the reference was found */
    readonly source: FileURI;
    /** Line number in the source file */
    readonly line: number;
    /** Description from the spec (if available) */
    readonly description: string | null;
    /** Type of reference */
    readonly type: 'requirement' | 'spec' | 'ticket' | 'doc';
}

/**
 * Cross-reference between specs and code.
 *
 * @example
 * const crossRef: SpecCrossRef = {
 *   implementedSpecs: ['REQ-001', 'REQ-002'],
 *   unimplementedSpecs: ['REQ-003', 'REQ-004'],
 *   undocumentedSymbols: ['RateLimiter', 'WebhookRetry']
 * };
 */
export interface SpecCrossRef {
    /** Specs mentioned in code via @requirements tags or similar */
    readonly implementedSpecs: readonly SpecReference[];
    /** Specs in markdown not found referenced in code */
    readonly unimplementedSpecs: readonly SpecReference[];
    /** Code symbols not mentioned in any spec */
    readonly undocumentedSymbols: readonly string[];
}

/**
 * Traceability gap in documentation.
 */
export interface TraceabilityGap {
    /** Type of gap */
    readonly type: 'spec-not-implemented' | 'symbol-not-documented' | 'orphaned-doc';
    /** Description of the gap */
    readonly description: string;
    /** Source location (spec file or code file) */
    readonly source: FileURI;
    /** Line number if applicable */
    readonly line: number | null;
    /** Severity of the gap */
    readonly severity: 'error' | 'warning' | 'info';
    /** Suggested action to close this gap */
    readonly suggestion?: string;
    /** Related spec section to read for remediation */
    readonly relatedSpec?: string;
}

/**
 * Complete traceability report.
 */
export interface TraceabilityReport {
    /** Workspace URI */
    readonly workspaceUri: FileURI;
    /** Timestamp of the report */
    readonly generatedAt: string;
    /** Cross-reference data */
    readonly crossRef: SpecCrossRef;
    /** All gaps found */
    readonly gaps: readonly TraceabilityGap[];
    /** Coverage percentage */
    readonly coveragePercent: number;
}

// ============================================================
// Hardening Checklist Types
// ============================================================

/**
 * Documentation completeness checklist.
 *
 * @example
 * const hardening: HardeningReport = {
 *   hasReadme: true,
 *   hasChangelog: false,
 *   hasContributing: false,
 *   hasLicense: true,
 *   publicApiCoverage: 85.5,
 *   exampleCoverage: 40.0,
 *   parameterCoverage: 72.3,
 *   returnTypeCoverage: 90.0
 * };
 */
export interface HardeningReport {
    /** Whether README exists */
    readonly hasReadme: boolean;
    /** Whether CHANGELOG exists */
    readonly hasChangelog: boolean;
    /** Whether CONTRIBUTING exists */
    readonly hasContributing: boolean;
    /** Whether LICENSE exists */
    readonly hasLicense: boolean;
    /** Percentage of exports with descriptions (0-100) */
    readonly publicApiCoverage: number;
    /** Percentage of exports with examples (0-100) */
    readonly exampleCoverage: number;
    /** Percentage of parameters with descriptions (0-100) */
    readonly parameterCoverage: number;
    /** Percentage of functions with return docs (0-100) */
    readonly returnTypeCoverage: number;
}

/**
 * A single item in the hardening checklist.
 */
export interface HardeningCheckItem {
    /** Check identifier */
    readonly id: string;
    /** Human-readable name */
    readonly name: string;
    /** Description of what this check verifies */
    readonly description: string;
    /** Whether the check passed */
    readonly passed: boolean;
    /** Current value (for numeric checks) */
    readonly value: number | boolean;
    /** Target value (for numeric checks) */
    readonly target: number | boolean;
    /** Severity if check fails */
    readonly severity: 'error' | 'warning' | 'info';
    /** Paths to relevant spec/doc sections for remediation */
    readonly readPath?: readonly string[];
    /** Actionable suggestion for fixing this check */
    readonly suggestion?: string;
}

/**
 * Validation result using negative-search pattern.
 * Focuses on what's missing/failed rather than what passed.
 */
export interface ValidationResult {
    /** Whether all required checks passed (negative search: true if no failures) */
    readonly isComplete: boolean;
    /** Reason for the validation result */
    readonly reason: string;
    /** IDs of all required checks */
    readonly requiredProofs: readonly string[];
    /** IDs of checks that passed */
    readonly passedProofs: readonly string[];
    /** IDs of checks that failed */
    readonly failedProofs: readonly string[];
    /** Recommended next action to fix validation */
    readonly recommendedAction: string;
}

/**
 * Complete hardening checklist result.
 */
export interface HardeningChecklist {
    /** Workspace URI */
    readonly workspaceUri: FileURI;
    /** Timestamp of the check */
    readonly generatedAt: string;
    /** All check items */
    readonly items: readonly HardeningCheckItem[];
    /** Overall score (0-100) */
    readonly score: number;
    /** Number of passing checks */
    readonly passed: number;
    /** Number of failing checks */
    readonly failed: number;
    /** Summary report */
    readonly report: HardeningReport;
    /** Validation result using negative-search pattern */
    readonly validation: ValidationResult;
}

// ============================================================
// Stub/Placeholder Detection Types
// ============================================================

/**
 * Type of stub or placeholder detected.
 */
export type StubType =
    | 'empty-body'           // Function body is empty
    | 'throw-not-implemented' // Function just throws "not implemented"
    | 'todo-body'            // Function body contains only TODO
    | 'placeholder-string'   // Description contains TODO/FIXME/placeholder
    | 'generic-param-name'   // Parameters named x, arg1, data, input

/**
 * A detected stub or placeholder.
 *
 * @example
 * const stub: DetectedStub = {
 *   type: 'throw-not-implemented',
 *   symbolRef: '#/definitions/processPayment',
 *   location: { uri: 'file:///src/payment.ts', range: {...} },
 *   message: 'Function body throws "not implemented"',
 *   severity: 'warning'
 * };
 */
export interface DetectedStub {
    /** Type of stub */
    readonly type: StubType;
    /** Reference to the symbol */
    readonly symbolRef: SchemaRef;
    /** Source location */
    readonly location: {
        readonly uri: FileURI;
        readonly range: {
            readonly start: { readonly line: number; readonly character: number };
            readonly end: { readonly line: number; readonly character: number };
        };
    };
    /** Human-readable message */
    readonly message: string;
    /** Severity */
    readonly severity: 'error' | 'warning';
}

/**
 * Result of stub detection scan.
 */
export interface StubDetectionResult {
    /** All detected stubs */
    readonly stubs: readonly DetectedStub[];
    /** Total symbols scanned */
    readonly totalScanned: number;
    /** Number of stubs found */
    readonly stubsFound: number;
}

// ============================================================
// Harsh Mode Gap Display Types
// ============================================================

/**
 * A documentation gap for harsh mode display.
 */
export interface DocumentationGap {
    /** Type of gap */
    readonly type:
        | 'no-description'
        | 'no-param-description'
        | 'no-return-description'
        | 'no-examples'
        | 'undocumented-error'
        | 'missing-type-doc';
    /** Symbol reference */
    readonly symbolRef: SchemaRef;
    /** Human-readable message */
    readonly message: string;
    /** Suggestion for fixing */
    readonly suggestion: string;
    /** Context information */
    readonly context: string;
}

/**
 * Harsh mode output for a module.
 */
export interface HarshModeOutput {
    /** Module path */
    readonly modulePath: string;
    /** All gaps in this module */
    readonly gaps: readonly DocumentationGap[];
    /** Gap count by type */
    readonly gapCounts: Readonly<Record<DocumentationGap['type'], number>>;
    /** Overall documentation health score (0-100) */
    readonly healthScore: number;
}
