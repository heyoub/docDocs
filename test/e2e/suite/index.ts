/**
 * @fileoverview Mocha test runner entry for @vscode/test-electron.
 */

import * as path from 'node:path';
import Mocha from 'mocha';
import { globSync } from 'glob';

export function run(): Promise<void> {
    const suiteDir = __dirname;
    const mocha = new Mocha({ ui: 'tdd', timeout: 120_000, color: true });

    for (const file of globSync('*.test.js', { cwd: suiteDir, absolute: true })) {
        mocha.addFile(file);
    }

    return new Promise((resolve, reject) => {
        mocha.run((failures) => {
            if (failures > 0) {
                reject(new Error(`${failures} E2E test(s) failed`));
            } else {
                resolve();
            }
        });
    });
}
