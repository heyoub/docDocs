/**
 * @fileoverview Generate documentation command for GenDocs extension.
 * Orchestrates the full documentation generation pipeline.
 *
 * @module commands/generate
 * @requirements 6.1, 6.2, 6.3, 6.7, 11.1-11.7, 12.1-12.5
 */

import * as vscode from 'vscode';
import type { FileURI, FileExtraction, ModuleSchema, GenDocsConfig } from '../types/index.js';
import { extractSymbols } from '../core/extractor/lsp.js';
import { extractExports } from '../core/extractor/exports.js';
import { generateModuleSchema } from '../core/schema/generator.js';
import { renderModule } from '../core/renderer/markdown.js';
import { renderAIContext } from '../core/renderer/aiContext.js';
import { loadConfig, getDefault } from '../state/config.js';
import { recordGeneration } from '../state/freshness.js';
import { contentHash } from '../utils/hash.js';

// ============================================================
// Validation Gates
// ============================================================

/**
 * Runs configured validation gates before generation.
 * @param folder - The workspace folder to run gates for
 * @param progress - Progress reporter for UI feedback
 * @returns Object indicating if gates passed and any error message
 */
async function runValidationGates(
    folder: vscode.WorkspaceFolder,
    progress: vscode.Progress<{ readonly message: string }>
): Promise<{ readonly passed: boolean; readonly error?: string }> {
    const configResult = await loadConfig(folder);
    if (!configResult.ok) {
        return { passed: true }; // No config, skip gates
    }

    const config = configResult.value;
    const gates = config.validation?.gates;
    if (!gates) return { passed: true };

    // Run custom gates
    const customGates = gates.custom ?? [];
    for (const gate of customGates) {
        progress.report({ message: `Running gate: ${gate.name}` });
        const result = await runCommand(gate.command, folder.uri.fsPath);
        if (!result.success) {
            return { passed: false, error: `Gate "${gate.name}" failed: ${result.error}` };
        }
    }

    // Run format gate
    if (gates.format?.enabled && gates.format.command) {
        progress.report({ message: 'Running format gate' });
        const result = await runCommand(gates.format.command, folder.uri.fsPath);
        if (!result.success) {
            if (gates.format.autoFix) {
                await runCommand(`${gates.format.command} --fix`, folder.uri.fsPath);
                const retry = await runCommand(gates.format.command, folder.uri.fsPath);
                if (!retry.success) {
                    return { passed: false, error: 'Format gate failed after auto-fix' };
                }
            } else {
                return { passed: false, error: `Format gate failed: ${result.error}` };
            }
        }
    }

    // Run lint gate
    if (gates.lint?.enabled && gates.lint.command) {
        progress.report({ message: 'Running lint gate' });
        const result = await runCommand(gates.lint.command, folder.uri.fsPath);
        if (!result.success) {
            return { passed: false, error: `Lint gate failed: ${result.error}` };
        }
    }

    return { passed: true };
}

/**
 * Runs a shell command and returns the result.
 * @param command - The shell command to execute
 * @param cwd - The working directory for command execution
 * @returns Object indicating success and any error message
 */
async function runCommand(
    command: string,
    cwd: string
): Promise<{ readonly success: boolean; readonly error?: string }> {
    return new Promise((resolve) => {
        const cp = require('child_process');
        cp.exec(command, { cwd }, (error: Error | null) => {
            resolve(error ? { success: false, error: error.message } : { success: true });
        });
    });
}

// ============================================================
// File Generation
// ============================================================

/**
 * Generates documentation for a single file.
 * @param uri - The file URI to generate documentation for
 * @returns The generated module schema or null if extraction failed
 */
async function generateForFile(uri: vscode.Uri): Promise<ModuleSchema | null> {
    const symbolsResult = await extractSymbols(uri);
    if (!symbolsResult.ok) {
        return null;
    }

    // Extract exports using LSP semantic tokens and text analysis
    const exportsResult = await extractExports(uri, symbolsResult.value);
    const exports = exportsResult.ok ? exportsResult.value : [];

    const extraction: FileExtraction = {
        uri: uri.toString() as FileURI,
        languageId: getLanguageId(uri),
        symbols: symbolsResult.value,
        imports: [],
        exports: [...exports],
        method: 'lsp',
        timestamp: Date.now(),
    };

    return generateModuleSchema(extraction);
}

/**
 * Gets language ID from file extension.
 * @param uri - The file URI to get language ID for
 * @returns The language identifier string
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

/**
 * Writes generated documentation to disk.
 * @param schema - The module schema to write
 * @param config - The GenDocs configuration
 * @param folder - The workspace folder for output
 * @returns Promise that resolves when writing is complete
 */
async function writeOutput(
    schema: ModuleSchema,
    config: GenDocsConfig,
    folder: vscode.WorkspaceFolder
): Promise<void> {
    const outputDir = config.output?.directory ?? '.gendocs';
    const formats = config.output?.formats ?? ['markdown', 'ai-context'];
    const baseUri = vscode.Uri.joinPath(folder.uri, outputDir);

    for (const format of formats) {
        if (format === 'markdown') {
            const content = renderModule(schema);
            const mdUri = vscode.Uri.joinPath(baseUri, 'api', `${schema.path}.md`);
            await writeFile(mdUri, content);
        } else if (format === 'ai-context') {
            const maxTokens = config.ml.maxTokens;
            const aiContext = renderAIContext(schema, maxTokens);
            const jsonUri = vscode.Uri.joinPath(baseUri, 'ai-context', `${schema.path}.json`);
            await writeFile(jsonUri, JSON.stringify(aiContext, null, 2));
        }
    }
}

