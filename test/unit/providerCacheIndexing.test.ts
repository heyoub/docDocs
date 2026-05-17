/**
 * @fileoverview Tests that preview/export paths index provider caches.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import type { FileURI } from '../../src/types/base.js';
import type { ModuleSchema } from '../../src/types/schema.js';
import { clearDocCache, getDocCacheSchema } from '../../src/providers/completion.js';
import { indexSchemaInProviders } from '../../src/core/pipeline/indexGeneratedSchema.js';
import { previewDocumentationCommand } from '../../src/commands/preview.js';

const testUri = vscode.Uri.file('/workspace/src/cached.ts');
const fileUri = testUri.toString() as FileURI;

const mockSchema: ModuleSchema = {
    $id: '/workspace/src/cached.ts' as ModuleSchema['$id'],
    path: '/workspace/src/cached.ts',
    symbols: [],
    imports: [],
    exports: [],
    definitions: {
        greet: {
            $id: '#/definitions/greet' as ModuleSchema['$id'],
            name: 'greet',
            qualifiedName: 'greet',
            kind: 'function',
            signature: 'function greet()',
            description: 'Says hello',
            modifiers: [],
            references: [],
            source: {
                uri: fileUri,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 5 },
                },
            },
        },
    },
};

vi.mock('../../src/core/pipeline/buildModuleSchema.js', () => ({
    buildModuleSchema: vi.fn(async () => ({ ok: true, value: mockSchema })),
}));

vi.mock('../../src/ui/webview/preview.js', () => ({
    PreviewPanelManager: class {
        show = vi.fn();
        dispose = vi.fn();
    },
}));

describe('provider cache indexing', () => {
    beforeEach(() => {
        clearDocCache();
        vi.clearAllMocks();
    });

    it('indexSchemaInProviders populates completion cache', () => {
        indexSchemaInProviders(fileUri, mockSchema);
        expect(getDocCacheSchema(fileUri)?.definitions['greet']).toBeDefined();
    });

    it('preview command indexes schema after successful build', async () => {
        await previewDocumentationCommand(testUri);
        expect(getDocCacheSchema(fileUri)?.definitions['greet']).toBeDefined();
    });
});
