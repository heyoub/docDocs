/**
 * @fileoverview Preview documentation command for GenDocs extension.
 * Opens a live preview webview for the current file's documentation.
 *
 * @module commands/preview
 * @requirements 6.5, 9.1
 */

import * as vscode from 'vscode';
import type { FileURI, FileExtraction, ModuleSchema } from '../types/index.js';
import { extractSymbols } from '../core/extractor/lsp.js';
import { generateModuleSchema } from '../core/schema/generator.js';
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

/**
 * Generates schema for a file.
 */
async function generateSchema(uri: vscode.Uri): Promise<ModuleSchema | null> {
    const symbolsResult = await extractSymbols(uri);
    if (!symbolsResult.ok) {
        return null;
    }

    const extraction: FileExtraction = {
        uri: uri.toString() as FileURI,
        languageId: getLanguageId(uri),
        symbols: symbolsResult.value,
        imports: [],
        exports: [],
        method: 'lsp',
        timestamp: Date.now(),
    };

    return generateModuleSchema(extraction);
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

    const schema = await generateSchema(targetUri);
    if (!schema) {
        vscode.window.showErrorMessage('Failed to generate documentation preview');
        return;
    }

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
        vscode.commands.registerCommand('gendocs.previewDocumentation', previewDocumentationCommand)
    );

    // Dispose preview manager on deactivation
    context.subscriptions.push({
        dispose: () => {
            previewManager?.dispose();
            previewManager = null;
        },
    });
}
