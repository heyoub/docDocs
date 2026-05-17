/**
 * Copies tree-sitter grammar and runtime WASM into ./wasm for the VS Code extension package.
 */
import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmDir = join(root, 'wasm');
const grammarSrc = join(root, 'node_modules/@vscode/tree-sitter-wasm/wasm');
const runtimeSrc = join(root, 'node_modules/web-tree-sitter/tree-sitter.wasm');

await mkdir(wasmDir, { recursive: true });

for (const file of await readdir(grammarSrc)) {
    if (!file.endsWith('.wasm')) continue;
    await copyFile(join(grammarSrc, file), join(wasmDir, file));
}

await copyFile(runtimeSrc, join(wasmDir, 'tree-sitter.wasm'));
console.log(`[docDocs] Copied tree-sitter WASM files to ${wasmDir}`);
