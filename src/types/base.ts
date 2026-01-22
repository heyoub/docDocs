/**
 * @fileoverview Foundational types for GenDocs extension.
 * This module contains branded types, position/range interfaces, and result types.
 * Zero imports - this is the base layer of the type system.
 *
 * @module types/base
 */

// ============================================================
// Branded Types
// ============================================================

/**
 * Branded type for file URIs.
 * Prevents accidental mixing of file URIs with regular strings.
 *
 * @example
 * const uri = 'file:///path/to/file.ts' as FileURI;
 */
export type FileURI = string & { readonly __brand: 'FileURI' };

/**
 * Branded type for symbol IDs.
 * Ensures symbol identifiers are not confused with other string types.
 *
 * @example
 * const id = 'MyClass#myMethod' as SymbolID;
 */
export type SymbolID = string & { readonly __brand: 'SymbolID' };

/**
 * Branded type for JSON Schema $ref values.
 * Prevents mixing schema references with regular strings.
 *
 * @example
 * const ref = '#/definitions/MyType' as SchemaRef;
 */
export type SchemaRef = string & { readonly __brand: 'SchemaRef' };

// ============================================================
// Position and Range Types
// ============================================================

/**
 * Position in a document.
 * Uses zero-based line and character indices.
 */
export interface Position {
    /** Zero-based line number */
    readonly line: number;
    /** Zero-based character offset on the line */
    readonly character: number;
}

/**
 * Range in a document defined by start and end positions.
 * The range is inclusive of start and exclusive of end.
 */
export interface Range {
    /** Start position (inclusive) */
    readonly start: Position;
    /** End position (exclusive) */
    readonly end: Position;
}

/**
 * Source location combining a file URI with a range.
 * Used to pinpoint exact locations in source files.
 */
export interface SourceLocation {
    /** URI of the source file */
    readonly uri: FileURI;
    /** Range within the file */
    readonly range: Range;
}

// ============================================================
// Result Types
// ============================================================

/**
 * Result type for operations that can fail.
 * Provides type-safe error handling without exceptions.
 *
 * @typeParam T - The success value type
 * @typeParam E - The error type (defaults to Error)
 *
 * @example
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) {
 *     return { ok: false, error: 'Division by zero' };
 *   }
 *   return { ok: true, value: a / b };
 * }
 */
export type Result<T, E = Error> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: E };

/**
 * Async result type for asynchronous operations that can fail.
 * Wraps Result in a Promise for async/await compatibility.
 *
 * @typeParam T - The success value type
 * @typeParam E - The error type (defaults to Error)
 *
 * @example
 * async function fetchData(url: string): AsyncResult<Data, FetchError> {
 *   try {
 *     const response = await fetch(url);
 *     const data = await response.json();
 *     return { ok: true, value: data };
 *   } catch (e) {
 *     return { ok: false, error: new FetchError(e) };
 *   }
 * }
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
