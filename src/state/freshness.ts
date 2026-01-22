/**
 * @fileoverview Freshness tracking for documentation staleness detection.
 * Tracks source file hashes and timestamps to determine when documentation
 * needs regeneration.
 *
 * @module state/freshness
 * @requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */

import * as vscode from 'vscode';
import type { FileURI, AsyncResult } from '../types/base.js';
import { ok, err } from '../utils/result.js';

// ============================================================
// Types
// ============================================================

/**
 * Status of documentation freshness for a file.
 * - fresh: Documentation is up-to-date with source
 * - stale: Source has changed since documentation was generated
 * - orphaned: Documentation exists but source file was deleted
 * - unknown: No freshness information available
 */
export interface FreshnessStatus {
    readonly status: 'fresh' | 'stale' | 'orphaned' | 'unknown';
    readonly sourceHash?: string;
    readonly docHash?: string;
    readonly lastGenerated?: Date;
    readonly lastModified?: Date;
}

/**
 * Entry for a single file in the freshness store.
 */
export interface FreshnessEntry {
    readonly sourceHash: string;
    readonly docHash: string;
    readonly lastGenerated: string;
    readonly gitCommit?: string;
}

/**
 * Persistent storage format for freshness data.
 * Stored in .gendocs/freshness.json
 */
export interface FreshnessStore {
    readonly version: number;
    readonly files: Readonly<Record<string, FreshnessEntry>>;
}

/**
 * Error types for freshness operations.
 */
export type FreshnessError =
    | { readonly type: 'io'; readonly message: string }
    | { readonly type: 'parse'; readonly message: string }
    | { readonly type: 'validation'; readonly message: string };

// ============================================================
// Constants
// ============================================================

const STORE_VERSION = 1;
const FRESHNESS_FILE = '.gendocs/freshness.json';

// ============================================================
// State
// ============================================================

/**
 * In-memory freshness store.
 * Mutable for performance; persisted to disk on demand.
 */
let store: FreshnessStore = createEmptyStore();

/**
 * Set of known source file URIs (for orphan detection).
 */
let knownSourceFiles: Set<string> = new Set();

// ============================================================
// Store Management
// ============================================================

/**
 * Creates an empty freshness store with default values.
 */
function createEmptyStore(): FreshnessStore {
    return {
        version: STORE_VERSION,
        files: {},
    };
}

/**
 * Validates that a parsed object is a valid FreshnessStore.
 */
function isValidStore(obj: unknown): obj is FreshnessStore {
    if (typeof obj !== 'object' || obj === null) return false;
    const record = obj as Record<string, unknown>;
    if (typeof record['version'] !== 'number') return false;
    if (typeof record['files'] !== 'object' || record['files'] === null) return false;
    return true;
}

/**
 * Validates that a parsed object is a valid FreshnessEntry.
 */
