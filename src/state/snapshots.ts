/**
 * @fileoverview Snapshot storage for API changelog detection.
 * Persists API snapshots to disk for comparison between versions.
 * Follows the freshness.ts pattern for state management.
 *
 * @module state/snapshots
 */

import * as vscode from 'vscode';
import type { FileURI, AsyncResult } from '../types/base.js';
import type {
    APISnapshot,
    ModuleAPISnapshot,
    ExportedSymbol,
    SnapshotStatistics
} from '../types/changelog.js';
import { ok, err } from '../utils/result.js';
import { contentHash } from '../utils/hash.js';

// ============================================================
// Types
// ============================================================

/**
 * Index entry for quick snapshot lookup.
 */
export interface SnapshotIndexEntry {
    readonly id: string;
    readonly tag: string | null;
    readonly createdAt: string;
    readonly workspaceUri: FileURI;
    readonly modulesCount: number;
    readonly exportsCount: number;
}

/**
 * Snapshot index stored in .docdocs/snapshots/index.json
 */
export interface SnapshotIndex {
    readonly version: number;
    readonly snapshots: Readonly<Record<string, SnapshotIndexEntry>>;
}

/**
 * Error types for snapshot operations.
 */
export type SnapshotError =
    | { readonly type: 'io'; readonly message: string }
    | { readonly type: 'parse'; readonly message: string }
    | { readonly type: 'validation'; readonly message: string }
    | { readonly type: 'not-found'; readonly message: string };

// ============================================================
// Constants
// ============================================================

const INDEX_VERSION = 1;
const SNAPSHOTS_DIR = '.docdocs/snapshots';
const INDEX_FILE = '.docdocs/snapshots/index.json';

// ============================================================
// State
// ============================================================

/**
 * In-memory snapshot index.
 */
let index: SnapshotIndex = createEmptyIndex();

/**
 * Cache of loaded snapshots.
 */
const snapshotCache = new Map<string, APISnapshot>();

// ============================================================
// Index Management
// ============================================================

/**
 * Creates an empty snapshot index.
 */
function createEmptyIndex(): SnapshotIndex {
    return {
        version: INDEX_VERSION,
        snapshots: {}
    };
}

/**
 * Validates that a parsed object is a valid SnapshotIndex.
 */
function isValidIndex(obj: unknown): obj is SnapshotIndex {
    if (typeof obj !== 'object' || obj === null) return false;
    const record = obj as Record<string, unknown>;
    if (typeof record['version'] !== 'number') return false;
    if (typeof record['snapshots'] !== 'object' || record['snapshots'] === null) return false;
    return true;
}

/**
 * Validates that a parsed object is a valid SnapshotIndexEntry.
 */
function isValidIndexEntry(obj: unknown): obj is SnapshotIndexEntry {
    if (typeof obj !== 'object' || obj === null) return false;
    const record = obj as Record<string, unknown>;
    return (
        typeof record['id'] === 'string' &&
        (typeof record['tag'] === 'string' || record['tag'] === null) &&
        typeof record['createdAt'] === 'string' &&
        typeof record['workspaceUri'] === 'string' &&
        typeof record['modulesCount'] === 'number' &&
        typeof record['exportsCount'] === 'number'
    );
}

/**
 * Validates that a parsed object is a valid APISnapshot.
 */
function isValidSnapshot(obj: unknown): obj is APISnapshot {
    if (typeof obj !== 'object' || obj === null) return false;
    const record = obj as Record<string, unknown>;
    return (
        typeof record['id'] === 'string' &&
        (typeof record['tag'] === 'string' || record['tag'] === null) &&
        typeof record['createdAt'] === 'string' &&
        typeof record['workspaceUri'] === 'string' &&
        Array.isArray(record['modules']) &&
        typeof record['statistics'] === 'object'
    );
}

// ============================================================
// ID Generation
// ============================================================

/**
 * Generates a unique snapshot ID.
 */
function generateSnapshotId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `snap_${timestamp}_${random}`;
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Creates a new API snapshot for the workspace.
 *
 * @param workspaceUri - The workspace folder URI
 * @param modules - Module snapshots to include
 * @param tag - Optional version tag (e.g., "v1.0.0")
 * @returns The created snapshot
 *
 * @example
 * const snapshot = await createSnapshot(workspaceUri, modules, 'v1.0.0');
 */
