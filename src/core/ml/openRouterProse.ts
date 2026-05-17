/**
 * @fileoverview Cloud prose generation via OpenRouter chat completions.
 *
 * @module core/ml/openRouterProse
 */

import type { SymbolSchema } from '../../types/schema.js';
import { getOpenRouterClient } from './openRouterClient.js';
import { runWithOpenRouterRateLimit } from './openRouterRateLimit.js';
import { fetchOpenRouterModelOptions, OPENROUTER_AUTO_MODEL } from './openRouterModels.js';
import {
    buildSummaryPrompt,
    buildTransitionPrompt,
    buildWhyItMattersPrompt,
    templateSummary,
    templateTransition,
    templateWhyItMatters,
} from './prosePrompts.js';

export interface OpenRouterProseConfig {
    readonly model: string;
    readonly maxTokens: number;
    readonly temperature?: number;
}

function extractTextContent(content: unknown): string {
    if (typeof content === 'string') {
        return content.trim();
    }
    return '';
}

/**
 * Generates completion text using OpenRouter's chat API.
 */
export async function completeWithOpenRouter(
    prompt: string,
    config: OpenRouterProseConfig
): Promise<string> {
    const client = await getOpenRouterClient();
    if (!client) {
        return '';
    }

    const result = await runWithOpenRouterRateLimit(() =>
        client.chat.send({
            chatRequest: {
                model: config.model,
                messages: [{ role: 'user', content: prompt }],
                maxTokens: config.maxTokens,
                temperature: config.temperature ?? 0.4,
                stream: false,
            },
        })
    );

    return extractTextContent(result.choices[0]?.message?.content);
}

/**
 * Cloud prose provider mirroring local smoother methods.
 */
export class OpenRouterProseProvider {
    constructor(private readonly config: OpenRouterProseConfig) {}

    async generateSummary(schema: SymbolSchema): Promise<string> {
        try {
            const text = await completeWithOpenRouter(buildSummaryPrompt(schema), this.config);
            return text || templateSummary(schema);
        } catch {
            return templateSummary(schema);
        }
    }

    async generateTransition(from: SymbolSchema, to: SymbolSchema): Promise<string> {
        try {
            const text = await completeWithOpenRouter(buildTransitionPrompt(from, to), this.config);
            return text || templateTransition(from, to);
        } catch {
            return templateTransition(from, to);
        }
    }

    async generateWhyItMatters(schema: SymbolSchema): Promise<string> {
        try {
            const text = await completeWithOpenRouter(buildWhyItMattersPrompt(schema), this.config);
            return text || templateWhyItMatters(schema);
        } catch {
            return templateWhyItMatters(schema);
        }
    }
}

/**
 * Resolves model id: explicit config, else auto router.
 */
export function resolveOpenRouterModelId(configuredModel: string | undefined): string {
    const trimmed = configuredModel?.trim();
    if (trimmed && trimmed.length > 0) {
        return trimmed;
    }
    return OPENROUTER_AUTO_MODEL;
}

/**
 * Lists models for quick-pick UI (newest first after auto).
 */
export async function listOpenRouterModelOptions(): Promise<
    import('./openRouterModels.js').OpenRouterModelOption[]
> {
    const client = await getOpenRouterClient();
    if (!client) {
        return [
            {
                id: OPENROUTER_AUTO_MODEL,
                label: 'openrouter/auto',
                description: 'Configure API key first (docdocs: Configure OpenRouter API Key)',
                created: 0,
            },
        ];
    }

    return fetchOpenRouterModelOptions(() => client.models.list());
}
