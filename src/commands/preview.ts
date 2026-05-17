/**
 * @fileoverview Preview documentation command for docDocs extension.
 * Opens a live preview webview for the current file's documentation.
 *
 * @module commands/preview
 * @requirements 6.5, 9.1
 */

import * as vscode from 'vscode';
import type { FileURI } from '../types/index.js';
import { formatExtractionError } from '../types/index.js';
import { buildModuleSchema } from '../core/pipeline/buildModuleSchema.js';
import { PreviewPanelManager } from '../ui/webview/preview.js';

// ============================================================
// Preview Manager Instance
// ============================================================

let previewManager: PreviewPanelManager | null = null;

/**
 * Gets or creates the preview panel manager.
 */
function getPreviewManager(): PreviewPanelManager {
    if (!previewManager) {
        previewManager = new PreviewPanelManager();
    }
    return previewManager;
}

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

// ============================================================
// Commands
// ============================================================

/**
 * Opens a preview of the current file's documentation.
 */
export async function previewDocumentationCommand(uri?: vscode.Uri): Promise<void> {
    const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
        vscode.window.showErrorMessage('No file selected');
        return;
    }

    const schemaResult = await buildModuleSchema(targetUri, getLanguageId(targetUri));
    if (!schemaResult.ok) {
        vscode.window.showErrorMessage(formatExtractionError(schemaResult.error));
        return;
    }

    const schema = schemaResult.value;

    const fileUri = targetUri.toString() as FileURI;
    const manager = getPreviewManager();
    manager.show(fileUri, schema);
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers preview commands.
 */
export function registerPreviewCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('docdocs.preview', previewDocumentationCommand)
    );

    // Dispose preview manager on deactivation
    context.subscriptions.push({
        dispose: () => {
            previewManager?.dispose();
            previewManager = null;
        },
    });
}
