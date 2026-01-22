/**
 * @fileoverview Property test for ML prose preservation.
 * Verifies that deterministic fields are unchanged after ML processing.
 *
 * Feature: gendocs-extension, Property 10: ML Prose Preservation
 * Validates: Requirements 5.5
 *
 * @module test/property/ml-preservation.property.test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import type { SymbolSchema, ParameterSchema } from '../../src/types/schema.js';
import type { SymbolKind, SymbolModifier, Visibility } from '../../src/types/symbols.js';
import { MLProseSmoother, createSmoother } from '../../src/core/ml/smoother.js';

// ============================================================
// Arbitrary Generators
// ============================================================

const arbSymbolKind: fc.Arbitrary<SymbolKind> = fc.constantFrom(
    'module', 'namespace', 'class', 'interface', 'type',
    'enum', 'function', 'method', 'property', 'variable',
    'constant', 'constructor', 'field', 'event'
);

const arbSymbolModifier: fc.Arbitrary<SymbolModifier> = fc.constantFrom(
    'static', 'readonly', 'abstract', 'async', 'generator',
    'optional', 'override', 'final', 'virtual', 'deprecated'
);

const arbVisibility: fc.Arbitrary<Visibility> = fc.constantFrom(
    'public', 'protected', 'private', 'internal'
);

const arbParameterSchema: fc.Arbitrary<ParameterSchema> = fc.record({
    name: fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,19}$/),
    type: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9<>,\s]{0,49}$/),
    description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
    optional: fc.boolean(),
    defaultValue: fc.option(fc.string({ maxLength: 30 }), { nil: null }),
    rest: fc.boolean(),
});

const arbSymbolSchema: fc.Arbitrary<SymbolSchema> = fc.record({
    $id: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{4,49}$/),
    $schema: fc.constant('https://json-schema.org/draft/2020-12/schema'),
    name: fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,29}$/),
    qualifiedName: fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_.]{0,99}$/),
    kind: arbSymbolKind,
    description: fc.string({ maxLength: 200 }),
    signature: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9<>(),:\s]{0,199}$/),
    parameters: fc.option(fc.array(arbParameterSchema, { maxLength: 5 }), { nil: undefined }),
    returnType: fc.option(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9<>|&]{0,49}$/), { nil: undefined }),
    modifiers: fc.array(arbSymbolModifier, { maxLength: 3 }),
    visibility: arbVisibility,
    source: fc.record({
        uri: fc.stringMatching(/^file:\/\/\/[a-z][a-z0-9_/]{4,99}$/),
        range: fc.record({
            start: fc.record({ line: fc.nat(1000), character: fc.nat(200) }),
            end: fc.record({ line: fc.nat(1000), character: fc.nat(200) }),
        }),
    }),
}) as fc.Arbitrary<SymbolSchema>;

// ============================================================
// Test Suite
// ============================================================

describe('Feature: gendocs-extension, Property 10: ML Prose Preservation', () => {
    let smoother: MLProseSmoother;

    beforeAll(() => {
        smoother = createSmoother();
    });

    it('template summary preserves all deterministic fields', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                // Capture original values
                const originalName = schema.name;
                const originalKind = schema.kind;
                const originalSignature = schema.signature;
                const originalModifiers = JSON.stringify(schema.modifiers);
                const originalParams = schema.parameters ? JSON.stringify(schema.parameters) : undefined;
                const originalReturnType = schema.returnType;

                // Generate summary (uses template since not initialized)
                const summary = await smoother.generateSummary(schema);

                // Summary should be a non-empty string
                if (typeof summary !== 'string' || summary.length === 0) return false;

                // Original schema fields should be unchanged
                if (schema.name !== originalName) return false;
                if (schema.kind !== originalKind) return false;
                if (schema.signature !== originalSignature) return false;
                if (JSON.stringify(schema.modifiers) !== originalModifiers) return false;
                if (schema.returnType !== originalReturnType) return false;
                const afterParams = schema.parameters ? JSON.stringify(schema.parameters) : undefined;
                if (afterParams !== originalParams) return false;

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('template transition preserves all deterministic fields', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, arbSymbolSchema, async (from, to) => {
                // Capture original values
                const originalFromName = from.name;
                const originalToName = to.name;

                // Generate transition
                const transition = await smoother.generateTransition(from, to);

                // Transition should be a non-empty string
                if (typeof transition !== 'string' || transition.length === 0) return false;

                // Original schemas should be unchanged
                if (from.name !== originalFromName) return false;
                if (to.name !== originalToName) return false;

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('template whyItMatters preserves all deterministic fields', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                // Capture original values
                const originalName = schema.name;
                const originalKind = schema.kind;

                // Generate explanation
                const explanation = await smoother.generateWhyItMatters(schema);

                // Explanation should be a non-empty string
                if (typeof explanation !== 'string' || explanation.length === 0) return false;

                // Original schema should be unchanged
                if (schema.name !== originalName) return false;
                if (schema.kind !== originalKind) return false;

                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('name field is never modified by generateSummary', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                const originalName = schema.name;
                await smoother.generateSummary(schema);
                return schema.name === originalName;
            }),
            { numRuns: 100 }
        );
    });

    it('signature field is never modified by generateSummary', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                const originalSignature = schema.signature;
                await smoother.generateSummary(schema);
                return schema.signature === originalSignature;
            }),
            { numRuns: 100 }
        );
    });

    it('kind field is never modified by generateSummary', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                const originalKind = schema.kind;
                await smoother.generateSummary(schema);
                return schema.kind === originalKind;
            }),
            { numRuns: 100 }
        );
    });

    it('modifiers array is never modified by generateSummary', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                const originalModifiers = JSON.stringify(schema.modifiers);
                await smoother.generateSummary(schema);
                return JSON.stringify(schema.modifiers) === originalModifiers;
            }),
            { numRuns: 100 }
        );
    });

    it('parameters array is never modified by generateSummary', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                const originalParams = schema.parameters ? JSON.stringify(schema.parameters) : undefined;
                await smoother.generateSummary(schema);
                const afterParams = schema.parameters ? JSON.stringify(schema.parameters) : undefined;
                return afterParams === originalParams;
            }),
            { numRuns: 100 }
        );
    });

    it('returnType field is never modified by generateSummary', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                const originalReturnType = schema.returnType;
                await smoother.generateSummary(schema);
                return schema.returnType === originalReturnType;
            }),
            { numRuns: 100 }
        );
    });

    it('qualifiedName field is never modified by generateSummary', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                const originalQualifiedName = schema.qualifiedName;
                await smoother.generateSummary(schema);
                return schema.qualifiedName === originalQualifiedName;
            }),
            { numRuns: 100 }
        );
    });

    it('smoother state is consistent when not initialized', () => {
        const state = smoother.getState();
        expect(state.initialized).toBe(false);
        expect(state.modelId).toBeNull();
        expect(state.device).toBeNull();
    });

    it('isReady returns false when not initialized', () => {
        expect(smoother.isReady()).toBe(false);
    });

    it('template fallback produces valid output for all symbol kinds', async () => {
        for (const kind of ['module', 'namespace', 'class', 'interface', 'type',
            'enum', 'function', 'method', 'property', 'variable',
            'constant', 'constructor', 'field', 'event'] as SymbolKind[]) {
            const schema: SymbolSchema = {
                $id: 'test-id-12345',
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                name: 'testSymbol',
                qualifiedName: 'module.testSymbol',
                kind,
                description: 'Test description',
                signature: 'function testSymbol(): void',
                modifiers: [],
                visibility: 'public',
                source: {
                    uri: 'file:///test/file.ts',
                    range: {
                        start: { line: 1, character: 0 },
                        end: { line: 10, character: 0 },
                    },
                },
            };

            const summary = await smoother.generateSummary(schema);
            expect(summary).toContain(kind.charAt(0).toUpperCase() + kind.slice(1));
            expect(summary).toContain('testSymbol');
        }
    });

    it('template summary includes symbol name', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, async (schema) => {
                const summary = await smoother.generateSummary(schema);
                return summary.includes(schema.name);
            }),
            { numRuns: 100 }
        );
    });

    it('template transition mentions both symbols', async () => {
        await fc.assert(
            fc.asyncProperty(arbSymbolSchema, arbSymbolSchema, async (from, to) => {
                const transition = await smoother.generateTransition(from, to);
                return transition.includes(from.name) && transition.includes(to.name);
            }),
            { numRuns: 100 }
        );
    });
});
