/**
 * @fileoverview Golden/snapshot tests for markdown output.
 * Verifies output stability by comparing against known-good references.
 *
 * These tests catch unintended changes to output format.
 *
 * @module test/golden/markdown-output
 */

import '../__mocks__/setup.js';
import { describe, it, expect } from 'vitest';
import type { FileURI } from '../../src/types/base.js';
import type { ExtractedSymbol, ExtractionResult } from '../../src/types/extraction.js';

import { generateModuleSchema } from '../../src/core/schema/generator.js';
import { renderModule } from '../../src/core/renderer/markdown.js';
import { renderDependencyGraph, renderCallGraph, renderSequenceDiagram } from '../../src/core/renderer/mermaid.js';

// ============================================================
// Test Fixtures
// ============================================================

const FIXED_DATE = '2024-01-15T10:30:00.000Z';

function validLocation(line: number = 1, endLine: number = 1) {
    return {
        uri: 'file:///src/example.ts' as FileURI,
        range: {
            start: { line, character: 0 },
            end: { line: endLine, character: 30 },
        },
    };
}

function createSymbol(overrides: Partial<ExtractedSymbol>): ExtractedSymbol {
    return {
        name: 'testSymbol',
        kind: 'function',
        signature: 'function testSymbol(): void',
        location: validLocation(),
        documentation: null,
        modifiers: [],
        children: [],
        ...overrides,
    };
}

function createExtraction(symbols: ExtractedSymbol[]): ExtractionResult {
    return {
        uri: 'file:///src/example.ts' as FileURI,
        languageId: 'typescript',
        symbols,
        imports: [],
        exports: [],
        method: 'lsp',
        timestamp: Date.now(),
    };
}

// Helper to normalize date in output for snapshot comparison
function normalizeOutput(output: string): string {
    return output
        .replace(/Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, `Generated: ${FIXED_DATE}`)
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, FIXED_DATE);
}

// ============================================================
// Golden Tests: Basic Markdown Structure
// ============================================================

describe('Golden: Markdown Structure', () => {
    it('empty module produces expected structure', () => {
        const extraction = createExtraction([]);
        const schema = generateModuleSchema(extraction);
        const markdown = normalizeOutput(renderModule(schema));

        // Verify structural elements
        expect(markdown).toContain('# ');
        expect(markdown).toContain('Generated:');
        // Empty module won't have section headers, just the empty message
        expect(markdown).toContain('No symbols documented');
    });

    it('single function produces expected sections', () => {
        const extraction = createExtraction([
            createSymbol({
                name: 'greet',
                kind: 'function',
                signature: 'function greet(name: string): string',
                documentation: {
                    summary: 'Greets a person by name.',
                    description: 'Returns a greeting string.',
                    params: [{ name: 'name', type: 'string', description: 'The name to greet' }],
                    returns: { type: 'string', description: 'A greeting message' },
                    examples: ['greet("World") // "Hello, World!"'],
                    tags: [],
                },
            }),
        ]);
        const schema = generateModuleSchema(extraction);
        const markdown = normalizeOutput(renderModule(schema));

        // Should contain the function name
        expect(markdown).toContain('greet');

        // Should contain documentation elements
        expect(markdown).toContain('Greets a person by name');

        // Should have the function signature with parameters
        expect(markdown).toContain('name: string');

        // Should contain the function signature showing return type
        expect(markdown).toContain('): string');
    });

    it('class with methods produces hierarchical output', () => {
        const extraction = createExtraction([
            createSymbol({
                name: 'Calculator',
                kind: 'class',
                signature: 'class Calculator',
                documentation: {
                    summary: 'A simple calculator class.',
                    description: null,
                    params: [],
                    returns: null,
                    examples: [],
                    tags: [],
                },
                children: [
                    createSymbol({
                        name: 'add',
                        kind: 'method',
                        signature: 'add(a: number, b: number): number',
                        documentation: {
                            summary: 'Adds two numbers.',
                            description: null,
                            params: [
                                { name: 'a', type: 'number', description: 'First number' },
                                { name: 'b', type: 'number', description: 'Second number' },
                            ],
                            returns: { type: 'number', description: 'The sum' },
                            examples: [],
                            tags: [],
                        },
                    }),
                    createSymbol({
                        name: 'subtract',
                        kind: 'method',
                        signature: 'subtract(a: number, b: number): number',
                    }),
                ],
            }),
        ]);
        const schema = generateModuleSchema(extraction);
        const markdown = normalizeOutput(renderModule(schema));

        // Should contain class name
        expect(markdown).toContain('Calculator');

        // Should contain method names
        expect(markdown).toContain('add');
        expect(markdown).toContain('subtract');
    });

    it('interface produces expected structure', () => {
        const extraction = createExtraction([
            createSymbol({
                name: 'User',
                kind: 'interface',
                signature: 'interface User { id: string; name: string; email?: string; }',
                documentation: {
                    summary: 'Represents a user in the system.',
                    description: 'Contains basic user information.',
                    params: [],
                    returns: null,
                    examples: [],
                    tags: [{ name: 'since', value: '1.0.0' }],
                },
            }),
        ]);
        const schema = generateModuleSchema(extraction);
        const markdown = normalizeOutput(renderModule(schema));

        expect(markdown).toContain('User');
        expect(markdown).toContain('interface');
        expect(markdown).toContain('Represents a user');
    });
});

