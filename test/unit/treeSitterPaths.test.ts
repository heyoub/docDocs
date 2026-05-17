/**
 * @fileoverview Unit tests for tree-sitter WASM path resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import {
    configureTreeSitterWasmDirectory,
    grammarWasmPath,
    hasBundledGrammars,
    getTreeSitterWasmDirectory,
} from '../../src/core/extractor/treeSitterPaths.js';

describe('treeSitterPaths', () => {
    const previous = getTreeSitterWasmDirectory();

    beforeEach(() => {
        configureTreeSitterWasmDirectory(previous);
    });

    afterEach(() => {
        configureTreeSitterWasmDirectory(previous);
    });

    it('resolves grammar wasm under configured directory', () => {
        configureTreeSitterWasmDirectory(previous);
        const path = grammarWasmPath('typescript');
        expect(path).toContain('tree-sitter-typescript.wasm');
        if (hasBundledGrammars()) {
            expect(existsSync(path)).toBe(true);
        }
    });

    it('uses explicit directory when configured', () => {
        const custom = `${process.cwd()}/wasm`;
        configureTreeSitterWasmDirectory(custom);
        expect(grammarWasmPath('javascript')).toBe(`${custom}/tree-sitter-javascript.wasm`);
    });
});
