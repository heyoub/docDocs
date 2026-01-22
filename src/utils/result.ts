/**
 * @fileoverview Result type utilities for type-safe error handling.
 * Provides helper functions for creating and transforming Result types
 * without using exceptions.
 *
 * @module utils/result
 */

import type { Result } from '../types/base.js';

/**
 * Creates a successful Result containing the given value.
 *
 * @typeParam T - The type of the success value
 * @param value - The success value to wrap
 * @returns A Result in the success state
 *
 * @example
 * const result = ok(42);
 * // result: { ok: true, value: 42 }
 */
export function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

/**
 * Creates a failed Result containing the given error.
 *
 * @typeParam E - The type of the error
 * @param error - The error to wrap
 * @returns A Result in the error state
 *
 * @example
 * const result = err(new Error('Something went wrong'));
 * // result: { ok: false, error: Error('Something went wrong') }
 */
export function err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

/**
 * Transforms the success value of a Result using the provided function.
 * If the Result is an error, returns the error unchanged.
 *
 * @typeParam T - The type of the original success value
 * @typeParam U - The type of the transformed success value
 * @typeParam E - The type of the error
 * @param result - The Result to transform
 * @param fn - The function to apply to the success value
 * @returns A new Result with the transformed value or the original error
 *
 * @example
 * const result = ok(5);
 * const doubled = mapResult(result, x => x * 2);
 * // doubled: { ok: true, value: 10 }
 *
 * const errorResult = err('failed');
 * const mapped = mapResult(errorResult, x => x * 2);
 * // mapped: { ok: false, error: 'failed' }
 */
export function mapResult<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U
): Result<U, E> {
    if (result.ok) {
        return { ok: true, value: fn(result.value) };
    }
    return result;
}

/**
 * Chains operations that return Results, flattening the nested Result.
 * If the input Result is an error, returns the error unchanged.
 * Otherwise, applies the function to the success value.
 *
 * @typeParam T - The type of the original success value
 * @typeParam U - The type of the new success value
 * @typeParam E - The type of the error
 * @param result - The Result to chain from
 * @param fn - The function that returns a new Result
 * @returns The Result from the function or the original error
 *
 * @example
 * const divide = (a: number, b: number): Result<number, string> =>
 *     b === 0 ? err('division by zero') : ok(a / b);
 *
 * const result = ok(10);
 * const divided = flatMapResult(result, x => divide(x, 2));
 * // divided: { ok: true, value: 5 }
 *
 * const chainedError = flatMapResult(result, x => divide(x, 0));
 * // chainedError: { ok: false, error: 'division by zero' }
 */
export function flatMapResult<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
): Result<U, E> {
    if (result.ok) {
        return fn(result.value);
    }
    return result;
}
