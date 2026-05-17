/**
 * @fileoverview Proactively warms completion/symbol provider caches.
 *
 * @module core/pipeline/schemaCacheWarmer
 */

import * as vscode from 'vscode';
import type { FileURI } from '../../types/index.js';
import { buildModuleSchema } from './buildModuleSchema.js';
import { indexSchemaInProviders } from './indexGeneratedSchema.js';
import { formatExtractionError } from '../../types/extraction.js';
import { getDocCacheSchema } from '../../providers/completion.js';
import { getStore } from '../../state/freshness.js';
import { isWatchExcludedPath } from '../../extension/watchPaths.js';

const SOURCE_GLOB = '**/*.{ts,js,tsx,jsx,py,rs,go,hs}';
const SOURCE_EXCLUDE = '**/{node_modules,.docdocs,dist,build}/**';

/** Language IDs we can warm via buildModuleSchema */
const WARM_LANGUAGE_PATTERN = /\.(ts|tsx|js|jsx|py|rs|go|hs)$/i;

export interface SchemaCacheWarmerOptions {
    readonly maxConcurrent?: number;
    readonly maxFilesPerBatch?: number;
}

/**
 * Schedules background cache warming for provider IntelliSense.
 */
export class SchemaCacheWarmer implements vscode.Disposable {
    private readonly maxConcurrent: number;
    private readonly maxFilesPerBatch: number;
    private readonly inFlight = new Map<string, Promise<void>>();
    private disposed = false;

    constructor(options: SchemaCacheWarmerOptions = {}) {
        this.maxConcurrent = options.maxConcurrent ?? 2;
        this.maxFilesPerBatch = options.maxFilesPerBatch ?? 24;
    }

    /**
     * Warms cache for a single document if not already cached.
     */
    scheduleWarm(uri: vscode.Uri): void {
        if (this.disposed) return;
        if (!WARM_LANGUAGE_PATTERN.test(uri.fsPath)) return;
        if (isWatchExcludedPath(uri.fsPath)) return;

        const fileUri = uri.toString() as FileURI;
        if (getDocCacheSchema(fileUri)) return;
        if (this.inFlight.has(fileUri)) return;

        const task = this.warmUri(uri).finally(() => {
            this.inFlight.delete(fileUri);
        });
        this.inFlight.set(fileUri, task);
    }

    /**
     * Warms caches for files listed in the freshness store (already documented once).
     */
    async warmTrackedFiles(): Promise<number> {
        const uris = Object.keys(getStore().files)
            .map(u => vscode.Uri.parse(u))
            .filter(u => WARM_LANGUAGE_PATTERN.test(u.fsPath))
            .filter(u => !isWatchExcludedPath(u.fsPath))
            .slice(0, this.maxFilesPerBatch);

        await this.warmUris(uris);
        return uris.length;
    }

    /**
     * Warms caches for all open text editors.
     */
    async warmOpenEditors(): Promise<number> {
        const uris = vscode.window.visibleTextEditors
            .map(e => e.document.uri)
            .filter(u => u.scheme === 'file')
            .filter(u => WARM_LANGUAGE_PATTERN.test(u.fsPath));

        await this.warmUris(uris);
        return uris.length;
    }

    /**
     * Warms caches for workspace source files (bounded batch).
     */
    async warmWorkspaceSample(): Promise<number> {
        const files = await vscode.workspace.findFiles(
            SOURCE_GLOB,
            SOURCE_EXCLUDE,
            this.maxFilesPerBatch
        );
        await this.warmUris(files);
        return files.length;
    }

    dispose(): void {
        this.disposed = true;
        this.inFlight.clear();
    }

    private async warmUris(uris: readonly vscode.Uri[]): Promise<void> {
        const queue = [...uris];
        const workers = Array.from({ length: this.maxConcurrent }, async () => {
            while (queue.length > 0 && !this.disposed) {
                const next = queue.shift();
                if (!next) break;
                await this.warmUri(next);
            }
        });
        await Promise.all(workers);
    }

    private async warmUri(uri: vscode.Uri): Promise<void> {
        const fileUri = uri.toString() as FileURI;
        if (getDocCacheSchema(fileUri)) return;

        const languageId = languageIdFromUri(uri);
        const result = await buildModuleSchema(uri, languageId);
        if (!result.ok) {
            console.warn(`[docDocs] Cache warm skipped ${uri.fsPath}: ${formatExtractionError(result.error)}`);
            return;
        }
        indexSchemaInProviders(fileUri, result.value);
    }
}

function languageIdFromUri(uri: vscode.Uri): string {
    const ext = uri.fsPath.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescriptreact',
        js: 'javascript',
        jsx: 'javascriptreact',
        py: 'python',
        rs: 'rust',
        go: 'go',
        hs: 'haskell',
    };
    return map[ext] ?? ext;
}

/**
 * Registers automatic cache warming from VS Code settings.
 */
export function registerSchemaCacheWarmer(
    context: vscode.ExtensionContext
): SchemaCacheWarmer {
    const warmer = new SchemaCacheWarmer();
    const config = () => vscode.workspace.getConfiguration('docdocs');

    const onOpen = vscode.workspace.onDidOpenTextDocument((doc) => {
        if (doc.uri.scheme !== 'file') return;
        if (!config().get<boolean>('completion.preloadOnOpen', true)) return;
        warmer.scheduleWarm(doc.uri);
    });

    const onActivateWarm = async (): Promise<void> => {
        if (!config().get<boolean>('completion.warmTrackedOnActivate', true)) return;
        const count = await warmer.warmTrackedFiles();
        if (count > 0) {
            console.log(`[docDocs] Warmed provider cache for ${count} tracked file(s)`);
        }
        await warmer.warmOpenEditors();
        if (config().get<boolean>('completion.warmWorkspaceOnActivate', false)) {
            const sample = await warmer.warmWorkspaceSample();
            if (sample > 0) {
                console.log(`[docDocs] Warmed provider cache for ${sample} workspace file(s)`);
            }
        }
    };

    void onActivateWarm();

    context.subscriptions.push(
        warmer,
        onOpen,
        vscode.commands.registerCommand('docdocs.warmProviderCache', async () => {
            const tracked = await warmer.warmTrackedFiles();
            const editors = await warmer.warmOpenEditors();
            const workspace = await warmer.warmWorkspaceSample();
            void vscode.window.showInformationMessage(
                `docDocs: warmed cache (${tracked} tracked, ${editors} open, ${workspace} workspace sample)`
            );
        })
    );

    return warmer;
}
