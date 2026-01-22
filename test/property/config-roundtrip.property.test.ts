/**
 * @fileoverview Property test for configuration round-trip consistency.
 * Verifies that GenDocsConfig can be serialized and deserialized
 * without data loss.
 *
 * Feature: gendocs-extension, Property 23: Schema Round-Trip Consistency
 * Validates: Requirements 13.1
 *
 * @module test/property/config-roundtrip.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
    GenDocsConfig,
    OutputFormat,
    LintRule,
    LintSeverity,
    MLDevice,
} from '../../src/types/config.js';
import { getDefault, mergeConfigs, validateConfig } from '../../src/state/config.js';

// ============================================================
// Arbitrary Generators
// ============================================================

/**
 * Generates a valid output format.
 */
const arbOutputFormat: fc.Arbitrary<OutputFormat> = fc.constantFrom(
    'markdown',
    'ai-context',
    'json-schema',
    'openapi',
    'graphql',
    'lsif',
    'notebook'
);

/**
 * Generates a valid lint rule.
 */
const arbLintRule: fc.Arbitrary<LintRule> = fc.constantFrom(
    'missing-description',
    'missing-param-description',
    'missing-return-description',
    'missing-example',
    'outdated-param-name',
    'outdated-return-type',
    'broken-reference',
    'circular-dependency',
    'undocumented-export'
);

/**
 * Generates a valid lint severity.
 */
const arbLintSeverity: fc.Arbitrary<LintSeverity> = fc.constantFrom('error', 'warning', 'off');

/**
 * Generates a valid ML device.
 */
const arbMLDevice: fc.Arbitrary<MLDevice> = fc.constantFrom('cpu', 'webgpu', 'auto');

/**
 * Generates a valid directory path.
 */
const arbDirectory = fc.stringMatching(/^\.?[a-z][a-z0-9_-]{0,20}$/);

/**
 * Generates a valid glob pattern.
 */
const arbGlobPattern = fc.stringMatching(/^(\*\*\/)?[a-z*]+(\.[a-z*]+)?$/);

/**
 * Generates a valid HuggingFace model ID.
 */
const arbModelId = fc.constantFrom(
    'HuggingFaceTB/SmolLM2-135M-Instruct',
    'HuggingFaceTB/SmolLM2-360M-Instruct',
    'Qwen/Qwen2.5-0.5B-Instruct'
);

/**
 * Generates a valid output configuration.
 */
const arbOutputConfig = fc.record({
    directory: arbDirectory,
    formats: fc.array(arbOutputFormat, { minLength: 1, maxLength: 4 }),
    clean: fc.boolean(),
});

/**
 * Generates a valid source configuration.
 */
const arbSourceConfig = fc.record({
    include: fc.array(arbGlobPattern, { minLength: 1, maxLength: 5 }),
    exclude: fc.array(arbGlobPattern, { minLength: 0, maxLength: 5 }),
    followSymlinks: fc.boolean(),
});

/**
 * Generates a valid extraction configuration.
 */
const arbExtractionConfig = fc.record({
    preferLSP: fc.boolean(),
    treeSitterFallback: fc.boolean(),
    timeout: fc.integer({ min: 1000, max: 120000 }),
    concurrency: fc.integer({ min: 1, max: 16 }),
});

/**
 * Generates a valid convergence configuration.
 */
const arbConvergenceConfig = fc.record({
    enabled: fc.boolean(),
    maxIterations: fc.integer({ min: 1, max: 10 }),
});

/**
 * Generates a valid validation configuration.
 */
const arbValidationConfig = fc.record({
    gates: fc.constant({}),
    convergence: arbConvergenceConfig,
});

/**
 * Generates a valid ML configuration.
 */
const arbMLConfig = fc.record({
    enabled: fc.boolean(),
    model: arbModelId,
    device: arbMLDevice,
    cacheDir: fc.option(arbDirectory, { nil: undefined }),
    generateSummaries: fc.boolean(),
    generateTransitions: fc.boolean(),
    generateWhyItMatters: fc.boolean(),
}).map(config => {
    // Remove undefined cacheDir
    if (config.cacheDir === undefined) {
        const { cacheDir: _, ...rest } = config;
        return rest;
    }
    return config;
});

/**
 * Generates a valid lint rules configuration.
 */
const arbLintRulesConfig = fc.record({
    'missing-description': arbLintSeverity,
    'missing-param-description': arbLintSeverity,
    'missing-return-description': arbLintSeverity,
    'missing-example': arbLintSeverity,
    'outdated-param-name': arbLintSeverity,
    'outdated-return-type': arbLintSeverity,
    'broken-reference': arbLintSeverity,
    'circular-dependency': arbLintSeverity,
    'undocumented-export': arbLintSeverity,
});