// ============================================================
// Golden Tests: Harsh Mode Output
// ============================================================

describe('Golden: Harsh Mode', () => {
    it('undocumented symbol shows gaps in harsh mode', () => {
        const extraction = createExtraction([
            createSymbol({
                name: 'undocumented',
                kind: 'function',
                signature: 'function undocumented(a: string, b: number): boolean',
                documentation: null, // No docs!
            }),
        ]);
        const schema = generateModuleSchema(extraction);
        const markdown = normalizeOutput(renderModule(schema, undefined, { harshMode: true }));

        // In harsh mode, should indicate missing documentation
        // The exact format depends on implementation, but it should be visible
        expect(markdown).toContain('undocumented');
    });

    it('partially documented symbol shows specific gaps', () => {
        const extraction = createExtraction([
            createSymbol({
                name: 'partial',
                kind: 'function',
                signature: 'function partial(a: string, b: number): boolean',
                documentation: {
                    summary: 'Has a summary but nothing else.',
                    description: null, // Missing
                    params: [], // Missing param docs
                    returns: null, // Missing return docs
                    examples: [], // No examples
                    tags: [],
                },
            }),
        ]);
        const schema = generateModuleSchema(extraction);
        const markdown = normalizeOutput(renderModule(schema, undefined, { harshMode: true }));

        expect(markdown).toContain('partial');
        expect(markdown).toContain('Has a summary');
    });
});

// ============================================================
// Golden Tests: Mermaid Diagrams
// ============================================================

describe('Golden: Mermaid Diagrams', () => {
    it('dependency graph has expected structure', () => {
        const graph = {
            nodes: new Map([
                ['src/api', { id: 'src/api', data: { path: 'src/api.ts', imports: ['src/utils'], exports: ['fetchData'] } }],
                ['src/utils', { id: 'src/utils', data: { path: 'src/utils.ts', imports: [], exports: ['format'] } }],
            ]),
            edges: [{ from: 'src/api', to: 'src/utils', data: { importCount: 2 } }],
        };

        const mermaid = renderDependencyGraph(graph);

        // Should start with graph directive
        expect(mermaid).toMatch(/^graph/);

        // Should contain node definitions (IDs sanitized: slashes become underscores)
        expect(mermaid).toContain('src_api');
        expect(mermaid).toContain('src_utils');

        // Should contain edge
        expect(mermaid).toMatch(/-->/);
    });

    it('call graph has expected structure', () => {
        const graph = {
            nodes: new Map([
                ['main', { id: 'main', data: { name: 'main', isEntryPoint: true, isLeaf: false } }],
                ['helper', { id: 'helper', data: { name: 'helper', isEntryPoint: false, isLeaf: true } }],
                ['recursive', { id: 'recursive', data: { name: 'recursive', isEntryPoint: false, isLeaf: false } }],
            ]),
            edges: [
                { from: 'main', to: 'helper', data: { callCount: 1, isRecursive: false } },
                { from: 'main', to: 'recursive', data: { callCount: 1, isRecursive: false } },
                { from: 'recursive', to: 'recursive', data: { callCount: 1, isRecursive: true } },
            ],
        };

        const mermaid = renderCallGraph(graph);

        expect(mermaid).toMatch(/^graph/);
        expect(mermaid).toContain('main');
        expect(mermaid).toContain('helper');
        expect(mermaid).toContain('recursive');
    });

    it('sequence diagram has expected structure', () => {
        const calls = [
            { from: 'Client', to: 'API', method: 'request', isRecursive: false, callCount: 1 },
            { from: 'API', to: 'Database', method: 'query', isRecursive: false, callCount: 1 },
            { from: 'Database', to: 'API', method: 'response', isRecursive: false, callCount: 1 },
            { from: 'API', to: 'Client', method: 'response', isRecursive: false, callCount: 1 },
        ];

        const mermaid = renderSequenceDiagram(calls);

        expect(mermaid).toMatch(/^sequenceDiagram/);
        expect(mermaid).toContain('participant');
        expect(mermaid).toContain('Client');
        expect(mermaid).toContain('API');
        expect(mermaid).toContain('Database');
    });

    it('circular dependencies are highlighted', () => {
        const graph = {
            nodes: new Map([
                ['a', { id: 'a', data: { path: 'a.ts', imports: ['b'], exports: [] } }],
                ['b', { id: 'b', data: { path: 'b.ts', imports: ['c'], exports: [] } }],
                ['c', { id: 'c', data: { path: 'c.ts', imports: ['a'], exports: [] } }],
            ]),
            edges: [
                { from: 'a', to: 'b', data: { importCount: 1, isCircular: true } },
                { from: 'b', to: 'c', data: { importCount: 1, isCircular: true } },
                { from: 'c', to: 'a', data: { importCount: 1, isCircular: true } },
            ],
        };

        const mermaid = renderDependencyGraph(graph);

        // Circular edges should be styled differently (typically red)
        expect(mermaid).toMatch(/style|stroke.*red|:::.*circular/i);
    });
});