function isValidEntry(obj: unknown): obj is FreshnessEntry {
    if (typeof obj !== 'object' || obj === null) return false;
    const record = obj as Record<string, unknown>;
    return (
        typeof record['sourceHash'] === 'string' &&
        typeof record['docHash'] === 'string' &&
        typeof record['lastGenerated'] === 'string'
    );
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Records a documentation generation event for a file.
 * Updates the in-memory store with the new hash and timestamp.
 *
 * @param uri - The file URI that was documented
 * @param sourceHash - Hash of the source file content
 * @param docHash - Hash of the generated documentation
 * @param gitCommit - Optional git commit hash
 *
 * @example
 * recordGeneration(
 *   'file:///path/to/file.ts' as FileURI,
 *   'abc123...',
 *   'def456...'
 * );
 */
export function recordGeneration(
    uri: FileURI,
    sourceHash: string,
    docHash: string,
    gitCommit?: string
): void {
    const entry: FreshnessEntry = {
        sourceHash,
        docHash,
        lastGenerated: new Date().toISOString(),
        ...(gitCommit !== undefined ? { gitCommit } : {}),
    };

    // Create new files object with updated entry
    const newFiles = { ...store.files, [uri]: entry };
    store = { ...store, files: newFiles };

    // Track this as a known source file
    knownSourceFiles.add(uri);
}

/**
 * Checks the freshness status of a file's documentation.
 * Compares the current source hash with the stored hash.
 *
 * @param uri - The file URI to check
 * @param currentSourceHash - Current hash of the source file (optional, for efficiency)
 * @returns FreshnessStatus indicating the documentation state
 *
 * @example
 * const status = checkFreshness('file:///path/to/file.ts' as FileURI);
 * if (status.status === 'stale') {
 *   console.log('Documentation needs regeneration');
 * }
 */
export function checkFreshness(
    uri: FileURI,
    currentSourceHash?: string
): FreshnessStatus {
    const entry = store.files[uri];

    // No record exists for this file
    if (!entry) {
        return { status: 'unknown' };
    }

    // If we have a current hash, compare it
    if (currentSourceHash !== undefined) {
        const isFresh = entry.sourceHash === currentSourceHash;
        return {
            status: isFresh ? 'fresh' : 'stale',
            sourceHash: entry.sourceHash,
            docHash: entry.docHash,
            lastGenerated: new Date(entry.lastGenerated),
        };
    }

    // Without current hash, return stored info (caller should verify)
    return {
        status: 'fresh', // Assume fresh if we can't verify
        sourceHash: entry.sourceHash,
        docHash: entry.docHash,
        lastGenerated: new Date(entry.lastGenerated),
    };
}

/**
 * Returns all files where the source has changed since documentation was generated.
 * Requires current source hashes to be provided for comparison.
 *
 * @param currentHashes - Map of file URIs to their current source hashes
 * @returns Array of file URIs with stale documentation
 *
 * @example
 * const hashes = new Map([
 *   ['file:///a.ts' as FileURI, 'hash1'],
 *   ['file:///b.ts' as FileURI, 'hash2'],
 * ]);
 * const stale = getStaleFiles(hashes);
 */
export function getStaleFiles(
    currentHashes: ReadonlyMap<FileURI, string>
): readonly FileURI[] {
    const staleFiles: FileURI[] = [];

    for (const [uri, currentHash] of currentHashes) {
        const entry = store.files[uri];
        if (entry && entry.sourceHash !== currentHash) {
            staleFiles.push(uri);
        }
    }

    return staleFiles;
}

/**
 * Returns documentation entries that no longer have corresponding source files.
 * These are docs for files that have been deleted.
 *
 * @param existingSourceFiles - Set of URIs for files that currently exist
 * @returns Array of file URIs with orphaned documentation
 *
 * @example
 * const existing = new Set(['file:///a.ts', 'file:///b.ts']);
 * const orphaned = getOrphanedDocs(existing);
 */
export function getOrphanedDocs(
    existingSourceFiles: ReadonlySet<string>
): readonly string[] {
    const orphaned: string[] = [];

    for (const uri of Object.keys(store.files)) {
        if (!existingSourceFiles.has(uri)) {
            orphaned.push(uri);
        }
    }

    return orphaned;
}

/**
 * Removes an entry from the freshness store.
 * Used when documentation is deleted or a file is removed.
 *
 * @param uri - The file URI to remove
 */
export function removeEntry(uri: FileURI): void {
    const { [uri]: _, ...remainingFiles } = store.files;
    store = { ...store, files: remainingFiles };
    knownSourceFiles.delete(uri);
}

/**
 * Clears all entries from the freshness store.
 * Used for testing or when resetting the extension state.
 */
export function clearStore(): void {
    store = createEmptyStore();
    knownSourceFiles.clear();
}

/**
 * Gets the current store for testing or inspection.
 * Returns a readonly copy to prevent external mutation.
 */
export function getStore(): FreshnessStore {
    return store;
}

/**
 * Sets the store directly (for testing or restoration).
 */
export function setStore(newStore: FreshnessStore): void {
    store = newStore;
    knownSourceFiles = new Set(Object.keys(newStore.files));
}

// ============================================================
// Persistence
// ============================================================

/**
 * Persists the freshness store to disk.
 * Writes to .gendocs/freshness.json in the workspace root.
 *
 * @param workspaceUri - The workspace folder URI
 * @returns AsyncResult indicating success or failure
 *
 * @example
 * const result = await persist(workspaceUri);
 * if (!result.ok) {
 *   console.error('Failed to persist:', result.error.message);
 * }
 */
export async function persist(
    workspaceUri: FileURI
): AsyncResult<void, FreshnessError> {
    try {
        const freshnessUri = vscode.Uri.joinPath(
            vscode.Uri.parse(workspaceUri),
            FRESHNESS_FILE
        );

        // Ensure .gendocs directory exists
        const gendocsDir = vscode.Uri.joinPath(
            vscode.Uri.parse(workspaceUri),
            '.gendocs'
        );
        try {
            await vscode.workspace.fs.createDirectory(gendocsDir);
        } catch {
            // Directory may already exist, ignore error
        }

        const content = JSON.stringify(store, null, 2);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(freshnessUri, encoder.encode(content));

        return ok(undefined);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err({ type: 'io', message: `Failed to persist freshness store: ${message}` });
    }
}

/**
 * Restores the freshness store from disk.
 * Reads from .gendocs/freshness.json in the workspace root.
 *
 * @param workspaceUri - The workspace folder URI
 * @returns AsyncResult indicating success or failure
 *
 * @example
 * const result = await restore(workspaceUri);
 * if (result.ok) {
 *   console.log('Freshness store restored');
 * }
 */
export async function restore(
    workspaceUri: FileURI
): AsyncResult<void, FreshnessError> {
    try {
        const freshnessUri = vscode.Uri.joinPath(
            vscode.Uri.parse(workspaceUri),
            FRESHNESS_FILE
        );

        let content: Uint8Array;
        try {
            content = await vscode.workspace.fs.readFile(freshnessUri);
        } catch {
            // File doesn't exist, start with empty store
            store = createEmptyStore();
            knownSourceFiles.clear();
            return ok(undefined);
        }

        const decoder = new TextDecoder();
        const json = decoder.decode(content);

        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return err({ type: 'parse', message: `Invalid JSON: ${message}` });
        }

        if (!isValidStore(parsed)) {
            return err({ type: 'validation', message: 'Invalid freshness store format' });
        }

        // Validate all entries
        const validatedFiles: Record<string, FreshnessEntry> = {};
        for (const [uri, entry] of Object.entries(parsed.files)) {
            if (isValidEntry(entry)) {
                validatedFiles[uri] = entry;
            }
        }

        store = {
            version: parsed.version,
            files: validatedFiles,
        };
        knownSourceFiles = new Set(Object.keys(validatedFiles));

        return ok(undefined);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err({ type: 'io', message: `Failed to restore freshness store: ${message}` });
    }
}

/**
 * Gets freshness statistics for reporting.
 *
 * @param currentHashes - Map of file URIs to their current source hashes
 * @param existingFiles - Set of URIs for files that currently exist
 * @returns Statistics about documentation freshness
 */
export function getStatistics(
    currentHashes: ReadonlyMap<FileURI, string>,
    existingFiles: ReadonlySet<string>
): FreshnessStatistics {
    const stale = getStaleFiles(currentHashes);
    const orphaned = getOrphanedDocs(existingFiles);
    const total = Object.keys(store.files).length;
    const fresh = total - stale.length - orphaned.length;

    return {
        total,
        fresh: Math.max(0, fresh),
        stale: stale.length,
        orphaned: orphaned.length,
    };
}

/**
 * Statistics about documentation freshness.
 */
export interface FreshnessStatistics {
    readonly total: number;
    readonly fresh: number;
    readonly stale: number;
    readonly orphaned: number;
}
