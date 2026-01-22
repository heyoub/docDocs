/**
 * @fileoverview Export documentation command for GenDocs extension.
 * Exports documentation in various formats (LSIF, OpenAPI, GraphQL).
 *
 * @module commands/export
 * @requirements 23.6, 30.1, 30.2, 30.3, 30.4, 30.5, 30.6
 */

import * as vscode from 'vscode';
import type { FileURI, FileExtraction, ModuleSchema } from '../types/index.js';
import { extractSymbols } from '../core/extractor/lsp.js';
import { generateModuleSchema, generateWorkspaceSchema } from '../core/schema/generator.js';
import { loadConfig, getDefault } from '../state/config.js';

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

/**
 * Writes content to a file.
 */
async function writeFile(uri: vscode.Uri, content: string): Promise<void> {
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
}

// ============================================================
// Export Functions
// ============================================================

/**
 * Generates LSIF index from workspace schemas.
 */
function generateLSIF(
    moduleSchemas: Map<string, ModuleSchema>
): string {
    const lines: string[] = [];
    let id = 1;

    // LSIF header
    lines.push(JSON.stringify({ id: id++, type: 'vertex', label: 'metaData', version: '0.4.0' }));

    // Project vertex
    const projectId = id++;
    lines.push(JSON.stringify({ id: projectId, type: 'vertex', label: 'project', kind: 'typescript' }));

    // Document and symbol vertices for each module
    for (const [path, schema] of moduleSchemas) {
        const docId = id++;
        lines.push(JSON.stringify({
            id: docId,
            type: 'vertex',
            label: 'document',
            uri: `file://${path}`,
            languageId: 'typescript',
        }));

        // Symbol vertices
        for (const symbolSchema of Object.values(schema.definitions)) {
            const rangeId = id++;
            lines.push(JSON.stringify({
                id: rangeId,
                type: 'vertex',
                label: 'range',
                start: symbolSchema.source.range.start,
                end: symbolSchema.source.range.end,
            }));

            if (symbolSchema.description) {
                const hoverId = id++;
                lines.push(JSON.stringify({
                    id: hoverId,
                    type: 'vertex',
                    label: 'hoverResult',
                    result: { contents: [{ language: 'markdown', value: symbolSchema.description }] },
                }));
            }
        }
    }

    return lines.join('\n');
}

/**
 * Generates OpenAPI spec from workspace schemas.
 */
function generateOpenAPI(
    moduleSchemas: Map<string, ModuleSchema>,
    config: { title: string; version: string }
): string {
    const spec = {
        openapi: '3.0.0',
        info: {
            title: config.title,
            version: config.version,
        },
        paths: {} as Record<string, unknown>,
        components: {
            schemas: {} as Record<string, unknown>,
        },
    };

    // Convert type schemas to OpenAPI schemas
    for (const schema of moduleSchemas.values()) {
        for (const [name, symbolSchema] of Object.entries(schema.definitions)) {
            if (symbolSchema.kind === 'interface' || symbolSchema.kind === 'type') {
                spec.components.schemas[name] = {
                    type: 'object',
                    description: symbolSchema.description,
                };
            }
        }
    }

    return JSON.stringify(spec, null, 2);
}

// ============================================================
// Commands
// ============================================================

/**
 * Exports LSIF index for the workspace.
 */
export async function exportLSIFCommand(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting LSIF Index',
            cancellable: true,
        },
        async (progress, token) => {
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js}',
                '**/node_modules/**'
            );

            const moduleSchemas = new Map<string, ModuleSchema>();

            for (const file of files) {
                if (token.isCancellationRequested) break;
                progress.report({ message: `Processing ${file.fsPath}` });

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
                    const schema = generateModuleSchema(extraction);
                    moduleSchemas.set(schema.path, schema);
                }
            }

            const lsif = generateLSIF(moduleSchemas);
            const outputUri = vscode.Uri.joinPath(folder.uri, '.gendocs', 'index.lsif');
            await writeFile(outputUri, lsif);

            vscode.window.showInformationMessage(`LSIF index exported to ${outputUri.fsPath}`);
        }
    );
}

/**
 * Exports OpenAPI spec for the workspace.
 */
export async function exportOpenAPICommand(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const configResult = await loadConfig(folder);
    const config = configResult.ok ? configResult.value : getDefault();
    const openApiConfig = config.export?.openapi ?? { title: 'API', version: '1.0.0' };

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting OpenAPI Spec',
            cancellable: true,
        },
        async (progress, token) => {
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js}',
                '**/node_modules/**'
            );

            const moduleSchemas = new Map<string, ModuleSchema>();

            for (const file of files) {
                if (token.isCancellationRequested) break;
                progress.report({ message: `Processing ${file.fsPath}` });

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
                    const schema = generateModuleSchema(extraction);
                    moduleSchemas.set(schema.path, schema);
                }
            }

            const openapi = generateOpenAPI(moduleSchemas, openApiConfig);
            const outputUri = vscode.Uri.joinPath(folder.uri, '.gendocs', 'openapi.json');
            await writeFile(outputUri, openapi);

            vscode.window.showInformationMessage(`OpenAPI spec exported to ${outputUri.fsPath}`);
        }
    );
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers export commands.
 */
export function registerExportCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('gendocs.exportLSIF', exportLSIFCommand),
        vscode.commands.registerCommand('gendocs.exportOpenAPI', exportOpenAPICommand)
    );
}

// Suppress unused variable warning
void generateWorkspaceSchema;