/**
 * Generates a valid coverage configuration.
 */
const arbCoverageConfig = fc.record({
    threshold: fc.integer({ min: 0, max: 100 }),
    failBelowThreshold: fc.boolean(),
});

/**
 * Generates a valid lint configuration.
 */
const arbLintConfig = fc.record({
    rules: arbLintRulesConfig,
    coverage: arbCoverageConfig,
});

/**
 * Generates a valid templates configuration.
 */
const arbTemplatesConfig = fc.record({
    directory: fc.option(arbDirectory, { nil: undefined }),
}).map(config => {
    if (config.directory === undefined) {
        return {};
    }
    return config;
});

/**
 * Generates a valid watch configuration.
 */
const arbWatchConfig = fc.record({
    enabled: fc.boolean(),
    debounceMs: fc.integer({ min: 100, max: 5000 }),
    autoRegenerate: fc.boolean(),
});

/**
 * Generates a valid git configuration.
 */
const arbGitConfig = fc.record({
    includeCommitInfo: fc.boolean(),
    includeBlame: fc.boolean(),
});

/**
 * Generates a valid export configuration.
 */
const arbExportConfig = fc.constant({});

/**
 * Generates a complete valid GenDocsConfig.
 */
const arbGenDocsConfig: fc.Arbitrary<GenDocsConfig> = fc.record({
    version: fc.constant(1 as const),
    output: arbOutputConfig,
    source: arbSourceConfig,
    extraction: arbExtractionConfig,
    validation: arbValidationConfig,
    ml: arbMLConfig,
    linting: arbLintConfig,
    templates: arbTemplatesConfig,
    watch: arbWatchConfig,
    git: arbGitConfig,
    export: arbExportConfig,
}) as fc.Arbitrary<GenDocsConfig>;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Simulates JSON serialization round-trip.
 */
function jsonRoundTrip<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Deep equality check for GenDocsConfig objects.
 */
function configsAreEqual(a: GenDocsConfig, b: GenDocsConfig): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================
// Property Tests
// ============================================================

