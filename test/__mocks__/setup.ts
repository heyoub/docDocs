/**
 * Test setup file for Bun test runner.
 * Registers the vscode mock module before tests run.
 */

import { mock } from 'bun:test';
import * as vscode from './vscode.js';

// Register the vscode mock
mock.module('vscode', () => vscode);
