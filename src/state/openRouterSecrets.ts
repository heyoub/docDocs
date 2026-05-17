/**
 * @fileoverview Secure storage for OpenRouter API keys (VS Code SecretStorage).
 *
 * @module state/openRouterSecrets
 */

import * as vscode from 'vscode';

const SECRET_KEY = 'docdocs.openrouter.apiKey';

let secrets: vscode.SecretStorage | null = null;

/**
 * Registers secret storage from extension activation.
 */
export function registerOpenRouterSecrets(context: vscode.ExtensionContext): void {
    secrets = context.secrets;
}

/**
 * Reads the configured OpenRouter API key, if any.
 */
export async function getOpenRouterApiKey(): Promise<string | undefined> {
    if (!secrets) return undefined;
    const value = await secrets.get(SECRET_KEY);
    return value?.trim() || undefined;
}

/**
 * Persists or clears the OpenRouter API key.
 */
export async function setOpenRouterApiKey(apiKey: string | undefined): Promise<void> {
    if (!secrets) {
        throw new Error('OpenRouter secrets not initialized');
    }
    if (!apiKey?.trim()) {
        await secrets.delete(SECRET_KEY);
        return;
    }
    await secrets.store(SECRET_KEY, apiKey.trim());
}

/**
 * Whether an API key is stored (does not validate the key).
 */
export async function hasOpenRouterApiKey(): Promise<boolean> {
    const key = await getOpenRouterApiKey();
    return Boolean(key);
}
