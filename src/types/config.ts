/**
 * @fileoverview Configuration types for GenDocs extension.
 * Defines all configuration interfaces for .gendocs.json files.
 * Zero imports from other project files - this is Layer 0.
 *
 * @module types/config
 */

// ============================================================
// Output Format Types
// ============================================================

/**
 * Supported output formats for documentation generation.
 * Each format serves a different purpose:
 * - markdown: Human-readable documentation
 * - ai-context: Structured JSON optimized for LLM consumption
 * - json-schema: Canonical machine-readable format
 * - openapi: REST API documentation
 * - graphql: GraphQL schema documentation
 * - lsif: Language Server Index Format for code intelligence
 * - notebook: Interactive VS Code notebooks
 */
export type OutputFormat =
    | 'markdown'
    | 'ai-context'
    | 'json-schema'
    | 'openapi'
    | 'graphql'
    | 'lsif'
    | 'notebook';

// ============================================================
// Lint Rule Types
// ============================================================

/**
 * Available lint rules for documentation quality checks.
 * Each rule validates a specific aspect of documentation completeness.
 */
export type LintRule =
    | 'missing-description'
    | 'missing-param-description'
    | 'missing-return-description'
    | 'missing-example'
    | 'outdated-param-name'
    | 'outdated-return-type'
    | 'broken-reference'
    | 'circular-dependency'
    | 'undocumented-export';

/**
 * Severity level for lint rules.
 * - error: Fails the lint check
 * - warning: Reports but doesn't fail
 * - off: Rule is disabled
 */
export type LintSeverity = 'error' | 'warning' | 'off';

// ============================================================
// Output Configuration
// ============================================================

/**
 * Configuration for documentation output.
 */
export interface OutputConfig {
    /** Directory for generated documentation (default: '.gendocs') */
    readonly directory: string;
    /** Output formats to generate */
    readonly formats: readonly OutputFormat[];
    /** Whether to clean output directory before generation */
    readonly clean: boolean;
}

// ============================================================
// Source Configuration
// ============================================================

/**
 * Configuration for source file selection.
 */
export interface SourceConfig {
    /** Glob patterns for files to include */
    readonly include: readonly string[];
    /** Glob patterns for files to exclude */
    readonly exclude: readonly string[];
    /** Whether to follow symbolic links */
    readonly followSymlinks: boolean;
}

// ============================================================
// Validation Gate Configuration
// ============================================================

/**
 * Configuration for a single validation gate.
 * Gates run before documentation generation to ensure code quality.
 */
export interface ValidationGateConfig {
    /** Whether this gate is enabled */
    readonly enabled: boolean;
    /** Shell command to run for validation */
    readonly command?: string;
    /** Whether to attempt auto-fix before failing */
    readonly autoFix?: boolean;
}

/**
 * Configuration for a custom validation gate.
 * Custom gates run arbitrary shell commands.
 */
export interface CustomGateConfig {
    /** Name of the custom gate */
    readonly name: string;
    /** Shell command to execute */
    readonly command: string;
}

/**
 * Configuration for all validation gates.
 */
export interface ValidationGatesConfig {
    /** Format validation gate (Biome, Prettier) */
    readonly format?: ValidationGateConfig;
    /** Lint validation gate (ESLint, Biome) */
    readonly lint?: ValidationGateConfig;
    /** Type-check validation gate (tsc, language-specific) */
    readonly typecheck?: ValidationGateConfig;
    /** Custom validation gates */
    readonly custom?: readonly CustomGateConfig[];
}

/**
 * Configuration for convergence mode.
 * Convergence regenerates documentation until output stabilizes.
 */
export interface ConvergenceConfig {
    /** Whether convergence mode is enabled */
    readonly enabled: boolean;
    /** Maximum iterations before giving up */
    readonly maxIterations: number;
}

/**
 * Configuration for all validation settings.
 */
export interface ValidationConfig {
    /** Validation gates configuration */
    readonly gates: ValidationGatesConfig;
    /** Convergence mode configuration */
    readonly convergence: ConvergenceConfig;
}

// ============================================================
// ML Configuration
// ============================================================

/**
 * Device type for ML model inference.
 * - cpu: Run on CPU (slower but always available)
 * - webgpu: Run on GPU via WebGPU (faster when available)
 * - auto: Automatically select best available device
 */
export type MLDevice = 'cpu' | 'webgpu' | 'auto';

/**
 * Configuration for ML prose generation.
 */
export interface MLConfig {
    /** Whether ML prose generation is enabled */
    readonly enabled: boolean;
    /** HuggingFace model ID to use */
    readonly model: string;
    /** Device to run inference on */
    readonly device: MLDevice;
    /** Directory for model cache */
    readonly cacheDir?: string;
    /** Maximum tokens for AI context output */
    readonly maxTokens: number;
    /** Whether to generate module summaries */
    readonly generateSummaries: boolean;
    /** Whether to generate transition text between sections */
    readonly generateTransitions: boolean;
    /** Whether to generate "why it matters" explanations */
    readonly generateWhyItMatters: boolean;
}

// ============================================================
// Lint Configuration
// ============================================================

/**
 * Configuration for lint rule severities.
 * Maps each lint rule to its severity level.
 */
export type LintRulesConfig = Record<LintRule, LintSeverity>;

/**
 * Configuration for documentation coverage requirements.
 */
