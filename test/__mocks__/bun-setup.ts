/**
 * Bun test preload: register the vscode mock before tests run.
 */

import { mock } from 'bun:test';
import * as vscode from './vscode.js';

mock.module('vscode', () => vscode);
