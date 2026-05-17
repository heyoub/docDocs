/**
 * @fileoverview Workspace analysis commands (traceability, hardening, flow).
 *
 * @module commands/analyze
 */

import * as vscode from 'vscode';
import type { FileURI, ModuleSchema } from '../types/index.js';
import { formatExtractionError } from '../types/index.js';
import { buildModuleSchema } from '../core/pipeline/buildModuleSchema.js';
import {
    formatChecklistMarkdown,
    generateHardeningChecklist,
    generateTraceabilityReport,
    findSpecFiles,
} from '../core/analysis/index.js';
import { extractFlowMatrix } from '../core/analysis/flow.js';
import { generateWorkspaceSchema } from '../core/schema/generator.js';
function getLanguageId(uri: vscode.Uri): string {
    const ext = uri.fsPath.split('.').pop() ?? '';
    const map: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescriptreact',
        js: 'javascript',
        jsx: 'javascriptreact',
        py: 'python',
        rs: 'rust',
        go: 'go',
        hs: 'haskell',
    };
    return map[ext] ?? ext;
}

async function collectModuleSchemas(
    progress: vscode.Progress<{ message?: string }>,
    token: vscode.CancellationToken
): Promise<ModuleSchema[]> {
    const files = await vscode.workspace.findFiles(
        '**/*.{ts,js,py,rs,go,hs}',
        '**/{node_modules,.docdocs,dist,build}/**'
    );

    const modules: ModuleSchema[] = [];

    for (const file of files) {
        if (token.isCancellationRequested) break;

        progress.report({ message: `Analyzing ${file.fsPath}` });
        const result = await buildModuleSchema(file, getLanguageId(file));
        if (!result.ok) {
            console.warn(`[docDocs] ${formatExtractionError(result.error)}`);
            continue;
        }
        modules.push(result.value);
    }

    return modules;
}

async function writeReport(folder: vscode.WorkspaceFolder, name: string, content: string): Promise<void> {
    const uri = vscode.Uri.joinPath(folder.uri, '.docdocs', 'reports', name);
    const parent = vscode.Uri.joinPath(uri, '..');
    await vscode.workspace.fs.createDirectory(parent);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

export async function exportHardeningReportCommand(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        void vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating Hardening Report', cancellable: true },
        async (progress, token) => {
            const modules = await collectModuleSchemas(progress, token);
            const workspaceSchema = generateWorkspaceSchema([]);
            const result = await generateHardeningChecklist(folder, workspaceSchema, modules);
            if (!result.ok) {
                void vscode.window.showErrorMessage(result.error.message);
                return;
            }
            const markdown = formatChecklistMarkdown(result.value);
            await writeReport(folder, 'hardening.md', markdown);
            void vscode.window.showInformationMessage('Hardening report written to .docdocs/reports/hardening.md');
        }
    );
}

export async function exportTraceabilityReportCommand(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        void vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating Traceability Report', cancellable: true },
        async (progress, token) => {
            const codeFiles = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,rs,go,hs}',
                '**/{node_modules,.docdocs,dist,build}/**'
            );
            const specFiles = await findSpecFiles(folder);
            const exportedSymbols: string[] = [];

            for (const file of codeFiles) {
                if (token.isCancellationRequested) break;
                progress.report({ message: `Scanning ${file.fsPath}` });
                const result = await buildModuleSchema(file, getLanguageId(file));
                if (!result.ok) continue;
                for (const name of Object.keys(result.value.definitions)) {
                    exportedSymbols.push(name);
                }
            }

            const reportResult = await generateTraceabilityReport(
                folder.uri.toString() as FileURI,
                codeFiles,
                specFiles,
                exportedSymbols
            );

            if (!reportResult.ok) {
                void vscode.window.showErrorMessage(reportResult.error.message);
                return;
            }

            const report = reportResult.value;
            const lines = [
                '# Traceability Report',
                '',
                `## Summary`,
                `- Implemented: ${report.crossRef.implementedSpecs.length}`,
                `- Unimplemented: ${report.crossRef.unimplementedSpecs.length}`,
                `- Gaps: ${report.gaps.length}`,
                '',
                '## Gaps',
                ...report.gaps.map((g) => `- ${g.description}`),
            ];
            await writeReport(folder, 'traceability.md', lines.join('\n'));
            void vscode.window.showInformationMessage(
                'Traceability report written to .docdocs/reports/traceability.md'
            );
        }
    );
}

export async function exportFlowReportCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showErrorMessage('Open a source file to analyze control flow');
        return;
    }

    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!folder) {
        void vscode.window.showErrorMessage('File is not in a workspace');
        return;
    }

    const code = editor.document.getText();
    const symbol = editor.document.getText(editor.selection) || 'selection';
    const matrix = extractFlowMatrix(code, symbol);
    const lines = [
        '# Control Flow Report',
        '',
        `**Complexity:** ${matrix.complexity}`,
        `**Branches:** ${matrix.branches}`,
        `**Loops:** ${matrix.loops}`,
        `**Early returns:** ${matrix.earlyReturns}`,
        `**Happy path:** ${matrix.happyPath}`,
        '',
        '## Conditionals',
        ...matrix.conditionals.map((d) => `- ${d}`),
    ];
    await writeReport(folder, 'flow-active-editor.md', lines.join('\n'));
    void vscode.window.showInformationMessage('Flow report written to .docdocs/reports/flow-active-editor.md');
}

export function registerAnalyzeCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('docdocs.exportHardeningReport', exportHardeningReportCommand),
        vscode.commands.registerCommand('docdocs.exportTraceabilityReport', exportTraceabilityReportCommand),
        vscode.commands.registerCommand('docdocs.exportFlowReport', exportFlowReportCommand)
    );
}
