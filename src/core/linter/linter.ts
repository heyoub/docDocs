/**
 * @fileoverview Documentation linter orchestration module.
 * Coordinates lint rule execution and calculates documentation coverage.
 * Layer 2 - imports from Layer 0 (types/) and Layer 1 (rules.ts).
 *
 * @module core/linter/linter
 */

import type { LintSeverity, LintConfig } from '../../types/config.js';
import type { LintResult, LintResultSeverity } from '../../types/lint.js';
import type {
    ModuleSchema,
    SymbolSchema,
    WorkspaceSchema,
} from '../../types/schema.js';
import {
    checkMissingDescription,
    checkMissingParamDescription,
    checkMissingReturnDescription,
    checkMissingExample,
    checkBrokenReference,
    checkUndocumentedExport,
} from './rules.js';

// ============================================================
// Coverage Report Types
// ============================================================

/**
 * Coverage statistics for a single module.
 */
export interface ModuleCoverage {
    /** File path of the module */
    readonly path: string;
    /** Total number of symbols in the module */
    readonly totalSymbols: number;
    /** Number of symbols with documentation */
    readonly documentedSymbols: number;
    /** Coverage percentage (0-100) */
    readonly coveragePercent: number;
}

/**
 * Complete coverage report for a workspace.
 */
export interface CoverageReport {
    /** Total number of symbols across all modules */
    readonly totalSymbols: number;
    /** Number of symbols with documentation */
    readonly documentedSymbols: number;
    /** Overall coverage percentage (0-100) */
    readonly coveragePercent: number;
    /** Per-module coverage breakdown */
    readonly byModule: readonly ModuleCoverage[];
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Converts a LintSeverity config value to a LintResultSeverity.
 * Returns null if the rule is disabled ('off').
 * @param severity - The configured severity level
 * @returns The result severity or null if disabled
 */
function toResultSeverity(severity: LintSeverity): LintResultSeverity | null {
    if (severity === 'off') {
        return null;
    }
    return severity;
}

/**
 * Checks if a symbol has documentation (non-empty description).
 * @param symbol - The symbol to check
 * @returns true if the symbol has a non-empty description
 */
function isDocumented(symbol: SymbolSchema): boolean {
    return symbol.description.trim().length > 0;
}

/**
 * Builds a set of all symbol IDs in a workspace for reference validation.
 * @param modules - Map of module schemas keyed by path
 * @returns Set of all symbol names/IDs
 */
function buildSymbolSet(
    modules: ReadonlyMap<string, ModuleSchema>
): ReadonlySet<string> {
    const symbols = new Set<string>();

    for (const module of modules.values()) {
        for (const symbolName of Object.keys(module.definitions)) {
            symbols.add(symbolName);
            // Also add the full $id reference
            const symbol = module.definitions[symbolName];
            if (symbol) {
                symbols.add(symbol.$id as string);
            }
        }
    }

    return symbols;
}

/**
 * Rounds a number to two decimal places.
 * @param value - The value to round
 * @returns The rounded value
 */
function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
}

// ============================================================
// Symbol Linting
// ============================================================

/**
 * Runs all applicable lint rules on a single symbol.
 * @param symbol - The symbol to lint
 * @param allSymbols - Set of all valid symbol IDs for reference checking
 * @param config - Lint configuration with rule severities
 * @returns Array of lint results
 */
function lintSymbolWithConfig(
    symbol: SymbolSchema,
    allSymbols: ReadonlySet<string>,
    config: LintConfig
): readonly LintResult[] {
    const results: LintResult[] = [];
    const rules = config.rules;

    // Check missing-description
    const descSeverity = toResultSeverity(rules['missing-description']);
    if (descSeverity !== null) {
        results.push(...checkMissingDescription(symbol, descSeverity));
    }

    // Check missing-param-description
    const paramSeverity = toResultSeverity(rules['missing-param-description']);
    if (paramSeverity !== null) {
        results.push(...checkMissingParamDescription(symbol, paramSeverity));
    }

    // Check missing-return-description
    const returnSeverity = toResultSeverity(rules['missing-return-description']);
    if (returnSeverity !== null) {
        results.push(...checkMissingReturnDescription(symbol, returnSeverity));
    }

    // Check missing-example
    const exampleSeverity = toResultSeverity(rules['missing-example']);
    if (exampleSeverity !== null) {
        results.push(...checkMissingExample(symbol, exampleSeverity));
    }

    // Check broken-reference
    const refSeverity = toResultSeverity(rules['broken-reference']);
    if (refSeverity !== null) {
        results.push(...checkBrokenReference(symbol, allSymbols, refSeverity));
    }

    return results;
}

// ============================================================
// Module Linting
// ============================================================

