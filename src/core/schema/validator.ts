/**
 * @fileoverview JSON Schema validation for GenDocs schemas.
 * Uses Ajv for JSON Schema draft-2020-12 validation.
 * Layer 1 - imports only from types/.
 *
 * @module core/schema/validator
 */

import { default as Ajv } from 'ajv';
import type { Result } from '../../types/base.js';
import type { SymbolSchema, ModuleSchema, WorkspaceSchema } from '../../types/schema.js';

/** Ajv error object type - matches Ajv's ErrorObject structure */
interface AjvErrorObject {
    readonly instancePath?: string;
    readonly message?: string;
    readonly keyword: string;
}

// ============================================================
// Validation Result Types
// ============================================================

/**
 * Error details from schema validation.
 */
export interface ValidationError {
    /** JSON path to the invalid property */
    readonly path: string;
    /** Human-readable error message */
    readonly message: string;
    /** The keyword that failed validation */
    readonly keyword: string;
}

/**
 * Result of schema validation.
 */
export interface ValidationResult {
    /** Whether the schema is valid */
    readonly isValid: boolean;
    /** List of validation errors (empty if valid) */
    readonly errors: readonly ValidationError[];
}

// ============================================================
// JSON Schema Definitions
// ============================================================

/**
 * JSON Schema for SymbolSchema validation.
 * Validates the structure of documented symbols.
 */
const SYMBOL_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['$id', 'name', 'qualifiedName', 'kind', 'signature', 'description', 'modifiers', 'references', 'source'],
    properties: {
        $id: { type: 'string' },
        name: { type: 'string' },
        qualifiedName: { type: 'string' },
        kind: { type: 'string' },
        signature: { type: 'string' },
        description: { type: 'string' },
        summary: { type: 'string' },
        parameters: { type: 'array' },
        returnType: { type: 'object' },
        modifiers: { type: 'array', items: { type: 'string' } },
        deprecated: { type: 'object' },
        references: { type: 'array', items: { type: 'string' } },
        source: {
            type: 'object',
            required: ['uri', 'range'],
            properties: {
                uri: { type: 'string' },
                range: { type: 'object' }
            }
        },
        examples: { type: 'array' },
        incomingCalls: { type: 'array' },
        outgoingCalls: { type: 'array' }
    },
    additionalProperties: false
} as const;

/**
 * JSON Schema for ModuleSchema validation.
 * Validates the structure of documented modules.
 */
const MODULE_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['$id', 'path', 'symbols', 'imports', 'exports', 'definitions'],
    properties: {
        $id: { type: 'string' },
        path: { type: 'string' },
        symbols: { type: 'array', items: { type: 'string' } },
        imports: { type: 'array' },
        exports: { type: 'array' },
        definitions: { type: 'object' }
    },
    additionalProperties: false
} as const;

/**
 * JSON Schema for WorkspaceSchema validation.
 * Validates the structure of workspace documentation.
 */
const WORKSPACE_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['$schema', 'version', 'generatedAt', 'modules', 'statistics'],
    properties: {
        $schema: { type: 'string' },
        version: { type: 'string' },
        generatedAt: { type: 'string' },
        modules: { type: 'array' },
        statistics: {
            type: 'object',
            required: ['totalModules', 'totalSymbols', 'documentedSymbols', 'coveragePercent', 'freshModules', 'staleModules', 'circularDependencies']
        }
    },
    additionalProperties: false
} as const;

// ============================================================
// Ajv Instance (Lazy Initialization)
// ============================================================

let ajvInstance: InstanceType<typeof Ajv> | null = null;

/**
 * Gets or creates the Ajv validator instance.
 * Uses lazy initialization to avoid loading Ajv until needed.
 */
