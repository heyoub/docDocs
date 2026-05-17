/**
 * @fileoverview Unit tests for workspace-relative module path resolution.
 */

import { describe, it, expect } from 'vitest';
import type { FileURI } from '../../src/types/base.js';
import { normalizeFileUriPath, resolveModulePath } from '../../src/utils/modulePath.js';

describe('modulePath', () => {
    it('normalizes file URIs to POSIX paths', () => {
        const uri = 'file:///home/user/proj/src/foo.ts' as FileURI;
        expect(normalizeFileUriPath(uri)).toBe('/home/user/proj/src/foo.ts');
    });

    it('resolves paths relative to workspace root', () => {
        const uri = 'file:///home/user/proj/src/foo.ts' as FileURI;
        expect(resolveModulePath(uri, '/home/user/proj')).toBe('src/foo.ts');
    });

    it('falls back when workspace root does not match', () => {
        const uri = 'file:///other/place/src/foo.ts' as FileURI;
        const path = resolveModulePath(uri, '/home/user/proj');
        expect(path).toContain('src/foo.ts');
    });
});
