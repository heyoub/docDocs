/**
 * @fileoverview LRU cache for extraction results and parsed schemas.
 * Provides in-memory caching to avoid redundant LSP calls and parsing.
 *
 * @module state/cache
 * @requirements 20.3
 */

import type { FileURI } from '../types/base.js';
import type { FileExtraction } from '../types/extraction.js';

// ============================================================
// Types
// ============================================================

/**
 * Cache entry with metadata for LRU eviction.
 */
interface CacheEntry<T> {
    readonly value: T;
    readonly timestamp: number;
    lastAccessed: number;
}

/**
 * Statistics about cache usage.
 */
export interface CacheStatistics {
    readonly hits: number;
    readonly misses: number;
    readonly evictions: number;
    readonly size: number;
    readonly maxSize: number;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_MAX_SIZE = 100;

// ============================================================
// LRU Cache Implementation
// ============================================================

/**
 * Generic LRU (Least Recently Used) cache.
 * Automatically evicts least recently accessed entries when full.
 */
class LRUCache<K, V> {
    private readonly cache: Map<K, CacheEntry<V>> = new Map();
    private readonly maxSize: number;
    private hits = 0;
    private misses = 0;
    private evictions = 0;

    constructor(maxSize: number = DEFAULT_MAX_SIZE) {
        this.maxSize = Math.max(1, maxSize);
    }

    /**
     * Gets a value from the cache, updating access time.
     */
    get(key: K): V | null {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }

        // Update last accessed time
        entry.lastAccessed = Date.now();
        this.hits++;
        return entry.value;
    }

    /**
     * Sets a value in the cache, evicting LRU entry if needed.
     */
    set(key: K, value: V): void {
        // If key exists, update it
        if (this.cache.has(key)) {
            const now = Date.now();
            this.cache.set(key, {
                value,
                timestamp: now,
                lastAccessed: now,
            });
            return;
        }

        // Evict if at capacity
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        const now = Date.now();
        this.cache.set(key, {
            value,
            timestamp: now,
            lastAccessed: now,
        });
    }

    /**
     * Removes a specific key from the cache.
     */
    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clears all entries from the cache.
     */
    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }

    /**
     * Checks if a key exists in the cache.
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * Gets cache statistics.
     */
    getStatistics(): CacheStatistics {
        return {
            hits: this.hits,
            misses: this.misses,
            evictions: this.evictions,
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }

    /**
     * Gets all keys in the cache.
     */
    keys(): K[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Evicts the least recently used entry.
     */
    private evictLRU(): void {
        let oldestKey: K | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey !== null) {
            this.cache.delete(oldestKey);
            this.evictions++;
        }
    }
}

// ============================================================
// Extraction Cache
// ============================================================

/**
 * Global extraction cache instance.
 */
let extractionCache = new LRUCache<string, FileExtraction>(DEFAULT_MAX_SIZE);

/**
 * Caches an extraction result for a file.
 *
 * @param uri - The file URI
 * @param extraction - The extraction result to cache
 *
 * @example
 * cacheExtraction('file:///path/to/file.ts' as FileURI, extraction);
 */
export function cacheExtraction(uri: FileURI, extraction: FileExtraction): void {
    extractionCache.set(uri, extraction);
}

/**
 * Retrieves a cached extraction result.
 *
 * @param uri - The file URI to look up
 * @returns The cached extraction or null if not found
 *
 * @example
 * const cached = getCachedExtraction('file:///path/to/file.ts' as FileURI);
 * if (cached) {
 *   console.log('Cache hit!');
 * }
 */
export function getCachedExtraction(uri: FileURI): FileExtraction | null {
    return extractionCache.get(uri);
}

/**
 * Invalidates the cache entry for a specific file.
 * Call this when a file is modified.
 *
 * @param uri - The file URI to invalidate
 *
 * @example
 * invalidateCache('file:///path/to/file.ts' as FileURI);
 */
export function invalidateCache(uri: FileURI): void {
    extractionCache.delete(uri);
}

/**
 * Invalidates cache entries matching a pattern.
 * Useful for invalidating all files in a directory.
 *
 * @param pattern - Regex pattern to match against URIs
 *
 * @example
 * invalidateCachePattern(/^file:\/\/\/path\/to\/src\//);
 */
export function invalidateCachePattern(pattern: RegExp): void {
    const keys = extractionCache.keys();
    for (const key of keys) {
        if (pattern.test(key)) {
            extractionCache.delete(key);
        }
    }
}

/**
 * Clears all cached extractions.
 *
 * @example
 * clearCache();
 */
export function clearCache(): void {
    extractionCache.clear();
}

/**
 * Gets statistics about the extraction cache.
 *
 * @returns Cache statistics
 *
 * @example
 * const stats = getCacheStatistics();
 * console.log(`Hit rate: ${stats.hits / (stats.hits + stats.misses)}`);
 */
export function getCacheStatistics(): CacheStatistics {
    return extractionCache.getStatistics();
}

/**
 * Configures the cache with a new maximum size.
 * This clears the existing cache.
 *
 * @param maxSize - Maximum number of entries to cache
 *
 * @example
 * configureCache(200); // Increase cache size
 */
export function configureCache(maxSize: number): void {
    extractionCache = new LRUCache<string, FileExtraction>(maxSize);
}

/**
 * Gets all cached file URIs.
 *
 * @returns Array of cached file URIs
 */
export function getCachedFiles(): readonly FileURI[] {
    return extractionCache.keys() as FileURI[];
}

/**
 * Checks if a file is cached.
 *
 * @param uri - The file URI to check
 * @returns True if the file is cached
 */
export function isCached(uri: FileURI): boolean {
    return extractionCache.has(uri);
}
