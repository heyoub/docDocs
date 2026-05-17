/**
 * @fileoverview Export path indexes provider caches via buildModuleSchema.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import type { FileURI } from '../../src/types/base.js';
import type { ModuleSchema } from '../../src/types/schema.js';
import { clearDocCache, getDocCacheSchema } from '../../src/providers/completion.js';

const mockSchema: ModuleSchema = {
    $id: '/workspace/src/exported.ts' as ModuleSchema['$id'],
    path: '/workspace/src/exported.ts',
    symbols: [],
    imports: [],
    exports: [],
    definitions: {
        exportedFn: {
            $id: '#/definitions/exportedFn' as ModuleSchema['$id'],
            name: 'exportedFn',
            qualifiedName: 'exportedFn',
            kind: 'function',
            signature: 'function exportedFn()',
            description: '',
            modifiers: [],
            references: [],
            source: {
                uri: 'file:///workspace/src/exported.ts' as FileURI,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 10 },
                },
            },
        },
    },
};

vi.mock('../../src/core/pipeline/buildModuleSchema.js', () => ({
    buildModuleSchema: vi.fn(async () => ({ ok: true, value: mockSchema })),
}));

vi.mock('../../src/providers/diagnostics.js', () => ({
    GenDocsDiagnosticsManager: class {
        reportExtractionFailure = vi.fn();
    },
}));

describe('export cache indexing', () => {
    beforeEach(() => {
        clearDocCache();
        vi.clearAllMocks();
    });

    it('indexes schema when export processes a file', async () => {
        const { addFileSchemaForExport } = await import('../../src/commands/export.js');
        const file = vscode.Uri.file('/workspace/src/exported.ts');
        const schemas = new Map<string, ModuleSchema>();
        const counts = { extraction: 0 };

        await addFileSchemaForExport(file, schemas, counts);

        expect(counts.extraction).toBe(0);
        expect(schemas.size).toBe(1);
        expect(getDocCacheSchema(file.toString() as FileURI)?.definitions['exportedFn']).toBeDefined();
    });
});
