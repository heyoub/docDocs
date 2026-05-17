/**
 * @fileoverview Shared helpers for docDocs E2E tests.
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';

export interface WaitForOptions {
    readonly timeoutMs?: number;
    readonly intervalMs?: number;
}

/**
 * Polls until predicate returns true or times out.
 */
export async function waitUntil(
    predicate: () => boolean | Promise<boolean>,
    message: string,
    options: WaitForOptions = {}
): Promise<void> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const intervalMs = options.intervalMs ?? 500;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        if (await predicate()) {
            return;
        }
        await sleep(intervalMs);
    }

    assert.fail(message);
}

/**
 * Finds a markdown file under `.docdocs` whose content includes the marker.
 */
export async function findDocOutputContaining(
    workspaceFolder: vscode.WorkspaceFolder,
    marker: string
): Promise<vscode.Uri | undefined> {
    const pattern = new vscode.RelativePattern(workspaceFolder, '.docdocs/**/*.md');
    const files = await vscode.workspace.findFiles(pattern, null, 100);

    for (const uri of files) {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder().decode(bytes);
        if (text.includes(marker)) {
            return uri;
        }
    }

    return undefined;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
