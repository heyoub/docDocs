/**
 * @fileoverview Configuration management for docDocs extension.
 * Handles loading, saving, validation, and merging of .docdocs.json files.
 *
 * @module state/config
 * @requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
 */

import * as vscode from 'vscode';
import type { AsyncResult } from '../types/base.js';
import type {
    GenDocsConfig,
    OutputConfig,
    SourceConfig,
    ExtractionConfig,
    ValidationConfig,
    MLConfig,
    LintConfig,
    TemplatesConfig,
    WatchConfig,
    GitConfig,
    ExportConfig,
    ChangelogConfig,
    LintRulesConfig,
} from '../types/config.js';
import { ok, err } from '../utils/result.js';
import { parseGenDocsConfig } from './configSchema.js';

// ============================================================
// Types
// ============================================================

/**
 * Error types for configuration operations.
 */
export type ConfigError =
    | { readonly type: 'io'; readonly message: string }
    | { readonly type: 'parse'; readonly message: string }
    | { readonly type: 'validation'; readonly message: string };

const CONFIG_FILE = '.docdocs.json';
/** Legacy config file name; read for migration, never written */
const LEGACY_CONFIG_FILE = '.gendocs.json';

/** Workspaces we already warned about invalid config (one warning per session). */
const configWarnedWorkspaces = new Set<string>();

/**
 * Formats a config load error for display in the UI or logs.
 */
export function formatConfigError(error: ConfigError): string {
    switch (error.type) {
        case 'parse':
            return `invalid JSON in ${CONFIG_FILE}: ${error.message}`;
        case 'validation':
            return `invalid ${CONFIG_FILE}: ${error.message}`;
        case 'io':
            return error.message;
    }
}

/**
 * Loads config for command handlers. On load/parse/validation failure, shows a
 * warning once per workspace and returns defaults (missing file still uses defaults silently).
 */
/** VS Code setting default for watch debounce (matches package.json contributes) */
const VSCODE_WATCH_DEBOUNCE_MS_DEFAULT = 1000;

/**
 * Resolves watch settings from VS Code workspace configuration and `.docdocs.json`.
 * VS Code `docdocs.watch.*` keys override file config for `enabled` and `debounceMs`;
 * `autoRegenerate` comes from the merged file config only.
 */
export async function resolveWatchConfig(
    folder: vscode.WorkspaceFolder
): Promise<WatchConfig> {
    const fileConfig = await loadConfigForCommand(folder);
    const vscodeConfig = vscode.workspace.getConfiguration('docdocs', folder.uri);
    return {
        enabled: vscodeConfig.get<boolean>('watch.enabled', fileConfig.watch.enabled),
        debounceMs: vscodeConfig.get<number>(
            'watch.debounceMs',
            fileConfig.watch.debounceMs ?? VSCODE_WATCH_DEBOUNCE_MS_DEFAULT
        ),
        autoRegenerate: fileConfig.watch.autoRegenerate,
    };
}

export async function loadConfigForCommand(
    folder: vscode.WorkspaceFolder
): Promise<GenDocsConfig> {
    const result = await loadConfig(folder);
    if (result.ok) {
        return result.value;
    }
    const key = folder.uri.toString();
    if (!configWarnedWorkspaces.has(key)) {
        configWarnedWorkspaces.add(key);
        void vscode.window.showWarningMessage(
            `docDocs: ${formatConfigError(result.error)}. Using default configuration.`
        );
    }
    return getDefault();
}

/**
 * Loads config when validation gates must run. Fails closed if the config file exists but is invalid.
 */
export async function loadConfigForValidationGates(
    folder: vscode.WorkspaceFolder
): AsyncResult<GenDocsConfig, ConfigError> {
    return loadConfig(folder);
}

// ============================================================
// Constants
// ============================================================

/**
 * Default lint rules configuration.
 */
const DEFAULT_LINT_RULES: LintRulesConfig = {
    'missing-description': 'warning',
    'missing-param-description': 'warning',
    'missing-return-description': 'warning',
    'missing-example': 'off',
    'outdated-param-name': 'error',
    'outdated-return-type': 'error',
    'broken-reference': 'error',
    'circular-dependency': 'warning',
    'undocumented-export': 'warning',
};