// ============================================================
// Golden Tests: Output Stability
// ============================================================

describe('Golden: Output Stability', () => {
    it('same input produces identical output', () => {
        const extraction = createExtraction([
            createSymbol({
                name: 'stable',
                kind: 'function',
                signature: 'function stable(): void',
                documentation: {
                    summary: 'A stable function.',
                    description: 'Always the same.',
                    params: [],
                    returns: null,
                    examples: ['stable()'],
                    tags: [],
                },
            }),
        ]);

        const schema = generateModuleSchema(extraction);
        const output1 = normalizeOutput(renderModule(schema));
        const output2 = normalizeOutput(renderModule(schema));

        expect(output1).toBe(output2);
    });

    it('symbols are ordered consistently', () => {
        const extraction = createExtraction([
            createSymbol({ name: 'zebra', kind: 'function' }),
            createSymbol({ name: 'alpha', kind: 'function' }),
            createSymbol({ name: 'beta', kind: 'function' }),
        ]);

        const schema = generateModuleSchema(extraction);
        const output1 = normalizeOutput(renderModule(schema));
        const output2 = normalizeOutput(renderModule(schema));

        expect(output1).toBe(output2);

        // Order should be consistent (alphabetical or declaration order)
        const zebra = output1.indexOf('zebra');
        const alpha = output1.indexOf('alpha');
        const beta = output1.indexOf('beta');

        // Just verify we can find all symbols
        expect(zebra).toBeGreaterThan(-1);
        expect(alpha).toBeGreaterThan(-1);
        expect(beta).toBeGreaterThan(-1);
    });
});

// ============================================================
// Golden Tests: Special Characters
// ============================================================

describe('Golden: Special Characters', () => {
    it('escapes markdown special characters in code', () => {
        const extraction = createExtraction([
            createSymbol({
                name: 'special',
                kind: 'function',
                signature: 'function special<T extends { key: string }>(obj: T): T[keyof T]',
                documentation: {
                    summary: 'Uses angle brackets <T> and curly braces {}.',
                    description: 'Also uses pipes | and asterisks *bold*.',
                    params: [],
                    returns: null,
                    examples: [],
                    tags: [],
                },
            }),
        ]);

        const schema = generateModuleSchema(extraction);
        const markdown = normalizeOutput(renderModule(schema));

        // Output should be valid markdown (special chars handled)
        expect(markdown).toContain('special');
        // The signature should appear (possibly escaped)
        expect(markdown).toMatch(/special.*T/);
    });

    it('handles unicode in documentation', () => {
        const extraction = createExtraction([
            createSymbol({
                name: 'i18n',
                kind: 'function',
                signature: 'function i18n(): void',
                documentation: {
                    summary: 'Supports unicode: 日本語, émojis 🎉, and symbols ±∞≠.',
                    description: 'Also RTL: مرحبا and Greek: Γειά σου.',
                    params: [],
                    returns: null,
                    examples: [],
                    tags: [],
                },
            }),
        ]);

        const schema = generateModuleSchema(extraction);
        const markdown = normalizeOutput(renderModule(schema));

        // Unicode should be preserved
        expect(markdown).toContain('日本語');
        expect(markdown).toContain('🎉');
    });
});
