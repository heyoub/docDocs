/**
 * @fileoverview Schema types for GenDocs extension.
 * This module defines JSON Schema output types for documentation generation.
 * Imports only from types/base.ts and types/symbols.ts - Layer 0 of the type system.
 *
 * @module types/schema
 */

import type { SchemaRef, SourceLocation } from './base.js';
import type { SymbolKind, SymbolModifier } from './symbols.js';

// ============================================================
// Type Schema Types
// ============================================================

/**
 * Kind of type in the type system.
 * Used to categorize types for proper rendering and analysis.
 */
export type TypeKind =
    | 'primitive'
    | 'reference'
    | 'union'
    | 'intersection'
    | 'array'
    | 'tuple'
    | 'function'
    | 'object'
    | 'generic';

/**
 * Schema representation of a type.
 * Captures the structure of types for documentation and cross-referencing.
 *
 * @example
 * // Primitive type
 * const stringType: TypeSchema = { raw: 'string', kind: 'primitive' };
 *
 * // Array type
 * const arrayType: TypeSchema = {
 *   raw: 'string[]',
 *   kind: 'array',
 *   elementType: { raw: 'string', kind: 'primitive' }
 * };
 */
export interface TypeSchema {
    /** Original type string as it appears in source */
    readonly raw: string;

    /** Categorization of the type */
    readonly kind: TypeKind;

    /** Reference to another symbol (for reference types) */
    readonly reference?: SchemaRef;

    /** Type arguments for generic types */
    readonly typeArguments?: readonly TypeSchema[];

    /** Member types (for union, intersection, tuple) */
    readonly members?: readonly TypeSchema[];

    /** Element type (for array types) */
    readonly elementType?: TypeSchema;

    /** Parameters (for function types) */
    readonly parameters?: readonly ParameterSchema[];

    /** Return type (for function types) */
    readonly returnType?: TypeSchema;
}

// ============================================================
// Parameter Schema Types
// ============================================================

/**
 * Schema representation of a function/method parameter.
 * Contains all information needed to document a parameter.
 *
 * @example
 * const param: ParameterSchema = {
 *   name: 'options',
 *   type: { raw: 'GenerateOptions', kind: 'reference', reference: '#/definitions/GenerateOptions' as SchemaRef },
 *   description: 'Configuration options for generation',
 *   optional: false,
 *   defaultValue: null
 * };
 */
export interface ParameterSchema {
    /** Name of the parameter */
    readonly name: string;

    /** Type of the parameter */
    readonly type: TypeSchema;

    /** Description from documentation comments */
    readonly description: string | null;

    /** Whether the parameter is optional */
    readonly optional: boolean;

    /** Default value if specified */
    readonly defaultValue: string | null;
}

// ============================================================
// Deprecation and Example Types
// ============================================================

/**
 * Information about a deprecated symbol.
 * Provides context for why something is deprecated and what to use instead.
 *
 * @example
 * const deprecation: DeprecationInfo = {
 *   deprecated: true,
 *   message: 'Use newMethod() instead',
 *   since: '2.0.0',
 *   replacement: '#/definitions/newMethod' as SchemaRef
 * };
 */
export interface DeprecationInfo {
    /** Always true - indicates the symbol is deprecated */
    readonly deprecated: true;

    /** Human-readable deprecation message */
    readonly message?: string;

    /** Version when the symbol was deprecated */
    readonly since?: string;

    /** Reference to the replacement symbol */
    readonly replacement?: SchemaRef;
}

/**
 * Schema representation of a code example.
 * Examples can come from doc comments, test files, or be manually added.
 *
 * @example
 * const example: ExampleSchema = {
 *   title: 'Basic usage',
 *   description: 'Shows how to call the function',
 *   code: 'const result = myFunction(42);',
 *   language: 'typescript',
 *   source: 'docComment',
 *   validated: true
 * };
 */
export interface ExampleSchema {
    /** Optional title for the example */
    readonly title?: string;

    /** Optional description of what the example demonstrates */
    readonly description?: string;

    /** The example code */
    readonly code: string;

    /** Programming language of the code */
    readonly language: string;

    /** Where the example came from */
    readonly source?: 'docComment' | 'testFile' | 'manual';

    /** Path to test file if source is 'testFile' */
    readonly testFile?: string;

    /** Whether the example has been validated (compiles/type-checks) */
    readonly validated: boolean;

