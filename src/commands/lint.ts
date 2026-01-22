/**
 * @fileoverview Lint documentation command for GenDocs extension.
 * Runs documentation linter and shows coverage reports.
 *
 * @module commands/lint
 * @requirements 26.7, 39.5
 */

import * as vscode from 'vscode';
import type { FileURI, FileExtraction, ModuleSchema } from '../types/index.js';
import { extractSymbols } from '../core/extractor/lsp.js';
import { generateModuleSchema, generateWorkspaceSchema } from '../core/schema/generator.js';
import { lint, calculateCoverage } from '../core/linter/linter.js';
import { loadConfig, getDefault } from '../state/config.js';
import { GenDocsDiagnosticsManager } from '../providers/diagnostics.js';

// ============================================================
// Diagnostics Manager Instance
// ============================================================

let diagnosticsManager: GenDocsDiagnosticsManager | null = null;

/**
 * Sets the diagnostics manager instance.
 */
export function setDiagnosticsManager(manager: GenDocsDiagnosticsManager): void {
    diagnosticsManager = manager;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Gets language ID from file extension.
 */
function getLanguageId(uri: vscode.Uri): string {
    const ext = uri.fsPath.split('.').pop() ?? '';
    const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescriptreact',
        js: 'javascript', jsx: 'javascriptreact',
        py: 'python', rs: 'rust', go: 'go', hs: 'haskell',
    };
    return langMap[ext] ?? ext;
}

// ============================================================
// Commands
// ============================================================

/**
 * Lints documentation for the workspace.
 */
export async function lintDocumentationCommand(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Linting Documentation',
            cancellable: true,
        },
        async (progress, token) => {
            const configResult = await loadConfig(folder);
            const config = configResult.ok ? configResult.value : getDefault();

            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,rs,go,hs}',
                '**/node_modules/**'
            );

            const extractions: FileExtraction[] = [];
            const moduleSchemas = new Map<string, ModuleSchema>();

            for (const file of files) {
                if (token.isCancellationRequested) break;
                progress.report({ message: `Analyzing ${file.fsPath}` });

                const symbolsResult = await extractSymbols(file);
                if (symbolsResult.ok) {
                    const extraction: FileExtraction = {
                        uri: file.toString() as FileURI,
                        languageId: getLanguageId(file),
                        symbols: symbolsResult.value,
                        imports: [],
                        exports: [],
                        method: 'lsp',
                        timestamp: Date.now(),
                    };
                    extractions.push(extraction);

                    const schema = generateModuleSchema(extraction);
                    moduleSchemas.set(schema.path, schema);
                }
            }

            const workspaceSchema = generateWorkspaceSchema(extractions);
            const results = lint(workspaceSchema, config.linting, moduleSchemas);

            // Group results by file
            const resultsByFile = new Map<FileURI, typeof results>();
            for (const result of results) {
                const fileUri = result.location.uri;
                const existing = resultsByFile.get(fileUri) ?? [];
                resultsByFile.set(fileUri, [...existing, result]);
            }

            // Update diagnostics
            if (diagnosticsManager) {
                diagnosticsManager.updateFiles(resultsByFile);
            }

            const errorCount = results.filter(r => r.severity === 'error').length;
            const warningCount = results.filter(r => r.severity === 'warning').length;

            vscode.window.showInformationMessage(
                `Lint complete: ${errorCount} errors, ${warningCount} warnings`
            );
        }
    );
}

/**
 * Shows documentation coverage report.
 */
export async function showCoverageReportCommand(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Calculating Coverage',
            cancellable: false,
        },
        async (progress) => {
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,rs,go,hs}',
                '**/node_modules/**'
            );

            const extractions: FileExtraction[] = [];
            const moduleSchemas = new Map<string, ModuleSchema>();

            for (const file of files) {
                progress.report({ message: `Analyzing ${file.fsPath}` });

                const symbolsResult = await extractSymbols(file);
                if (symbolsResult.ok) {
                    const extraction: FileExtraction = {
                        uri: file.toString() as FileURI,
                        languageId: getLanguageId(file),
                        symbols: symbolsResult.value,
                        imports: [],
                        exports: [],
                        method: 'lsp',
                        timestamp: Date.now(),
                    };
                    extractions.push(extraction);

                    const schema = generateModuleSchema(extraction);
                    moduleSchemas.set(schema.path, schema);
                }
            }

            const workspaceSchema = generateWorkspaceSchema(extractions);
            const coverage = calculateCoverage(workspaceSchema, moduleSchemas);

            const message = `Documentation Coverage: ${coverage.coveragePercent.toFixed(1)}%\n` +
                `Documented: ${coverage.documentedSymbols}/${coverage.totalSymbols} symbols`;

            vscode.window.showInformationMessage(message);
        }
    );
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers lint commands.
 */
export function registerLintCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('gendocs.lintDocumentation', lintDocumentationCommand),
        vscode.commands.registerCommand('gendocs.showCoverageReport', showCoverageReportCommand)
    );
}
