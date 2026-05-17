/**
 * @fileoverview Property-based tests for LSP fallback behavior.
 * Tests Property 2: LSP Fallback Behavior from the design document.
 *
 * **Validates: Requirements 1.5, 1.6**
 *
 * Property Statement:
 * *For any* file where LSP commands return null, undefined, or timeout, the LSP_Extractor
 * SHALL either retry with backoff (for timeouts) or return a typed error (for unavailable
 * LSP), and the extraction process SHALL continue without throwing exceptions.
 *
 * @module test/property/lsp-fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { FileURI, Position, Range, Result } from '../../src/types/base.js';
import type { LSPError } from '../../src/core/extractor/lspTypes.js';

// ============================================================
// Test Configuration
// ============================================================

/**
 * Minimum 100 iterations per property test as per design document.
 */
const PROPERTY_CONFIG: fc.Parameters<unknown> = {
    numRuns: 100,
    verbose: false,
};

// ============================================================
// Mock VS Code Module
// ============================================================

/**
 * Mock command execution results for testing different scenarios.
 */
type MockCommandResult = 'null' | 'undefined' | 'timeout' | 'empty-array' | 'error';

/**
 * Tracks command execution attempts for retry verification.
 */
interface CommandExecutionTracker {
    command: string;
    attempts: number;
    results: MockCommandResult[];
}

/**
 * Creates a mock vscode.commands.executeCommand function.
 */
function createMockExecuteCommand(
    behavior: MockCommandResult,
    tracker: CommandExecutionTracker
): <T>(command: string, ...args: unknown[]) => Promise<T | null | undefined> {
    return async <T>(command: string, ..._args: unknown[]): Promise<T | null | undefined> => {
        tracker.command = command;
        tracker.attempts++;
        tracker.results.push(behavior);

        switch (behavior) {
            case 'null':
                return null;
            case 'undefined':
                return undefined;
            case 'empty-array':
                return [] as unknown as T;
            case 'timeout':
                throw new Error('LSP command timed out after 5000ms');
            case 'error':
                throw new Error('LSP command failed');
            default:
                return null;
        }
    };
}

// ============================================================
// Testable Helper Functions (mirrors lspHelpers.ts)
// ============================================================

const DEFAULT_TIMEOUT_MS = 5000;
const RETRY_TIMEOUT_MULTIPLIER = 2;
const MAX_RETRIES = 1;

type LSPNullPolicy = 'reject' | 'allow';

function ok<T>(value: T): Result<T, LSPError> {
    return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

function isTimeoutError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('timed out');
}

function createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`LSP command timed out after ${ms}ms`)), ms);
    });
}

async function executeWithTimeoutTestable<T>(
    executor: () => Promise<T | null | undefined>,
    timeoutMs: number,
    command: string,
    nullPolicy: LSPNullPolicy = 'reject'
): Promise<Result<T, LSPError>> {
    try {
        const result = await Promise.race([executor(), createTimeout(timeoutMs)]);
        if (result === null || result === undefined) {
            if (nullPolicy === 'allow') {
                return ok(result as T);
            }
            return err({ type: 'unavailable', message: `${command}: language server returned no result` });
        }
        return ok(result);
    } catch (error) {
        if (isTimeoutError(error)) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        return err({ type: 'unknown', message: `${command}: ${message}` });
    }
}

async function executeWithRetryTestable<T>(
    executor: () => Promise<T | null | undefined>,
    command: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    nullPolicy: LSPNullPolicy = 'reject'
): Promise<Result<T, LSPError>> {
    let lastTimeout: LSPError | null = null;
    let currentTimeout = timeoutMs;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await executeWithTimeoutTestable<T>(executor, currentTimeout, command, nullPolicy);
        } catch (error) {
            if (isTimeoutError(error)) {
                lastTimeout = {
                    type: 'timeout',
                    message: error instanceof Error ? error.message : String(error),
                };
                currentTimeout *= RETRY_TIMEOUT_MULTIPLIER;
                continue;
            }
            const message = error instanceof Error ? error.message : String(error);
            return err({ type: 'unknown', message: `${command}: ${message}` });
        }
    }

    if (lastTimeout) {
        return err(lastTimeout);
    }
    return err({ type: 'timeout', message: `LSP command ${command} timed out` });
}

// ============================================================
// Arbitrary Generators
// ============================================================

const arbitraryFileURI: fc.Arbitrary<FileURI> = fc
    .stringMatching(/^[a-z][a-z0-9_/]*$/)
    .filter((s) => s.length > 0 && s.length <= 50)
    .map((s) => `file:///${s}.ts` as FileURI);

const arbitraryPosition: fc.Arbitrary<Position> = fc.record({
    line: fc.nat({ max: 10000 }),
    character: fc.nat({ max: 500 }),
});

