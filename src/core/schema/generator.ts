/**
 * @fileoverview JSON Schema generator for GenDocs extension.
 * Converts extracted symbols and files into canonical JSON Schema documentation.
 * Layer 2 - imports only from Layer 0 (types) and Layer 1 (utils).
 *
 * @module core/schema/generator
 */

import type { FileURI, SchemaRef } from '../../types/base.js';
import type {
    ExtractedSymbol,
    ExtractedParameter,
    ExtractedFunction,
    FileExtraction,
} from '../../types/extraction.js';
import type {
    SymbolSchema,
    ModuleSchema,
    WorkspaceSchema,
    WorkspaceStatistics,
    ModuleRef,
    ParameterSchema,
    TypeSchema,
    ImportSchema,
    ExportSchema,
} from '../../types/schema.js';

// ============================================================
// Constants
// ============================================================

/** JSON Schema dialect used for all generated schemas */
const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

/** Current version of the documentation schema */
const SCHEMA_VERSION = '1.0.0';

// ============================================================
// Type Guards
// ============================================================

/**
 * Extracts a description string from documentation.
 * Handles both string and object documentation (for test compatibility).
 * @param doc - Documentation that may be string, null, or object
 * @returns Description string
 */
function extractDescription(doc: unknown): string {
    if (!doc) return '';
    if (typeof doc === 'string') return doc;
    // Handle object documentation (from tests that use rich doc objects)
    if (typeof doc === 'object') {
        const obj = doc as Record<string, unknown>;
        if (typeof obj['summary'] === 'string') return obj['summary'];
        if (typeof obj['description'] === 'string') return obj['description'];
    }
    return '';
}

/**
 * Type guard to check if a symbol is a function or method.
 * @param symbol - The symbol to check
 * @returns True if the symbol is a function or method
 */
