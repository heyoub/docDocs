/**
 * @fileoverview Documentation hardening checklist for GenDocs.
 * Performs structural completeness checks on documentation.
 *
 * @module core/analysis/hardening
 */

import * as vscode from 'vscode';
import type { FileURI, AsyncResult } from '../../types/base.js';
import type {
    HardeningReport,
    HardeningCheckItem,
    HardeningChecklist,
    ValidationResult
} from '../../types/analysis.js';
import type { WorkspaceSchema, ModuleSchema } from '../../types/schema.js';

// ============================================================
// Check Definitions
// ============================================================

/**
 * Definition of a hardening check.
 */
interface CheckDefinition {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly severity: 'error' | 'warning' | 'info';
    readonly check: (context: CheckContext) => CheckResult;
    /** Paths to relevant spec/doc sections for remediation */
    readonly readPath: readonly string[];
    /** Actionable suggestion for fixing this check */
    readonly suggestion: string;
}

interface CheckContext {
    readonly workspaceFolder: vscode.WorkspaceFolder;
    readonly schema: WorkspaceSchema | null;
    readonly modules: readonly ModuleSchema[];
    readonly files: readonly string[];
}

interface CheckResult {
    readonly passed: boolean;
    readonly value: number | boolean;
    readonly target: number | boolean;
}

// ============================================================
// Hardening Checks
// ============================================================

const CHECKS: readonly CheckDefinition[] = [
    {
        id: 'has-readme',
        name: 'README exists',
        description: 'Project has a README file',
        severity: 'error',
        readPath: ['docs/project-structure.md#required-files'],
        suggestion: 'Create a README.md file describing the project purpose, installation, and usage',
        check: (ctx) => ({
            passed: ctx.files.some(f =>
                f.toLowerCase().includes('readme')
            ),
            value: ctx.files.some(f => f.toLowerCase().includes('readme')),
            target: true
        })
    },
    {
        id: 'has-changelog',
        name: 'CHANGELOG exists',
        description: 'Project has a CHANGELOG file',
        severity: 'warning',
        readPath: ['docs/project-structure.md#changelog', 'keepachangelog.com'],
        suggestion: 'Create a CHANGELOG.md following Keep a Changelog format',
        check: (ctx) => ({
            passed: ctx.files.some(f =>
                f.toLowerCase().includes('changelog') ||
                f.toLowerCase().includes('history')
            ),
            value: ctx.files.some(f =>
                f.toLowerCase().includes('changelog') ||
                f.toLowerCase().includes('history')
            ),
            target: true
        })
    },
    {
        id: 'has-contributing',
        name: 'CONTRIBUTING exists',
        description: 'Project has contribution guidelines',
        severity: 'info',
        readPath: ['docs/project-structure.md#contributing'],
        suggestion: 'Create a CONTRIBUTING.md with guidelines for contributors',
        check: (ctx) => ({
            passed: ctx.files.some(f =>
                f.toLowerCase().includes('contributing')
            ),
            value: ctx.files.some(f => f.toLowerCase().includes('contributing')),
            target: true
        })
    },
    {
        id: 'has-license',
        name: 'LICENSE exists',
        description: 'Project has a license file',
        severity: 'error',
        readPath: ['choosealicense.com', 'docs/project-structure.md#license'],
        suggestion: 'Add a LICENSE file - visit choosealicense.com for guidance',
        check: (ctx) => ({
            passed: ctx.files.some(f =>
                f.toLowerCase().includes('license') ||
                f.toLowerCase().includes('licence')
            ),
            value: ctx.files.some(f =>
                f.toLowerCase().includes('license') ||
                f.toLowerCase().includes('licence')
            ),
            target: true
        })
    },
    {
        id: 'public-api-coverage',
        name: 'Public API documentation coverage',
        description: 'Percentage of exports with descriptions',
        severity: 'warning',
        readPath: ['CONTRIBUTING.md#documentation-guidelines', 'docs/api-guidelines.md#documenting-exports'],
        suggestion: 'Add JSDoc/TSDoc comments with @description to exported symbols',
        check: (ctx) => {
            const stats = computeDocCoverage(ctx.modules);
            const coverage = stats.totalExports > 0
                ? (stats.documentedExports / stats.totalExports) * 100
                : 100;
            return {
                passed: coverage >= 80,
                value: Math.round(coverage * 10) / 10,
                target: 80
            };
        }
    },
    {
        id: 'example-coverage',
        name: 'Example coverage',
        description: 'Percentage of exports with code examples',
        severity: 'info',
        readPath: ['CONTRIBUTING.md#writing-examples', 'docs/api-guidelines.md#examples'],
        suggestion: 'Add @example tags showing how to use exported symbols',
        check: (ctx) => {
            const stats = computeExampleCoverage(ctx.modules);
            const coverage = stats.totalExports > 0
                ? (stats.withExamples / stats.totalExports) * 100
                : 100;
            return {
                passed: coverage >= 50,
                value: Math.round(coverage * 10) / 10,
                target: 50
            };
        }
    },
    {
        id: 'parameter-coverage',
        name: 'Parameter documentation coverage',
        description: 'Percentage of parameters with descriptions',
        severity: 'warning',
        readPath: ['CONTRIBUTING.md#documenting-parameters', 'docs/api-guidelines.md#parameter-docs'],
        suggestion: 'Add @param tags with descriptions for all function parameters',
        check: (ctx) => {
            const stats = computeParameterCoverage(ctx.modules);
            const coverage = stats.totalParams > 0
                ? (stats.documentedParams / stats.totalParams) * 100
                : 100;
            return {
                passed: coverage >= 70,
                value: Math.round(coverage * 10) / 10,
                target: 70
            };
        }
    },
    {
        id: 'return-type-coverage',
        name: 'Return type documentation coverage',
        description: 'Percentage of functions with documented return types',
        severity: 'info',
        readPath: ['CONTRIBUTING.md#documenting-returns', 'docs/api-guidelines.md#return-docs'],
        suggestion: 'Add @returns tags describing what functions return',
        check: (ctx) => {
            const stats = computeReturnCoverage(ctx.modules);
            const coverage = stats.totalFunctions > 0
                ? (stats.documentedReturns / stats.totalFunctions) * 100
                : 100;
            return {
                passed: coverage >= 60,
                value: Math.round(coverage * 10) / 10,
                target: 60
            };
        }
    }
];

