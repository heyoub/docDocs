/**
 * @fileoverview GenDocs extension entry point.
 * Registers all commands, providers, and UI components.
 *
 * @module extension
 * @requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 31.1, 31.2, 31.3, 31.4, 31.6
 */

import * as vscode from 'vscode';

// Commands
import { registerGenerateCommands } from './commands/generate.js';
import { registerPreviewCommands } from './commands/preview.js';
import { registerLintCommands, setDiagnosticsManager } from './commands/lint.js';
import { registerExportCommands } from './commands/export.js';
import { registerChangelogCommands } from './commands/changelog.js';

// Providers
import { registerCodeLensProvider } from './providers/codeLens.js';
import { registerCompletionProvider } from './providers/completion.js';
import { registerWorkspaceSymbolProvider } from './providers/symbols.js';
import { registerDiagnosticsManager } from './providers/diagnostics.js';

// UI Components
import { registerDocExplorer } from './ui/docExplorer.js';
import { registerStatusBar } from './ui/statusBar.js';
import { registerPreviewPanel } from './ui/webview/preview.js';
import { registerGraphPanel } from './ui/webview/graph.js';

// State
import { restore as restoreFreshness, persist as persistFreshness } from './state/freshness.js';
import { restoreIndex as restoreSnapshots } from './state/snapshots.js';

// ============================================================
// Extension Activation
// ============================================================

/**
 * Activates the GenDocs extension.
 * Called when the extension is first activated.
 *
 * @param context - The VS Code extension context
 * @returns A promise that resolves when activation is complete
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('GenDocs extension activating...');

    // Restore persisted state for each workspace folder
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        const firstFolder = folders[0];
        if (firstFolder) {
            const workspaceUri = firstFolder.uri.toString() as import('./types/index.js').FileURI;
            await restoreFreshness(workspaceUri);
            await restoreSnapshots(workspaceUri);
        }
    }

    // Register commands
    registerGenerateCommands(context);
    registerPreviewCommands(context);
    registerLintCommands(context);
    registerExportCommands(context);
    registerChangelogCommands(context);

    // Register providers
    const codeLensProvider = registerCodeLensProvider(context);
    registerCompletionProvider(context);
    registerWorkspaceSymbolProvider(context);
    const diagnosticsManager = registerDiagnosticsManager(context);

    // Connect diagnostics manager to lint commands
    setDiagnosticsManager(diagnosticsManager);

    // Register UI components
    const docExplorer = registerDocExplorer(context);
    const statusBar = registerStatusBar(context);
    registerPreviewPanel(context);
    registerGraphPanel(context);

    // Register additional commands
    registerUtilityCommands(context, codeLensProvider, docExplorer, statusBar);

    // Set up file watchers for watch mode
    setupFileWatchers(context, codeLensProvider, docExplorer, statusBar);

    // Persist state on deactivation
    context.subscriptions.push({
        dispose: async () => {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                const firstFolder = folders[0];
                if (firstFolder) {
                    const workspaceUri = firstFolder.uri.toString() as import('./types/index.js').FileURI;
                    await persistFreshness(workspaceUri);
                }
            }
        },
    });

    console.log('GenDocs extension activated');
}

/**
 * Deactivates the GenDocs extension.
 * Called when the extension is deactivated.
 *
 * @returns void
 */
export function deactivate(): void {
    console.log('GenDocs extension deactivated');
}

// ============================================================
// Utility Commands
// ============================================================

/**
 * Registers utility commands for UI interaction.
 *
 * @param context - The VS Code extension context
 * @param codeLensProvider - The CodeLens provider instance
 * @param docExplorer - The Doc Explorer tree view instance
 * @param statusBar - The status bar instance
 * @returns void
 */
function registerUtilityCommands(
    context: vscode.ExtensionContext,
    codeLensProvider: ReturnType<typeof registerCodeLensProvider>,
    docExplorer: ReturnType<typeof registerDocExplorer>,
    statusBar: ReturnType<typeof registerStatusBar>
): void {
    // Open Doc Explorer command
    context.subscriptions.push(
        vscode.commands.registerCommand('gendocs.openDocExplorer', () => {
            vscode.commands.executeCommand('workbench.view.extension.gendocs');
        })
    );

    // Refresh Doc Explorer command
    context.subscriptions.push(
        vscode.commands.registerCommand('gendocs.refreshDocExplorer', () => {
            docExplorer.refresh();
            codeLensProvider.refresh();
        })
    );

    // Open documentation for a file
    context.subscriptions.push(
        vscode.commands.registerCommand('gendocs.openDocumentation', async (uri: string) => {
            const docUri = vscode.Uri.parse(uri);
            await vscode.commands.executeCommand('gendocs.previewDocumentation', docUri);
        })
    );

    // Toggle watch mode
    let watchMode = false;
    context.subscriptions.push(
        vscode.commands.registerCommand('gendocs.toggleWatchMode', () => {
            watchMode = !watchMode;
            statusBar.setWatching(watchMode);
            vscode.window.showInformationMessage(
                watchMode ? 'Watch mode enabled' : 'Watch mode disabled'
            );
        })
    );
}

// ============================================================
// File Watchers
// ============================================================

/**
 * Sets up file watchers for automatic documentation updates.
 *
 * @param context - The VS Code extension context
 * @param codeLensProvider - The CodeLens provider instance
 * @param docExplorer - The Doc Explorer tree view instance
 * @param statusBar - The status bar instance
 * @returns void
 */
function setupFileWatchers(
    context: vscode.ExtensionContext,
    codeLensProvider: ReturnType<typeof registerCodeLensProvider>,
    docExplorer: ReturnType<typeof registerDocExplorer>,
    statusBar: ReturnType<typeof registerStatusBar>
): void {
    // Watch for file saves
    const saveWatcher = vscode.workspace.onDidSaveTextDocument(() => {
        // Refresh CodeLens for the saved file
        codeLensProvider.refresh();

        // Update status bar with current freshness
        updateFreshnessStatus(statusBar);
    });

    // Watch for file changes in workspace
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,py,rs,go,hs}');

    fileWatcher.onDidChange(() => {
        docExplorer.refresh();
        updateFreshnessStatus(statusBar);
    });

    fileWatcher.onDidCreate(() => {
        docExplorer.refresh();
        updateFreshnessStatus(statusBar);
    });

    fileWatcher.onDidDelete(() => {
        docExplorer.refresh();
        updateFreshnessStatus(statusBar);
    });

    context.subscriptions.push(saveWatcher, fileWatcher);

    // Initial status update
    updateFreshnessStatus(statusBar);
}

/**
 * Updates the status bar with current freshness counts.
 *
 * @param statusBar - The status bar instance to update
 * @returns void
 */
function updateFreshnessStatus(statusBar: ReturnType<typeof registerStatusBar>): void {
    // This would normally query the freshness tracker
    // For now, just show placeholder values
    statusBar.setFreshness(0, 0);
}
