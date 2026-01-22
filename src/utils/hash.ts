/**
 * @fileoverview Hash utilities for content and file hashing.
 * Used by the Freshness Tracker to detect when source files have changed.
 *
 * @module utils/hash
 * @requirements 15.1, 15.2
 */

import type { FileURI } from '../types/base.js';

/**
 * Computes a SHA-256 hash of the given content string.
 * Returns a hex-encoded hash string.
 *
 * @param content - The string content to hash
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * const hash = await contentHash('hello world');
 * // Returns: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
 */
export async function contentHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
}

/**
 * Computes a SHA-256 hash of a file's contents.
 * Reads the file and returns its hex-encoded hash.
 *
 * @param uri - The file URI to hash
 * @returns Promise resolving to hex-encoded SHA-256 hash
 *
 * @example
 * const hash = await fileHash('file:///path/to/file.ts' as FileURI);
 */
export async function fileHash(uri: FileURI): Promise<string> {
    const vscode = await import('vscode');
    const fileUri = vscode.Uri.parse(uri);
    const fileContent = await vscode.workspace.fs.readFile(fileUri);
    // Create a copy of the buffer to ensure it's ArrayBuffer, not SharedArrayBuffer
    const buffer = new Uint8Array(fileContent).buffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return bufferToHex(hashBuffer);
}

/**
 * Converts an ArrayBuffer to a hex-encoded string.
 *
 * @param buffer - The ArrayBuffer to convert
 * @returns Hex-encoded string
 */
function bufferToHex(buffer: ArrayBuffer): string {
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
