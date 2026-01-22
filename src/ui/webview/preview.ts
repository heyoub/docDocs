/**
 * @fileoverview Documentation preview webview for GenDocs extension.
 * Renders documentation as formatted Markdown with live updates.
 *
 * @module ui/webview/preview
 * @requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import * as vscode from 'vscode';
import type { FileURI, ModuleSchema } from '../../types/index.js';
import { renderModule } from '../../core/renderer/markdown.js';

// ============================================================
// Constants
// ============================================================

/** View type for the preview panel */
const VIEW_TYPE = 'gendocs.preview';

/** Debounce delay for auto-updates (ms) */
const UPDATE_DEBOUNCE_MS = 500;

// ============================================================
// Types
// ============================================================

type ViewMode = 'markdown' | 'json';

// ============================================================
// Preview Panel Manager
// ============================================================

/**
 * Manages the documentation preview webview panel.
 */
export class PreviewPanelManager {
    private panel: vscode.WebviewPanel | null = null;
    private currentUri: FileURI | null = null;
    private currentSchema: ModuleSchema | null = null;
    private viewMode: ViewMode = 'markdown';
    private updateTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Shows the preview panel for a module.
     */
    show(uri: FileURI, schema: ModuleSchema): void {
        this.currentUri = uri;
        this.currentSchema = schema;

        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = this.createPanel();
        }

        this.updateContent();
    }

    /**
     * Updates the preview with new schema data (debounced).
     */
    update(uri: FileURI, schema: ModuleSchema): void {
        if (this.currentUri !== uri) return;

        this.currentSchema = schema;

        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(() => {
            this.updateContent();
        }, UPDATE_DEBOUNCE_MS);
    }

    /**
     * Toggles between Markdown and JSON view modes.
     */
    toggleViewMode(): void {
        this.viewMode = this.viewMode === 'markdown' ? 'json' : 'markdown';
        this.updateContent();
    }

    /**
     * Disposes of the preview panel.
     */
    dispose(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.panel?.dispose();
        this.panel = null;
    }

    private createPanel(): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            VIEW_TYPE,
            'Documentation Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        panel.onDidDispose(() => {
            this.panel = null;
        });

        panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));

        return panel;
    }

    private handleMessage(message: { command: string }): void {
        switch (message.command) {
            case 'toggleView':
                this.toggleViewMode();
                break;
            case 'copy':
                this.copyToClipboard();
                break;
        }
    }

    private async copyToClipboard(): Promise<void> {
        if (!this.currentSchema) return;

        const content = this.viewMode === 'markdown'
            ? renderModule(this.currentSchema)
            : JSON.stringify(this.currentSchema, null, 2);

        await vscode.env.clipboard.writeText(content);
        vscode.window.showInformationMessage('Documentation copied to clipboard');
    }

    private updateContent(): void {
        if (!this.panel || !this.currentSchema) return;

        const content = this.viewMode === 'markdown'
            ? this.renderMarkdownView()
            : this.renderJsonView();

        this.panel.webview.html = this.getHtml(content);
    }

    private renderMarkdownView(): string {
        if (!this.currentSchema) return '';
        return renderModule(this.currentSchema);
    }

    private renderJsonView(): string {
        if (!this.currentSchema) return '';
        return JSON.stringify(this.currentSchema, null, 2);
    }

    private getHtml(content: string): string {
        const isJson = this.viewMode === 'json';
        const toggleLabel = isJson ? 'View Markdown' : 'View JSON';
        const contentHtml = isJson
            ? `<pre><code>${escapeHtml(content)}</code></pre>`
            : `<div class="markdown">${content}</div>`;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation Preview</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 16px; }
        .toolbar { margin-bottom: 16px; }
        button { margin-right: 8px; }
        pre { background: var(--vscode-textBlockQuote-background); padding: 16px; overflow: auto; }
        code { font-family: var(--vscode-editor-font-family); }
        .markdown h1 { border-bottom: 1px solid var(--vscode-panel-border); }
        .markdown h2 { margin-top: 24px; }
        .markdown code { background: var(--vscode-textBlockQuote-background); padding: 2px 4px; }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="toggleView()">${toggleLabel}</button>
        <button onclick="copyContent()">Copy to Clipboard</button>
    </div>
    ${contentHtml}
    <script>
        const vscode = acquireVsCodeApi();
        function toggleView() { vscode.postMessage({ command: 'toggleView' }); }
        function copyContent() { vscode.postMessage({ command: 'copy' }); }
    </script>
</body>
</html>`;
    }
}

// ============================================================
// Utilities
// ============================================================

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================
// Registration
// ============================================================

/**
 * Creates and registers the preview panel manager.
 */
export function registerPreviewPanel(context: vscode.ExtensionContext): PreviewPanelManager {
    const manager = new PreviewPanelManager();
    context.subscriptions.push({ dispose: () => manager.dispose() });
    return manager;
}
