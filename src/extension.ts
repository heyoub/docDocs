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
import { registerSidebarProvider } from './ui/sidebarProvider.js';
import { registerDashboardProvider, registerOnboardingProvider } from './ui/dashboardProvider.js';

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

    // Register webview providers (React-based UI)
    registerSidebarProvider(context);
    registerDashboardProvider(context);
    registerOnboardingProvider(context);

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
        vscode.commands.registerCommand('docdocs.openExplorer', () => {
            vscode.commands.executeCommand('workbench.view.extension.docdocs');
        })
    );

    // Refresh Doc Explorer command
    context.subscriptions.push(
        vscode.commands.registerCommand('docdocs.refreshExplorer', () => {
            docExplorer.refresh();
            codeLensProvider.refresh();
        })
    );

    // Open documentation for a file
    context.subscriptions.push(
        vscode.commands.registerCommand('docdocs.openDocumentation', async (uri: string) => {
            const docUri = vscode.Uri.parse(uri);
            await vscode.commands.executeCommand('docdocs.preview', docUri);
        })
    );

    // Toggle watch mode
    let watchMode = false;
    context.subscriptions.push(
        vscode.commands.registerCommand('docdocs.toggleWatch', () => {
            watchMode = !watchMode;
            statusBar.setWatching(watchMode);
            vscode.window.showInformationMessage(
                watchMode ? 'Watch mode enabled' : 'Watch mode disabled'
            );
        })
    );
}

// ============================================================
// Debounce utility
// ============================================================

/**
 * Debounces a function so it is invoked at most once per delay after repeated calls.
 *
 * @param fn - Function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function with cancel() to clear pending invocation
 */
function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delayMs: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const debounced = (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delayMs);
    };

    debounced.cancel = () => {
        clearTimeout(timeoutId);
        timeoutId = undefined;
    };

    return debounced;
}

/** Debounce delay for file watcher callbacks (ms) */
const FILE_WATCHER_DEBOUNCE_MS = 300;

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

    // Watch for file changes in workspace (debounced to avoid refresh storm)
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,py,rs,go,hs}');
    const debouncedRefresh = debounce(() => {
        docExplorer.refresh();
        updateFreshnessStatus(statusBar);
    }, FILE_WATCHER_DEBOUNCE_MS);

    fileWatcher.onDidChange(debouncedRefresh);
    fileWatcher.onDidCreate(debouncedRefresh);
    fileWatcher.onDidDelete(debouncedRefresh);

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
async function updateFreshnessStatus(statusBar: ReturnType<typeof registerStatusBar>): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        statusBar.setFreshness(0, 0);
        return;
    }

    try {
        const files = await vscode.workspace.findFiles(
            '**/*.{ts,js,py,rs,go,hs}',
            '**/node_modules/**',
            100 // Limit for performance
        );

        // Count documented files (those with entries in freshness store)
        const store = await import('./state/freshness.js');
        const freshnessStore = store.getStore();
        const totalTracked = Object.keys(freshnessStore.files).length;

        // Simple heuristic: files in store are "fresh", total files - tracked are "stale"
        const freshCount = totalTracked;
        const staleCount = Math.max(0, files.length - totalTracked);

        statusBar.setFreshness(freshCount, staleCount);
    } catch {
        statusBar.setFreshness(0, 0);
    }
}
