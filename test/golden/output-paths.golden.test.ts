/**
 * @fileoverview Golden/unit tests for stable workspace-relative schema paths.
 *
 * schema.path feeds writeOutput: `.docdocs/api/{schema.path}.md`
 */

import { describe, it, expect } from 'vitest';
import type { FileURI } from '../../src/types/base.js';
import type { ExtractedSymbol, FileExtraction } from '../../src/types/extraction.js';
import {
    generateModuleSchema,
    tryGenerateModuleSchema,
} from '../../src/core/schema/generator.js';
import { resolveModulePath } from '../../src/utils/modulePath.js';

function isAbsoluteSchemaPath(path: string): boolean {
    if (path.startsWith('file://')) {
        return true;
    }
    if (/^[A-Za-z]:[/\\]/.test(path)) {
        return true;
    }
    // POSIX absolute (e.g. /home/user/...) but not lone "index" workspace root marker
    if (path.startsWith('/') && path !== '/index') {
        return true;
    }
    return false;
}

function docdocsMarkdownOutputPath(schemaPath: string, outputDir = '.docdocs'): string {
    return `${outputDir}/api/${schemaPath}.md`;
}

function minimalSymbol(uri: FileURI): ExtractedSymbol {
    return {
        id: 'sym' as ExtractedSymbol['id'],
        name: 'example',
        kind: 'function',
        location: {
            uri,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 20 },
            },
        },
        visibility: 'public',
        signature: 'function example(): void',
        documentation: null,
        modifiers: [],
        children: [],
    };
}

function extraction(overrides: Partial<FileExtraction> & Pick<FileExtraction, 'uri'>): FileExtraction {
    const uri = overrides.uri;
    return {
        languageId: 'typescript',
        symbols: [minimalSymbol(uri)],
        imports: [],
        exports: [],
        method: 'lsp',
        timestamp: 1_700_000_000_000,
        ...overrides,
    };
}

describe('Golden: workspace-relative output paths', () => {
    const workspaceRoot = '/home/user/proj';
    const absoluteUri = `file://${workspaceRoot}/src/example.ts` as FileURI;

    it('uses relativePath for schema.path when set', () => {
        const ext = extraction({
            uri: absoluteUri,
            relativePath: 'src/example.ts',
        });

        const schema = generateModuleSchema(ext);
        expect(schema.path).toBe('src/example.ts');
        expect(isAbsoluteSchemaPath(schema.path)).toBe(false);
    });

    it('tryGenerateModuleSchema matches generateModuleSchema path', () => {
        const ext = extraction({
            uri: absoluteUri,
            relativePath: 'src/example.ts',
        });

        const direct = generateModuleSchema(ext);
        const result = tryGenerateModuleSchema(ext);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.path).toBe(direct.path);
            expect(result.value.path).toBe('src/example.ts');
        }
    });

    it('normalizes backslashes in relativePath', () => {
        const ext = extraction({
            uri: absoluteUri,
            relativePath: 'src\\nested\\example.ts',
        });

        const schema = generateModuleSchema(ext);
        expect(schema.path).toBe('src/nested/example.ts');
    });

    it('mirrors buildModuleSchema: resolveModulePath + relativePath on extraction', () => {
        const relativePath = resolveModulePath(absoluteUri, workspaceRoot);
        expect(relativePath).toBe('src/example.ts');

        const ext = extraction({
            uri: absoluteUri,
            relativePath,
        });

        const schema = generateModuleSchema(ext);
        expect(schema.path).toBe('src/example.ts');
        expect(schema.$id).toBe('src/example.ts');
    });

    it('does not emit absolute paths when only URI is set (fallback via resolveModulePath)', () => {
        const ext = extraction({ uri: absoluteUri });

        const schema = generateModuleSchema(ext);
        expect(schema.path).toBe('src/example.ts');
        expect(isAbsoluteSchemaPath(schema.path)).toBe(false);
    });

    it('stable markdown output path under .docdocs/api/', () => {
        const ext = extraction({
            uri: absoluteUri,
            relativePath: 'src/example.ts',
        });
        const schema = generateModuleSchema(ext);

        expect(docdocsMarkdownOutputPath(schema.path)).toBe('.docdocs/api/src/example.ts.md');
        expect(docdocsMarkdownOutputPath(schema.path, 'docs')).toBe('docs/api/src/example.ts.md');
    });

    it('nested module paths preserve directory structure in output filename', () => {
        const ext = extraction({
            uri: `file://${workspaceRoot}/packages/core/src/lib/util.ts` as FileURI,
            relativePath: 'packages/core/src/lib/util.ts',
        });

        const schema = generateModuleSchema(ext);
        expect(schema.path).toBe('packages/core/src/lib/util.ts');
        expect(docdocsMarkdownOutputPath(schema.path)).toBe(
            '.docdocs/api/packages/core/src/lib/util.ts.md'
        );
    });
});
