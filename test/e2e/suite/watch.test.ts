/**
 * @fileoverview E2E test for watch-mode debounced regeneration.
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { findDocOutputContaining, sleep, waitUntil } from './helpers.js';

const WATCH_MARKER = 'e2eWatchPing9f2c';

suite('docDocs watch E2E', () => {
    test('watch regenerates documentation after save', async function () {
        this.timeout(180_000);

        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length > 0, 'workspace folder required');
        const folder = folders[0]!;
        const exampleUri = vscode.Uri.joinPath(folder.uri, 'src', 'example.ts');

        const config = vscode.workspace.getConfiguration('docdocs', folder.uri);
        await config.update('watch.enabled', true, vscode.ConfigurationTarget.Workspace);
        await config.update('watch.debounceMs', 400, vscode.ConfigurationTarget.Workspace);

        // Allow configuration listener to sync watch controller state
        await sleep(600);

        const doc = await vscode.workspace.openTextDocument(exampleUri);
        await vscode.window.showTextDocument(doc);

        const originalText = doc.getText();
        const insertion = `\n/** ${WATCH_MARKER} */\nexport function ${WATCH_MARKER}(): number {\n    return 42;\n}\n`;

        try {
            const edit = new vscode.WorkspaceEdit();
            edit.insert(exampleUri, new vscode.Position(doc.lineCount, 0), insertion);
            const applied = await vscode.workspace.applyEdit(edit);
            assert.ok(applied, 'workspace edit should apply');

            const updated = await vscode.workspace.openTextDocument(exampleUri);
            await updated.save();

            await waitUntil(
                async () => (await findDocOutputContaining(folder, WATCH_MARKER)) !== undefined,
                `expected .docdocs markdown containing ${WATCH_MARKER} after watch save`,
                { timeoutMs: 150_000, intervalMs: 750 }
            );

            const outputUri = await findDocOutputContaining(folder, WATCH_MARKER);
            assert.ok(outputUri, 'documentation output file should exist');

            const outputText = new TextDecoder().decode(
                await vscode.workspace.fs.readFile(outputUri)
            );
            assert.ok(
                outputText.includes(WATCH_MARKER),
                'generated markdown should document the watch-triggered symbol'
            );
        } finally {
            await vscode.workspace.fs.writeFile(
                exampleUri,
                new TextEncoder().encode(originalText)
            );
            await config.update('watch.enabled', false, vscode.ConfigurationTarget.Workspace);
        }
    });
});
