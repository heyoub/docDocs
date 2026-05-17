/**
 * @fileoverview Unit tests for watch debounce controller (fake timers).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { createWatchController } from '../../src/extension/watchController.js';

describe('createWatchController', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('debounces regenerate to a single call per file', async () => {
        const onRegenerate = vi.fn();

        const controller = createWatchController(onRegenerate, { setWatching: vi.fn() }, {
            resolveWatchConfig: vi.fn(async () => ({
                enabled: true,
                autoRegenerate: true,
                debounceMs: 500,
            })),
            getWorkspaceFolder: () =>
                ({ uri: vscode.Uri.file('/workspace') }) as vscode.WorkspaceFolder,
            getWorkspaceFolders: () =>
                [{ uri: vscode.Uri.file('/workspace') }] as readonly vscode.WorkspaceFolder[],
            updateWatchEnabled: vi.fn(),
            setWatching: vi.fn(),
            showWarning: vi.fn(),
            showInformation: vi.fn(),
        });

        await controller.syncFromConfig();

        const uri = vscode.Uri.file('/workspace/src/example.ts');
        controller.scheduleRegenerate(uri);
        controller.scheduleRegenerate(uri);
        controller.scheduleRegenerate(uri);

        await vi.waitUntil(() => controller.pendingCount() === 1, { timeout: 200 });

        await vi.advanceTimersByTimeAsync(500);
        expect(onRegenerate).toHaveBeenCalledTimes(1);
        expect(onRegenerate).toHaveBeenCalledWith(uri);
        expect(controller.pendingCount()).toBe(0);

        controller.dispose();
    });

    it('does not schedule when watch is disabled', async () => {
        const onRegenerate = vi.fn();
        const controller = createWatchController(onRegenerate, { setWatching: vi.fn() }, {
            resolveWatchConfig: vi.fn(async () => ({
                enabled: false,
                autoRegenerate: true,
                debounceMs: 100,
            })),
            getWorkspaceFolder: () =>
                ({ uri: vscode.Uri.file('/workspace') }) as vscode.WorkspaceFolder,
            getWorkspaceFolders: () =>
                [{ uri: vscode.Uri.file('/workspace') }] as readonly vscode.WorkspaceFolder[],
            updateWatchEnabled: vi.fn(),
            setWatching: vi.fn(),
            showWarning: vi.fn(),
            showInformation: vi.fn(),
        });

        await controller.syncFromConfig();
        controller.scheduleRegenerate(vscode.Uri.file('/workspace/src/example.ts'));
        await vi.advanceTimersByTimeAsync(200);

        expect(onRegenerate).not.toHaveBeenCalled();
    });
});
