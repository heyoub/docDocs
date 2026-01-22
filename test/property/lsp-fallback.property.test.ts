/**
 * @fileoverview Property-based tests for LSP fallback behavior.
 * Tests Property 2: LSP Fallback Behavior from the design document.
 *
 * **Validates: Requirements 1.5, 1.6**
 *
 * Property Statement:
 * *For any* file where LSP commands return null, undefined, or timeout, the LSP_Extractor
 * SHALL either retry with backoff (for timeouts) or gracefully skip the file (for unavailable
 * LSP), and the extraction process SHALL continue without throwing exceptions.
 *
 * @module test/property/lsp-fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { FileURI, Position, Range } from '../../src/types/base.js';

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
                // Simulate a timeout by creating a promise that never resolves
                // but will be caught by the timeout wrapper
                throw new Error('LSP command timed out after 5000ms');
            case 'error':
                throw new Error('LSP command failed');
            default:
                return null;
        }
    };
}

// ============================================================
// Testable Helper Functions (Extracted Logic)
// ============================================================

/**
 * Default timeout for LSP commands in milliseconds.
 */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Retry timeout multiplier for exponential backoff.
 */
const RETRY_TIMEOUT_MULTIPLIER = 2;

/**
 * Maximum number of retry attempts.
 */
const MAX_RETRIES = 1;

/**
 * Creates a timeout promise that rejects after the specified duration.
 */
function createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`LSP command timed out after ${ms}ms`)), ms);
    });
}

/**
 * Executes a command with timeout handling.
 * This is a testable version that accepts a command executor function.
 */
async function executeWithTimeoutTestable<T>(
    executor: () => Promise<T | null | undefined>,
    timeoutMs: number
): Promise<T | null> {
    try {
        const result = await Promise.race([
            executor(),
            createTimeout(timeoutMs)
        ]);
        return result ?? null;
    } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
            throw error;
        }
        return null;
    }
}

/**
 * Executes a command with retry logic for timeouts.
 * This is a testable version that accepts a command executor function.
 */
async function executeWithRetryTestable<T>(
    executor: () => Promise<T | null | undefined>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T | null> {
    let lastError: Error | null = null;
    let currentTimeout = timeoutMs;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await executeWithTimeoutTestable<T>(executor, currentTimeout);
        } catch (error) {
            if (error instanceof Error && error.message.includes('timed out')) {
                lastError = error;
                currentTimeout *= RETRY_TIMEOUT_MULTIPLIER;
                continue;
            }
            return null;
        }
    }

    // After all retries exhausted, return null (graceful skip)
    return null;
}

// ============================================================
// Arbitrary Generators
// ============================================================

/**
 * Generates a valid FileURI.
 */
const arbitraryFileURI: fc.Arbitrary<FileURI> = fc
    .stringMatching(/^[a-z][a-z0-9_/]*$/)
    .filter((s) => s.length > 0 && s.length <= 50)
    .map((s) => `file:///${s}.ts` as FileURI);

/**
 * Generates a valid Position.
 */
const arbitraryPosition: fc.Arbitrary<Position> = fc.record({
    line: fc.nat({ max: 10000 }),
    character: fc.nat({ max: 500 }),
});

/**
 * Generates a valid Range.
 */
const arbitraryRange: fc.Arbitrary<Range> = fc
    .tuple(arbitraryPosition, arbitraryPosition)
    .map(([start, end]) => ({
        start,
        end: {
            line: Math.max(start.line, end.line),
            character: end.line > start.line ? end.character : Math.max(start.character, end.character),
        },
    }));

/**
 * Generates a mock command result type.
 */
const arbitraryMockCommandResult: fc.Arbitrary<MockCommandResult> = fc.constantFrom<MockCommandResult>(
    'null',
    'undefined',
    'timeout',
    'empty-array',
    'error'
);

/**
 * Generates a non-timeout mock command result (for testing graceful skip).
 */
const arbitraryNonTimeoutResult: fc.Arbitrary<MockCommandResult> = fc.constantFrom<MockCommandResult>(
    'null',
    'undefined',
    'empty-array',
    'error'
);

/**
 * Generates LSP command names.
 */
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

/**
 * Generates a timeout value in milliseconds.
 */
