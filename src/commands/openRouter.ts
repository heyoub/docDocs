/**
 * @fileoverview OpenRouter API key and model picker commands.
 *
 * @module commands/openRouter
 */

import * as vscode from 'vscode';
import {
    getOpenRouterApiKey,
    hasOpenRouterApiKey,
    setOpenRouterApiKey,
} from '../state/openRouterSecrets.js';
import { clearOpenRouterModelCache } from '../core/ml/openRouterModels.js';
import { listOpenRouterModelOptions } from '../core/ml/openRouterProse.js';
import { resetOpenRouterClient } from '../core/ml/openRouterClient.js';

/**
 * Prompts for an OpenRouter API key and stores it in SecretStorage.
 */
export async function configureOpenRouterApiKeyCommand(): Promise<void> {
    const existing = await getOpenRouterApiKey();
    const value = await vscode.window.showInputBox({
        title: 'OpenRouter API Key',
        prompt: 'Paste your API key from https://openrouter.ai/keys',
        password: true,
        ignoreFocusOut: true,
        value: existing ? '••••••••••••••••' : '',
    });

    if (value === undefined) {
        return;
    }

    if (value === '' || value === '••••••••••••••••') {
        await setOpenRouterApiKey(undefined);
        resetOpenRouterClient();
        clearOpenRouterModelCache();
        void vscode.window.showInformationMessage('OpenRouter API key cleared');
        return;
    }

    await setOpenRouterApiKey(value);
    resetOpenRouterClient();
    clearOpenRouterModelCache();
    void vscode.window.showInformationMessage('OpenRouter API key saved securely');
}

/**
 * Lists models via OpenRouter SDK (newest first) and updates workspace model setting.
 */
export async function pickOpenRouterModelCommand(): Promise<void> {
    if (!(await hasOpenRouterApiKey())) {
        const configure = 'Configure API Key';
        const choice = await vscode.window.showWarningMessage(
            'OpenRouter API key required for cloud prose fallback',
            configure
        );
        if (choice === configure) {
            await configureOpenRouterApiKeyCommand();
        }
        return;
    }

    const options = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Loading OpenRouter models',
        },
        () => listOpenRouterModelOptions()
    );

    const picked = await vscode.window.showQuickPick(
        options.map((o) => ({
            label: o.label,
            description: o.id,
            detail: o.description,
            modelId: o.id,
        })),
        {
            title: 'Select OpenRouter model for docDocs prose',
            matchOnDescription: true,
            matchOnDetail: true,
        }
    );

    if (!picked) {
        return;
    }

    const config = vscode.workspace.getConfiguration('docdocs');
    await config.update('ml.openRouter.model', picked.modelId, vscode.ConfigurationTarget.Workspace);
    void vscode.window.showInformationMessage(`OpenRouter model set to ${picked.modelId}`);
}

export function registerOpenRouterCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'docdocs.configureOpenRouterApiKey',
            configureOpenRouterApiKeyCommand
        ),
        vscode.commands.registerCommand('docdocs.pickOpenRouterModel', pickOpenRouterModelCommand)
    );
}