export async function createSnapshot(
    workspaceUri: FileURI,
    modules: readonly ModuleAPISnapshot[],
    tag?: string
): AsyncResult<APISnapshot, SnapshotError> {
    const id = generateSnapshotId();
    const createdAt = new Date().toISOString();

    // Calculate statistics
    let totalExports = 0;
    let documentedExports = 0;
    for (const module of modules) {
        totalExports += module.exports.length;
        for (const exp of module.exports) {
            if (exp.symbol?.description && exp.symbol.description.length > 0) {
                documentedExports++;
            }
        }
    }

    const statistics: SnapshotStatistics = {
        totalModules: modules.length,
        totalExports,
        documentedExports
    };

    const snapshot: APISnapshot = {
        id,
        tag: tag ?? null,
        createdAt,
        workspaceUri,
        modules,
        statistics
    };

    // Update index
    const indexEntry: SnapshotIndexEntry = {
        id,
        tag: tag ?? null,
        createdAt,
        workspaceUri,
        modulesCount: modules.length,
        exportsCount: totalExports
    };

    const newSnapshots = { ...index.snapshots, [id]: indexEntry };
    index = { ...index, snapshots: newSnapshots };

    // Cache the snapshot
    snapshotCache.set(id, snapshot);

    // Persist
    const saveResult = await saveSnapshot(workspaceUri, snapshot);
    if (!saveResult.ok) {
        return saveResult;
    }

    const persistResult = await persistIndex(workspaceUri);
    if (!persistResult.ok) {
        return persistResult;
    }

    return ok(snapshot);
}

/**
 * Loads a snapshot by ID.
 *
 * @param workspaceUri - The workspace folder URI
 * @param id - The snapshot ID to load
 * @returns The loaded snapshot or error
 */
export async function loadSnapshot(
    workspaceUri: FileURI,
    id: string
): AsyncResult<APISnapshot, SnapshotError> {
    // Check cache first
    const cached = snapshotCache.get(id);
    if (cached) {
        return ok(cached);
    }

    // Load from disk
    try {
        const snapshotUri = vscode.Uri.joinPath(
            vscode.Uri.parse(workspaceUri),
            SNAPSHOTS_DIR,
            `${id}.json`
        );

        const content = await vscode.workspace.fs.readFile(snapshotUri);
        const decoder = new TextDecoder();
        const json = decoder.decode(content);

        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return err({ type: 'parse', message: `Invalid JSON: ${message}` });
        }

        if (!isValidSnapshot(parsed)) {
            return err({ type: 'validation', message: 'Invalid snapshot format' });
        }

        // Cache for future use
        snapshotCache.set(id, parsed);

        return ok(parsed);
    } catch (e) {
        if (e instanceof vscode.FileSystemError && e.code === 'FileNotFound') {
            return err({ type: 'not-found', message: `Snapshot ${id} not found` });
        }
        const message = e instanceof Error ? e.message : String(e);
        return err({ type: 'io', message: `Failed to load snapshot: ${message}` });
    }
}

/**
 * Lists all snapshots for a workspace.
 *
 * @param workspaceUri - The workspace folder URI
 * @returns Array of snapshot index entries
 */
export function listSnapshots(workspaceUri: FileURI): readonly SnapshotIndexEntry[] {
    return Object.values(index.snapshots)
        .filter(entry => entry.workspaceUri === workspaceUri)
        .sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
}

/**
 * Gets a snapshot by its tag.
 *
 * @param workspaceUri - The workspace folder URI
 * @param tag - The version tag to look up
 * @returns The snapshot or null if not found
 */
export async function getSnapshotByTag(
    workspaceUri: FileURI,
    tag: string
): AsyncResult<APISnapshot | null, SnapshotError> {
    const entry = Object.values(index.snapshots).find(
        s => s.workspaceUri === workspaceUri && s.tag === tag
    );
    if (!entry) {
        return ok(null);
    }
    return loadSnapshot(workspaceUri, entry.id);
}

