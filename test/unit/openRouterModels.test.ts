/**
 * @fileoverview Unit tests for OpenRouter model listing helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    OPENROUTER_AUTO_MODEL,
    clearOpenRouterModelCache,
    isTextChatModel,
    resolveLatestTextModelId,
    sortModelsNewestFirst,
    toModelOptions,
    type OpenRouterModelRecord,
} from '../../src/core/ml/openRouterModels.js';

function mockModel(id: string, created: number, text = true): OpenRouterModelRecord {
    return {
        id,
        canonicalSlug: id,
        name: id,
        created,
        architecture: {
            outputModalities: text ? ['text'] : ['embeddings'],
        },
    };
}

describe('openRouterModels', () => {
    beforeEach(() => {
        clearOpenRouterModelCache();
    });

    it('filters to text chat models', () => {
        expect(isTextChatModel(mockModel('a', 1))).toBe(true);
        expect(isTextChatModel(mockModel('embed', 2, false))).toBe(false);
    });

    it('sorts models newest first', () => {
        const sorted = sortModelsNewestFirst([
            mockModel('old', 100),
            mockModel('new', 300),
        ]);
        expect(sorted[0]?.id).toBe('new');
    });

    it('places auto router first in picker options', () => {
        const options = toModelOptions([
            mockModel('anthropic/claude-sonnet-4.5', 200),
            mockModel('openai/gpt-4o', 100),
        ]);
        expect(options[0]?.id).toBe(OPENROUTER_AUTO_MODEL);
        expect(options.length).toBeGreaterThan(1);
    });

    it('resolves latest text model id', () => {
        const latest = resolveLatestTextModelId([
            mockModel('z', 50),
            mockModel('latest/model', 500),
        ]);
        expect(latest).toBe('latest/model');
    });
});
