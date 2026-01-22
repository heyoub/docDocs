/**
 * @fileoverview Status bar integration for GenDocs extension.
 * Displays documentation freshness status in the VS Code status bar.
 *
 * @module ui/statusBar
 * @requirements 10.1, 10.2, 10.3, 10.4, 10.5, 31.5
 */

import * as vscode from 'vscode';

// ============================================================
// Constants
// ============================================================

/** Configuration key for status bar visibility */
const CONFIG_STATUSBAR_VISIBLE = 'gendocs.statusBar.visible';

/** Configuration key for warning threshold */
const CONFIG_WARNING_THRESHOLD = 'gendocs.statusBar.warningThreshold';

/** Default warning threshold (percentage) */
const DEFAULT_WARNING_THRESHOLD = 80;

// ============================================================
// Status Bar Manager
// ============================================================

/**
 * Manages the GenDocs status bar item.
 * Shows documentation freshness and watch mode status.
 */
export class StatusBarManager {
    private readonly item: vscode.StatusBarItem;
    private freshCount = 0;
    private totalCount = 0;
    private isWatching = false;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.item.command = 'gendocs.openDocExplorer';
        this.item.tooltip = 'Click to open Doc Explorer';
        this.update();
    }

    /**
     * Updates the freshness counts.
     */
    setFreshness(fresh: number, total: number): void {
        this.freshCount = fresh;
        this.totalCount = total;
        this.update();
    }

    /**
     * Sets the watch mode status.
     */
    setWatching(watching: boolean): void {
        this.isWatching = watching;
        this.update();
    }

    /**
     * Shows the status bar item.
     */
    show(): void {
        const config = vscode.workspace.getConfiguration();
        const visible = config.get<boolean>(CONFIG_STATUSBAR_VISIBLE, true);
        if (visible) {
            this.item.show();
        }
    }

    /**
     * Hides the status bar item.
     */
    hide(): void {
        this.item.hide();
    }

    /**
     * Disposes of the status bar item.
     */
    dispose(): void {
        this.item.dispose();
    }

    private update(): void {
        const watchIcon = this.isWatching ? '$(eye) ' : '';
        this.item.text = `${watchIcon}$(book) Docs: ${this.freshCount}/${this.totalCount} fresh`;

        // Check threshold for warning color
        const config = vscode.workspace.getConfiguration();
        const threshold = config.get<number>(CONFIG_WARNING_THRESHOLD, DEFAULT_WARNING_THRESHOLD);
        const percentage = this.totalCount > 0 ? (this.freshCount / this.totalCount) * 100 : 100;

        if (percentage < threshold) {
            this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.item.backgroundColor = undefined;
        }
    }
}

// ============================================================
// Registration
// ============================================================

/**
 * Creates and registers the status bar manager.
 */
export function registerStatusBar(context: vscode.ExtensionContext): StatusBarManager {
    const manager = new StatusBarManager();
    manager.show();
    context.subscriptions.push(manager);
    return manager;
}