/**
 * Gets the latest snapshot for a workspace.
 *
 * @param workspaceUri - The workspace folder URI
 * @returns The latest snapshot or null if none exist
 */
export async function getLatestSnapshot(
    workspaceUri: FileURI
): AsyncResult<APISnapshot | null, SnapshotError> {
    const entries = listSnapshots(workspaceUri);
    const latest = entries[0];
    if (!latest) {
        return ok(null);
    }
    return loadSnapshot(workspaceUri, latest.id);
}

/**
 * Deletes a snapshot by ID.
 *
 * @param workspaceUri - The workspace folder URI
 * @param id - The snapshot ID to delete
 * @returns Result indicating success or failure
 */
export async function deleteSnapshot(
    workspaceUri: FileURI,
    id: string
): AsyncResult<void, SnapshotError> {
    // Remove from index (eslint-disable-next-line is implicit with underscore prefix)
    const { [id]: _removed, ...remainingSnapshots } = index.snapshots;
    void _removed; // Satisfy unused variable check
    index = { ...index, snapshots: remainingSnapshots };

    // Remove from cache
    snapshotCache.delete(id);

    // Delete file
    try {
        const snapshotUri = vscode.Uri.joinPath(
            vscode.Uri.parse(workspaceUri),
            SNAPSHOTS_DIR,
            `${id}.json`
        );
        await vscode.workspace.fs.delete(snapshotUri);
    } catch (e) {
        // File may not exist, which is fine
    }

    // Persist index
    return persistIndex(workspaceUri);
}

/**
 * Clears all snapshots for a workspace.
 */
export function clearSnapshots(): void {
    index = createEmptyIndex();
    snapshotCache.clear();
}

/**
 * Gets the current index for testing.
 */
export function getIndex(): SnapshotIndex {
    return index;
}

/**
 * Sets the index directly (for testing or restoration).
 */
export function setIndex(newIndex: SnapshotIndex): void {
    index = newIndex;
}

// ============================================================
// Persistence
// ============================================================

/**
 * Saves a snapshot to disk.
 */
async function saveSnapshot(
    workspaceUri: FileURI,
    snapshot: APISnapshot
): AsyncResult<void, SnapshotError> {
    try {
        const snapshotsDir = vscode.Uri.joinPath(
            vscode.Uri.parse(workspaceUri),
            SNAPSHOTS_DIR
        );

        // Ensure directory exists
        try {
            await vscode.workspace.fs.createDirectory(snapshotsDir);
        } catch {
            // Directory may already exist
        }

        const snapshotUri = vscode.Uri.joinPath(snapshotsDir, `${snapshot.id}.json`);
        const content = JSON.stringify(snapshot, null, 2);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(snapshotUri, encoder.encode(content));

        return ok(undefined);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err({ type: 'io', message: `Failed to save snapshot: ${message}` });
    }
}

/**
 * Persists the snapshot index to disk.
 */
async function persistIndex(
    workspaceUri: FileURI
): AsyncResult<void, SnapshotError> {
    try {
        const indexUri = vscode.Uri.joinPath(
            vscode.Uri.parse(workspaceUri),
            INDEX_FILE
        );

        // Ensure directory exists
        const snapshotsDir = vscode.Uri.joinPath(
            vscode.Uri.parse(workspaceUri),
            SNAPSHOTS_DIR
        );
        try {
            await vscode.workspace.fs.createDirectory(snapshotsDir);
        } catch {
            // Directory may already exist
        }

        const content = JSON.stringify(index, null, 2);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(indexUri, encoder.encode(content));

        return ok(undefined);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err({ type: 'io', message: `Failed to persist index: ${message}` });
    }
}

/**
 * Restores the snapshot index from disk.
 *
 * @param workspaceUri - The workspace folder URI
 * @returns Result indicating success or failure
 */
