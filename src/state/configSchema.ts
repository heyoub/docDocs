/**
 * @fileoverview Zod runtime schemas for .docdocs.json configuration.
 * Mirrors src/types/config.ts for structural validation at load time.
 *
 * @module state/configSchema
 */

import { z } from 'zod';
import type { GenDocsConfig } from '../types/config.js';
import type { Result } from '../types/base.js';
import { ok, err } from '../utils/result.js';

// ============================================================
// Enum literals (mirror types/config.ts)
// ============================================================

const OUTPUT_FORMATS = [
    'markdown',
    'ai-context',
    'json-schema',
    'openapi',
    'graphql',
    'lsif',
    'notebook',
] as const;

const LINT_RULES = [
    'missing-description',
    'missing-param-description',
    'missing-return-description',
    'missing-example',
    'outdated-param-name',
    'outdated-return-type',
    'broken-reference',
    'circular-dependency',
    'undocumented-export',
] as const;

const LINT_SEVERITIES = ['error', 'warning', 'off'] as const;

const ML_DEVICES = ['cpu', 'webgpu', 'auto'] as const;

// ============================================================
// Primitive schemas
// ============================================================

export const outputFormatSchema = z.enum(OUTPUT_FORMATS);
export const lintRuleSchema = z.enum(LINT_RULES);
export const lintSeveritySchema = z.enum(LINT_SEVERITIES);
export const mlDeviceSchema = z.enum(ML_DEVICES);

// ============================================================
// Nested section schemas (partial — config files may omit fields)
// ============================================================

const outputConfigShape = z.object({
    directory: z.string().min(1),
    formats: z.array(outputFormatSchema).min(1),
    clean: z.boolean(),
});

export const outputConfigSchema = outputConfigShape.strict().partial();

const sourceConfigShape = z.object({
    include: z.array(z.string()).min(1),
    exclude: z.array(z.string()),
    followSymlinks: z.boolean(),
});

export const sourceConfigSchema = sourceConfigShape.strict().partial();

const extractionConfigShape = z.object({
    preferLSP: z.boolean(),
    treeSitterFallback: z.boolean(),
    timeout: z.number().int().positive(),
    concurrency: z.number().int().min(1).max(64),
});

export const extractionConfigSchema = extractionConfigShape.strict().partial();

const validationGateConfigShape = z.object({
    enabled: z.boolean(),
    command: z.string().min(1).optional(),
    autoFix: z.boolean().optional(),
});

export const validationGateConfigSchema = validationGateConfigShape.strict().partial();

export const customGateConfigSchema = z
    .object({
        name: z.string().min(1),
        command: z.string().min(1),
    })
    .strict();

export const validationGatesConfigSchema = z
    .object({
        format: validationGateConfigSchema.optional(),
        lint: validationGateConfigSchema.optional(),
        typecheck: validationGateConfigSchema.optional(),
        custom: z.array(customGateConfigSchema).optional(),
    })
    .strict();

const convergenceConfigShape = z.object({
    enabled: z.boolean(),
    maxIterations: z.number().int().min(1).max(100),
});

export const convergenceConfigSchema = convergenceConfigShape.strict().partial();

const validationConfigShape = z.object({
    gates: validationGatesConfigSchema,
    convergence: convergenceConfigSchema,
});

export const validationConfigSchema = validationConfigShape.strict().partial();

const mlConfigShape = z.object({
    enabled: z.boolean(),
    model: z.string().min(1),
    device: mlDeviceSchema,
    cacheDir: z.string().min(1).optional(),
    maxTokens: z.number().int().positive(),
    generateSummaries: z.boolean(),
    generateTransitions: z.boolean(),
    generateWhyItMatters: z.boolean(),
});

export const mlConfigSchema = mlConfigShape.strict().partial();

const lintRulesConfigSchema = z
    .object({
        'missing-description': lintSeveritySchema.optional(),
        'missing-param-description': lintSeveritySchema.optional(),
        'missing-return-description': lintSeveritySchema.optional(),
        'missing-example': lintSeveritySchema.optional(),
        'outdated-param-name': lintSeveritySchema.optional(),
        'outdated-return-type': lintSeveritySchema.optional(),
        'broken-reference': lintSeveritySchema.optional(),
        'circular-dependency': lintSeveritySchema.optional(),
        'undocumented-export': lintSeveritySchema.optional(),
    })
    .strict();

