/**
 * @fileoverview OpenRouter model listing and picker helpers (via @openrouter/sdk).
 *
 * @module core/ml/openRouterModels
 */

/** Minimal model shape from OpenRouter models.list() (avoids ESM type import in CJS extension). */
export interface OpenRouterModelRecord {
    readonly id: string;
    readonly canonicalSlug: string;
    readonly name: string;
    readonly created: number;
    readonly description?: string;
    readonly architecture: {
        readonly outputModalities: readonly string[];
    };
}

/** OpenRouter auto router — picks the best model per prompt (see openrouter.ai/docs). */
export const OPENROUTER_AUTO_MODEL = 'openrouter/auto';

export interface OpenRouterModelOption {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly created: number;
}

let cachedModels: OpenRouterModelOption[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Returns true when a model supports text output (chat completion).
 */
export function isTextChatModel(model: OpenRouterModelRecord): boolean {
    return model.architecture.outputModalities.includes('text');
}

/**
 * Sorts models newest-first for the dynamic picker default.
 */
export function sortModelsNewestFirst(models: readonly OpenRouterModelRecord[]): OpenRouterModelRecord[] {
    return [...models].sort((a, b) => b.created - a.created);
}

/**
 * Maps SDK models to quick-pick options with auto router first.
 */
export function toModelOptions(models: readonly OpenRouterModelRecord[]): OpenRouterModelOption[] {
    const textModels = sortModelsNewestFirst(models.filter(isTextChatModel));
    const options: OpenRouterModelOption[] = [
        {
            id: OPENROUTER_AUTO_MODEL,
            label: 'openrouter/auto',
            description: 'Auto — OpenRouter picks the best model for each prompt',
            created: Number.MAX_SAFE_INTEGER,
        },
    ];

    for (const model of textModels) {
        if (model.id === OPENROUTER_AUTO_MODEL || model.canonicalSlug === OPENROUTER_AUTO_MODEL) {
            continue;
        }
        options.push({
            id: model.id,
            label: model.name,
            description: model.description ?? model.canonicalSlug,
            created: model.created,
        });
    }

    return options;
}

/**
 * Fetches models from OpenRouter (cached).
 */
export async function fetchOpenRouterModelOptions(
    listModels: () => Promise<{ data: OpenRouterModelRecord[] }>
): Promise<OpenRouterModelOption[]> {
    const now = Date.now();
    if (cachedModels && now < cacheExpiresAt) {
        return cachedModels;
    }

    const response = await listModels();
    cachedModels = toModelOptions(response.data);
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedModels;
}

/**
 * Resolves the newest text model id (fallback when user has not picked a model).
 */
export function resolveLatestTextModelId(models: readonly OpenRouterModelRecord[]): string {
    const sorted = sortModelsNewestFirst(models.filter(isTextChatModel));
    return sorted[0]?.id ?? OPENROUTER_AUTO_MODEL;
}

/**
 * Clears cached model list (for tests).
 */
export function clearOpenRouterModelCache(): void {
    cachedModels = null;
    cacheExpiresAt = 0;
}
