/**
 * @fileoverview Property test for freshness persistence round-trip.
 * Verifies that FreshnessStore can be serialized and deserialized
 * without data loss.
 *
 * Feature: gendocs-extension, Property 24: Freshness Persistence Round-Trip
 * Validates: Requirements 15.5
 *
 * @module test/property/freshness-roundtrip.property.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { FileURI } from '../../src/types/base.js';
import type { FreshnessStore, FreshnessEntry } from '../../src/state/freshness.js';
import {
    getStore,
    setStore,
    clearStore,
    recordGeneration,
    checkFreshness,
    getStaleFiles,
    getOrphanedDocs,
} from '../../src/state/freshness.js';

// ============================================================
// Arbitrary Generators
// ============================================================

/**
 * Generates a valid file URI string.
 */
const arbFileURI = fc.stringMatching(/^file:\/\/\/[a-z][a-z0-9_/]*\.[a-z]{1,4}$/)
    .map(s => s as FileURI);

/**
 * Generates a valid SHA-256-like hash string (64 hex characters).
 */
const arbHash: fc.Arbitrary<string> = fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 64, maxLength: 64 })
    .map(chars => chars.join(''));

/**
 * Generates a valid ISO date string.
 */
const arbISODate = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
}).map(d => d.toISOString());

/**
 * Generates a valid git commit hash (40 hex characters).
 */
const arbGitCommit: fc.Arbitrary<string> = fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 40, maxLength: 40 })
    .map(chars => chars.join(''));

/**
 * Generates a valid FreshnessEntry.
 */
const arbFreshnessEntry: fc.Arbitrary<FreshnessEntry> = fc.record({
    sourceHash: arbHash,
    docHash: arbHash,
    lastGenerated: arbISODate,
    gitCommit: fc.option(arbGitCommit, { nil: undefined }),
}).map(entry => {
    // Remove undefined gitCommit to match the interface
    if (entry.gitCommit === undefined) {
        const { gitCommit: _, ...rest } = entry;
        return rest as FreshnessEntry;
    }
    return entry as FreshnessEntry;
});

/**
 * Generates a valid FreshnessStore with 0-50 entries.
 */
const arbFreshnessStore: fc.Arbitrary<FreshnessStore> = fc.record({
    version: fc.constant(1),
    files: fc.dictionary(
        fc.stringMatching(/^file:\/\/\/[a-z][a-z0-9_/]{0,30}\.[a-z]{1,4}$/),
        arbFreshnessEntry,
        { minKeys: 0, maxKeys: 50 }
    ),
}).map(store => ({
    version: store.version,
    files: Object.freeze(store.files),
}));

// ============================================================
// Helper Functions
// ============================================================

/**
 * Deep equality check for FreshnessStore objects.
 * Compares version and all file entries for structural equality.
 *
 * @param a - First store to compare
 * @param b - Second store to compare
 * @returns True if stores are structurally equal, false otherwise
 */
function storesAreEqual(a: FreshnessStore, b: FreshnessStore): boolean {
    if (a.version !== b.version) return false;

    const aKeys = Object.keys(a.files).sort();
    const bKeys = Object.keys(b.files).sort();

    if (aKeys.length !== bKeys.length) return false;

    for (let i = 0; i < aKeys.length; i++) {
        if (aKeys[i] !== bKeys[i]) return false;

        const aEntry = a.files[aKeys[i]];
        const bEntry = b.files[bKeys[i]];

        if (aEntry.sourceHash !== bEntry.sourceHash) return false;
        if (aEntry.docHash !== bEntry.docHash) return false;
        if (aEntry.lastGenerated !== bEntry.lastGenerated) return false;
        if (aEntry.gitCommit !== bEntry.gitCommit) return false;
    }

    return true;
}

/**
 * Simulates JSON serialization round-trip (what persist/restore does).
 * Serializes to JSON string and parses back to verify data survives the trip.
 *
 * @param store - The FreshnessStore to round-trip
 * @returns A new FreshnessStore parsed from JSON serialization
 */
function jsonRoundTrip(store: FreshnessStore): FreshnessStore {
    const json = JSON.stringify(store);
    return JSON.parse(json) as FreshnessStore;
}

// ============================================================
// Property Tests
// ============================================================