export interface CoverageConfig {
    /** Minimum coverage percentage (0-100) */
    readonly threshold: number;
    /** Whether to fail if coverage is below threshold */
    readonly failBelowThreshold: boolean;
}

/**
 * Configuration for documentation linting.
 */
export interface LintConfig {
    /** Severity configuration for each lint rule */
    readonly rules: LintRulesConfig;
    /** Coverage requirements */
    readonly coverage: CoverageConfig;
}

// ============================================================
// Template Configuration
// ============================================================

/**
 * Configuration for Markdown template overrides.
 */
export interface MarkdownTemplateConfig {
    /** Path to custom module template */
    readonly module?: string;
    /** Path to custom symbol template */
    readonly symbol?: string;
    /** Path to custom index template */
    readonly index?: string;
}

/**
 * Configuration for documentation templates.
 */
export interface TemplatesConfig {
    /** Directory containing custom templates */
    readonly directory?: string;
    /** Markdown template overrides */
    readonly markdown?: MarkdownTemplateConfig;
}

// ============================================================
// Watch Configuration
// ============================================================

/**
 * Configuration for watch mode.
 */
export interface WatchConfig {
    /** Whether watch mode is enabled */
    readonly enabled: boolean;
    /** Debounce delay in milliseconds */
    readonly debounceMs: number;
    /** Whether to auto-regenerate on file changes */
    readonly autoRegenerate: boolean;
}

// ============================================================
// Git Configuration
// ============================================================

/**
 * Configuration for Git integration.
 */
export interface GitConfig {
    /** Whether to include commit info in documentation */
    readonly includeCommitInfo: boolean;
    /** Whether to include git blame information */
    readonly includeBlame: boolean;
}

// ============================================================
// Export Configuration
// ============================================================

/**
 * Configuration for OpenAPI export.
 */
export interface OpenAPIExportConfig {
    /** API title */
    readonly title: string;
    /** API version */
    readonly version: string;
    /** Server configurations */
    readonly servers: readonly OpenAPIServerConfig[];
}

/**
 * Configuration for an OpenAPI server.
 */
export interface OpenAPIServerConfig {
    /** Server URL */
    readonly url: string;
    /** Server description */
    readonly description: string;
}

/**
 * Configuration for GraphQL export.
 */
export interface GraphQLExportConfig {
    /** Path to GraphQL schema file */
    readonly schemaPath: string;
}

/**
 * Configuration for multi-format export.
 */
export interface ExportConfig {
    /** OpenAPI export configuration */
    readonly openapi?: OpenAPIExportConfig;
    /** GraphQL export configuration */
    readonly graphql?: GraphQLExportConfig;
}

// ============================================================
// Extraction Configuration
// ============================================================

/**
 * Configuration for symbol extraction.
 */
export interface ExtractionConfig {
    /** Whether to prefer LSP over other extraction methods */
    readonly preferLSP: boolean;
    /** Whether to fall back to tree-sitter when LSP unavailable */
    readonly treeSitterFallback: boolean;
    /** Timeout in milliseconds per file */
    readonly timeout: number;
    /** Number of parallel extractions */
    readonly concurrency: number;
}

// ============================================================
// Changelog Configuration
// ============================================================

/**
 * Configuration for changelog and snapshot features.
 */
export interface ChangelogConfig {
    /** Auto-create snapshot on git tag */
    readonly autoSnapshot: boolean;
    /** Git tag pattern for auto-snapshot (e.g., "v*") */
    readonly tagPattern: string;
    /** Directory to write changelogs */
    readonly outputDir: string;
    /** Include non-exported (private) symbols in snapshots */
    readonly includePrivate: boolean;
    /** Enable harsh mode (expose documentation gaps) */
    readonly harshMode: boolean;
    /** Include impact analysis in changelogs */
    readonly includeImpactAnalysis: boolean;
    /** Include before/after code diffs */
    readonly includeCodeDiffs: boolean;
    /** Include migration examples for breaking changes */
    readonly includeMigrationExamples: boolean;
}

// ============================================================
// Main Configuration Interface
// ============================================================

/**
 * Complete GenDocs configuration schema.
 * This interface represents the structure of .gendocs.json files.
 *
 * @example
 * ```json
 * {
 *   "version": 1,
 *   "output": {
 *     "directory": ".gendocs",
 *     "formats": ["markdown", "ai-context"],
 *     "clean": true
 *   },
 *   "source": {
 *     "include": ["src/**\/*.ts"],
 *     "exclude": ["**\/*.test.ts"],
 *     "followSymlinks": false
 *   }
 * }
 * ```
 */
export interface GenDocsConfig {
    /** Configuration schema version (always 1) */
    readonly version: 1;
    /** Output configuration */
    readonly output: OutputConfig;
    /** Source file selection configuration */
    readonly source: SourceConfig;
    /** Extraction configuration */
    readonly extraction: ExtractionConfig;
    /** Validation configuration */
    readonly validation: ValidationConfig;
    /** ML prose generation configuration */
    readonly ml: MLConfig;
    /** Documentation linting configuration */
    readonly linting: LintConfig;
    /** Template configuration */
    readonly templates: TemplatesConfig;
    /** Watch mode configuration */
    readonly watch: WatchConfig;
    /** Git integration configuration */
    readonly git: GitConfig;
    /** Multi-format export configuration */
    readonly export: ExportConfig;
    /** Changelog and snapshot configuration */
    readonly changelog: ChangelogConfig;
}

