/**
 * @fileoverview docDocs extension entry point.
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
import { registerExportCommands, setDiagnosticsManager as setExportDiagnosticsManager } from './commands/export.js';
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
import { restore as restoreFreshness, persist as persistFreshness, checkFreshness, getStore } from './state/freshness.js';
import { contentHash } from './utils/hash.js';
import type { FileURI } from './types/index.js';
import type { FreshnessError } from './state/freshness.js';
import { restoreIndex as restoreSnapshots } from './state/snapshots.js';
import { resolveWatchConfig } from './state/config.js';
import { generateForFileFromWatch } from './commands/generate.js';

// Providers (CodeLens diagnostic wiring)
import { registerCodeLensDiagnostics } from './providers/codeLens.js';

// ============================================================
// Module State
// ============================================================

let outputChannel: vscode.OutputChannel | undefined;

function formatFreshnessPersistError(error: FreshnessError): string {
    switch (error.type) {
        case 'io':
        case 'parse':
        case 'validation':
            return error.message;
    }
}

async function persistFreshnessWithFeedback(workspaceUri: import('./types/index.js').FileURI): Promise<void> {
    const result = await persistFreshness(workspaceUri);
    if (result.ok) return;

    const message = formatFreshnessPersistError(result.error);
    console.warn(`[docDocs] ${message}`);
    outputChannel ??= vscode.window.createOutputChannel('docDocs');
    outputChannel.appendLine(`[docDocs] ${message}`);
    outputChannel.show(true);
}

// ============================================================
// Extension Activation
// ============================================================

/**
 * Activates the docDocs extension.
 * Called when the extension is first activated.
 *
 * @param context - The VS Code extension context
 * @returns A promise that resolves when activation is complete
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const channel = vscode.window.createOutputChannel('docDocs');
    outputChannel = channel;
    const log = (msg: string) => {
        const line = `[docDocs] ${msg}`;
        channel.appendLine(line);
        console.log(line);
    };
    log('activating...');

    try {
        // Restore persisted state for each workspace folder
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            const firstFolder = folders[0];
            if (firstFolder) {
                const workspaceUri = firstFolder.uri.toString() as import('./types/index.js').FileURI;
                await restoreFreshness(workspaceUri);
                await restoreSnapshots(workspaceUri);
            }
        } else {
            log('No workspace folder open — open a folder for full features (File → Open Folder).');
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

        // Connect diagnostics manager to lint, export, and CodeLens extraction failures
        setDiagnosticsManager(diagnosticsManager);
        setExportDiagnosticsManager(diagnosticsManager);
        registerCodeLensDiagnostics(
            (uri, message) => diagnosticsManager.reportExtractionFailure(uri, message),
            (uri) => diagnosticsManager.clearFile(uri)
        );

        // Register UI components
        const docExplorer = registerDocExplorer(context);
        const statusBar = registerStatusBar(context);
        registerPreviewPanel(context);
        registerGraphPanel(context);

        // Register webview providers (React-based UI)
        registerSidebarProvider(context);
        registerDashboardProvider(context);
        registerOnboardingProvider(context);

        // Register additional commands and watch mode
        const watchController = createWatchController(statusBar);
        await watchController.syncFromConfig();
        registerUtilityCommands(context, watchController);
        setupFileWatchers(context, codeLensProvider, docExplorer, statusBar, watchController);
        context.subscriptions.push(watchController);

        // Persist state on deactivation
        context.subscriptions.push({
            dispose: async () => {
                const folders = vscode.workspace.workspaceFolders;
                const firstFolder = folders?.[0];
                if (firstFolder) {
                    const workspaceUri = firstFolder.uri.toString() as import('./types/index.js').FileURI;
                    await persistFreshnessWithFeedback(workspaceUri);
                }
            },
        });

        log('activated');
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        log(`activation failed: ${message}`);
        if (stack) outputChannel.appendLine(stack);
        outputChannel.show();
        void vscode.window.showErrorMessage(
            `docDocs failed to activate: ${message}. See Output → docDocs for details.`
        );
        throw err;
    }
}

/**
 * Deactivates the docDocs extension.
 * Called when the extension is deactivated.
 *
 * @returns void
 */
export async function deactivate(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    const firstFolder = folders?.[0];
    if (firstFolder) {
        const workspaceUri = firstFolder.uri.toString() as import('./types/index.js').FileURI;
        await persistFreshnessWithFeedback(workspaceUri);
    }
    console.log('docDocs extension deactivated');
}

// ============================================================
// Watch Mode
// ============================================================

/** Glob for source files monitored by watch mode */
const WATCH_FILE_GLOB = '**/*.{ts,js,py,rs,go,hs}';

/** Exclude patterns for watch-triggered regeneration */
const WATCH_EXCLUDE = /node_modules|\.docdocs|dist\/|build\//;

interface WatchController extends vscode.Disposable {
    readonly isEnabled: () => boolean;
    syncFromConfig: () => Promise<void>;
    toggle: () => Promise<void>;
    scheduleRegenerate: (uri: vscode.Uri) => void;
    cancelPending: () => void;
}

/**
 * Creates watch-mode state backed by VS Code workspace settings and `.docdocs.json`.
 */
