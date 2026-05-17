/**
 * @fileoverview VS Code extension host E2E smoke tests.
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('docDocs E2E', () => {
    test('extension activates and registers core commands', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(
            commands.includes('docdocs.generateFile'),
            'docdocs.generateFile should be registered'
        );
        assert.ok(
            commands.includes('docdocs.preview'),
            'docdocs.preview should be registered'
        );
        assert.ok(
            commands.includes('docdocs.toggleWatch'),
            'docdocs.toggleWatch should be registered'
        );
    });

    test('sample workspace folder is loaded', () => {
        assert.ok(
            vscode.workspace.workspaceFolders &&
                vscode.workspace.workspaceFolders.length > 0,
            'E2E workspace folder should be open'
        );
    });

    test('can open sample TypeScript document', async () => {
        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length > 0);
        const exampleUri = vscode.Uri.joinPath(folders[0]!.uri, 'src', 'example.ts');
        const doc = await vscode.workspace.openTextDocument(exampleUri);
        assert.ok(doc.getText().includes('greet'));
    });

    test('preview command runs without throwing', async function () {
        this.timeout(90_000);
        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length > 0);
        const exampleUri = vscode.Uri.joinPath(folders[0]!.uri, 'src', 'example.ts');
        await vscode.window.showTextDocument(exampleUri);
        await vscode.commands.executeCommand('docdocs.preview', exampleUri);
    });

    test('warmProviderCache command is registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('docdocs.warmProviderCache'));
    });

    test('extension bundles tree-sitter wasm grammars', async () => {
        const ext = vscode.extensions.getExtension('heyoub.docdocs');
        assert.ok(ext, 'docdocs extension should be present');
        await ext.activate();
        const wasmUri = vscode.Uri.joinPath(ext.extensionUri, 'wasm', 'tree-sitter-typescript.wasm');
        const stat = await vscode.workspace.fs.stat(wasmUri);
        assert.ok(stat.size > 0, 'typescript grammar wasm should be packaged');
    });

    test('warmProviderCache runs for open editor', async function () {
        this.timeout(90_000);
        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length > 0);
        const exampleUri = vscode.Uri.joinPath(folders[0]!.uri, 'src', 'example.ts');
        await vscode.window.showTextDocument(exampleUri);
        await vscode.commands.executeCommand('docdocs.warmProviderCache');
    });
});