/**
 * Default output configuration.
 */
const DEFAULT_OUTPUT: OutputConfig = {
    directory: '.docdocs',
    formats: ['markdown', 'ai-context'],
    clean: false,
};

/**
 * Default source configuration.
 */
const DEFAULT_SOURCE: SourceConfig = {
    include: ['src/**/*'],
    exclude: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*'],
    followSymlinks: false,
};

/**
 * Default extraction configuration.
 */
const DEFAULT_EXTRACTION: ExtractionConfig = {
    preferLSP: true,
    treeSitterFallback: true,
    timeout: 30000,
    concurrency: 4,
};

/**
 * Default validation configuration.
 */
const DEFAULT_VALIDATION: ValidationConfig = {
    gates: {},
    convergence: {
        enabled: false,
        maxIterations: 3,
    },
};

/**
 * Default ML configuration.
 */
const DEFAULT_ML: MLConfig = {
    enabled: false,
    model: 'tiiuae/Falcon-H1-Tiny-Coder-90M',  // Registry recommended model
    device: 'auto',
    maxTokens: 4000,
    generateSummaries: true,
    generateTransitions: false,
    generateWhyItMatters: false,
    openRouter: {
        enabled: true,
        model: 'openrouter/auto',
    },
};

/**
 * Default lint configuration.
 */
const DEFAULT_LINT: LintConfig = {
    rules: DEFAULT_LINT_RULES,
    coverage: {
        threshold: 80,
        failBelowThreshold: false,
    },
};

/**
 * Default templates configuration.
 */
const DEFAULT_TEMPLATES: TemplatesConfig = {};

/**
 * Default watch configuration.
 */
const DEFAULT_WATCH: WatchConfig = {
    enabled: false,
    debounceMs: 500,
    autoRegenerate: true,
};

/**
 * Default git configuration.
 */
const DEFAULT_GIT: GitConfig = {
    includeCommitInfo: false,
    includeBlame: false,
};

/**
 * Default export configuration.
 */
const DEFAULT_EXPORT: ExportConfig = {};

/**
 * Default changelog configuration.
 */
const DEFAULT_CHANGELOG: ChangelogConfig = {
    autoSnapshot: false,
    tagPattern: 'v*',
    outputDir: '.docdocs/changelogs',
    includePrivate: false,
    harshMode: false,
    includeImpactAnalysis: true,
    includeCodeDiffs: true,
    includeMigrationExamples: true,
};

// ============================================================
// Default Configuration
// ============================================================

/**
 * Returns the default docDocs configuration.
 * All required fields are populated with sensible defaults.
 *
 * @returns Complete default configuration
 *
 * @example
 * const config = getDefault();
 * console.log(config.output.directory); // '.docdocs'
 */
export function getDefault(): GenDocsConfig {
    return {
        version: 1,
        output: DEFAULT_OUTPUT,
        source: DEFAULT_SOURCE,
        extraction: DEFAULT_EXTRACTION,
        validation: DEFAULT_VALIDATION,
        ml: DEFAULT_ML,
        linting: DEFAULT_LINT,
        templates: DEFAULT_TEMPLATES,
        watch: DEFAULT_WATCH,
        git: DEFAULT_GIT,
        export: DEFAULT_EXPORT,
        changelog: DEFAULT_CHANGELOG,
    };
}

// ============================================================
// Configuration Loading
// ============================================================

/**
 * Loads configuration from a workspace folder.
 * Reads .docdocs.json if it exists (or .gendocs.json for migration), otherwise returns defaults.
 *
 * @param folder - The workspace folder to load config from
 * @returns AsyncResult with the loaded configuration or error
 *
 * @example
 * const result = await loadConfig(workspaceFolder);
 * if (result.ok) {
 *   console.log('Loaded config:', result.value);
 * }
 */
