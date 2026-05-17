/**
 * @fileoverview Workspace-relative module path resolution for schemas and graphs.
 *
 * @module utils/modulePath
 */

import type { FileURI } from '../types/base.js';

/**
 * Normalizes a FileURI to a POSIX-style filesystem path (no file:// prefix).
 */
export function normalizeFileUriPath(uri: FileURI): string {
    let path = uri.replace(/^file:\/\//, '');
    try {
        path = decodeURIComponent(path);
    } catch {
        // keep raw path when decode fails
    }
    path = path.replace(/\\/g, '/');
    if (/^\/[A-Za-z]:/.test(path)) {
        path = path.slice(1);
    }
    return path;
}

/**
 * Resolves a module path relative to the workspace root when possible.
 */
export function resolveModulePath(uri: FileURI, workspaceRootFsPath?: string): string {
    const normalized = normalizeFileUriPath(uri);
    if (!workspaceRootFsPath) {
        return fallbackRelativePath(normalized);
    }

    const root = workspaceRootFsPath.replace(/\\/g, '/').replace(/\/$/, '');
    const full = normalized;
    if (full === root) {
        return 'index';
    }
    if (full.startsWith(`${root}/`)) {
        return full.slice(root.length + 1);
    }

    return fallbackRelativePath(normalized);
}

function fallbackRelativePath(normalized: string): string {
    const srcIdx = normalized.indexOf('/src/');
    if (srcIdx >= 0) {
        return normalized.slice(srcIdx + 1);
    }
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length <= 3) {
        return segments.join('/');
    }
    return segments.slice(-3).join('/');
}
