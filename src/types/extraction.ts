/**
 * @fileoverview Extraction types for GenDocs extension.
 * This module defines types for symbol extraction from source code,
 * including extracted symbols, parameters, functions, and file-level extraction results.
 * Imports from types/base.ts and types/symbols.ts - Layer 0 of the type system.
 *
 * @module types/extraction
 */

import type { FileURI } from './base.js';
import type { SymbolBase } from './symbols.js';

// ============================================================
// Extraction Method Types
// ============================================================

/**
 * Method used to extract symbols from source code.
 * Determines the extraction strategy and affects output quality.
 *
 * - `lsp`: Language Server Protocol extraction (highest quality)
 * - `tree-sitter`: Syntax tree parsing fallback (good quality)
 * - `regex`: Regular expression fallback (basic quality)
 *
 * @example
 * const method: ExtractionMethod = 'lsp';
 */
export type ExtractionMethod = 'lsp' | 'tree-sitter' | 'regex';

// ============================================================
// Extracted Symbol Types
// ============================================================

/**
 * Symbol extracted from source code with documentation and hierarchy.
 * Extends SymbolBase with extraction-specific fields.
 * All properties are readonly to ensure immutability.
 *
 * @example
 * const symbol: ExtractedSymbol = {
 *   id: 'MyClass' as SymbolID,
 *   name: 'MyClass',
 *   kind: 'class',
 *   location: { uri: 'file:///path/to/file.ts' as FileURI, range: { ... } },
 *   modifiers: ['export'],
 *   visibility: 'public',
 *   signature: 'class MyClass',
 *   documentation: 'A sample class',
 *   children: []
 * };
 */
export interface ExtractedSymbol extends SymbolBase {
    /** Full signature of the symbol as it appears in source */
    readonly signature: string;

    /** Documentation string extracted from comments, or null if none */
    readonly documentation: string | null;

    /** Child symbols (e.g., methods in a class, properties in an interface) */
    readonly children: readonly ExtractedSymbol[];
}

// ============================================================
// Parameter Types
// ============================================================

/**
 * Parameter extracted from a function or method signature.
 * Contains type information and optional default values.
 *
 * @example
 * const param: ExtractedParameter = {
 *   name: 'options',
 *   type: 'GenerateOptions',
 *   description: 'Configuration options for generation',
 *   optional: true,
 *   defaultValue: '{}'
 * };
 */
export interface ExtractedParameter {
    /** Name of the parameter */
    readonly name: string;

    /** Type annotation of the parameter */
    readonly type: string;

    /** Description from documentation, or null if none */
    readonly description: string | null;

    /** Whether the parameter is optional */
    readonly optional: boolean;

    /** Default value as a string, or null if none */
    readonly defaultValue: string | null;
}

// ============================================================
// Function Types
// ============================================================

/**
 * Function or method extracted from source code.
 * Extends ExtractedSymbol with function-specific fields.
 *
 * @example
 * const fn: ExtractedFunction = {
 *   id: 'MyClass#myMethod' as SymbolID,
 *   name: 'myMethod',
 *   kind: 'method',
 *   location: { ... },
 *   modifiers: ['async'],
 *   visibility: 'public',
 *   signature: 'async myMethod(options: Options): Promise<Result>',
 *   documentation: 'Performs an async operation',
 *   children: [],
 *   parameters: [{ name: 'options', type: 'Options', ... }],
 *   returnType: 'Promise<Result>',
 *   typeParameters: ['T', 'E']
 * };
 */
export interface ExtractedFunction extends ExtractedSymbol {
    /** Kind is restricted to function or method */
    readonly kind: 'function' | 'method';

    /** Parameters of the function */
    readonly parameters: readonly ExtractedParameter[];

    /** Return type annotation */
    readonly returnType: string;

    /** Generic type parameters (e.g., ['T', 'E'] for <T, E>) */
    readonly typeParameters: readonly string[];
}

// ============================================================
// Import/Export Types
// ============================================================

/**
 * Information about an import statement in a file.
 * Used for dependency graph construction.
 *
 * @example
 * const importInfo: ImportInfo = {
 *   source: './utils/hash.js',
 *   specifiers: ['contentHash', 'fileHash'],
 *   isTypeOnly: false
 * };
 */
export interface ImportInfo {
    /** Module specifier (path or package name) */
    readonly source: string;

    /** Imported names (empty for namespace imports) */
    readonly specifiers: readonly string[];

    /** Whether this is a type-only import */
    readonly isTypeOnly: boolean;
}

/**
 * Information about an export from a file.
 * Used for API surface extraction.
 *
 * @example
 * const exportInfo: ExportInfo = {
 *   name: 'generateSchema',
 *   isDefault: false,
 *   isTypeOnly: false
 * };
 */
export interface ExportInfo {
    /** Exported name */
    readonly name: string;

    /** Whether this is the default export */
    readonly isDefault: boolean;

    /** Whether this is a type-only export */
    readonly isTypeOnly: boolean;
}

// ============================================================
// File Extraction Types
// ============================================================

/**
 * Complete extraction result for a single file.
 * Contains all symbols, imports, exports, and metadata.
 *
 * @example
 * const extraction: FileExtraction = {
 *   uri: 'file:///path/to/file.ts' as FileURI,
 *   languageId: 'typescript',
 *   symbols: [...],
 *   imports: [...],
 *   exports: [...],
 *   method: 'lsp',
 *   timestamp: Date.now()
 * };
 */
export interface FileExtraction {
    /** URI of the extracted file */
    readonly uri: FileURI;

    /** Language identifier (e.g., 'typescript', 'python', 'rust') */
    readonly languageId: string;

    /** All symbols extracted from the file */
    readonly symbols: readonly ExtractedSymbol[];

    /** All imports in the file */
    readonly imports: readonly ImportInfo[];

    /** All exports from the file */
    readonly exports: readonly ExportInfo[];

    /** Method used for extraction */
    readonly method: ExtractionMethod;

    /** Unix timestamp when extraction was performed */
    readonly timestamp: number;
}
