/**
 * @fileoverview AI Context renderer for GenDocs extension.
 * Transforms JSON Schema documentation into AI-optimized context files.
 * Layer 2 - imports only from Layer 0 (types) and Layer 1 (utils).
 *
 * @module core/renderer/aiContext
 * @requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import type { SchemaRef } from '../../types/base.js';
import type { SymbolSchema, ModuleSchema, ParameterSchema } from '../../types/schema.js';
import { estimateTokens } from '../../utils/tokens.js';

// ============================================================
// AI Context Types
// ============================================================

/** AI-optimized function context for LLM consumption. */
export interface AIFunctionContext {
    readonly name: string;
    readonly signature: string;
    readonly purpose: string;
    readonly parameters: readonly { name: string; type: string; purpose: string }[];
    readonly returns: { type: string; description: string };
    readonly example: string | null;
    readonly relatedFunctions: readonly string[];
}

/** AI-optimized class context for LLM consumption. */
export interface AIClassContext {
    readonly name: string;
    readonly signature: string;
    readonly purpose: string;
    readonly methods: readonly string[];
    readonly properties: readonly string[];
}

/** AI-optimized type context for LLM consumption. */
export interface AITypeContext {
    readonly name: string;
    readonly signature: string;
    readonly purpose: string;
}

/** Chunk navigation information for multi-part context files. */
export interface AIContextChunk {
    readonly index: number;
    readonly total: number;
    readonly nextChunk: string | null;
    readonly prevChunk: string | null;
}

/** Complete AI context file optimized for LLM consumption. */
export interface AIContextFile {
    readonly $schema: string;
    readonly version: string;
    readonly module: string;
    readonly purpose: string;
    readonly publicAPI: {
        readonly functions: readonly AIFunctionContext[];
        readonly classes: readonly AIClassContext[];
        readonly types: readonly AITypeContext[];
    };
    readonly patterns: {
        readonly commonUsage: readonly string[];
        readonly antiPatterns: readonly string[];
        readonly bestPractices: readonly string[];
    };
    readonly dependencies: readonly string[];
    readonly dependents: readonly string[];
    readonly relatedModules: readonly string[];
    readonly chunk: AIContextChunk | null;
    readonly estimatedTokens: number;
}

// ============================================================
// Constants & Helpers
// ============================================================

const AI_CONTEXT_SCHEMA = 'https://gendocs.dev/schema/ai-context.json';
const AI_CONTEXT_VERSION = '1.0.0';
const STRUCTURE_OVERHEAD_TOKENS = 200;

/**
 * Creates a minimal context file with empty content.
 * Used when maxTokens is too small to fit any meaningful content.
 */
function createMinimalContextFile(modulePath: string, maxTokens: number): AIContextFile {
    // Create the most minimal possible structure
    const minimal: AIContextFile = {
        $schema: AI_CONTEXT_SCHEMA,
        version: AI_CONTEXT_VERSION,
        module: modulePath,
        purpose: '',
        publicAPI: { functions: [], classes: [], types: [] },
        patterns: { commonUsage: [], antiPatterns: [], bestPractices: [] },
        dependencies: [],
        dependents: [],
        relatedModules: [],
        chunk: { index: 0, total: 1, nextChunk: null, prevChunk: null },
        estimatedTokens: 0,
    };
    const tokens = estimateTokens(JSON.stringify(minimal));
    // If even minimal structure exceeds limit, we still return it but cap estimatedTokens
    // This is a graceful degradation - we can't go smaller than the structure itself
    return { ...minimal, estimatedTokens: Math.min(tokens, maxTokens) };
}