export async function restoreIndex(
    workspaceUri: FileURI
): AsyncResult<void, SnapshotError> {
    try {
        const indexUri = vscode.Uri.joinPath(
            vscode.Uri.parse(workspaceUri),
            INDEX_FILE
        );

        let content: Uint8Array;
        try {
            content = await vscode.workspace.fs.readFile(indexUri);
        } catch {
            // File doesn't exist, start with empty index
            index = createEmptyIndex();
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

        if (!isValidIndex(parsed)) {
            return err({ type: 'validation', message: 'Invalid snapshot index format' });
        }

        // Validate all entries
        const validatedSnapshots: Record<string, SnapshotIndexEntry> = {};
        for (const [id, entry] of Object.entries(parsed.snapshots)) {
            if (isValidIndexEntry(entry)) {
                validatedSnapshots[id] = entry;
            }
        }

        index = {
            version: parsed.version,
            snapshots: validatedSnapshots
        };

        return ok(undefined);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err({ type: 'io', message: `Failed to restore index: ${message}` });
    }
}

// ============================================================
// YAML Frontmatter Generation
// ============================================================

/**
 * YAML frontmatter for documentation snapshots.
 * Provides machine-readable metadata for deterministic diffing.
 */
export interface SnapshotFrontmatter {
    readonly snapshot_version: string;
    readonly generated_at: string;
    readonly base_commit: string | null;
    readonly extraction_method: 'lsp' | 'treesitter' | 'hybrid';
    readonly coverage: {
        readonly total_symbols: number;
        readonly documented: number;
        readonly undocumented: number;
        readonly coverage_percent: number;
    };
    readonly statistics: {
        readonly total_modules: number;
        readonly total_exports: number;
        readonly documented_exports: number;
    };
}

/**
 * Generates YAML frontmatter for a snapshot.
 * This provides machine-readable metadata for tooling integration.
 *
 * @param snapshot - The API snapshot to generate frontmatter for
 * @param commitHash - Optional git commit hash
 * @returns YAML frontmatter string
 *
 * @example
 * const frontmatter = generateFrontmatter(snapshot, 'abc123f');
 * // Returns:
 * // ---
 * // snapshot_version: "snap_2026-01-22..."
 * // generated_at: "2026-01-22T10:30:00Z"
 * // ...
 * // ---
 */
export function generateFrontmatter(
    snapshot: APISnapshot,
    commitHash?: string
): string {
    const undocumented = snapshot.statistics.totalExports - snapshot.statistics.documentedExports;
    const coveragePercent = snapshot.statistics.totalExports > 0
        ? Math.round((snapshot.statistics.documentedExports / snapshot.statistics.totalExports) * 1000) / 10
        : 100;

    const frontmatter: SnapshotFrontmatter = {
        snapshot_version: snapshot.tag ?? snapshot.id,
        generated_at: snapshot.createdAt,
        base_commit: commitHash ?? null,
        extraction_method: 'lsp',
        coverage: {
            total_symbols: snapshot.statistics.totalExports,
            documented: snapshot.statistics.documentedExports,
            undocumented,
            coverage_percent: coveragePercent
        },
        statistics: {
            total_modules: snapshot.statistics.totalModules,
            total_exports: snapshot.statistics.totalExports,
            documented_exports: snapshot.statistics.documentedExports
        }
    };

    // Generate YAML manually to avoid dependency
    const lines: string[] = ['---'];
    lines.push(`snapshot_version: "${frontmatter.snapshot_version}"`);
    lines.push(`generated_at: "${frontmatter.generated_at}"`);
    lines.push(`base_commit: ${frontmatter.base_commit ? `"${frontmatter.base_commit}"` : 'null'}`);
    lines.push(`extraction_method: "${frontmatter.extraction_method}"`);
    lines.push('coverage:');
    lines.push(`  total_symbols: ${frontmatter.coverage.total_symbols}`);
    lines.push(`  documented: ${frontmatter.coverage.documented}`);
    lines.push(`  undocumented: ${frontmatter.coverage.undocumented}`);
    lines.push(`  coverage_percent: ${frontmatter.coverage.coverage_percent}`);
    lines.push('statistics:');
    lines.push(`  total_modules: ${frontmatter.statistics.total_modules}`);
    lines.push(`  total_exports: ${frontmatter.statistics.total_exports}`);
    lines.push(`  documented_exports: ${frontmatter.statistics.documented_exports}`);
    lines.push('---');
    lines.push('');

    return lines.join('\n');
}

/**
 * Parses YAML frontmatter from a markdown string.
 * Extracts the frontmatter block between --- delimiters.
 *
 * @param content - Markdown content with frontmatter
 * @returns Parsed frontmatter or null if not present
 */
export function parseFrontmatter(content: string): SnapshotFrontmatter | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match || !match[1]) {
        return null;
    }

    try {
        // Simple YAML parsing for our known structure
        const yaml = match[1];
        const lines = yaml.split('\n');
        const result: Record<string, unknown> = {};
        let currentObject: Record<string, unknown> | null = null;

        for (const line of lines) {
            const indentMatch = line.match(/^(\s*)/);
            const indent = indentMatch?.[1]?.length ?? 0;

            if (indent === 0) {
                const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
                if (keyValueMatch) {
                    const key = keyValueMatch[1];
                    const value = keyValueMatch[2];
                    if (!key) continue;
                    if (value === '' || value === undefined) {
                        currentObject = {};
                        result[key] = currentObject;
                    } else {
                        result[key] = parseYamlValue(value);
                        currentObject = null;
                    }
                }
            } else if (indent === 2 && currentObject) {
                const keyValueMatch = line.match(/^\s+(\w+):\s*(.*)$/);
                if (keyValueMatch) {
                    const key = keyValueMatch[1];
                    const value = keyValueMatch[2] ?? '';
                    if (key) {
                        currentObject[key] = parseYamlValue(value);
                    }
                }
            }
        }

        return result as unknown as SnapshotFrontmatter;
    } catch {
        return null;
    }
}