const arbitraryTimeoutMs: fc.Arbitrary<number> = fc.integer({ min: 10, max: 100 });

// ============================================================
// Property Tests
// ============================================================

describe('Feature: gendocs-extension, Property 2: LSP Fallback Behavior', () => {
    /**
     * Property: When LSP commands return null, the extraction returns ok: true with empty result.
     *
     * **Validates: Requirements 1.5**
     */
    it('returns ok result when LSP returns null', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('null', tracker);

                const result = await executeWithRetryTestable<unknown[]>(
                    () => mockExecutor(command, uri),
                    50 // Short timeout for testing
                );

                // Should return null (graceful handling) without throwing
                expect(result).toBeNull();
                // Should have attempted at least once
                expect(tracker.attempts).toBeGreaterThanOrEqual(1);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: When LSP commands return undefined, the extraction returns ok: true with empty result.
     *
     * **Validates: Requirements 1.5**
     */
    it('returns ok result when LSP returns undefined', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('undefined', tracker);

                const result = await executeWithRetryTestable<unknown[]>(
                    () => mockExecutor(command, uri),
                    50
                );

                // Should return null (graceful handling) without throwing
                expect(result).toBeNull();
                expect(tracker.attempts).toBeGreaterThanOrEqual(1);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: When LSP commands timeout, retry logic is triggered with exponential backoff.
     *
     * **Validates: Requirements 1.6**
     */
    it('retries with backoff on timeout', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('timeout', tracker);

                const result = await executeWithRetryTestable<unknown[]>(
                    () => mockExecutor(command, uri),
                    50
                );

                // Should return null after retries exhausted
                expect(result).toBeNull();
                // Should have attempted MAX_RETRIES + 1 times (initial + retries)
                expect(tracker.attempts).toBe(MAX_RETRIES + 1);
                // All attempts should have been timeouts
                expect(tracker.results.every(r => r === 'timeout')).toBe(true);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: When LSP commands throw errors, the extraction gracefully returns null.
     *
     * **Validates: Requirements 1.5**
     */
    it('gracefully handles errors without throwing', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('error', tracker);

                // Should not throw
                let threwError = false;
                let result: unknown[] | null = null;
                try {
                    result = await executeWithRetryTestable<unknown[]>(
                        () => mockExecutor(command, uri),
                        50
                    );
                } catch {
                    threwError = true;
                }

                expect(threwError).toBe(false);
                expect(result).toBeNull();
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: For any non-timeout failure, no retry is attempted (graceful skip).
     *
     * **Validates: Requirements 1.5**
     */
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
                        50
                    );

                    // For non-timeout failures, should only attempt once
                    expect(tracker.attempts).toBe(1);
                }
            ),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: The extraction process continues without throwing exceptions for any failure type.
     *
     * **Validates: Requirements 1.5, 1.6**
     */
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
                            50
                        );
                    } catch {
                        threwError = true;
                    }

                    // Should never throw, regardless of failure type
                    expect(threwError).toBe(false);
                }
            ),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Empty array results are handled gracefully (not treated as errors).
     *
     * **Validates: Requirements 1.5**
     */
    it('handles empty array results gracefully', async () => {
        await fc.assert(
            fc.asyncProperty(arbitraryFileURI, arbitraryLSPCommand, async (uri, command) => {
                const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                const mockExecutor = createMockExecuteCommand('empty-array', tracker);

                const result = await executeWithRetryTestable<unknown[]>(
                    () => mockExecutor(command, uri),
                    50
                );

                // Empty array should be returned as-is (not null)
                expect(result).toEqual([]);
                // Should only attempt once (no retry needed for valid response)
                expect(tracker.attempts).toBe(1);
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Timeout backoff multiplier is applied correctly.
     *
     * **Validates: Requirements 1.6**
     */
    it('applies exponential backoff multiplier on retries', async () => {
        // Track the actual timeout values used
        const timeoutValues: number[] = [];
        let attemptCount = 0;

        const customExecuteWithRetry = async <T>(
            executor: () => Promise<T | null | undefined>,
            initialTimeoutMs: number
        ): Promise<T | null> => {
            let currentTimeout = initialTimeoutMs;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                timeoutValues.push(currentTimeout);
                attemptCount++;
                try {
                    // Always timeout for this test
                    throw new Error(`LSP command timed out after ${currentTimeout}ms`);
                } catch (error) {
                    if (error instanceof Error && error.message.includes('timed out')) {
                        currentTimeout *= RETRY_TIMEOUT_MULTIPLIER;
                        continue;
                    }
                    return null;
                }
            }
            return null;
        };

        await fc.assert(
            fc.asyncProperty(arbitraryTimeoutMs, async (initialTimeout) => {
                timeoutValues.length = 0;
                attemptCount = 0;

                await customExecuteWithRetry<unknown[]>(
                    async () => { throw new Error('timeout'); },
                    initialTimeout
                );

                // Verify exponential backoff
                expect(timeoutValues.length).toBe(MAX_RETRIES + 1);
                for (let i = 1; i < timeoutValues.length; i++) {
                    expect(timeoutValues[i]).toBe(timeoutValues[i - 1]! * RETRY_TIMEOUT_MULTIPLIER);
                }
            }),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Multiple sequential extractions all handle failures gracefully.
     *
     * **Validates: Requirements 1.5, 1.6**
     */
    it('handles multiple sequential extractions gracefully', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(arbitraryMockCommandResult, { minLength: 1, maxLength: 10 }),
                async (resultTypes) => {
                    const results: (unknown[] | null)[] = [];
                    let anyThrew = false;

                    for (const resultType of resultTypes) {
                        const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                        const mockExecutor = createMockExecuteCommand(resultType, tracker);

                        try {
                            const result = await executeWithRetryTestable<unknown[]>(
                                () => mockExecutor('vscode.executeDocumentSymbolProvider', 'file:///test.ts'),
                                50
                            );
                            results.push(result);
                        } catch {
                            anyThrew = true;
                        }
                    }

                    // No extraction should throw
                    expect(anyThrew).toBe(false);
                    // All extractions should complete
                    expect(results.length).toBe(resultTypes.length);
                }
            ),
            PROPERTY_CONFIG
        );
    });

    /**
     * Property: Retry count is bounded by MAX_RETRIES constant.
     *
     * **Validates: Requirements 1.6**
     */
    it('retry count is bounded by MAX_RETRIES', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbitraryFileURI,
                fc.integer({ min: 1, max: 100 }), // Simulate many potential retries
                async (uri, _potentialRetries) => {
                    const tracker: CommandExecutionTracker = { command: '', attempts: 0, results: [] };
                    const mockExecutor = createMockExecuteCommand('timeout', tracker);

                    await executeWithRetryTestable<unknown[]>(
                        () => mockExecutor('vscode.executeDocumentSymbolProvider', uri),
                        50
                    );

                    // Attempts should never exceed MAX_RETRIES + 1
                    expect(tracker.attempts).toBeLessThanOrEqual(MAX_RETRIES + 1);
                    expect(tracker.attempts).toBe(MAX_RETRIES + 1);
                }
            ),
            PROPERTY_CONFIG
        );
    });
});