function getAjv(): InstanceType<typeof Ajv> {
    if (ajvInstance === null) {
        ajvInstance = new Ajv({
            allErrors: true,
            verbose: true
        });
    }
    return ajvInstance;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Converts Ajv errors to ValidationError format.
 */
function convertErrors(errors: unknown): readonly ValidationError[] {
    if (!errors || !Array.isArray(errors) || errors.length === 0) {
        return [];
    }
    return errors.map((error: AjvErrorObject): ValidationError => ({
        path: error.instancePath ?? '/',
        message: error.message ?? 'Unknown validation error',
        keyword: error.keyword ?? 'unknown'
    }));
}

/**
 * Creates a successful validation result.
 */
function validResult(): ValidationResult {
    return { isValid: true, errors: [] };
}

/**
 * Creates a failed validation result.
 */
function invalidResult(errors: readonly ValidationError[]): ValidationResult {
    return { isValid: false, errors };
}

// ============================================================
// Public Validation Functions
// ============================================================

/**
 * Validates any schema against JSON Schema draft-2020-12.
 * This is a generic validator that checks basic JSON Schema compliance.
 *
 * @param schema - The schema to validate (unknown type for safety)
 * @returns ValidationResult indicating validity and any errors
 *
 * @example
 * const result = validateSchema({ type: 'object', properties: {} });
 * if (!result.isValid) {
 *   console.error('Invalid schema:', result.errors);
 * }
 */
export function validateSchema(schema: unknown): ValidationResult {
    if (schema === null || schema === undefined) {
        return invalidResult([{
            path: '/',
            message: 'Schema cannot be null or undefined',
            keyword: 'type'
        }]);
    }

    if (typeof schema !== 'object') {
        return invalidResult([{
            path: '/',
            message: 'Schema must be an object',
            keyword: 'type'
        }]);
    }

    // Basic structural validation - schema should be a valid JSON object
    try {
        JSON.stringify(schema);
        return validResult();
    } catch {
        return invalidResult([{
            path: '/',
            message: 'Schema is not valid JSON',
            keyword: 'format'
        }]);
    }
}

/**
 * Validates a SymbolSchema against the expected structure.
 *
 * @param schema - The symbol schema to validate
 * @returns Result with validated SymbolSchema or ValidationResult errors
 *
 * @example
 * const result = validateSymbolSchema(symbolData);
 * if (result.ok) {
 *   const validSymbol = result.value;
 * } else {
 *   console.error('Validation failed:', result.error.errors);
 * }
 */
export function validateSymbolSchema(schema: unknown): Result<SymbolSchema, ValidationResult> {
    const ajv = getAjv();
    const validate = ajv.compile(SYMBOL_SCHEMA);
    const isValid = validate(schema);

    if (isValid) {
        return { ok: true, value: schema as SymbolSchema };
    }

    return {
        ok: false,
        error: invalidResult(convertErrors(validate.errors))
    };
}

/**
 * Validates a ModuleSchema against the expected structure.
 *
 * @param schema - The module schema to validate
 * @returns Result with validated ModuleSchema or ValidationResult errors
 *
 * @example
 * const result = validateModuleSchema(moduleData);
 * if (result.ok) {
 *   const validModule = result.value;
 * } else {
 *   console.error('Validation failed:', result.error.errors);
 * }
 */
export function validateModuleSchema(schema: unknown): Result<ModuleSchema, ValidationResult> {
    const ajv = getAjv();
    const validate = ajv.compile(MODULE_SCHEMA);
    const isValid = validate(schema);

    if (isValid) {
        return { ok: true, value: schema as ModuleSchema };
    }

    return {
        ok: false,
        error: invalidResult(convertErrors(validate.errors))
    };
}

/**
 * Validates a WorkspaceSchema against the expected structure.
 *
 * @param schema - The workspace schema to validate
 * @returns Result with validated WorkspaceSchema or ValidationResult errors
 *
 * @example
 * const result = validateWorkspaceSchema(workspaceData);
 * if (result.ok) {
 *   const validWorkspace = result.value;
 * } else {
 *   console.error('Validation failed:', result.error.errors);
 * }
 */
export function validateWorkspaceSchema(schema: unknown): Result<WorkspaceSchema, ValidationResult> {
    const ajv = getAjv();
    const validate = ajv.compile(WORKSPACE_SCHEMA);
    const isValid = validate(schema);

    if (isValid) {
        return { ok: true, value: schema as WorkspaceSchema };
    }

    return {
        ok: false,
        error: invalidResult(convertErrors(validate.errors))
    };
}