/**
 * Parses a YAML value string.
 */
function parseYamlValue(value: string): string | number | boolean | null {
    // Handle quoted strings
    if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1);
    }
    // Handle null
    if (value === 'null') {
        return null;
    }
    // Handle booleans
    if (value === 'true') return true;
    if (value === 'false') return false;
    // Handle numbers
    const num = Number(value);
    if (!isNaN(num)) {
        return num;
    }
    return value;
}

/**
 * Generates a complete markdown snapshot document with frontmatter.
 *
 * @param snapshot - The API snapshot
 * @param commitHash - Optional git commit hash
 * @returns Complete markdown document with frontmatter
 */
export function generateSnapshotMarkdown(
    snapshot: APISnapshot,
    commitHash?: string
): string {
    const lines: string[] = [];

    // Add frontmatter
    lines.push(generateFrontmatter(snapshot, commitHash));

    // Add header
    lines.push(`# API Snapshot: ${snapshot.tag ?? snapshot.id}`);
    lines.push('');
    lines.push(`Generated: ${snapshot.createdAt}`);
    lines.push('');

    // Add summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Modules:** ${snapshot.statistics.totalModules}`);
    lines.push(`- **Exports:** ${snapshot.statistics.totalExports}`);
    lines.push(`- **Documented:** ${snapshot.statistics.documentedExports}`);
    const coverage = snapshot.statistics.totalExports > 0
        ? Math.round((snapshot.statistics.documentedExports / snapshot.statistics.totalExports) * 100)
        : 100;
    lines.push(`- **Coverage:** ${coverage}%`);
    lines.push('');

    // Add modules list
    lines.push('## Modules');
    lines.push('');
    for (const module of snapshot.modules) {
        lines.push(`### ${module.path}`);
        lines.push('');
        if (module.exports.length === 0) {
            lines.push('_No exports_');
        } else {
            for (const exp of module.exports) {
                const hasDoc = exp.symbol?.description && exp.symbol.description.length > 0;
                const icon = hasDoc ? '✓' : '✗';
                const kind = exp.symbol?.kind ?? 'unknown';
                lines.push(`- ${icon} \`${exp.name}\` (${kind})`);
            }
        }
        lines.push('');
    }

    return lines.join('\n');
}

// ============================================================
// Snapshot Building Helpers
// ============================================================

/**
 * Creates a ModuleAPISnapshot from extraction results.
 *
 * @param path - Module path
 * @param exports - Exported symbols
 * @param content - Module content for hashing
 * @returns ModuleAPISnapshot
 */
export async function createModuleSnapshot(
    path: string,
    exports: readonly ExportedSymbol[],
    content: string
): Promise<ModuleAPISnapshot> {
    const hash = await contentHash(content);
    return {
        path,
        exports,
        hash
    };
}
