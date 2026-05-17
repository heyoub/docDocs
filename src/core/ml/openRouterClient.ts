/**
 * @fileoverview OpenRouter SDK client factory for docDocs extension host.
 *
 * @module core/ml/openRouterClient
 */

import { getOpenRouterApiKey } from '../../state/openRouterSecrets.js';

/** OpenRouter SDK client (loaded dynamically to keep CJS bundle lean). */
export type OpenRouterSdkClient = {
    chat: {
        send: (request: {
            chatRequest: {
                model: string;
                messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>;
                maxTokens?: number;
                temperature?: number;
                stream?: false;
            };
        }) => Promise<{
            choices: Array<{ message?: { content?: unknown } }>;
            model?: string;
        }>;
    };
    models: {
        list: () => Promise<{ data: import('./openRouterModels.js').OpenRouterModelRecord[] }>;
    };
};

let cachedClient: OpenRouterSdkClient | null = null;
let cachedKey: string | null = null;

/**
 * Creates or returns a cached OpenRouter client when an API key is configured.
 */
export async function getOpenRouterClient(): Promise<OpenRouterSdkClient | null> {
    const apiKey = await getOpenRouterApiKey();
    if (!apiKey) {
        cachedClient = null;
        cachedKey = null;
        return null;
    }

    if (cachedClient && cachedKey === apiKey) {
        return cachedClient;
    }

    const { OpenRouter } = await import('@openrouter/sdk');
    cachedClient = new OpenRouter({
        apiKey,
        httpReferer: 'https://github.com/Heyoub/docDocs',
        appTitle: 'docDocs VS Code Extension',
    }) as unknown as OpenRouterSdkClient;
    cachedKey = apiKey;
    return cachedClient;
}

/**
 * Clears cached client (for tests or after key rotation).
 */
export function resetOpenRouterClient(): void {
    cachedClient = null;
    cachedKey = null;
}