describe('Feature: gendocs-extension, Property 23: Schema Round-Trip Consistency', () => {
    it('should preserve config through JSON serialization round-trip', () => {
        fc.assert(
            fc.property(arbGenDocsConfig, (config) => {
                const restored = jsonRoundTrip(config);
                expect(configsAreEqual(config, restored)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('should preserve default config through round-trip', () => {
        const defaultConfig = getDefault();
        const restored = jsonRoundTrip(defaultConfig);
        expect(configsAreEqual(defaultConfig, restored)).toBe(true);
    });

    it('should preserve merged config through round-trip', () => {
        fc.assert(
            fc.property(
                arbGenDocsConfig,
                fc.record({
                    output: fc.option(arbOutputConfig, { nil: undefined }),
                    ml: fc.option(arbMLConfig, { nil: undefined }),
                }),
                (base, override) => {
                    const merged = mergeConfigs(base, override as Partial<GenDocsConfig>);
                    const restored = jsonRoundTrip(merged);
                    expect(configsAreEqual(merged, restored)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should validate round-tripped config successfully', () => {
        fc.assert(
            fc.property(arbGenDocsConfig, (config) => {
                const restored = jsonRoundTrip(config);
                const result = validateConfig(restored);
                expect(result.ok).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('should preserve all output formats through round-trip', () => {
        fc.assert(
            fc.property(
                fc.array(arbOutputFormat, { minLength: 1, maxLength: 7 }),
                (formats) => {
                    const config = mergeConfigs(getDefault(), {
                        output: { ...getDefault().output, formats },
                    });
                    const restored = jsonRoundTrip(config);
                    expect(restored.output.formats).toEqual(formats);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should preserve all lint rules through round-trip', () => {
        fc.assert(
            fc.property(arbLintRulesConfig, (rules) => {
                const config = mergeConfigs(getDefault(), {
                    linting: { ...getDefault().linting, rules },
                });
                const restored = jsonRoundTrip(config);
                expect(restored.linting.rules).toEqual(rules);
            }),
            { numRuns: 100 }
        );
    });

    it('should preserve ML configuration through round-trip', () => {
        fc.assert(
            fc.property(arbMLConfig, (ml) => {
                const config = mergeConfigs(getDefault(), { ml } as Partial<GenDocsConfig>);
                const restored = jsonRoundTrip(config);

                expect(restored.ml.enabled).toBe(ml.enabled);
                expect(restored.ml.model).toBe(ml.model);
                expect(restored.ml.device).toBe(ml.device);
                expect(restored.ml.generateSummaries).toBe(ml.generateSummaries);
                expect(restored.ml.generateTransitions).toBe(ml.generateTransitions);
                expect(restored.ml.generateWhyItMatters).toBe(ml.generateWhyItMatters);
            }),
            { numRuns: 100 }
        );
    });

    it('should preserve watch configuration through round-trip', () => {
        fc.assert(
            fc.property(arbWatchConfig, (watch) => {
                const config = mergeConfigs(getDefault(), { watch });
                const restored = jsonRoundTrip(config);

                expect(restored.watch.enabled).toBe(watch.enabled);
                expect(restored.watch.debounceMs).toBe(watch.debounceMs);
                expect(restored.watch.autoRegenerate).toBe(watch.autoRegenerate);
            }),
            { numRuns: 100 }
        );
    });

    it('should preserve coverage thresholds through round-trip', () => {
        fc.assert(
            fc.property(arbCoverageConfig, (coverage) => {
                const config = mergeConfigs(getDefault(), {
                    linting: { ...getDefault().linting, coverage },
                });
                const restored = jsonRoundTrip(config);

                expect(restored.linting.coverage.threshold).toBe(coverage.threshold);
                expect(restored.linting.coverage.failBelowThreshold).toBe(coverage.failBelowThreshold);
            }),
            { numRuns: 100 }
        );
    });

    it('should preserve extraction settings through round-trip', () => {
        fc.assert(
            fc.property(arbExtractionConfig, (extraction) => {
                const config = mergeConfigs(getDefault(), { extraction });
                const restored = jsonRoundTrip(config);

                expect(restored.extraction.preferLSP).toBe(extraction.preferLSP);
                expect(restored.extraction.treeSitterFallback).toBe(extraction.treeSitterFallback);
                expect(restored.extraction.timeout).toBe(extraction.timeout);
                expect(restored.extraction.concurrency).toBe(extraction.concurrency);
            }),
            { numRuns: 100 }
        );
    });

    it('should handle config with all optional fields set', () => {
        const fullConfig: GenDocsConfig = {
            version: 1,
            output: {
                directory: 'docs',
                formats: ['markdown', 'ai-context', 'json-schema'],
                clean: true,
            },
            source: {
                include: ['src/**/*.ts', 'lib/**/*.ts'],
                exclude: ['**/*.test.ts', '**/node_modules/**'],
                followSymlinks: true,
            },
            extraction: {
                preferLSP: true,
                treeSitterFallback: true,
                timeout: 60000,
                concurrency: 8,
            },
            validation: {
                gates: {},
                convergence: {
                    enabled: true,
                    maxIterations: 5,
                },
            },
            ml: {
                enabled: true,
                model: 'HuggingFaceTB/SmolLM2-360M-Instruct',
                device: 'webgpu',
                cacheDir: '.cache',
                generateSummaries: true,
                generateTransitions: true,
                generateWhyItMatters: true,
            },
            linting: {
                rules: {
                    'missing-description': 'error',
                    'missing-param-description': 'warning',
                    'missing-return-description': 'warning',
                    'missing-example': 'off',
                    'outdated-param-name': 'error',
                    'outdated-return-type': 'error',
                    'broken-reference': 'error',
                    'circular-dependency': 'error',
                    'undocumented-export': 'warning',
                },
                coverage: {
                    threshold: 90,
                    failBelowThreshold: true,
                },
            },
            templates: {
                directory: 'templates',
            },
            watch: {
                enabled: true,
                debounceMs: 1000,
                autoRegenerate: true,
            },
            git: {
                includeCommitInfo: true,
                includeBlame: true,
            },
            export: {},
        };

        const restored = jsonRoundTrip(fullConfig);
        expect(configsAreEqual(fullConfig, restored)).toBe(true);
    });

    it('should handle minimal config merged with defaults', () => {
        const minimalOverride: Partial<GenDocsConfig> = {
            output: {
                directory: 'api-docs',
                formats: ['markdown'],
                clean: false,
            },
        };

        const merged = mergeConfigs(getDefault(), minimalOverride);
        const restored = jsonRoundTrip(merged);

        expect(restored.output.directory).toBe('api-docs');
        expect(restored.output.formats).toEqual(['markdown']);
        // Other fields should have defaults
        expect(restored.ml.enabled).toBe(false);
        expect(restored.watch.enabled).toBe(false);
    });
});
