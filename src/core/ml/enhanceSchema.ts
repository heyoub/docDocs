/**
 * @fileoverview ML prose enhancement: local worker → OpenRouter cloud → templates.
 *
 * @module core/ml/enhanceSchema
 */

import * as vscode from 'vscode';
import type { MLConfig } from '../../types/config.js';
import type { ModuleSchema, SymbolSchema } from '../../types/schema.js';
import { hasOpenRouterApiKey } from '../../state/openRouterSecrets.js';
import { createSmoother, type MLProseSmoother } from './smoother.js';
import { OpenRouterProseProvider, resolveOpenRouterModelId } from './openRouterProse.js';
import { templateSummary, templateWhyItMatters } from './prosePrompts.js';

let sharedSmoother: MLProseSmoother | null = null;
let initAttempted = false;
let lastModelId: string | null = null;

async function getSmoother(config: MLConfig): Promise<MLProseSmoother | null> {
    if (!config.enabled) {
        return null;
    }

    if (sharedSmoother === null || lastModelId !== config.model) {
        sharedSmoother?.dispose();
        sharedSmoother = createSmoother({
            modelId: config.model,
            device: config.device,
            maxTokens: config.maxTokens,
            ...(config.cacheDir !== undefined && { cacheDir: config.cacheDir }),
        });
        lastModelId = config.model;
        initAttempted = false;
    }

    if (!initAttempted) {
        initAttempted = true;
        try {
            await sharedSmoother.initialize();
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[docDocs] Local ML prose init failed: ${msg}`);
        }
    }

    return sharedSmoother;
}

function needsEnhancement(symbol: SymbolSchema): boolean {
    const trimmed = symbol.description.trim();
    return trimmed.length === 0 || trimmed === '*No description*';
}

function resolveOpenRouterConfig(mlConfig: MLConfig): { enabled: boolean; model: string } {
    const vscodeConfig = vscode.workspace.getConfiguration('docdocs');
    const enabled = vscodeConfig.get<boolean>(
        'ml.openRouter.enabled',
        mlConfig.openRouter.enabled
    );
    const model = vscodeConfig.get<string>(
        'ml.openRouter.model',
        mlConfig.openRouter.model
    );
    return {
        enabled,
        model: resolveOpenRouterModelId(model),
    };
}

async function createOpenRouterProvider(
    mlConfig: MLConfig
): Promise<OpenRouterProseProvider | null> {
    const openRouter = resolveOpenRouterConfig(mlConfig);
    if (!openRouter.enabled) {
        return null;
    }
    if (!(await hasOpenRouterApiKey())) {
        return null;
    }

    return new OpenRouterProseProvider({
        model: openRouter.model,
        maxTokens: Math.min(mlConfig.maxTokens, 512),
        temperature: 0.4,
    });
}

/**
 * Enhances symbol descriptions: local ML → OpenRouter → templates.
 */
export async function enhanceModuleWithMl(
    module: ModuleSchema,
    mlConfig: MLConfig
): Promise<ModuleSchema> {
    if (!mlConfig.enabled) {
        return module;
    }

    const smoother = await getSmoother(mlConfig);
    const useLocal = smoother?.isReady() ?? false;
    const openRouter = useLocal ? null : await createOpenRouterProvider(mlConfig);

    if (!useLocal && !openRouter) {
        console.log('[docDocs] Using template prose (local ML unavailable, OpenRouter not configured)');
    } else if (!useLocal && openRouter) {
        console.log('[docDocs] Using OpenRouter cloud prose fallback');
    }

    const definitions: Record<string, SymbolSchema> = { ...module.definitions };

    for (const [name, symbol] of Object.entries(definitions)) {
        if (!needsEnhancement(symbol)) {
            continue;
        }

        try {
            if (mlConfig.generateSummaries) {
                let summary: string;
                if (useLocal && smoother) {
                    summary = await smoother.generateSummary(symbol);
                } else if (openRouter) {
                    summary = await openRouter.generateSummary(symbol);
                } else {
                    summary = templateSummary(symbol);
                }
                definitions[name] = { ...symbol, description: summary };
                continue;
            }
            if (mlConfig.generateWhyItMatters) {
                let why: string;
                if (useLocal && smoother) {
                    why = await smoother.generateWhyItMatters(symbol);
                } else if (openRouter) {
                    why = await openRouter.generateWhyItMatters(symbol);
                } else {
                    why = templateWhyItMatters(symbol);
                }
                definitions[name] = { ...symbol, description: why };
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[docDocs] Prose enhancement skipped for ${name}: ${msg}`);
        }
    }

    return { ...module, definitions };
}

/**
 * Resets shared ML state (for tests).
 */
export function resetMlSmootherForTests(): void {
    sharedSmoother?.dispose();
    sharedSmoother = null;
    initAttempted = false;
    lastModelId = null;
}
