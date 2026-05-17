/**
 * @fileoverview Unit tests for watch-mode path exclusion rules.
 */

import { describe, it, expect } from 'vitest';
import { isWatchExcludedPath, WATCH_FILE_GLOB } from '../../src/extension/watchPaths.js';

describe('watchPaths', () => {
    it('exports the watch file glob', () => {
        expect(WATCH_FILE_GLOB).toContain('ts');
    });

    it('excludes node_modules paths', () => {
        expect(isWatchExcludedPath('/proj/node_modules/foo/index.ts')).toBe(true);
    });

    it('excludes .docdocs output paths', () => {
        expect(isWatchExcludedPath('/proj/.docdocs/api/foo.md')).toBe(true);
    });

    it('excludes dist and build directories', () => {
        expect(isWatchExcludedPath('/proj/dist/bundle.js')).toBe(true);
        expect(isWatchExcludedPath('/proj/build/out.js')).toBe(true);
    });

    it('allows normal source paths', () => {
        expect(isWatchExcludedPath('/proj/src/index.ts')).toBe(false);
        expect(isWatchExcludedPath('/proj/lib/utils.py')).toBe(false);
    });
});