function createWatchController(
    statusBar: ReturnType<typeof registerStatusBar>
): WatchController {
    let enabled = false;
    const regenerateTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const syncFromConfig = async (): Promise<void> => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            enabled = false;
            statusBar.setWatching(false);
            return;
        }
        const watch = await resolveWatchConfig(folder);
        enabled = watch.enabled;
        statusBar.setWatching(enabled);
    };

    const cancelPending = (): void => {
        for (const timer of regenerateTimers.values()) {
            clearTimeout(timer);
        }
        regenerateTimers.clear();
    };

    const scheduleRegenerate = (uri: vscode.Uri): void => {
        if (!enabled) return;
        if (WATCH_EXCLUDE.test(uri.fsPath)) return;

        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (!folder) return;

        void resolveWatchConfig(folder).then((watch) => {
            if (!watch.enabled || !watch.autoRegenerate) return;

            const key = uri.toString();
            const existing = regenerateTimers.get(key);
            if (existing !== undefined) clearTimeout(existing);

            regenerateTimers.set(
                key,
                setTimeout(() => {
                    regenerateTimers.delete(key);
                    void generateForFileFromWatch(uri);
                }, watch.debounceMs)
            );
        });
    };

    const toggle = async (): Promise<void> => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            void vscode.window.showWarningMessage('Open a workspace folder to use watch mode');
            return;
        }

        const watch = await resolveWatchConfig(folder);
        const next = !watch.enabled;
        const vscodeConfig = vscode.workspace.getConfiguration('docdocs', folder.uri);
        await vscodeConfig.update('watch.enabled', next, vscode.ConfigurationTarget.Workspace);
        enabled = next;
        statusBar.setWatching(next);
        if (!next) cancelPending();
        void vscode.window.showInformationMessage(
            next ? 'Watch mode enabled' : 'Watch mode disabled'
        );
    };

    return {
        isEnabled: () => enabled,
        syncFromConfig,
        toggle,
        scheduleRegenerate,
        cancelPending,
        dispose: cancelPending,
    };
}

// ============================================================
// Utility Commands
// ============================================================

/**
 * Registers utility commands for UI interaction.
 */
function registerUtilityCommands(
    context: vscode.ExtensionContext,
    watchController: WatchController
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('docdocs.openExplorer', () => {
            vscode.commands.executeCommand('workbench.view.extension.docdocs');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('docdocs.openDocumentation', async (uri: string) => {
            const docUri = vscode.Uri.parse(uri);
            await vscode.commands.executeCommand('docdocs.preview', docUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('docdocs.toggleWatch', () => watchController.toggle())
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

/** Debounce delay for explorer/freshness refresh on file events (ms) */
const UI_REFRESH_DEBOUNCE_MS = 300;

// ============================================================
// File Watchers
// ============================================================

/**
 * Sets up file watchers for UI refresh and watch-mode auto-regeneration.
 */
function setupFileWatchers(
    context: vscode.ExtensionContext,
    codeLensProvider: ReturnType<typeof registerCodeLensProvider>,
    docExplorer: ReturnType<typeof registerDocExplorer>,
    statusBar: ReturnType<typeof registerStatusBar>,
    watchController: WatchController
): void {
    const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('docdocs.watch')) {
            void watchController.syncFromConfig();
        }
    });

    const saveWatcher = vscode.workspace.onDidSaveTextDocument((doc) => {
        codeLensProvider.refresh();
        updateFreshnessStatus(statusBar);
        watchController.scheduleRegenerate(doc.uri);
    });

    const fileWatcher = vscode.workspace.createFileSystemWatcher(WATCH_FILE_GLOB);
    const debouncedUiRefresh = debounce(() => {
        docExplorer.refresh();
        updateFreshnessStatus(statusBar);
    }, UI_REFRESH_DEBOUNCE_MS);

    const onFileEvent = (uri: vscode.Uri): void => {
        debouncedUiRefresh();
        watchController.scheduleRegenerate(uri);
    };

    fileWatcher.onDidChange(onFileEvent);
    fileWatcher.onDidCreate(onFileEvent);
    fileWatcher.onDidDelete(onFileEvent);

    context.subscriptions.push(configWatcher, saveWatcher, fileWatcher);

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

    const MAX_TRACKED_SAMPLE = 100;

    try {
        const freshnessStore = getStore();
        const trackedUris = Object.keys(freshnessStore.files).slice(0, MAX_TRACKED_SAMPLE);

        if (trackedUris.length === 0) {
            statusBar.setFreshness(0, 0);
            return;
        }

        let freshCount = 0;
        let checkedCount = 0;

        for (const uriStr of trackedUris) {
            try {
                const fileUri = vscode.Uri.parse(uriStr);
                const content = await vscode.workspace.fs.readFile(fileUri);
                const text = new TextDecoder().decode(content);
                const hash = await contentHash(text);
                const status = checkFreshness(uriStr as FileURI, hash);

                checkedCount++;
                if (status.status === 'fresh') {
                    freshCount++;
                }
            } catch (readErr) {
                const message = readErr instanceof Error ? readErr.message : String(readErr);
                console.warn(`[docDocs] Freshness check skipped ${uriStr}: ${message}`);
            }
        }

        statusBar.setFreshness(freshCount, checkedCount);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[docDocs] Failed to update freshness status: ${message}`);
        statusBar.setFreshness(0, 0);
    }
}
