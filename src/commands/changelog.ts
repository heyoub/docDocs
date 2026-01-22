/**
 * @fileoverview Changelog commands for GenDocs extension.
 * Provides VS Code commands for snapshot management and changelog generation.
 *
 * @module commands/changelog
 */

import * as vscode from 'vscode';
import type { FileURI } from '../types/index.js';
import type {
    APISnapshot,
    ModuleAPISnapshot,
    ExportedSymbol
} from '../types/changelog.js';
import {
    createSnapshot,
    loadSnapshot,
    listSnapshots,
    getLatestSnapshot,
    restoreIndex,
    createModuleSnapshot
} from '../state/snapshots.js';
import { extractSymbols } from '../core/extractor/lsp.js';
import { extractExports } from '../core/extractor/exports.js';
import { generateModuleSchema } from '../core/schema/generator.js';
import { computeDiff } from '../core/changelog/diff.js';
import { renderChangelog } from '../core/changelog/renderer.js';
import { loadConfig, getDefault } from '../state/config.js';
// contentHash is used internally by createModuleSnapshot

// ============================================================
// Snapshot Creation
// ============================================================

/**
 * Creates an API snapshot of the current workspace.
 * Prompts for an optional version tag.
 */
export async function createSnapshotCommand(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    const folder = folders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspaceUri = folder.uri.toString() as FileURI;

    // Prompt for tag
    const tag = await vscode.window.showInputBox({
        prompt: 'Enter a version tag for this snapshot (optional)',
        placeHolder: 'e.g., v1.0.0',
        validateInput: (value) => {
            if (value && !/^[a-zA-Z0-9._-]+$/.test(value)) {
                return 'Tag can only contain letters, numbers, dots, underscores, and hyphens';
            }
            return null;
        }
    });

    // User cancelled
    if (tag === undefined) {
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Creating API Snapshot',
            cancellable: true
        },
        async (progress, token) => {
            progress.report({ message: 'Finding source files...' });

            // Find all source files
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/*.{ts,js,tsx,jsx,py,rs,go,hs}'),
                '**/node_modules/**'
            );

            if (token.isCancellationRequested) return;

            const moduleSnapshots: ModuleAPISnapshot[] = [];
            let processed = 0;

            for (const file of files) {
                if (token.isCancellationRequested) break;

                progress.report({
                    message: `Processing ${file.fsPath}`,
                    increment: (1 / files.length) * 100
                });

                try {
                    const moduleSnapshot = await createModuleSnapshotForFile(file, folder);
                    if (moduleSnapshot && moduleSnapshot.exports.length > 0) {
                        moduleSnapshots.push(moduleSnapshot);
                    }
                } catch (e) {
                    // Skip files that fail to process
                    console.warn(`Failed to process ${file.fsPath}:`, e);
                }

                processed++;
            }

            if (token.isCancellationRequested) return;

            progress.report({ message: 'Saving snapshot...' });

            const result = await createSnapshot(
                workspaceUri,
                moduleSnapshots,
                tag.length > 0 ? tag : undefined
            );

            if (result.ok) {
                const tagInfo = tag.length > 0 ? ` (${tag})` : '';
                vscode.window.showInformationMessage(
                    `Snapshot created${tagInfo} with ${moduleSnapshots.length} modules and ${result.value.statistics.totalExports} exports`
                );
            } else {
                vscode.window.showErrorMessage(`Failed to create snapshot: ${result.error.message}`);
            }
        }
    );
}

/**
 * Creates a module snapshot for a single file.
 */
async function createModuleSnapshotForFile(
    file: vscode.Uri,
    folder: vscode.WorkspaceFolder
): Promise<ModuleAPISnapshot | null> {
    // Extract symbols
    const symbolsResult = await extractSymbols(file);
    if (!symbolsResult.ok) {
        return null;
    }

    // Extract exports
    const exportsResult = await extractExports(file, symbolsResult.value);
    if (!exportsResult.ok) {
        return null;
    }

    // Generate schema for exported symbols
    const exportedSymbols: ExportedSymbol[] = [];

    for (const exp of exportsResult.value) {
        // Find the symbol that matches this export
        const symbol = symbolsResult.value.find(s => s.name === exp.name);

        // Generate schema if symbol found
        let symbolSchema = null;
        if (symbol) {
            const extraction = {
                uri: file.toString() as FileURI,
                languageId: getLanguageId(file),
                symbols: [symbol],
                imports: [],
                exports: [exp],
                method: 'lsp' as const,
                timestamp: Date.now()
            };
            const moduleSchema = generateModuleSchema(extraction);
            symbolSchema = moduleSchema.definitions[symbol.name] ?? null;
        }

        exportedSymbols.push({
            name: exp.name,
            exportInfo: exp,
            symbol: symbolSchema
        });
    }

    // Get file content for hash
    const doc = await vscode.workspace.openTextDocument(file);
    const content = doc.getText();

    // Get relative path from the specific workspace folder (important for multi-root workspaces)
    const folderPath = folder.uri.fsPath;
    const filePath = file.fsPath;
    const relativePath = filePath.startsWith(folderPath)
        ? filePath.slice(folderPath.length + 1) // +1 for path separator
        : vscode.workspace.asRelativePath(file, false); // Fallback

    return createModuleSnapshot(relativePath, exportedSymbols, content);
}

/**
 * Gets language ID from file extension.
 */
function getLanguageId(uri: vscode.Uri): string {
    const ext = uri.fsPath.split('.').pop() ?? '';
    const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescriptreact',
        js: 'javascript', jsx: 'javascriptreact',
        py: 'python', rs: 'rust', go: 'go', hs: 'haskell'
    };
    return langMap[ext] ?? ext;
}

// ============================================================
// Snapshot Listing
// ============================================================

/**
 * Lists all snapshots and allows selection.
 */
export async function listSnapshotsCommand(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    const folder = folders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspaceUri = folder.uri.toString() as FileURI;

    // Restore index if needed
    await restoreIndex(workspaceUri);

    const snapshots = listSnapshots(workspaceUri);

    if (snapshots.length === 0) {
        vscode.window.showInformationMessage('No snapshots found. Create one with "DocDocs: Create Snapshot"');
        return;
    }

    // Create quick pick items
    const items: vscode.QuickPickItem[] = snapshots.map(s => ({
        label: s.tag ?? s.id,
        description: new Date(s.createdAt).toLocaleString(),
        detail: `${s.modulesCount} modules, ${s.exportsCount} exports`
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a snapshot to view details'
    });

    if (selected) {
        const snapshot = snapshots.find(s =>
            (s.tag ?? s.id) === selected.label
        );
        if (snapshot) {
            const result = await loadSnapshot(workspaceUri, snapshot.id);
            if (result.ok) {
                showSnapshotDetails(result.value);
            }
        }
    }
}

/**
 * Shows details of a snapshot in an output channel.
 */
function showSnapshotDetails(snapshot: APISnapshot): void {
    const channel = vscode.window.createOutputChannel('DocDocs Snapshot');
    channel.clear();
    channel.appendLine(`# Snapshot: ${snapshot.tag ?? snapshot.id}`);
    channel.appendLine(`Created: ${snapshot.createdAt}`);
    channel.appendLine(`Modules: ${snapshot.statistics.totalModules}`);
    channel.appendLine(`Exports: ${snapshot.statistics.totalExports}`);
    channel.appendLine(`Documented: ${snapshot.statistics.documentedExports}`);
    channel.appendLine('');
    channel.appendLine('## Modules:');
    for (const module of snapshot.modules) {
        channel.appendLine(`- ${module.path} (${module.exports.length} exports)`);
    }
    channel.show();
}

// ============================================================
// Snapshot Comparison
// ============================================================

/**
 * Compares two snapshots and shows the diff.
 */
export async function compareSnapshotsCommand(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    const folder = folders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspaceUri = folder.uri.toString() as FileURI;

    // Restore index if needed
    await restoreIndex(workspaceUri);

    const snapshots = listSnapshots(workspaceUri);

    if (snapshots.length < 2) {
        vscode.window.showInformationMessage('Need at least 2 snapshots to compare');
        return;
    }

    // Select "from" snapshot
    const fromItems: vscode.QuickPickItem[] = snapshots.map(s => ({
        label: s.tag ?? s.id,
        description: new Date(s.createdAt).toLocaleString()
    }));

    const fromSelected = await vscode.window.showQuickPick(fromItems, {
        placeHolder: 'Select the OLDER snapshot (from)'
    });

    if (!fromSelected) return;

    // Select "to" snapshot
    const toItems = fromItems.filter(i => i.label !== fromSelected.label);
    const toSelected = await vscode.window.showQuickPick(toItems, {
        placeHolder: 'Select the NEWER snapshot (to)'
    });

    if (!toSelected) return;

    // Load snapshots
    const fromEntry = snapshots.find(s => (s.tag ?? s.id) === fromSelected.label);
    const toEntry = snapshots.find(s => (s.tag ?? s.id) === toSelected.label);

    if (!fromEntry || !toEntry) {
        vscode.window.showErrorMessage('Failed to find selected snapshots');
        return;
    }

    const fromResult = await loadSnapshot(workspaceUri, fromEntry.id);
    const toResult = await loadSnapshot(workspaceUri, toEntry.id);

    if (!fromResult.ok || !toResult.ok) {
        vscode.window.showErrorMessage('Failed to load snapshots');
        return;
    }

    // Compute diff
    const diff = computeDiff(fromResult.value, toResult.value);

    // Load config for harsh mode setting
    const configResult = await loadConfig(folder);
    const config = configResult.ok ? configResult.value : getDefault();
    const harshMode = config.changelog.harshMode;

    // Render changelog
    const changelog = renderChangelog(diff, { harshMode });

    // Show in output channel
    const channel = vscode.window.createOutputChannel('DocDocs Changelog');
    channel.clear();
    channel.appendLine(changelog.markdown);
    channel.show();
}

// ============================================================
// Generate Changelog (Latest vs Current)
// ============================================================

/**
 * Generates a changelog comparing the latest snapshot to current state.
 */
export async function generateChangelogCommand(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    const folder = folders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspaceUri = folder.uri.toString() as FileURI;

    // Restore index if needed
    await restoreIndex(workspaceUri);

    // Get latest snapshot
    const latestResult = await getLatestSnapshot(workspaceUri);
    if (!latestResult.ok) {
        vscode.window.showErrorMessage(`Failed to load latest snapshot: ${latestResult.error.message}`);
        return;
    }

    if (!latestResult.value) {
        vscode.window.showInformationMessage('No snapshots found. Create one first with "DocDocs: Create Snapshot"');
        return;
    }

    const fromSnapshot = latestResult.value;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating Changelog',
            cancellable: true
        },
        async (progress, token) => {
            progress.report({ message: 'Creating current state snapshot...' });

            // Create a temporary snapshot of current state
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/*.{ts,js,tsx,jsx,py,rs,go,hs}'),
                '**/node_modules/**'
            );

            const moduleSnapshots: ModuleAPISnapshot[] = [];

            for (const file of files) {
                if (token.isCancellationRequested) return;

                try {
                    const moduleSnapshot = await createModuleSnapshotForFile(file, folder);
                    if (moduleSnapshot && moduleSnapshot.exports.length > 0) {
                        moduleSnapshots.push(moduleSnapshot);
                    }
                } catch (e) {
                    // Skip files that fail
                }
            }

            // Create temporary "current" snapshot (not persisted)
            const currentSnapshot: APISnapshot = {
                id: 'current',
                tag: 'current',
                createdAt: new Date().toISOString(),
                workspaceUri,
                modules: moduleSnapshots,
                statistics: {
                    totalModules: moduleSnapshots.length,
                    totalExports: moduleSnapshots.reduce((sum, m) => sum + m.exports.length, 0),
                    documentedExports: moduleSnapshots.reduce((sum, m) =>
                        sum + m.exports.filter(e => e.symbol?.description).length, 0
                    )
                }
            };

            progress.report({ message: 'Computing diff...' });

            // Compute diff
            const diff = computeDiff(fromSnapshot, currentSnapshot);

            // Load config
            const configResult = await loadConfig(folder);
            const config = configResult.ok ? configResult.value : getDefault();
            const harshMode = config.changelog.harshMode;

            // Render changelog
            const changelog = renderChangelog(diff, { harshMode });

            // Show result
            if (diff.summary.totalChanges === 0) {
                vscode.window.showInformationMessage('No changes detected since last snapshot');
                return;
            }

            // Show in output channel
            const channel = vscode.window.createOutputChannel('DocDocs Changelog');
            channel.clear();
            channel.appendLine(changelog.markdown);
            channel.show();

            // Also offer to save
            const save = await vscode.window.showInformationMessage(
                `Changelog generated: ${diff.summary.totalChanges} changes, recommended bump: ${diff.recommendedBump.toUpperCase()}`,
                'Save to File',
                'Close'
            );

            if (save === 'Save to File') {
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.joinPath(folder.uri, 'CHANGELOG.md'),
                    filters: { 'Markdown': ['md'] }
                });

                if (saveUri) {
                    await vscode.workspace.fs.writeFile(
                        saveUri,
                        new TextEncoder().encode(changelog.markdown)
                    );
                    vscode.window.showInformationMessage(`Changelog saved to ${saveUri.fsPath}`);
                }
            }
        }
    );
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers all changelog commands.
 *
 * @param context - The extension context
 */
export function registerChangelogCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('docdocs.createSnapshot', createSnapshotCommand),
        vscode.commands.registerCommand('docdocs.listSnapshots', listSnapshotsCommand),
        vscode.commands.registerCommand('docdocs.compareSnapshots', compareSnapshotsCommand),
        vscode.commands.registerCommand('docdocs.generateChangelog', generateChangelogCommand)
    );
}