export async function loadConfig(
    folder: vscode.WorkspaceFolder
): AsyncResult<GenDocsConfig, ConfigError> {
    try {
        // Try canonical config first, then legacy for migration
        let content: Uint8Array;
        let usedUri = vscode.Uri.joinPath(folder.uri, CONFIG_FILE);
        try {
            content = await vscode.workspace.fs.readFile(usedUri);
        } catch {
            try {
                usedUri = vscode.Uri.joinPath(folder.uri, LEGACY_CONFIG_FILE);
                content = await vscode.workspace.fs.readFile(usedUri);
            } catch {
                return ok(getDefault());
            }
        }

        const decoder = new TextDecoder();
        const json = decoder.decode(content);

        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return err({ type: 'parse', message: `Invalid JSON in ${CONFIG_FILE}: ${message}` });
        }

        const validationResult = validateConfig(parsed);
        if (!validationResult.ok) {
            return validationResult;
        }

        // Merge with defaults to ensure all fields are present
        return ok(mergeConfigs(getDefault(), validationResult.value));
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err({ type: 'io', message: `Failed to load config: ${message}` });
    }
}

// ============================================================
// Configuration Saving
// ============================================================

/**
 * Saves configuration to a workspace folder.
 * Writes to .docdocs.json in the workspace root.
 *
 * @param folder - The workspace folder to save config to
 * @param config - The configuration to save
 * @returns AsyncResult indicating success or failure
 *
 * @example
 * const result = await saveConfig(workspaceFolder, config);
 * if (!result.ok) {
 *   console.error('Failed to save:', result.error.message);
 * }
 */
export async function saveConfig(
    folder: vscode.WorkspaceFolder,
    config: GenDocsConfig
): AsyncResult<void, ConfigError> {
    try {
        const configUri = vscode.Uri.joinPath(folder.uri, CONFIG_FILE);
        const content = JSON.stringify(config, null, 2);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(configUri, encoder.encode(content));
        return ok(undefined);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err({ type: 'io', message: `Failed to save config: ${message}` });
    }
}

// ============================================================
// Configuration Validation
// ============================================================

/**
 * Validates that a parsed object is a valid docDocs config.
 * Uses Zod schemas in configSchema.ts (enum checks, strict keys, nested sections).
 *
 * @param obj - The object to validate
 * @returns Result with validated config or validation error
 */
export function validateConfig(
    obj: unknown
): { ok: true; value: Partial<GenDocsConfig> } | { ok: false; error: ConfigError } {
    return parseGenDocsConfig(obj);
}

// ============================================================
// Configuration Merging
// ============================================================

/**
 * Merges a partial configuration with a base configuration.
 * Override values take precedence over base values.
 * Performs deep merge for nested objects.
 *
 * @param base - The base configuration (typically defaults)
 * @param override - Partial configuration to merge
 * @returns Complete merged configuration
 *
 * @example
 * const merged = mergeConfigs(getDefault(), { output: { clean: true } });
 */
export function mergeConfigs(
    base: GenDocsConfig,
    override: Partial<GenDocsConfig>
): GenDocsConfig {
    return {
        version: 1,
        output: mergeOutput(base.output, override.output),
        source: mergeSource(base.source, override.source),
        extraction: mergeExtraction(base.extraction, override.extraction),
        validation: mergeValidation(base.validation, override.validation),
        ml: mergeML(base.ml, override.ml),
        linting: mergeLinting(base.linting, override.linting),
        templates: mergeTemplates(base.templates, override.templates),
        watch: mergeWatch(base.watch, override.watch),
        git: mergeGit(base.git, override.git),
        export: mergeExport(base.export, override.export),
        changelog: mergeChangelog(base.changelog, override.changelog),
    };
}

function mergeOutput(base: OutputConfig, override?: Partial<OutputConfig>): OutputConfig {
    if (!override) return base;
    return {
        directory: override.directory ?? base.directory,
        formats: override.formats ?? base.formats,
        clean: override.clean ?? base.clean,
    };
}

function mergeSource(base: SourceConfig, override?: Partial<SourceConfig>): SourceConfig {
    if (!override) return base;
    return {
        include: override.include ?? base.include,
        exclude: override.exclude ?? base.exclude,
        followSymlinks: override.followSymlinks ?? base.followSymlinks,
    };
}

function mergeExtraction(base: ExtractionConfig, override?: Partial<ExtractionConfig>): ExtractionConfig {
    if (!override) return base;
    return {
        preferLSP: override.preferLSP ?? base.preferLSP,
        treeSitterFallback: override.treeSitterFallback ?? base.treeSitterFallback,
        timeout: override.timeout ?? base.timeout,
        concurrency: override.concurrency ?? base.concurrency,
    };
}