    /** Validation error message if validated is false */
    readonly validationError?: string;
}


// ============================================================
// Import/Export Schema Types
// ============================================================

/**
 * Schema representation of an import statement.
 * Captures what is imported from where.
 *
 * @example
 * const importSchema: ImportSchema = {
 *   source: './utils.js',
 *   specifiers: ['helper', 'format'],
 *   isTypeOnly: false
 * };
 */
export interface ImportSchema {
    /** Module path or package name being imported from */
    readonly source: string;

    /** Names of imported symbols */
    readonly specifiers: readonly string[];

    /** Whether this is a type-only import */
    readonly isTypeOnly: boolean;
}

/**
 * Schema representation of an export.
 * Captures what is exported and how.
 *
 * @example
 * const exportSchema: ExportSchema = {
 *   name: 'MyClass',
 *   isDefault: false,
 *   isTypeOnly: false
 * };
 */
export interface ExportSchema {
    /** Name of the exported symbol */
    readonly name: string;

    /** Whether this is the default export */
    readonly isDefault: boolean;

    /** Whether this is a type-only export */
    readonly isTypeOnly: boolean;
}

// ============================================================
// Symbol Schema Types
// ============================================================

/**
 * Complete schema representation of a documented symbol.
 * This is the canonical format for symbol documentation in JSON Schema.
 *
 * @example
 * const symbolSchema: SymbolSchema = {
 *   $id: '#/definitions/MyClass' as SchemaRef,
 *   name: 'MyClass',
 *   qualifiedName: 'myModule.MyClass',
 *   kind: 'class',
 *   signature: 'class MyClass implements IMyInterface',
 *   description: 'A class that does something useful.',
 *   modifiers: ['export'],
 *   references: [],
 *   source: { uri: 'file:///path/to/file.ts' as FileURI, range: { start: { line: 10, character: 0 }, end: { line: 50, character: 1 } } }
 * };
 */
export interface SymbolSchema {
    /** JSON Schema $id for this symbol */
    readonly $id: SchemaRef;

    /** Name of the symbol */
    readonly name: string;

    /** Fully qualified name including module path */
    readonly qualifiedName: string;

    /** Kind of symbol */
    readonly kind: SymbolKind;

    /** Full signature as it appears in source */
    readonly signature: string;

    /** Documentation description (empty string if undocumented) */
    readonly description: string;

    /** ML-generated summary (optional) */
    readonly summary?: string;

    /** Function/method parameters (for callable symbols) */
    readonly parameters?: readonly ParameterSchema[];

    /** Return type (for functions/methods) */
    readonly returnType?: TypeSchema;

    /** Modifiers applied to this symbol */
    readonly modifiers: readonly SymbolModifier[];

    /** Deprecation information if symbol is deprecated */
    readonly deprecated?: DeprecationInfo;

    /** References to related symbols */
    readonly references: readonly SchemaRef[];

    /** Source location of the symbol */
    readonly source: SourceLocation;

    /** Code examples for this symbol */
    readonly examples?: readonly ExampleSchema[];

    /** Incoming calls (who calls this function) */
    readonly incomingCalls?: readonly SchemaRef[];

    /** Outgoing calls (what this function calls) */
    readonly outgoingCalls?: readonly SchemaRef[];

    /** Control flow matrix for functions (complexity analysis) */
    readonly flowMatrix?: FlowMatrixSchema;
}

// ============================================================
// Flow Matrix Schema Types
// ============================================================

/**
 * Complexity classification for functions.
 */
export type ComplexityLevel =
    | 'trivial'
    | 'simple'
    | 'moderate'
    | 'complex'
    | 'galaxy-brain';

/**
 * Schema representation of a function's control flow matrix.
 * Captures the decision tree structure for documentation.
 *
 * @example
 * const flowMatrix: FlowMatrixSchema = {
 *   branches: 4,
 *   earlyReturns: 2,
 *   errorPaths: 1,
 *   complexity: 'simple',
 *   happyPath: 'Returns processed data on success'
 * };
 */
export interface FlowMatrixSchema {
    /** Number of conditional branches */
    readonly branches: number;

    /** Number of early return statements */
    readonly earlyReturns: number;

    /** Number of error/exception paths */
    readonly errorPaths: number;

    /** Computed complexity classification */
    readonly complexity: ComplexityLevel;

    /** Description of the main success path */
    readonly happyPath: string;

