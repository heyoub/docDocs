/**
 * @fileoverview Watch-mode controller with injectable timers for testing.
 *
 * @module extension/watchController
 */

import * as vscode from 'vscode';
import { resolveWatchConfig } from '../state/config.js';
import { isWatchExcludedPath } from './watchPaths.js';

export interface WatchController extends vscode.Disposable {
    readonly isEnabled: () => boolean;
    syncFromConfig: () => Promise<void>;
    toggle: () => Promise<void>;
    scheduleRegenerate: (uri: vscode.Uri) => void;
    cancelPending: () => void;
    readonly pendingCount: () => number;
}

export interface WatchControllerDeps {
    readonly setTimeout: typeof setTimeout;
    readonly clearTimeout: typeof clearTimeout;
    readonly onRegenerate: (uri: vscode.Uri) => void | Promise<void>;
    readonly resolveWatchConfig: typeof resolveWatchConfig;
    readonly getWorkspaceFolder: (uri: vscode.Uri) => vscode.WorkspaceFolder | undefined;
    readonly getWorkspaceFolders: () => readonly vscode.WorkspaceFolder[] | undefined;
    readonly updateWatchEnabled: (folder: vscode.WorkspaceFolder, enabled: boolean) => Promise<void>;
    readonly setWatching: (enabled: boolean) => void;
    readonly showWarning: (message: string) => void;
    readonly showInformation: (message: string) => void;
}

const defaultDeps = (
    onRegenerate: (uri: vscode.Uri) => void | Promise<void>,
    statusBar: { setWatching: (enabled: boolean) => void }
): WatchControllerDeps => ({
    setTimeout,
    clearTimeout,
    onRegenerate,
    resolveWatchConfig,
    getWorkspaceFolder: (uri) => vscode.workspace.getWorkspaceFolder(uri),
    getWorkspaceFolders: () => vscode.workspace.workspaceFolders,
    updateWatchEnabled: async (folder, enabled) => {
        const vscodeConfig = vscode.workspace.getConfiguration('docdocs', folder.uri);
        await vscodeConfig.update('watch.enabled', enabled, vscode.ConfigurationTarget.Workspace);
    },
    setWatching: (enabled) => statusBar.setWatching(enabled),
    showWarning: (message) => {
        void vscode.window.showWarningMessage(message);
    },
    showInformation: (message) => {
        void vscode.window.showInformationMessage(message);
    },
});

/**
 * Creates watch-mode state backed by VS Code workspace settings and `.docdocs.json`.
 */
export function createWatchController(
    onRegenerate: (uri: vscode.Uri) => void | Promise<void>,
    statusBar: { setWatching: (enabled: boolean) => void },
    depsOverride?: Partial<WatchControllerDeps>
): WatchController {
    const deps: WatchControllerDeps = { ...defaultDeps(onRegenerate, statusBar), ...depsOverride };
    let enabled = false;
    const regenerateTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const syncFromConfig = async (): Promise<void> => {
        const folders = deps.getWorkspaceFolders();
        const folder = folders?.[0];
        if (!folder) {
            enabled = false;
            deps.setWatching(false);
            return;
        }
        const watch = await deps.resolveWatchConfig(folder);
        enabled = watch.enabled;
        deps.setWatching(enabled);
    };

    const cancelPending = (): void => {
        for (const timer of regenerateTimers.values()) {
            deps.clearTimeout(timer);
        }
        regenerateTimers.clear();
    };

    const scheduleRegenerate = (uri: vscode.Uri): void => {
        if (!enabled) return;
        if (isWatchExcludedPath(uri.fsPath)) return;

        const folder = deps.getWorkspaceFolder(uri);
        if (!folder) return;

        void deps.resolveWatchConfig(folder).then((watch) => {
            if (!watch.enabled || !watch.autoRegenerate) return;

            const key = uri.toString();
            const existing = regenerateTimers.get(key);
            if (existing !== undefined) deps.clearTimeout(existing);

            regenerateTimers.set(
                key,
                deps.setTimeout(() => {
                    regenerateTimers.delete(key);
                    void deps.onRegenerate(uri);
                }, watch.debounceMs)
            );
        });
    };

    const toggle = async (): Promise<void> => {
        const folders = deps.getWorkspaceFolders();
        const folder = folders?.[0];
        if (!folder) {
            deps.showWarning('Open a workspace folder to use watch mode');
            return;
        }

        const watch = await deps.resolveWatchConfig(folder);
        const next = !watch.enabled;
        await deps.updateWatchEnabled(folder, next);
        enabled = next;
        deps.setWatching(next);
        if (!next) cancelPending();
        deps.showInformation(next ? 'Watch mode enabled' : 'Watch mode disabled');
    };

    return {
        isEnabled: () => enabled,
        syncFromConfig,
        toggle,
        scheduleRegenerate,
        cancelPending,
        pendingCount: () => regenerateTimers.size,
        dispose: cancelPending,
    };
}