/**
 * Lints a single module schema.
 * Runs all applicable lint rules on the module and its symbols.
 *
 * **Validates: Requirement 26.1** - Check for missing documentation on exported symbols
 * **Validates: Requirement 26.5** - Produce VS Code diagnostics
 *
 * @param module - The module schema to lint
 * @param config - Lint configuration with rule severities
 * @param allSymbols - Optional set of all symbol IDs for reference checking
 * @returns Array of lint results for the module
 */
export function lintModule(
    module: ModuleSchema,
    config: LintConfig,
    allSymbols?: ReadonlySet<string>
): readonly LintResult[] {
    const results: LintResult[] = [];
    const rules = config.rules;

    // Build symbol set from this module if not provided
    const symbolSet =
        allSymbols ?? buildSymbolSet(new Map([[module.path, module]]));

    // Check undocumented-export at module level
    const exportSeverity = toResultSeverity(rules['undocumented-export']);
    if (exportSeverity !== null) {
        results.push(...checkUndocumentedExport(module, exportSeverity));
    }

    // Lint each symbol in the module
    for (const symbolName of Object.keys(module.definitions)) {
        const symbol = module.definitions[symbolName];
        if (symbol) {
            results.push(...lintSymbolWithConfig(symbol, symbolSet, config));
        }
    }

    return results;
}

// ============================================================
// Workspace Linting
// ============================================================

/**
 * Lints an entire workspace schema.
 * Runs all enabled lint rules on all modules and their symbols.
 *
 * **Validates: Requirement 26.1** - Check for missing documentation on exported symbols
 * **Validates: Requirement 26.5** - Produce VS Code diagnostics
 * **Validates: Requirement 26.6** - Support configurable severity levels
 *
 * @param schema - The workspace schema to lint
 * @param config - Lint configuration with rule severities
 * @param moduleSchemas - Map of module schemas keyed by path
 * @returns Array of all lint results across the workspace
 */
export function lint(
    schema: WorkspaceSchema,
    config: LintConfig,
    moduleSchemas: ReadonlyMap<string, ModuleSchema>
): readonly LintResult[] {
    const results: LintResult[] = [];

    // Build complete symbol set for cross-module reference checking
    const allSymbols = buildSymbolSet(moduleSchemas);

    // Lint each module
    for (const moduleRef of schema.modules) {
        const moduleSchema = moduleSchemas.get(moduleRef.path);
        if (moduleSchema) {
            results.push(...lintModule(moduleSchema, config, allSymbols));
        }
    }

    return results;
}

// ============================================================
// Coverage Calculation
// ============================================================

/**
 * Calculates documentation coverage for a single module.
 * @param module - The module schema to analyze
 * @returns Coverage statistics for the module
 */
function calculateModuleCoverage(module: ModuleSchema): ModuleCoverage {
    const symbolNames = Object.keys(module.definitions);
    const totalSymbols = symbolNames.length;

    let documentedSymbols = 0;
    for (const symbolName of symbolNames) {
        const symbol = module.definitions[symbolName];
        if (symbol && isDocumented(symbol)) {
            documentedSymbols++;
        }
    }

    const coveragePercent =
        totalSymbols > 0
            ? roundToTwoDecimals((documentedSymbols / totalSymbols) * 100)
            : 100;

    return {
        path: module.path,
        totalSymbols,
        documentedSymbols,
        coveragePercent,
    };
}

/**
 * Calculates documentation coverage for an entire workspace.
 * Coverage is defined as the percentage of symbols with non-empty descriptions.
 *
 * **Validates: Requirement 39.1** - Calculate documentation coverage
 * **Property 21: Coverage Calculation Accuracy** - coverage = documented/total * 100
 *
 * @param schema - The workspace schema to analyze
 * @param moduleSchemas - Map of module schemas keyed by path
 * @returns Complete coverage report with per-module breakdown
 */
export function calculateCoverage(
    schema: WorkspaceSchema,
    moduleSchemas: ReadonlyMap<string, ModuleSchema>
): CoverageReport {
    const moduleCoverages: ModuleCoverage[] = [];
    let totalSymbols = 0;
    let documentedSymbols = 0;

    // Calculate coverage for each module
    for (const moduleRef of schema.modules) {
        const moduleSchema = moduleSchemas.get(moduleRef.path);
        if (moduleSchema) {
            const coverage = calculateModuleCoverage(moduleSchema);
            moduleCoverages.push(coverage);
            totalSymbols += coverage.totalSymbols;
            documentedSymbols += coverage.documentedSymbols;
        }
    }

    // Calculate overall coverage percentage
    const coveragePercent =
        totalSymbols > 0
            ? roundToTwoDecimals((documentedSymbols / totalSymbols) * 100)
            : 100;

    return {
        totalSymbols,
        documentedSymbols,
        coveragePercent,
        byModule: moduleCoverages,
    };
}
