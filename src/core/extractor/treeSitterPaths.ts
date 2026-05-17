/**
 * @fileoverview Resolves tree-sitter WASM paths for extension host and tests.
 *
 * @module core/extractor/treeSitterPaths
 */

import * as path from 'node:path';
import { existsSync } from 'node:fs';

let wasmDirectory: string | null = null;

/**
 * Configures the directory containing tree-sitter-*.wasm grammar files.
 * Call once during extension activation with `context.asAbsolutePath('wasm')`.
 */
export function configureTreeSitterWasmDirectory(directory: string): void {
    wasmDirectory = directory;
}

/**
 * Returns the configured WASM directory, or discovers a default for tests/CLI.
 */
export function getTreeSitterWasmDirectory(): string {
    if (wasmDirectory) {
        return wasmDirectory;
    }

    const candidates = [
        path.join(process.cwd(), 'wasm'),
        path.join(process.cwd(), 'node_modules/@vscode/tree-sitter-wasm/wasm'),
    ];

    for (const candidate of candidates) {
        if (existsSync(path.join(candidate, 'tree-sitter-typescript.wasm'))) {
            wasmDirectory = candidate;
            return candidate;
        }
    }

    return candidates[0] ?? 'wasm';
}

/**
 * Absolute path to a grammar WASM file.
 */
export function grammarWasmPath(grammarName: string): string {
    return path.join(getTreeSitterWasmDirectory(), `tree-sitter-${grammarName}.wasm`);
}

/**
 * Whether bundled grammar WASM files are present on disk.
 */
export function hasBundledGrammars(): boolean {
    return existsSync(grammarWasmPath('typescript'));
}