function mergeValidation(base: ValidationConfig, override?: Partial<ValidationConfig>): ValidationConfig {
    if (!override) return base;
    return {
        gates: override.gates ?? base.gates,
        convergence: override.convergence
            ? { ...base.convergence, ...override.convergence }
            : base.convergence,
    };
}

function mergeML(base: MLConfig, override?: Partial<MLConfig>): MLConfig {
    if (!override) return base;
    const result: MLConfig = {
        enabled: override.enabled ?? base.enabled,
        model: override.model ?? base.model,
        device: override.device ?? base.device,
        maxTokens: override.maxTokens ?? base.maxTokens,
        generateSummaries: override.generateSummaries ?? base.generateSummaries,
        generateTransitions: override.generateTransitions ?? base.generateTransitions,
        generateWhyItMatters: override.generateWhyItMatters ?? base.generateWhyItMatters,
        openRouter: {
            enabled: override.openRouter?.enabled ?? base.openRouter.enabled,
            model: override.openRouter?.model ?? base.openRouter.model,
        },
    };
    // Handle optional cacheDir
    const cacheDir = override.cacheDir ?? base.cacheDir;
    if (cacheDir !== undefined) {
        return { ...result, cacheDir };
    }
    return result;
}

function mergeLinting(base: LintConfig, override?: Partial<LintConfig>): LintConfig {
    if (!override) return base;
    return {
        rules: override.rules ? { ...base.rules, ...override.rules } : base.rules,
        coverage: override.coverage
            ? { ...base.coverage, ...override.coverage }
            : base.coverage,
    };
}

function mergeTemplates(base: TemplatesConfig, override?: Partial<TemplatesConfig>): TemplatesConfig {
    if (!override) return base;
    const result: TemplatesConfig = {};
    // Handle optional directory
    const directory = override.directory ?? base.directory;
    if (directory !== undefined) {
        (result as { directory?: string }).directory = directory;
    }
    // Handle optional markdown
    const markdown = override.markdown
        ? { ...base.markdown, ...override.markdown }
        : base.markdown;
    if (markdown !== undefined) {
        (result as { markdown?: typeof markdown }).markdown = markdown;
    }
    return result;
}

function mergeWatch(base: WatchConfig, override?: Partial<WatchConfig>): WatchConfig {
    if (!override) return base;
    return {
        enabled: override.enabled ?? base.enabled,
        debounceMs: override.debounceMs ?? base.debounceMs,
        autoRegenerate: override.autoRegenerate ?? base.autoRegenerate,
    };
}

function mergeGit(base: GitConfig, override?: Partial<GitConfig>): GitConfig {
    if (!override) return base;
    return {
        includeCommitInfo: override.includeCommitInfo ?? base.includeCommitInfo,
        includeBlame: override.includeBlame ?? base.includeBlame,
    };
}

function mergeExport(base: ExportConfig, override?: Partial<ExportConfig>): ExportConfig {
    if (!override) return base;
    const result: ExportConfig = {};
    const openapi = override.openapi ?? base.openapi;
    const graphql = override.graphql ?? base.graphql;
    if (openapi !== undefined) {
        (result as { openapi?: typeof openapi }).openapi = openapi;
    }
    if (graphql !== undefined) {
        (result as { graphql?: typeof graphql }).graphql = graphql;
    }
    return result;
}

function mergeChangelog(base: ChangelogConfig, override?: Partial<ChangelogConfig>): ChangelogConfig {
    if (!override) return base;
    return {
        autoSnapshot: override.autoSnapshot ?? base.autoSnapshot,
        tagPattern: override.tagPattern ?? base.tagPattern,
        outputDir: override.outputDir ?? base.outputDir,
        includePrivate: override.includePrivate ?? base.includePrivate,
        harshMode: override.harshMode ?? base.harshMode,
        includeImpactAnalysis: override.includeImpactAnalysis ?? base.includeImpactAnalysis,
        includeCodeDiffs: override.includeCodeDiffs ?? base.includeCodeDiffs,
        includeMigrationExamples: override.includeMigrationExamples ?? base.includeMigrationExamples,
    };
}