// ============================================================
// Coverage Computation
// ============================================================

interface DocStats {
    totalExports: number;
    documentedExports: number;
}

function computeDocCoverage(modules: readonly ModuleSchema[]): DocStats {
    let totalExports = 0;
    let documentedExports = 0;

    for (const module of modules) {
        for (const symbolRef of module.symbols) {
            const symbolName = symbolRef.replace(/^#\/definitions\//, '');
            const symbol = module.definitions[symbolName];
            if (symbol) {
                totalExports++;
                if (symbol.description && symbol.description.length > 0) {
                    documentedExports++;
                }
            }
        }
    }

    return { totalExports, documentedExports };
}

interface ExampleStats {
    totalExports: number;
    withExamples: number;
}

function computeExampleCoverage(modules: readonly ModuleSchema[]): ExampleStats {
    let totalExports = 0;
    let withExamples = 0;

    for (const module of modules) {
        for (const symbolRef of module.symbols) {
            const symbolName = symbolRef.replace(/^#\/definitions\//, '');
            const symbol = module.definitions[symbolName];
            if (symbol) {
                totalExports++;
                if (symbol.examples && symbol.examples.length > 0) {
                    withExamples++;
                }
            }
        }
    }

    return { totalExports, withExamples };
}

interface ParamStats {
    totalParams: number;
    documentedParams: number;
}

function computeParameterCoverage(modules: readonly ModuleSchema[]): ParamStats {
    let totalParams = 0;
    let documentedParams = 0;

    for (const module of modules) {
        for (const symbolRef of module.symbols) {
            const symbolName = symbolRef.replace(/^#\/definitions\//, '');
            const symbol = module.definitions[symbolName];
            if (symbol?.parameters) {
                for (const param of symbol.parameters) {
                    totalParams++;
                    if (param.description && param.description.length > 0) {
                        documentedParams++;
                    }
                }
            }
        }
    }

    return { totalParams, documentedParams };
}

interface ReturnStats {
    totalFunctions: number;
    documentedReturns: number;
}

function computeReturnCoverage(modules: readonly ModuleSchema[]): ReturnStats {
    let totalFunctions = 0;
    let documentedReturns = 0;

    for (const module of modules) {
        for (const symbolRef of module.symbols) {
            const symbolName = symbolRef.replace(/^#\/definitions\//, '');
            const symbol = module.definitions[symbolName];
            if (symbol && (symbol.kind === 'function' || symbol.kind === 'method')) {
                totalFunctions++;
                if (symbol.returnType) {
                    documentedReturns++;
                }
            }
        }
    }

    return { totalFunctions, documentedReturns };
}

// ============================================================
// Validation (Negative-Search Pattern)
// ============================================================

/**
 * Computes validation result using negative-search pattern.
 * Focuses on what's missing/failed rather than what passed.
 *
 * @param items - The hardening check items
 * @returns Validation result with failure-focused information
 */
export function computeValidation(
    items: readonly HardeningCheckItem[]
): ValidationResult {
    const required = items.filter(i => i.severity === 'error');
    const failedRequired = required.filter(i => !i.passed);
    const allFailed = items.filter(i => !i.passed);

    const isComplete = failedRequired.length === 0;

    let reason: string;
    let recommendedAction: string;

    if (isComplete) {
        const warnings = allFailed.filter(i => i.severity === 'warning');
        if (warnings.length > 0) {
            reason = `All required checks passed, but ${warnings.length} warning(s) remain`;
            recommendedAction = warnings[0]?.suggestion ?? 'Address remaining warnings';
        } else {
            reason = 'All required checks passed';
            recommendedAction = 'Documentation meets minimum requirements';
        }
    } else {
        reason = `Required checks failed: ${failedRequired.map(f => f.id).join(', ')}`;
        const firstFailed = failedRequired[0];
        recommendedAction = firstFailed?.suggestion ?? `Fix: ${firstFailed?.name}`;
    }

    return {
        isComplete,
        reason,
        requiredProofs: required.map(r => r.id),
        passedProofs: items.filter(i => i.passed).map(i => i.id),
        failedProofs: allFailed.map(i => i.id),
        recommendedAction
    };
}

// ============================================================
// Report Generation
// ============================================================

/**
 * Generates a hardening report from modules.
 */
function generateReport(modules: readonly ModuleSchema[]): HardeningReport {
    const docStats = computeDocCoverage(modules);
    const exampleStats = computeExampleCoverage(modules);
    const paramStats = computeParameterCoverage(modules);
    const returnStats = computeReturnCoverage(modules);

    return {
        hasReadme: false, // Will be set by checklist
        hasChangelog: false,
        hasContributing: false,
        hasLicense: false,
        publicApiCoverage: docStats.totalExports > 0
            ? (docStats.documentedExports / docStats.totalExports) * 100
            : 100,
        exampleCoverage: exampleStats.totalExports > 0
            ? (exampleStats.withExamples / exampleStats.totalExports) * 100
            : 100,
        parameterCoverage: paramStats.totalParams > 0
            ? (paramStats.documentedParams / paramStats.totalParams) * 100
            : 100,
        returnTypeCoverage: returnStats.totalFunctions > 0
            ? (returnStats.documentedReturns / returnStats.totalFunctions) * 100
            : 100
    };
}

// ============================================================
// Main Analysis Function
// ============================================================

/**
 * Generates a complete hardening checklist for a workspace.
 *
 * @param workspaceFolder - The workspace folder to analyze
 * @param schema - Optional pre-generated workspace schema
 * @param modules - Module schemas to analyze
 * @returns Complete hardening checklist
 */
export async function generateHardeningChecklist(
    workspaceFolder: vscode.WorkspaceFolder,
    schema: WorkspaceSchema | null,
    modules: readonly ModuleSchema[]
): AsyncResult<HardeningChecklist, Error> {
    try {
        // Find all files in workspace root
        const rootFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(workspaceFolder, '*'),
            '**/node_modules/**'
        );

        const fileNames = rootFiles
            .map(f => {
                const parts = f.path.split('/');
                return parts[parts.length - 1];
            })
            .filter((name): name is string => name !== undefined);

        // Create check context
        const context: CheckContext = {
            workspaceFolder,
            schema,
            modules,
            files: fileNames
        };

        // Run all checks
        const items: HardeningCheckItem[] = [];
        let passed = 0;
        let failed = 0;

        for (const check of CHECKS) {
            const result = check.check(context);
            items.push({
                id: check.id,
                name: check.name,
                description: check.description,
                passed: result.passed,
                value: result.value,
                target: result.target,
                severity: check.severity,
                readPath: check.readPath,
                suggestion: check.suggestion
            });

            if (result.passed) {
                passed++;
            } else {
                failed++;
            }
        }

        // Compute validation using negative-search pattern
        const validation = computeValidation(items);

        // Calculate overall score
        const score = CHECKS.length > 0
            ? (passed / CHECKS.length) * 100
            : 100;

        // Generate report
        const report = generateReport(modules);

        // Update report with file checks
        const updatedReport: HardeningReport = {
            ...report,
            hasReadme: fileNames.some(f => f.toLowerCase().includes('readme')),
            hasChangelog: fileNames.some(f =>
                f.toLowerCase().includes('changelog') ||
                f.toLowerCase().includes('history')
            ),
            hasContributing: fileNames.some(f => f.toLowerCase().includes('contributing')),
            hasLicense: fileNames.some(f =>
                f.toLowerCase().includes('license') ||
                f.toLowerCase().includes('licence')
            )
        };

        return {
            ok: true,
            value: {
                workspaceUri: workspaceFolder.uri.toString() as FileURI,
                generatedAt: new Date().toISOString(),
                items,
                score: Math.round(score * 10) / 10,
                passed,
                failed,
                report: updatedReport,
                validation
            }
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: new Error(`Hardening analysis failed: ${message}`) };
    }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Gets check items that failed.
 */
export function getFailedChecks(
    checklist: HardeningChecklist
): readonly HardeningCheckItem[] {
    return checklist.items.filter(item => !item.passed);
}

/**
 * Gets check items by severity.
 */
export function getChecksBySeverity(
    checklist: HardeningChecklist,
    severity: 'error' | 'warning' | 'info'
): readonly HardeningCheckItem[] {
    return checklist.items.filter(item => item.severity === severity);
}

/**
 * Formats the checklist as markdown.
 */
export function formatChecklistMarkdown(checklist: HardeningChecklist): string {
    const lines: string[] = [];

    lines.push('# Documentation Hardening Checklist');
    lines.push('');
    lines.push(`**Score: ${checklist.score}%** (${checklist.passed}/${checklist.items.length} checks passed)`);
    lines.push('');

    // Group by severity
    const errors = getChecksBySeverity(checklist, 'error');
    const warnings = getChecksBySeverity(checklist, 'warning');
    const infos = getChecksBySeverity(checklist, 'info');

    if (errors.length > 0) {
        lines.push('## Critical');
        lines.push('');
        for (const item of errors) {
            const icon = item.passed ? '✅' : '❌';
            lines.push(`- ${icon} **${item.name}**: ${item.passed ? 'Pass' : 'Fail'}`);
        }
        lines.push('');
    }

    if (warnings.length > 0) {
        lines.push('## Warnings');
        lines.push('');
        for (const item of warnings) {
            const icon = item.passed ? '✅' : '⚠️';
            const value = typeof item.value === 'number' ? `${item.value}%` : item.value;
            const target = typeof item.target === 'number' ? `${item.target}%` : item.target;
            lines.push(`- ${icon} **${item.name}**: ${value} (target: ${target})`);
        }
        lines.push('');
    }

    if (infos.length > 0) {
        lines.push('## Recommendations');
        lines.push('');
        for (const item of infos) {
            const icon = item.passed ? '✅' : 'ℹ️';
            const value = typeof item.value === 'number' ? `${item.value}%` : item.value;
            const target = typeof item.target === 'number' ? `${item.target}%` : item.target;
            lines.push(`- ${icon} **${item.name}**: ${value} (target: ${target})`);
        }
        lines.push('');
    }

    return lines.join('\n');
}
