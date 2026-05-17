/**
 * @fileoverview Watch-mode path rules (testable without activating the extension).
 *
 * @module extension/watchPaths
 */

/** Glob for source files monitored by watch mode */
export const WATCH_FILE_GLOB = '**/*.{ts,js,py,rs,go,hs}';

/** Path segments excluded from watch-triggered regeneration */
const WATCH_EXCLUDE_PATTERN = /node_modules|\.docdocs|dist\/|build\//;

/**
 * Returns true if a file path should not trigger watch regeneration.
 */
export function isWatchExcludedPath(fsPath: string): boolean {
    return WATCH_EXCLUDE_PATTERN.test(fsPath);
}