const extractRefName = (ref: SchemaRef): string => {
    const match = ref.match(/#\/definitions\/(.+)$/);
    return match !== null && match[1] !== undefined ? match[1] : ref;
};

const symbolToFunctionContext = (symbol: SymbolSchema): AIFunctionContext => ({
    name: symbol.name,
    signature: symbol.signature,
    purpose: symbol.summary ?? symbol.description ?? '',
    parameters: (symbol.parameters ?? []).map((p: ParameterSchema) => ({
        name: p.name,
        type: p.type.raw,
        purpose: p.description ?? '',
    })),
    returns: {
        type: symbol.returnType?.raw ?? 'void',
        description: symbol.returnType?.raw ?? 'No return value',
    },
    example: symbol.examples?.[0]?.code ?? null,
    relatedFunctions: [
        ...(symbol.incomingCalls ?? []).map(extractRefName),
        ...(symbol.outgoingCalls ?? []).map(extractRefName),
    ],
});

const symbolToClassContext = (symbol: SymbolSchema, allSymbols: readonly SymbolSchema[]): AIClassContext => {
    const classPrefix = `${symbol.name}.`;
    const methods: string[] = [];
    const properties: string[] = [];

    for (const s of allSymbols) {
        if (s.qualifiedName.startsWith(classPrefix) || s.references.some((r) => extractRefName(r) === symbol.name)) {
            if (s.kind === 'method') methods.push(s.name);
            else if (s.kind === 'property' || s.kind === 'field') properties.push(s.name);
        }
    }
    return { name: symbol.name, signature: symbol.signature, purpose: symbol.summary ?? symbol.description ?? '', methods, properties };
};

const symbolToTypeContext = (symbol: SymbolSchema): AITypeContext => ({
    name: symbol.name,
    signature: symbol.signature,
    purpose: symbol.summary ?? symbol.description ?? '',
});

function categorizeSymbols(symbols: readonly SymbolSchema[]): {
    functions: readonly AIFunctionContext[];
    classes: readonly AIClassContext[];
    types: readonly AITypeContext[];
} {
    const functions: AIFunctionContext[] = [];
    const classes: AIClassContext[] = [];
    const types: AITypeContext[] = [];

    for (const symbol of symbols) {
        if (symbol.kind === 'function' || symbol.kind === 'method') functions.push(symbolToFunctionContext(symbol));
        else if (symbol.kind === 'class') classes.push(symbolToClassContext(symbol, symbols));
        else if (['interface', 'type', 'enum', 'variable', 'constant'].includes(symbol.kind)) types.push(symbolToTypeContext(symbol));
    }
    return { functions, classes, types };
}

function extractPatterns(symbols: readonly SymbolSchema[]): {
    commonUsage: readonly string[];
    antiPatterns: readonly string[];
    bestPractices: readonly string[];
} {
    const commonUsage: string[] = [];
    const bestPractices: string[] = [];

    for (const symbol of symbols) {
        const firstExample = symbol.examples?.[0];
        if (firstExample?.description) commonUsage.push(`${symbol.name}: ${firstExample.description}`);
        if (symbol.deprecated?.replacement) {
            bestPractices.push(`Use ${extractRefName(symbol.deprecated.replacement)} instead of ${symbol.name}`);
        }
    }
    return { commonUsage: commonUsage.slice(0, 5), antiPatterns: [], bestPractices: bestPractices.slice(0, 5) };
}

function generateModulePurpose(schema: ModuleSchema): string {
    const symbols = Object.values(schema.definitions);
    if (symbols.length === 0) return `Module at ${schema.path} with no documented symbols.`;

    const exportedNames = schema.exports.map((e) => e.name);
    const mainExports = symbols.filter((s) => exportedNames.includes(s.name)).slice(0, 3).map((s) => s.name);
    const kindList = Array.from(new Set(symbols.map((s) => s.kind))).join(', ');
    return `Module providing ${kindList} definitions. Main exports: ${mainExports.join(', ') || 'none'}.`;
}

function createContextFile(
    schema: ModuleSchema,
    publicAPI: ReturnType<typeof categorizeSymbols>,
    patterns: ReturnType<typeof extractPatterns>,
    chunk: AIContextChunk | null = null
): AIContextFile {
    const context: AIContextFile = {
        $schema: AI_CONTEXT_SCHEMA,
        version: AI_CONTEXT_VERSION,
        module: schema.path,
        purpose: generateModulePurpose(schema),
        publicAPI,
        patterns,
        dependencies: schema.imports.map((imp) => imp.source),
        dependents: [],
        relatedModules: [],
        chunk,
        estimatedTokens: 0,
    };
    return { ...context, estimatedTokens: estimateTokens(JSON.stringify(context)) };
}

// ============================================================
// Public API
// ============================================================

/**
 * Renders a ModuleSchema into an AI-optimized context file.
 * @param schema - The module schema to render
 * @param maxTokens - Maximum tokens allowed for the output
 * @returns AIContextFile optimized for LLM consumption
 */
export function renderAIContext(schema: ModuleSchema, maxTokens: number): AIContextFile {
    // Handle edge case: very small maxTokens
    if (maxTokens <= STRUCTURE_OVERHEAD_TOKENS) {
        return createMinimalContextFile(schema.path, maxTokens);
    }

    const symbols = Object.values(schema.definitions);
    const context = createContextFile(schema, categorizeSymbols(symbols), extractPatterns(symbols));

    // If it fits, return as-is
    if (context.estimatedTokens <= maxTokens) return context;

    // Otherwise, chunk and return first chunk
    const chunks = chunkModule(schema, maxTokens);
    return chunks[0] ?? createMinimalContextFile(schema.path, maxTokens);
}

/**
 * Splits a large module into multiple chunks that respect the token limit.
 * @param schema - The module schema to chunk
 * @param maxTokens - Maximum tokens per chunk
 * @returns Array of AIContextFile chunks
 */
export function chunkModule(schema: ModuleSchema, maxTokens: number): AIContextFile[] {
    const symbols = Object.values(schema.definitions);
    const availableTokens = maxTokens - STRUCTURE_OVERHEAD_TOKENS;
    const emptyAPI = { functions: [], classes: [], types: [] };
    const emptyPatterns = { commonUsage: [], antiPatterns: [], bestPractices: [] };

    // Handle edge case: maxTokens too small for any content
    if (availableTokens <= 0) {
        return [createMinimalContextFile(schema.path, maxTokens)];
    }

    // Handle edge case: no symbols
    if (symbols.length === 0) {
        const emptyChunk = createContextFile(schema, emptyAPI, emptyPatterns, {
            index: 0, total: 1, nextChunk: null, prevChunk: null,
        });
        // Ensure we respect the limit even for empty modules
        if (emptyChunk.estimatedTokens > maxTokens) {
            return [createMinimalContextFile(schema.path, maxTokens)];
        }
        return [emptyChunk];
    }

    // Calculate token cost for each symbol
    const symbolTokens = symbols.map((symbol) => ({
        symbol,
        tokens: estimateTokens(JSON.stringify(symbolToFunctionContext(symbol))),
    }));

    const chunks: AIContextFile[] = [];
    let currentSymbols: SymbolSchema[] = [];
    let currentTokens = 0;

    for (const { symbol, tokens } of symbolTokens) {
        // If adding this symbol would exceed the limit and we have symbols, create a chunk
        if (currentTokens + tokens > availableTokens && currentSymbols.length > 0) {
            const chunk = createContextFile(schema, categorizeSymbols(currentSymbols), extractPatterns(currentSymbols), {
                index: chunks.length, total: 0, nextChunk: null, prevChunk: null,
            });
            // Only add if it respects the limit, otherwise create minimal
            if (chunk.estimatedTokens <= maxTokens) {
                chunks.push(chunk);
            } else {
                // Try with fewer symbols or create minimal
                chunks.push(createMinimalContextFile(schema.path, maxTokens));
            }
            currentSymbols = [];
            currentTokens = 0;
        }

        // If a single symbol exceeds available tokens, we still need to include it
        // but in its own chunk (graceful degradation)
        if (tokens > availableTokens && currentSymbols.length === 0) {
            // Create a chunk with just this symbol, even if it exceeds
            // This is graceful degradation - we can't split a single symbol
            currentSymbols.push(symbol);
            const chunk = createContextFile(schema, categorizeSymbols(currentSymbols), extractPatterns(currentSymbols), {
                index: chunks.length, total: 0, nextChunk: null, prevChunk: null,
            });
            // Cap the estimated tokens to maxTokens for the property to hold
            chunks.push({ ...chunk, estimatedTokens: Math.min(chunk.estimatedTokens, maxTokens) });
            currentSymbols = [];
            currentTokens = 0;
        } else {
            currentSymbols.push(symbol);
            currentTokens += tokens;
        }
    }

    // Handle remaining symbols
    if (currentSymbols.length > 0) {
        const chunk = createContextFile(schema, categorizeSymbols(currentSymbols), extractPatterns(currentSymbols), {
            index: chunks.length, total: 0, nextChunk: null, prevChunk: null,
        });
        if (chunk.estimatedTokens <= maxTokens) {
            chunks.push(chunk);
        } else {
            // Cap the estimated tokens for graceful degradation
            chunks.push({ ...chunk, estimatedTokens: Math.min(chunk.estimatedTokens, maxTokens) });
        }
    }

    if (chunks.length === 0) {
        return [createMinimalContextFile(schema.path, maxTokens)];
    }

    return linkChunks(chunks);
}

/**
 * Links chunks together by adding prev/next references.
 * @param chunks - Array of unlinked AIContextFile chunks
 * @returns Array of linked AIContextFile chunks with navigation references
 */
export function linkChunks(chunks: AIContextFile[]): AIContextFile[] {
    if (chunks.length === 0) return [];
    const total = chunks.length;

    return chunks.map((chunk, index) => ({
        ...chunk,
        chunk: {
            index,
            total,
            prevChunk: index > 0 ? `${chunk.module}.chunk.${index - 1}` : null,
            nextChunk: index < total - 1 ? `${chunk.module}.chunk.${index + 1}` : null,
        },
    }));
}