/**
 * Writes content to a file, creating directories as needed.
 * @param uri - The file URI to write to
 * @param content - The content to write
 * @returns Promise that resolves when writing is complete
 */
async function writeFile(uri: vscode.Uri, content: string): Promise<void> {
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
}

// ============================================================
// Convergence Loop
// ============================================================

/**
 * Runs generation in convergence mode until output stabilizes.
 * @param uri - The file URI to generate documentation for
 * @param maxIterations - Maximum iterations before giving up
 * @param progress - Progress reporter for UI feedback
 * @returns The final module schema or null if generation failed
 */
async function runConvergenceLoop(
    uri: vscode.Uri,
    maxIterations: number,
    progress: vscode.Progress<{ readonly message: string }>
): Promise<ModuleSchema | null> {
    let previousHash = '';
    let schema: ModuleSchema | null = null;

    for (let i = 0; i < maxIterations; i++) {
        progress.report({ message: `Convergence iteration ${i + 1}/${maxIterations}` });

        schema = await generateForFile(uri);
        if (!schema) return null;

        const currentHash = await contentHash(JSON.stringify(schema));
        if (currentHash === previousHash) {
            progress.report({ message: 'Documentation converged' });
            return schema;
        }
        previousHash = currentHash;
    }

    vscode.window.showWarningMessage(
        `Documentation did not converge after ${maxIterations} iterations`
    );
    return schema;
}

// ============================================================
// Main Commands
// ============================================================

/**
 * Generates documentation for a single file.
 * @param uri - Optional file URI; uses active editor if not provided
 * @returns Promise that resolves when generation is complete
 */
export async function generateForFileCommand(uri?: vscode.Uri): Promise<void> {
    const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
        vscode.window.showErrorMessage('No file selected');
        return;
    }

    const folder = vscode.workspace.getWorkspaceFolder(targetUri);
    if (!folder) {
        vscode.window.showErrorMessage('File is not in a workspace');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating Documentation',
            cancellable: true,
        },
        async (progress, token) => {
            const gateResult = await runValidationGates(folder, progress);
            if (!gateResult.passed) {
                vscode.window.showErrorMessage(gateResult.error ?? 'Validation failed');
                return;
            }

            if (token.isCancellationRequested) return;

            progress.report({ message: 'Extracting symbols...' });
            const configResult = await loadConfig(folder);
            const config = configResult.ok ? configResult.value : getDefault();

            const schema = await generateForFile(targetUri);
            if (!schema) {
                vscode.window.showErrorMessage('Failed to extract symbols');
                return;
            }

            if (token.isCancellationRequested) return;

            progress.report({ message: 'Writing output...' });
            await writeOutput(schema, config, folder);

            const fileUri = targetUri.toString() as FileURI;
            const doc = await vscode.workspace.openTextDocument(targetUri);
            const sourceHash = await contentHash(doc.getText());
            const docHash = await contentHash(JSON.stringify(schema));
            recordGeneration(fileUri, sourceHash, docHash);

            vscode.window.showInformationMessage('Documentation generated successfully');
        }
    );
}

/**
 * Generates documentation for a folder.
 * @param uri - Optional folder URI; uses active editor's folder if not provided
 * @returns Promise that resolves when generation is complete
 */
export async function generateForFolderCommand(uri?: vscode.Uri): Promise<void> {
    const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
        vscode.window.showErrorMessage('No folder selected');
        return;
    }

    const folder = vscode.workspace.getWorkspaceFolder(targetUri);
    if (!folder) {
        vscode.window.showErrorMessage('Folder is not in a workspace');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating Documentation for Folder',
            cancellable: true,
        },
        async (progress, token) => {
            const gateResult = await runValidationGates(folder, progress);
            if (!gateResult.passed) {
                vscode.window.showErrorMessage(gateResult.error ?? 'Validation failed');
                return;
            }

            const configResult = await loadConfig(folder);
            const config = configResult.ok ? configResult.value : getDefault();

            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(targetUri, '**/*.{ts,js,py,rs,go,hs}'),
                '**/node_modules/**'
            );

            let generated = 0;
            for (const file of files) {
                if (token.isCancellationRequested) break;

                progress.report({ message: `Processing ${file.fsPath}` });
                const schema = await generateForFile(file);
                if (schema) {
                    await writeOutput(schema, config, folder);
                    generated++;
                }
            }

            vscode.window.showInformationMessage(`Generated documentation for ${generated} files`);
        }
    );
}

/**
 * Generates documentation for the entire workspace.
 * @returns Promise that resolves when generation is complete for all folders
 */
export async function generateForWorkspaceCommand(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    for (const folder of folders) {
        await generateForFolderCommand(folder.uri);
    }
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers all generate commands.
 * @param context - The extension context for subscription management
 * @returns void
 */
export function registerGenerateCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('gendocs.generateDocumentation', generateForFileCommand),
        vscode.commands.registerCommand('gendocs.generateForFolder', generateForFolderCommand),
        vscode.commands.registerCommand('gendocs.generateForWorkspace', generateForWorkspaceCommand)
    );
}

// Suppress unused variable warning for convergence loop
void runConvergenceLoop;
