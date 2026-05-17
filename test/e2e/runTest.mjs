/**
 * Launches VS Code extension host and runs E2E tests.
 * Workspace folder is appended after extension test flags so VS Code does not
 * treat it as the test entry module (see @vscode/test-electron concat order).
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cp from 'node:child_process';
import { downloadAndUnzipVSCode } from '@vscode/test-electron/out/download.js';
import { getProfileArguments } from '@vscode/test-electron/out/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDevelopmentPath = path.resolve(__dirname, '../..');
const extensionTestsPath = path.resolve(__dirname, './dist/suite');
const testWorkspace = path.resolve(__dirname, './fixtures/sample-workspace');

async function main() {
    const vscodeExecutablePath = await downloadAndUnzipVSCode({});

    let args = [
        '--no-sandbox',
        '--disable-gpu-sandbox',
        '--disable-updates',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-workspace-trust',
        `--extensionTestsPath=${extensionTestsPath}`,
        `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
        testWorkspace,
    ];

    args.push(...getProfileArguments(args));

    const installDir = path.dirname(vscodeExecutablePath);
    const executable = path.join(installDir, 'bin', 'code');

    const exitCode = await new Promise((resolve, reject) => {
        const child = cp.spawn(executable, args, {
            env: { ...process.env },
            stdio: 'inherit',
        });
        child.on('error', reject);
        child.on('close', (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
        console.error(`[docDocs E2E] VS Code test exit code: ${exitCode}`);
        process.exit(exitCode);
    }
}

main().catch((error) => {
    console.error('[docDocs E2E] Failed:', error);
    process.exit(1);
});