describe('Feature: gendocs-extension, Property 24: Freshness Persistence Round-Trip', () => {
    beforeEach(() => {
        clearStore();
    });

    it('should preserve all entries through JSON serialization round-trip', () => {
        fc.assert(
            fc.property(arbFreshnessStore, (originalStore) => {
                // Serialize and deserialize
                const restored = jsonRoundTrip(originalStore);

                // Verify equality
                expect(storesAreEqual(originalStore, restored)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('should preserve store state through setStore/getStore cycle', () => {
        fc.assert(
            fc.property(arbFreshnessStore, (originalStore) => {
                // Set the store
                setStore(originalStore);

                // Get it back
                const retrieved = getStore();

                // Verify equality
                expect(storesAreEqual(originalStore, retrieved)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('should preserve entries recorded via recordGeneration', () => {
        fc.assert(
            fc.property(
                arbFileURI,
                arbHash,
                arbHash,
                fc.option(arbGitCommit, { nil: undefined }),
                (uri, sourceHash, docHash, gitCommit) => {
                    clearStore();

                    // Record a generation
                    recordGeneration(uri, sourceHash, docHash, gitCommit);

                    // Get the store and round-trip it
                    const store = getStore();
                    const restored = jsonRoundTrip(store);

                    // Verify the entry is preserved
                    const entry = restored.files[uri];
                    expect(entry).toBeDefined();
                    expect(entry.sourceHash).toBe(sourceHash);
                    expect(entry.docHash).toBe(docHash);
                    if (gitCommit !== undefined) {
                        expect(entry.gitCommit).toBe(gitCommit);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should maintain freshness status after round-trip', () => {
        fc.assert(
            fc.property(
                arbFileURI,
                arbHash,
                arbHash,
                (uri, sourceHash, docHash) => {
                    clearStore();

                    // Record a generation
                    recordGeneration(uri, sourceHash, docHash);

                    // Check freshness before round-trip
                    const statusBefore = checkFreshness(uri, sourceHash);

                    // Round-trip the store
                    const store = getStore();
                    const restored = jsonRoundTrip(store);
                    setStore(restored);

                    // Check freshness after round-trip
                    const statusAfter = checkFreshness(uri, sourceHash);

                    // Status should be the same
                    expect(statusAfter.status).toBe(statusBefore.status);
                    expect(statusAfter.sourceHash).toBe(statusBefore.sourceHash);
                    expect(statusAfter.docHash).toBe(statusBefore.docHash);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should preserve stale file detection after round-trip', () => {
        fc.assert(
            fc.property(
                fc.array(arbFileURI, { minLength: 1, maxLength: 10 }),
                fc.array(arbHash, { minLength: 1, maxLength: 10 }),
                (uris, hashes) => {
                    clearStore();

                    // Record generations with original hashes
                    const uniqueUris = [...new Set(uris)];
                    for (let i = 0; i < uniqueUris.length; i++) {
                        const hash = hashes[i % hashes.length];
                        recordGeneration(uniqueUris[i], hash, hash);
                    }

                    // Create a map with modified hashes (to simulate changes)
                    const currentHashes = new Map<FileURI, string>();
                    for (let i = 0; i < uniqueUris.length; i++) {
                        // Every other file gets a different hash
                        const originalHash = hashes[i % hashes.length];
                        const currentHash = i % 2 === 0 ? originalHash : originalHash + 'modified';
                        currentHashes.set(uniqueUris[i], currentHash);
                    }

                    // Get stale files before round-trip
                    const staleBefore = getStaleFiles(currentHashes);

                    // Round-trip the store
                    const store = getStore();
                    const restored = jsonRoundTrip(store);
                    setStore(restored);

                    // Get stale files after round-trip
                    const staleAfter = getStaleFiles(currentHashes);

                    // Should have same stale files
                    expect(staleAfter.length).toBe(staleBefore.length);
                    expect(new Set(staleAfter)).toEqual(new Set(staleBefore));
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should preserve orphan detection after round-trip', () => {
        fc.assert(
            fc.property(
                fc.array(arbFileURI, { minLength: 2, maxLength: 10 }),
                arbHash,
                (uris, hash) => {
                    clearStore();

                    // Record generations for all URIs
                    const uniqueUris = [...new Set(uris)];
                    for (const uri of uniqueUris) {
                        recordGeneration(uri, hash, hash);
                    }

                    // Create a set of "existing" files (half of them)
                    const existingFiles = new Set<string>(
                        uniqueUris.slice(0, Math.ceil(uniqueUris.length / 2))
                    );

                    // Get orphans before round-trip
                    const orphansBefore = getOrphanedDocs(existingFiles);

                    // Round-trip the store
                    const store = getStore();
                    const restored = jsonRoundTrip(store);
                    setStore(restored);

                    // Get orphans after round-trip
                    const orphansAfter = getOrphanedDocs(existingFiles);

                    // Should have same orphans
                    expect(orphansAfter.length).toBe(orphansBefore.length);
                    expect(new Set(orphansAfter)).toEqual(new Set(orphansBefore));
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should handle empty store round-trip', () => {
        const emptyStore: FreshnessStore = {
            version: 1,
            files: {},
        };

        const restored = jsonRoundTrip(emptyStore);

        expect(restored.version).toBe(1);
        expect(Object.keys(restored.files)).toHaveLength(0);
    });

    it('should handle store with many entries', () => {
        fc.assert(
            fc.property(
                fc.dictionary(
                    fc.stringMatching(/^file:\/\/\/[a-z]{1,20}\.[a-z]{2,3}$/),
                    arbFreshnessEntry,
                    { minKeys: 100, maxKeys: 200 }
                ),
                (files) => {
                    const store: FreshnessStore = {
                        version: 1,
                        files,
                    };

                    const restored = jsonRoundTrip(store);

                    expect(Object.keys(restored.files).length).toBe(Object.keys(files).length);
                    expect(storesAreEqual(store, restored)).toBe(true);
                }
            ),
            { numRuns: 20 } // Fewer runs for large stores
        );
    });
});