const coverageConfigShape = z.object({
    threshold: z.number().min(0).max(100),
    failBelowThreshold: z.boolean(),
});

export const coverageConfigSchema = coverageConfigShape.strict().partial();

const lintConfigShape = z.object({
    rules: lintRulesConfigSchema,
    coverage: coverageConfigSchema,
});

export const lintConfigSchema = lintConfigShape.strict().partial();

const markdownTemplateConfigShape = z.object({
    module: z.string().min(1),
    symbol: z.string().min(1),
    index: z.string().min(1),
});

export const markdownTemplateConfigSchema = markdownTemplateConfigShape.strict().partial();

const templatesConfigShape = z.object({
    directory: z.string().min(1),
    markdown: markdownTemplateConfigSchema,
});

export const templatesConfigSchema = templatesConfigShape.strict().partial();

const watchConfigShape = z.object({
    enabled: z.boolean(),
    debounceMs: z.number().int().min(0).max(600_000),
    autoRegenerate: z.boolean(),
});

export const watchConfigSchema = watchConfigShape.strict().partial();

const gitConfigShape = z.object({
    includeCommitInfo: z.boolean(),
    includeBlame: z.boolean(),
});

export const gitConfigSchema = gitConfigShape.strict().partial();

export const openAPIServerConfigSchema = z
    .object({
        url: z.string().min(1),
        description: z.string(),
    })
    .strict();

export const openAPIExportConfigSchema = z
    .object({
        title: z.string().min(1),
        version: z.string().min(1),
        servers: z.array(openAPIServerConfigSchema),
    })
    .strict();

export const graphQLExportConfigSchema = z
    .object({
        schemaPath: z.string().min(1),
    })
    .strict();

const openAPIExportPartialSchema = z
    .object({
        title: z.string().min(1),
        version: z.string().min(1),
        servers: z.array(openAPIServerConfigSchema),
    })
    .strict()
    .partial();

const exportConfigShape = z.object({
    openapi: openAPIExportPartialSchema,
    graphql: graphQLExportConfigSchema,
});

export const exportConfigSchema = exportConfigShape.strict().partial();

const changelogConfigShape = z.object({
    autoSnapshot: z.boolean(),
    tagPattern: z.string().min(1),
    outputDir: z.string().min(1),
    includePrivate: z.boolean(),
    harshMode: z.boolean(),
    includeImpactAnalysis: z.boolean(),
    includeCodeDiffs: z.boolean(),
    includeMigrationExamples: z.boolean(),
});

export const changelogConfigSchema = changelogConfigShape.strict().partial();

/** Top-level .docdocs.json object (all sections optional for partial overrides). */
export const genDocsConfigSchema = z
    .object({
        version: z.literal(1).optional(),
        output: outputConfigSchema.optional(),
        source: sourceConfigSchema.optional(),
        extraction: extractionConfigSchema.optional(),
        validation: validationConfigSchema.optional(),
        ml: mlConfigSchema.optional(),
        linting: lintConfigSchema.optional(),
        templates: templatesConfigSchema.optional(),
        watch: watchConfigSchema.optional(),
        git: gitConfigSchema.optional(),
        export: exportConfigSchema.optional(),
        changelog: changelogConfigSchema.optional(),
    })
    .strict();

export type ParsedGenDocsConfig = z.infer<typeof genDocsConfigSchema>;

// ============================================================
// Parsing
// ============================================================

function formatZodError(error: z.ZodError): string {
    return error.issues
        .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join('.') : 'config';
            return `${path}: ${issue.message}`;
        })
        .join('; ');
}

/**
 * Validates unknown input against the GenDocsConfig Zod schema.
 * Returns a partial config suitable for merging with defaults.
 */
export function parseGenDocsConfig(
    obj: unknown
): Result<Partial<GenDocsConfig>, { readonly type: 'validation'; readonly message: string }> {
    const result = genDocsConfigSchema.safeParse(obj);
    if (!result.success) {
        return err({ type: 'validation', message: formatZodError(result.error) });
    }
    return ok(result.data as Partial<GenDocsConfig>);
}