    /** Number of loop constructs */
    readonly loops: number;

    /** Number of async boundaries (await points) */
    readonly asyncBoundaries: number;

    /** Error types that can be thrown */
    readonly errorTypes: readonly string[];
}

// ============================================================
// Module Schema Types
// ============================================================

/**
 * Reference to a module in the workspace schema.
 * Provides summary information without loading the full module schema.
 *
 * @example
 * const moduleRef: ModuleRef = {
 *   $ref: './modules/utils.schema.json' as SchemaRef,
 *   path: 'src/utils.ts',
 *   exports: 15,
 *   documented: 12,
 *   freshness: 'fresh'
 * };
 */
export interface ModuleRef {
    /** JSON Schema $ref to the module schema file */
    readonly $ref: SchemaRef;

    /** File path of the source module */
    readonly path: string;

    /** Number of exported symbols */
    readonly exports: number;

    /** Number of documented symbols */
    readonly documented: number;

    /** Freshness status of the documentation */
    readonly freshness: 'fresh' | 'stale';
}

/**
 * Complete schema representation of a documented module.
 * Contains all symbols and their relationships within a single file.
 *
 * @example
 * const moduleSchema: ModuleSchema = {
 *   $id: 'src/utils.ts' as SchemaRef,
 *   path: 'src/utils.ts',
 *   symbols: ['#/definitions/helper' as SchemaRef],
 *   imports: [{ source: './base.js', specifiers: ['BaseType'], isTypeOnly: true }],
 *   exports: [{ name: 'helper', isDefault: false, isTypeOnly: false }],
 *   definitions: { helper: { ... } }
 * };
 */
export interface ModuleSchema {
    /** JSON Schema $id for this module */
    readonly $id: SchemaRef;

    /** File path of the source module */
    readonly path: string;

    /** References to symbols defined in this module */
    readonly symbols: readonly SchemaRef[];

    /** Import statements in this module */
    readonly imports: readonly ImportSchema[];

    /** Export statements from this module */
    readonly exports: readonly ExportSchema[];

    /** Symbol definitions keyed by symbol name */
    readonly definitions: Readonly<Record<string, SymbolSchema>>;
}

// ============================================================
// Workspace Schema Types
// ============================================================

/**
 * Statistics about the documented workspace.
 * Provides aggregate metrics for documentation coverage and health.
 *
 * @example
 * const stats: WorkspaceStatistics = {
 *   totalModules: 25,
 *   totalSymbols: 150,
 *   documentedSymbols: 120,
 *   coveragePercent: 80.0,
 *   freshModules: 20,
 *   staleModules: 5,
 *   circularDependencies: 2
 * };
 */
export interface WorkspaceStatistics {
    /** Total number of modules in the workspace */
    readonly totalModules: number;

    /** Total number of symbols across all modules */
    readonly totalSymbols: number;

    /** Number of symbols with documentation */
    readonly documentedSymbols: number;

    /** Documentation coverage percentage (0-100) */
    readonly coveragePercent: number;

    /** Number of modules with fresh documentation */
    readonly freshModules: number;

    /** Number of modules with stale documentation */
    readonly staleModules: number;

    /** Number of circular dependency chains detected */
    readonly circularDependencies: number;
}

/**
 * Root schema for the entire documented workspace.
 * Aggregates all module schemas and provides workspace-level metadata.
 *
 * @example
 * const workspaceSchema: WorkspaceSchema = {
 *   $schema: 'https://json-schema.org/draft/2020-12/schema',
 *   version: '1.0.0',
 *   generatedAt: '2024-01-15T10:30:00Z',
 *   modules: [{ $ref: './modules/utils.schema.json' as SchemaRef, path: 'src/utils.ts', exports: 15, documented: 12, freshness: 'fresh' }],
 *   statistics: { totalModules: 1, totalSymbols: 15, documentedSymbols: 12, coveragePercent: 80.0, freshModules: 1, staleModules: 0, circularDependencies: 0 }
 * };
 */
export interface WorkspaceSchema {
    /** JSON Schema dialect identifier */
    readonly $schema: string;

    /** Version of the documentation schema */
    readonly version: string;

    /** ISO 8601 timestamp when documentation was generated */
    readonly generatedAt: string;

    /** References to all module schemas */
    readonly modules: readonly ModuleRef[];

    /** Aggregate statistics for the workspace */
    readonly statistics: WorkspaceStatistics;
}
