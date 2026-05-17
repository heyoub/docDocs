/**
 * @fileoverview Unit tests for proactive provider cache warming.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import type { FileURI, ModuleSchema } from '../../src/types/index.js';
import { SchemaCacheWarmer } from '../../src/core/pipeline/schemaCacheWarmer.js';
import { buildModuleSchema } from '../../src/core/pipeline/buildModuleSchema.js';
import { getDocCacheSchema, updateDocCache } from '../../src/providers/completion.js';

vi.mock('../../src/core/pipeline/buildModuleSchema.js', () => ({
    buildModuleSchema: vi.fn(),
}));

const testUri = vscode.Uri.file('/workspace/src/example.ts');
const fileUri = testUri.toString() as FileURI;

function minimalSchema(): ModuleSchema {
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        module: 'example',
        version: '1.0.0',
        definitions: {},
    } as ModuleSchema;
}

describe('SchemaCacheWarmer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateDocCache(fileUri, minimalSchema());
        // clear by resetting - completion doesn't export clear; use different uri per test
    });

    it('skips warm when cache already populated', async () => {
        const warmer = new SchemaCacheWarmer();
        warmer.scheduleWarm(testUri);
        await new Promise((r) => setTimeout(r, 10));
        expect(buildModuleSchema).not.toHaveBeenCalled();
        warmer.dispose();
    });

    it('builds schema and indexes providers on warm', async () => {
        const uncachedUri = vscode.Uri.file('/workspace/src/other.ts');
        const uncachedFileUri = uncachedUri.toString() as FileURI;
        expect(getDocCacheSchema(uncachedFileUri)).toBeUndefined();

        vi.mocked(buildModuleSchema).mockResolvedValue({
            ok: true,
            value: { ...minimalSchema(), module: 'other' },
        });

        const warmer = new SchemaCacheWarmer({ maxConcurrent: 1 });
        warmer.scheduleWarm(uncachedUri);
        await new Promise((r) => setTimeout(r, 50));

        expect(buildModuleSchema).toHaveBeenCalled();
        expect(getDocCacheSchema(uncachedFileUri)).toBeDefined();
        warmer.dispose();
    });
});