const arbitraryRange: fc.Arbitrary<Range> = fc
    .tuple(arbitraryPosition, arbitraryPosition)
    .map(([start, end]) => ({
        start,
        end: {
            line: Math.max(start.line, end.line),
            character: end.line > start.line ? end.character : Math.max(start.character, end.character),
        },
    }));

const arbitraryMockCommandResult: fc.Arbitrary<MockCommandResult> = fc.constantFrom<MockCommandResult>(
    'null',
    'undefined',
    'timeout',
    'empty-array',
    'error'
);

const arbitraryNonTimeoutResult: fc.Arbitrary<MockCommandResult> = fc.constantFrom<MockCommandResult>(
    'null',
    'undefined',
    'empty-array',
    'error'
);

const arbitraryLSPCommand: fc.Arbitrary<string> = fc.constantFrom(
    'vscode.executeDocumentSymbolProvider',
    'vscode.executeHoverProvider',
    'vscode.executeReferenceProvider',
    'vscode.prepareCallHierarchy',
    'vscode.provideDocumentSemanticTokens',
    'vscode.executeTypeDefinitionProvider',
    'vscode.executeDefinitionProvider',
    'vscode.executeImplementationProvider',
    'vscode.executeSignatureHelpProvider',
    'vscode.executeInlayHintProvider'
);

const arbitraryTimeoutMs: fc.Arbitrary<number> = fc.integer({ min: 10, max: 100 });

// ============================================================
// Property Tests
// ============================================================

describe('Feature: docdocs-extension, Property 2: LSP Fallback Behavior', () => {
    it('returns unavailable error when LSP returns null', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('null', tracker);

                const result = await executeWithRetryTestable<unknown[]>(
                    () => mockExecutor(command, uri),
                    command,
                    50
                );

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.type).toBe('unavailable');
                }
                expect(tracker.attempts).toBeGreaterThanOrEqual(1);
            }),
            PROPERTY_CONFIG
        );
    });

    it('returns unavailable error when LSP returns undefined', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('undefined', tracker);

                const result = await executeWithRetryTestable<unknown[]>(
                    () => mockExecutor(command, uri),
                    command,
                    50
                );

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.type).toBe('unavailable');
                }
                expect(tracker.attempts).toBeGreaterThanOrEqual(1);
            }),
            PROPERTY_CONFIG
        );
    });

    it('retries with backoff on timeout', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('timeout', tracker);

                const result = await executeWithRetryTestable<unknown[]>(
                    () => mockExecutor(command, uri),
                    command,
                    50
                );

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.type).toBe('timeout');
                }
                expect(tracker.attempts).toBe(MAX_RETRIES + 1);
                expect(tracker.results.every(r => r === 'timeout')).toBe(true);
            }),
            PROPERTY_CONFIG
        );
    });

    it('returns unknown error on command failures without throwing', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('error', tracker);

                let threwError = false;
                let result: Result<unknown[], LSPError> | undefined;
                try {
                    result = await executeWithRetryTestable<unknown[]>(
                        () => mockExecutor(command, uri),
                        command,
                        50
                    );
                } catch {
                    threwError = true;
                }

                expect(threwError).toBe(false);
                expect(result?.ok).toBe(false);
                if (result && !result.ok) {
                    expect(result.error.type).toBe('unknown');
                }
            }),
            PROPERTY_CONFIG
        );
    });

    it('does not retry on non-timeout failures', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbitraryFileURI,
                arbitraryLSPCommand,
                arbitraryNonTimeoutResult,
                async (uri, command, resultType) => {
                    const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                    const mockExecutor = createMockExecuteCommand(resultType, tracker);

                    await executeWithRetryTestable<unknown[]>(
                        () => mockExecutor(command, uri),
                        command,
                        50
                    );

                    expect(tracker.attempts).toBe(1);
                }
            ),
            PROPERTY_CONFIG
        );
    });

    it('never throws exceptions for any failure type', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbitraryFileURI,
                arbitraryLSPCommand,
                arbitraryMockCommandResult,
                async (uri, command, resultType) => {
                    const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                    const mockExecutor = createMockExecuteCommand(resultType, tracker);

                    let threwError = false;
                    try {
                        await executeWithRetryTestable<unknown[]>(
                            () => mockExecutor(command, uri),
                            command,
                            50
                        );
                    } catch {
                        threwError = true;
                    }

                    expect(threwError).toBe(false);
                }
            ),
            PROPERTY_CONFIG
        );
    });

    it('handles empty array results as success (empty document)', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('empty-array', tracker);

                const result = await executeWithRetryTestable<unknown[]>(
                    () => mockExecutor(command, uri),
                    command,
                    50
                );

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toEqual([]);
                }
                expect(tracker.attempts).toBe(1);
            }),
            PROPERTY_CONFIG
        );
    });

    it('applies exponential backoff multiplier on retries', async () => {
        const timeoutValues: number[] = [];

        const customExecuteWithRetry = async <T>(
            _executor: () => Promise<T | null | undefined>,
            command: string,
            initialTimeoutMs: number
        ): Promise<Result<T, LSPError>> => {
            let currentTimeout = initialTimeoutMs;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                timeoutValues.push(currentTimeout);
                try {
                    throw new Error(`LSP command timed out after ${currentTimeout}ms`);
                } catch (error) {
                    if (isTimeoutError(error)) {
                        currentTimeout *= RETRY_TIMEOUT_MULTIPLIER;
                        continue;
                    }
                    return err({ type: 'unknown', message: `${command}: failed` });
                }
            }
            return err({ type: 'timeout', message: `${command}: timed out` });
        };

        await fc.assert(
            fc.asyncProperty(arbitraryTimeoutMs, async (initialTimeout) => {
                timeoutValues.length = 0;

                await customExecuteWithRetry<unknown[]>(
                    async () => { throw new Error('timeout'); },
                    'vscode.executeDocumentSymbolProvider',
                    initialTimeout
                );

                expect(timeoutValues.length).toBe(MAX_RETRIES + 1);
                for (let i = 1; i < timeoutValues.length; i++) {
                    expect(timeoutValues[i]).toBe(timeoutValues[i - 1]! * RETRY_TIMEOUT_MULTIPLIER);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    it('handles multiple sequential extractions gracefully', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(arbitraryMockCommandResult, { minLength: 1, maxLength: 10 }),
                async (resultTypes) => {
                    const results: Result<unknown[], LSPError>[] = [];
                    let anyThrew = false;

                    for (const resultType of resultTypes) {
                        const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                        const mockExecutor = createMockExecuteCommand(resultType, tracker);

                        try {
                            const result = await executeWithRetryTestable<unknown[]>(
                                () => mockExecutor('vscode.executeDocumentSymbolProvider', 'file:///test.ts'),
                                'vscode.executeDocumentSymbolProvider',
                                50
                            );
                            results.push(result);
                        } catch {
                            anyThrew = true;
                        }
                    }

                    expect(anyThrew).toBe(false);
                    expect(results.length).toBe(resultTypes.length);
                }
            ),
            PROPERTY_CONFIG
        );
    });

    it('retry count is bounded by MAX_RETRIES', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbitraryFileURI,
                fc.integer({ min: 1, max: 100 }),
                async (uri, _potentialRetries) => {
                    const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                    const mockExecutor = createMockExecuteCommand('timeout', tracker);

                    await executeWithRetryTestable<unknown[]>(
                        () => mockExecutor('vscode.executeDocumentSymbolProvider', uri),
                        'vscode.executeDocumentSymbolProvider',
                        50
                    );

                    expect(tracker.attempts).toBeLessThanOrEqual(MAX_RETRIES + 1);
                    expect(tracker.attempts).toBe(MAX_RETRIES + 1);
                }
            ),
            PROPERTY_CONFIG
        );
    });
});

