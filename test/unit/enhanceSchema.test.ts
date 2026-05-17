/**
 * @fileoverview Unit tests for ML schema enhancement.
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { MLConfig } from '../../src/types/config.js';
import type { ModuleSchema, SymbolSchema } from '../../src/types/schema.js';
import { enhanceModuleWithMl, resetMlSmootherForTests } from '../../src/core/ml/enhanceSchema.js';

const mlConfig: MLConfig = {
    enabled: true,
    model: 'tiiuae/Falcon-H1-Tiny-Coder-90M',
    device: 'cpu',
    maxTokens: 128,
    generateSummaries: true,
    generateTransitions: false,
    generateWhyItMatters: false,
    openRouter: {
        enabled: false,
        model: 'openrouter/auto',
    },
};

function moduleWithEmptyDescription(): ModuleSchema {
    const sym: SymbolSchema = {
        $id: 'src/a.ts#/definitions/foo' as SymbolSchema['$id'],
        name: 'foo',
        qualifiedName: 'a.foo',
        kind: 'function',
        signature: 'function foo()',
        description: '',
        modifiers: [],
        references: [],
        source: {
            uri: 'file:///src/a.ts' as SymbolSchema['source']['uri'],
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 3 },
            },
        },
    };
    return {
        $id: 'src/a.ts' as ModuleSchema['$id'],
        path: 'src/a.ts',
        symbols: [],
        imports: [],
        exports: [],
        definitions: { foo: sym },
    };
}

describe('enhanceModuleWithMl', () => {
    afterEach(() => {
        resetMlSmootherForTests();
    });

    it('returns module unchanged when ML is disabled', async () => {
        const module = moduleWithEmptyDescription();
        const result = await enhanceModuleWithMl(module, { ...mlConfig, enabled: false });
        expect(result).toBe(module);
    });

    it('fills empty descriptions via template fallback when worker is unavailable', async () => {
        const module = moduleWithEmptyDescription();
        const result = await enhanceModuleWithMl(module, mlConfig);
        expect(result.definitions.foo?.description.length).toBeGreaterThan(0);
    });
});