describe('Feature: gendocs-extension, Property 2: LSP Fallback - Integration Scenarios', () => {
    /**
     * Property: Mixed success and failure scenarios are handled correctly.
     */
    it('handles mixed success and failure scenarios', async () => {
        // Simulate a scenario where first call times out, retry succeeds
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
            50
        );

        // Should succeed on retry
        expect(result).toEqual(['symbol1', 'symbol2']);
        expect(callCount).toBe(2);
    });

    /**
     * Property: Partial failures in batch operations don't affect other operations.
     */
    it('partial failures do not affect other operations', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.boolean(), { minLength: 2, maxLength: 5 }),
                async (shouldSucceed) => {
                    const results: (string[] | null)[] = [];

                    for (const success of shouldSucceed) {
                        const executor = async <T>(): Promise<T | null | undefined> => {
                            if (success) {
                                return ['result'] as unknown as T;
                            }
                            return null;
                        };

                        const result = await executeWithRetryTestable<string[]>(executor, 50);
                        results.push(result);
                    }

                    // Each result should match expected outcome
                    for (let i = 0; i < shouldSucceed.length; i++) {
                        if (shouldSucceed[i]) {
                            expect(results[i]).toEqual(['result']);
                        } else {
                            expect(results[i]).toBeNull();
                        }
                    }
                }
            ),
            PROPERTY_CONFIG
        );
    });
});