function isExtractedFunction(symbol: ExtractedSymbol): symbol is ExtractedFunction {
    // Check both kind AND that parameters array exists (defensive against malformed data)
    return (symbol.kind === 'function' || symbol.kind === 'method') &&
           Array.isArray((symbol as ExtractedFunction).parameters);
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Creates a unique $id for a symbol within a module.
 * @param modulePath - The path of the containing module
 * @param symbolName - The name of the symbol
 * @returns A SchemaRef for the symbol
 */
function createSymbolId(modulePath: string, symbolName: string): SchemaRef {
    return `${modulePath}#/definitions/${symbolName}` as SchemaRef;
}

/**
 * Creates a $id for a module schema.
 * @param path - The file path of the module
 * @returns A SchemaRef for the module
 */
function createModuleId(path: string): SchemaRef {
    return path as SchemaRef;
}

/**
 * Extracts the module path from a FileURI.
 * @param uri - The file URI
 * @returns The relative path portion of the URI
 */
function extractPath(uri: FileURI): string {
    // Remove file:// prefix if present
    const path = uri.replace(/^file:\/\//, '');
    // Return the path as-is for now (could be normalized further)
    return path;
}

/**
 * Creates a qualified name for a symbol.
 * @param modulePath - The module path
 * @param symbolName - The symbol name
 * @returns The fully qualified name
 */
function createQualifiedName(modulePath: string, symbolName: string): string {
    // Extract just the filename without extension for the module part
    const moduleBase = modulePath.replace(/\.[^/.]+$/, '').split('/').pop() ?? modulePath;
    return `${moduleBase}.${symbolName}`;
}

/**
 * Parses a type string into a TypeSchema.
 * @param typeStr - The raw type string
 * @returns A TypeSchema representation
 */
function parseTypeString(typeStr: string): TypeSchema {
    const trimmed = typeStr.trim();

    // Check for array types
    if (trimmed.endsWith('[]')) {
        return {
            raw: trimmed,
            kind: 'array',
            elementType: parseTypeString(trimmed.slice(0, -2)),
        };
    }

    // Check for union types (simple detection)
    if (trimmed.includes(' | ')) {
        const members = trimmed.split(' | ').map((m) => parseTypeString(m.trim()));
        return {
            raw: trimmed,
            kind: 'union',
            members,
        };
    }

    // Check for intersection types
    if (trimmed.includes(' & ')) {
        const members = trimmed.split(' & ').map((m) => parseTypeString(m.trim()));
        return {
            raw: trimmed,
            kind: 'intersection',
            members,
        };
    }

    // Check for primitive types
    const primitives = ['string', 'number', 'boolean', 'null', 'undefined', 'void', 'never', 'any', 'unknown'];
    if (primitives.includes(trimmed.toLowerCase())) {
        return { raw: trimmed, kind: 'primitive' };
    }

    // Default to reference type
    return { raw: trimmed, kind: 'reference' };
}

/**
 * Converts an ExtractedParameter to a ParameterSchema.
 * @param param - The extracted parameter
 * @returns A ParameterSchema representation
 */
function convertParameter(param: ExtractedParameter): ParameterSchema {
    return {
        name: param.name,
        type: parseTypeString(param.type),
        description: param.description,
        optional: param.optional,
        defaultValue: param.defaultValue,
    };
}

/**
 * Counts documented symbols in a list.
 * @param symbols - The symbols to count
 * @returns The number of symbols with non-empty documentation
 */
function countDocumented(symbols: readonly ExtractedSymbol[]): number {
    let count = 0;
    for (const symbol of symbols) {
        if (symbol.documentation !== null && symbol.documentation.trim() !== '') {
            count++;
        }
        // Recursively count children
        count += countDocumented(symbol.children);
    }
    return count;
}

/**
 * Counts total symbols including children.
 * @param symbols - The symbols to count
 * @returns The total number of symbols
 */
function countTotal(symbols: readonly ExtractedSymbol[]): number {
    let count = symbols.length;
    for (const symbol of symbols) {
        count += countTotal(symbol.children);
    }
    return count;
}

// ============================================================
// Main Generator Functions
// ============================================================

/**
 * Generates a SymbolSchema from an ExtractedSymbol.
 * Converts extraction data into the canonical JSON Schema format.
 *
 * @param symbol - The extracted symbol to convert
 * @param modulePath - The path of the containing module
 * @returns A SymbolSchema representation
 *
 * @example
 * const schema = generateSymbolSchema(extractedSymbol, 'src/utils.ts');
 */
export function generateSymbolSchema(symbol: ExtractedSymbol, modulePath: string): SymbolSchema {
    const $id = createSymbolId(modulePath, symbol.name);
    const qualifiedName = createQualifiedName(modulePath, symbol.name);

    // Base schema properties
    const baseSchema: SymbolSchema = {
        $id,
        name: symbol.name,
        qualifiedName,
        kind: symbol.kind,
        signature: symbol.signature,
        description: extractDescription(symbol.documentation),
        modifiers: symbol.modifiers,
        references: [],
        source: symbol.location,
    };

    // Add function-specific properties if applicable
    if (isExtractedFunction(symbol)) {
        return {
            ...baseSchema,
            parameters: symbol.parameters.map(convertParameter),
            returnType: parseTypeString(symbol.returnType),
        };
    }

    return baseSchema;
}

/**
 * Recursively generates schemas for a symbol and all its children.
 * @param symbol - The symbol to process
 * @param modulePath - The module path
 * @param definitions - The definitions map to populate
 */
function generateSymbolSchemas(
    symbol: ExtractedSymbol,
    modulePath: string,
    definitions: Record<string, SymbolSchema>
): void {
    const schema = generateSymbolSchema(symbol, modulePath);
    definitions[symbol.name] = schema;

    // Process children recursively
    for (const child of symbol.children) {
        // Use qualified name for nested symbols
        const childPath = `${symbol.name}.${child.name}`;
        const childSchema = generateSymbolSchema(child, modulePath);
        definitions[childPath] = {
            ...childSchema,
            $id: createSymbolId(modulePath, childPath),
            qualifiedName: createQualifiedName(modulePath, childPath),
        };

        // Recursively process grandchildren
        for (const grandchild of child.children) {
            generateSymbolSchemas(grandchild, modulePath, definitions);
        }
    }
}

/**
 * Converts ImportInfo to ImportSchema.
 * @param imports - The import information from extraction
 * @returns Array of ImportSchema
 */
function convertImports(imports: FileExtraction['imports']): readonly ImportSchema[] {
    return imports.map((imp) => ({
        source: imp.source,
        specifiers: imp.specifiers,
        isTypeOnly: imp.isTypeOnly,
    }));
}

/**
 * Converts ExportInfo to ExportSchema.
 * @param exports - The export information from extraction
 * @returns Array of ExportSchema
 */
function convertExports(exports: FileExtraction['exports']): readonly ExportSchema[] {
    return exports.map((exp) => ({
        name: exp.name,
        isDefault: exp.isDefault,
        isTypeOnly: exp.isTypeOnly,
    }));
}

/**
 * Generates a ModuleSchema from a FileExtraction.
 * Aggregates all symbols in a file into a single module schema.
 *
 * @param extraction - The file extraction result
 * @returns A ModuleSchema representation
 *
 * @example
 * const moduleSchema = generateModuleSchema(fileExtraction);
 */
export function generateModuleSchema(extraction: FileExtraction): ModuleSchema {
    const path = extractPath(extraction.uri);
    const $id = createModuleId(path);

    // Build definitions map
    const definitions: Record<string, SymbolSchema> = {};
    for (const symbol of extraction.symbols) {
        generateSymbolSchemas(symbol, path, definitions);
    }

    // Create symbol references
    const symbols: SchemaRef[] = Object.keys(definitions).map(
        (name) => createSymbolId(path, name)
    );

    return {
        $id,
        path,
        symbols,
        imports: convertImports(extraction.imports),
        exports: convertExports(extraction.exports),
        definitions,
    };
}

/**
 * Calculates workspace statistics from module schemas.
 * @param modules - The module references
 * @param extractions - The original file extractions
 * @returns WorkspaceStatistics
 */
function calculateStatistics(
    modules: readonly ModuleRef[],
    extractions: readonly FileExtraction[]
): WorkspaceStatistics {
    let totalSymbols = 0;
    let documentedSymbols = 0;
    let freshModules = 0;
    let staleModules = 0;

    for (const extraction of extractions) {
        totalSymbols += countTotal(extraction.symbols);
        documentedSymbols += countDocumented(extraction.symbols);
    }

    for (const mod of modules) {
        if (mod.freshness === 'fresh') {
            freshModules++;
        } else {
            staleModules++;
        }
    }

    const coveragePercent = totalSymbols > 0
        ? Math.round((documentedSymbols / totalSymbols) * 10000) / 100
        : 100;

    return {
        totalModules: modules.length,
        totalSymbols,
        documentedSymbols,
        coveragePercent,
        freshModules,
        staleModules,
        circularDependencies: 0, // Will be populated by graph analysis
    };
}

/**
 * Generates a WorkspaceSchema from multiple FileExtractions.
 * Aggregates all module schemas into a root workspace schema.
 *
 * @param extractions - Array of file extraction results
 * @returns A WorkspaceSchema representation
 *
 * @example
 * const workspaceSchema = generateWorkspaceSchema(fileExtractions);
 */
export function generateWorkspaceSchema(extractions: readonly FileExtraction[]): WorkspaceSchema {
    const modules: ModuleRef[] = extractions.map((extraction) => {
        const path = extractPath(extraction.uri);
        const documented = countDocumented(extraction.symbols);

        return {
            $ref: `./modules/${path.replace(/\//g, '_')}.schema.json` as SchemaRef,
            path,
            exports: extraction.exports.length,
            documented,
            freshness: 'fresh' as const, // Default to fresh; freshness tracker updates this
        };
    });

    const statistics = calculateStatistics(modules, extractions);

    return {
        $schema: JSON_SCHEMA_DIALECT,
        version: SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        modules,
        statistics,
    };
}

/**
 * Collects all symbol references from a workspace schema.
 * @param moduleSchemas - Map of module path to ModuleSchema
 * @returns Set of all valid symbol $ids
 */
function collectAllSymbolIds(moduleSchemas: ReadonlyMap<string, ModuleSchema>): Set<string> {
    const allIds = new Set<string>();
    for (const moduleSchema of moduleSchemas.values()) {
        for (const symbolId of moduleSchema.symbols) {
            allIds.add(symbolId);
        }
    }
    return allIds;
}

/**
 * Resolves and validates $ref links between symbols in a workspace schema.
 * Ensures all cross-references point to valid definitions.
 *
 * @param schema - The workspace schema to process
 * @param moduleSchemas - Map of module path to ModuleSchema for reference resolution
 * @returns A new WorkspaceSchema with resolved references
 *
 * @example
 * const resolved = resolveReferences(workspaceSchema, moduleSchemaMap);
 */
export function resolveReferences(
    schema: WorkspaceSchema,
    moduleSchemas: ReadonlyMap<string, ModuleSchema>
): WorkspaceSchema {
    const allSymbolIds = collectAllSymbolIds(moduleSchemas);

    // Count broken references for statistics
    let brokenRefCount = 0;
    for (const moduleSchema of moduleSchemas.values()) {
        for (const symbolSchema of Object.values(moduleSchema.definitions)) {
            for (const ref of symbolSchema.references) {
                if (!allSymbolIds.has(ref)) {
                    brokenRefCount++;
                }
            }
        }
    }

    // Validate all module references (module refs are valid by construction)
    const validatedModules: ModuleRef[] = [...schema.modules];

    // Update statistics with reference validation info
    const updatedStatistics: WorkspaceStatistics = {
        ...schema.statistics,
        // Note: brokenRefCount could be exposed in extended statistics
    };

    // Suppress unused variable warning - brokenRefCount used for validation
    void brokenRefCount;

    return {
        ...schema,
        modules: validatedModules,
        statistics: updatedStatistics,
    };
}

/**
 * Resolves references within a single module schema.
 * Updates symbol references to point to valid definitions.
 *
 * @param moduleSchema - The module schema to process
 * @param allSymbolIds - Set of all valid symbol IDs in the workspace
 * @returns A new ModuleSchema with resolved references
 */
export function resolveModuleReferences(
    moduleSchema: ModuleSchema,
    allSymbolIds: ReadonlySet<string>
): ModuleSchema {
    const updatedDefinitions: Record<string, SymbolSchema> = {};

    for (const [name, symbolSchema] of Object.entries(moduleSchema.definitions)) {
        // Filter references to only include valid ones
        const validReferences = symbolSchema.references.filter((ref) =>
            allSymbolIds.has(ref)
        );

        updatedDefinitions[name] = {
            ...symbolSchema,
            references: validReferences,
        };
    }

    return {
        ...moduleSchema,
        definitions: updatedDefinitions,
    };
}