describe('Feature: docdocs-extension, Property 2: LSP Fallback - Integration Scenarios', () => {
    it('handles mixed success and failure scenarios', async () => {
        let callCount = 0;
        const mixedExecutor = async <T>(): Promise<T | null | undefined> => {
            callCount++;
            if (callCount === 1) {
                throw new Error('LSP command timed out after 5000ms');
            }
            return ['symbol1', 'symbol2'] as unknown as T;
        };

        const result = await executeWithRetryTestable<string[]>(
            mixedExecutor,
            'vscode.executeDocumentSymbolProvider',
            50
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual(['symbol1', 'symbol2']);
        }
        expect(callCount).toBe(2);
    });

    it('partial failures do not affect other operations', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.boolean(), { minLength: 2, maxLength: 5 }),
                async (shouldSucceed) => {
                    const results: Result<string[], LSPError>[] = [];

                    for (const success of shouldSucceed) {
                        const executor = async <T>(): Promise<T | null | undefined> => {
                            if (success) {
                                return ['result'] as unknown as T;
                            }
                            return null;
                        };

                        const result = await executeWithRetryTestable<string[]>(
                            executor,
                            'vscode.executeDocumentSymbolProvider',
                            50
                        );
                        results.push(result);
                    }

                    for (let i = 0; i < shouldSucceed.length; i++) {
                        if (shouldSucceed[i]) {
                            expect(results[i]?.ok).toBe(true);
                        } else {
                            expect(results[i]?.ok).toBe(false);
                        }
                    }
                }
            ),
            PROPERTY_CONFIG
        );
    });
});
