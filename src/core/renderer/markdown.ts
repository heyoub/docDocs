/**
 * @fileoverview Markdown renderer for GenDocs extension.
 * Transforms JSON Schema documentation into human-readable Markdown.
 * Layer 2 - imports only from Layer 0 (types) and Layer 1 (utils, templates).
 *
 * @module core/renderer/markdown
 */

import type { SchemaRef } from '../../types/base.js';
import type { SymbolSchema, ModuleSchema, ParameterSchema, TypeSchema } from '../../types/schema.js';
import { helperDefinitions, moduleTemplate, symbolTemplate, indexTemplate } from './templates.js';

// ============================================================
// Types
// ============================================================

/** Templates interface for Markdown rendering. */
export interface Templates {
    readonly module: string;
    readonly symbol: string;
    readonly index: string;
}

/** Default templates using the built-in Handlebars templates. */
export const defaultTemplates: Templates = {
    module: moduleTemplate,
    symbol: symbolTemplate,
    index: indexTemplate,
};

// ============================================================
// Helper Functions
// ============================================================

const slugify = (text: string): string => helperDefinitions.slugify(text);

const escapeMarkdown = (text: string): string =>
    text.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const extractRefName = (ref: SchemaRef): string => {
    const match = ref.match(/#\/definitions\/(.+)$/);
    return match !== null && match[1] !== undefined ? match[1] : ref;
};

const createAnchorLink = (name: string): string => `[${escapeMarkdown(name)}](#${slugify(name)})`;

const formatModifiers = (modifiers: readonly string[]): string =>
    modifiers.length === 0 ? '' : modifiers.map((m) => `\`${m}\``).join(' ');

const formatType = (type: TypeSchema): string => {
    if (type.reference) {
        const refName = extractRefName(type.reference as SchemaRef);
        return `[\`${escapeMarkdown(type.raw)}\`](#${slugify(refName)})`;
    }
    return `\`${escapeMarkdown(type.raw)}\``;
};

const capitalize = (str: unknown): string => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const truncate = (str: unknown, max: number): string => {
    if (!str || typeof str !== 'string') return '*No description*';
    return str.length <= max ? str : str.slice(0, max - 3) + '...';
};

// ============================================================
// Render Functions
// ============================================================

function renderParametersTable(parameters: readonly ParameterSchema[]): string {
    if (parameters.length === 0) return '';
    const header = '| Name | Type | Required | Default | Description |\n|------|------|----------|---------|-------------|';
    const rows = parameters.map((p) => {
        const def = p.defaultValue ? `\`${escapeMarkdown(p.defaultValue)}\`` : '-';
        const desc = p.description ? escapeMarkdown(p.description) : '-';
        return `| \`${escapeMarkdown(p.name)}\` | ${formatType(p.type)} | ${p.optional ? 'No' : 'Yes'} | ${def} | ${desc} |`;
    });
    return `#### Parameters\n\n${header}\n${rows.join('\n')}`;
}

function renderDeprecationWarning(deprecated: SymbolSchema['deprecated']): string {
    if (!deprecated) return '';
    let warning = `> ⚠️ **Deprecated**`;
    if (deprecated.since) warning += ` since ${deprecated.since}`;
    if (deprecated.message) warning += `: ${deprecated.message}`;
    if (deprecated.replacement) {
        warning += `\n> Use ${createAnchorLink(extractRefName(deprecated.replacement))} instead.`;
    }
    return warning + '\n';
}

/**
 * Renders a single symbol's documentation.
 * @param schema - The symbol schema to render
 * @returns Markdown string for the symbol
 */
export function renderSymbol(schema: SymbolSchema): string {
    const lines: string[] = [`### ${escapeMarkdown(schema.name)}\n`];
    const deprecation = renderDeprecationWarning(schema.deprecated);
    if (deprecation) lines.push(deprecation);

    // Kind and modifiers
    const mods = formatModifiers(schema.modifiers);
    lines.push(`**Kind:** \`${schema.kind}\`${mods ? ` | **Modifiers:** ${mods}` : ''}\n`);

    // Signature
    lines.push('```typescript', schema.signature, '```\n');

    // Summary and description
    if (schema.summary) lines.push(`> ${escapeMarkdown(schema.summary)}\n`);
    lines.push(schema.description?.trim() ? escapeMarkdown(schema.description) + '\n' : '*No description provided.*\n');

    // Parameters
    if (schema.parameters?.length) lines.push(renderParametersTable(schema.parameters) + '\n');

    // Return type
    if (schema.returnType) lines.push(`#### Returns\n`, formatType(schema.returnType) + '\n');

    // Examples
    if (schema.examples?.length) {
        lines.push('#### Examples\n');
        for (const ex of schema.examples) {
            if (ex.title) lines.push(`**${escapeMarkdown(ex.title)}**\n`);
            if (ex.description) lines.push(escapeMarkdown(ex.description) + '\n');
            lines.push(`\`\`\`${ex.language}`, ex.code, '```');
            if (!ex.validated && ex.validationError) {
                lines.push(`> ⚠️ Not validated: ${escapeMarkdown(ex.validationError)}`);
            }
            lines.push('');
        }
    }

    // Call hierarchy
    const renderRefList = (title: string, refs: readonly SchemaRef[] | undefined): void => {
        if (refs?.length) {
            lines.push(`#### ${title}\n`);
            refs.forEach((ref) => lines.push(`- ${createAnchorLink(extractRefName(ref))}`));
            lines.push('');
        }
    };
    renderRefList('Called By', schema.incomingCalls);
    renderRefList('Calls', schema.outgoingCalls);
    if (schema.references.length > 0) renderRefList('See Also', schema.references);

    // Source location (defensive against malformed data)
    const loc = schema.source;
    if (loc?.uri && loc?.range?.start && loc?.range?.end) {
        lines.push(`<details><summary>Source</summary>\`${loc.uri}\` L${loc.range.start.line}-${loc.range.end.line}</details>\n`);
    }

    return lines.join('\n');
}

/**
 * Renders a table of contents from an array of symbols.
 * @param symbols - Array of symbol schemas to include
 * @returns Markdown table of contents string
 */
export function renderTableOfContents(symbols: readonly SymbolSchema[]): string {
    if (symbols.length === 0) return '*No symbols documented.*\n';

    const lines: string[] = ['## Table of Contents\n'];
    const byKind = new Map<string, SymbolSchema[]>();

    for (const symbol of symbols) {
        const existing = byKind.get(symbol.kind) ?? [];
        existing.push(symbol);
        byKind.set(symbol.kind, existing);
    }

    for (const kind of Array.from(byKind.keys()).sort()) {
        const kindSymbols = byKind.get(kind) ?? [];
        lines.push(`### ${capitalize(kind)}s\n`);
        for (const s of kindSymbols) {
            const dep = s.deprecated ? ' ⚠️' : '';
            lines.push(`- ${createAnchorLink(s.name)}${dep} - ${truncate(s.description, 60)}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

/**
 * Renders cross-reference links between symbols in a module.
 * @param schema - The module schema containing symbol definitions
 * @returns Markdown string with cross-reference links
 */
export function renderCrossLinks(schema: ModuleSchema): string {
    const symbolsWithRefs: Array<{ name: string; refs: readonly SchemaRef[] }> = [];

    for (const [name, sym] of Object.entries(schema.definitions)) {
        const allRefs: SchemaRef[] = [...sym.references];
        if (sym.incomingCalls) allRefs.push(...sym.incomingCalls);
        if (sym.outgoingCalls) allRefs.push(...sym.outgoingCalls);
        if (allRefs.length > 0) symbolsWithRefs.push({ name, refs: allRefs });
    }

    if (symbolsWithRefs.length === 0) return '';

    const lines = ['## Cross References\n', '| Symbol | Related To |', '|--------|------------|'];
    for (const { name, refs } of symbolsWithRefs) {
        const refLinks = refs.map((r) => createAnchorLink(extractRefName(r))).join(', ');
        lines.push(`| ${createAnchorLink(name)} | ${refLinks} |`);
    }
    lines.push('');
    return lines.join('\n');
}

function renderImports(imports: ModuleSchema['imports']): string {
    if (imports.length === 0) return '';
    const lines = ['## Imports\n', '| Source | Specifiers | Type Only |', '|--------|------------|-----------|'];
    for (const imp of imports) {
        const specs = imp.specifiers.map((s) => `\`${s}\``).join(', ');
        lines.push(`| \`${escapeMarkdown(imp.source)}\` | ${specs} | ${imp.isTypeOnly ? 'Yes' : 'No'} |`);
    }
    lines.push('');
    return lines.join('\n');
}

function renderExports(exports: ModuleSchema['exports']): string {
    if (exports.length === 0) return '';
    const lines = ['## Exports\n', '| Name | Default | Type Only |', '|------|---------|-----------|'];
    for (const exp of exports) {
        lines.push(`| \`${escapeMarkdown(exp.name)}\` | ${exp.isDefault ? 'Yes' : 'No'} | ${exp.isTypeOnly ? 'Yes' : 'No'} |`);
    }
    lines.push('');
    return lines.join('\n');
}

// ============================================================
// Harsh Mode Rendering
// ============================================================

/**
 * Render configuration options.
 */
export interface RenderConfig {
    /** Enable harsh mode to expose documentation gaps */
    readonly harshMode?: boolean;
}

/**
 * Renders a symbol with harsh mode gap markers.
 * Exposes missing documentation explicitly instead of hiding it.
 *
 * @param schema - The symbol schema to render
 * @param harshMode - Whether to show gap markers
 * @returns Markdown string for the symbol
 */
export function renderSymbolWithGaps(schema: SymbolSchema, harshMode: boolean): string {
    const lines: string[] = [`### ${escapeMarkdown(schema.name)}\n`];
    const deprecation = renderDeprecationWarning(schema.deprecated);
    if (deprecation) lines.push(deprecation);

    // Kind and modifiers
    const mods = formatModifiers(schema.modifiers);
    lines.push(`**Kind:** \`${schema.kind}\`${mods ? ` | **Modifiers:** ${mods}` : ''}\n`);

    // Signature
    lines.push('```typescript', schema.signature, '```\n');

    // Summary and description - harsh mode shows explicit gap markers
    if (schema.summary) {
        lines.push(`> ${escapeMarkdown(schema.summary)}\n`);
    }

    if (schema.description?.trim()) {
        lines.push(escapeMarkdown(schema.description) + '\n');
    } else if (harshMode) {
        lines.push('<!-- NO DESCRIPTION - This symbol is part of the public API but has no documentation -->\n');
        lines.push('> **⚠️ UNDOCUMENTED** - This symbol needs a description.\n');
    } else {
        lines.push('*No description provided.*\n');
    }

    // Parameters - harsh mode shows which params are missing docs
    if (schema.parameters?.length) {
        if (harshMode) {
            lines.push(renderParametersTableHarsh(schema.parameters) + '\n');
        } else {
            lines.push(renderParametersTable(schema.parameters) + '\n');
        }
    } else if (harshMode && (schema.kind === 'function' || schema.kind === 'method')) {
        // Check if function might have params based on signature
        if (schema.signature.includes('(') && !schema.signature.includes('()')) {
            lines.push('<!-- PARAMETERS MAY BE MISSING - Signature suggests parameters but none documented -->\n');
        }
    }

    // Return type - harsh mode shows if return documentation is missing
    if (schema.returnType) {
        lines.push(`#### Returns\n`, formatType(schema.returnType) + '\n');
        if (harshMode) {
            const hasReturnDoc =
                schema.description?.toLowerCase().includes('@returns') ||
                schema.description?.toLowerCase().includes('@return') ||
                schema.description?.toLowerCase().includes('returns ');
            if (!hasReturnDoc && !['void', 'undefined', 'never'].includes(schema.returnType.raw.toLowerCase())) {
                lines.push('<!-- RETURN VALUE UNDOCUMENTED - Returns `' + schema.returnType.raw + '` but no description -->\n');
            }
        }
    }

    // Examples - harsh mode shows explicit gap for missing examples
    if (schema.examples?.length) {
        lines.push('#### Examples\n');
        for (const ex of schema.examples) {
            if (ex.title) lines.push(`**${escapeMarkdown(ex.title)}**\n`);
            if (ex.description) lines.push(escapeMarkdown(ex.description) + '\n');
            lines.push(`\`\`\`${ex.language}`, ex.code, '```');
            if (!ex.validated && ex.validationError) {
                lines.push(`> ⚠️ Not validated: ${escapeMarkdown(ex.validationError)}`);
            }
            lines.push('');
        }
    } else if (harshMode) {
        lines.push('#### Examples\n');
        lines.push('<!-- NO EXAMPLES - Public API with zero usage examples -->\n');
        lines.push('> **ℹ️ NO EXAMPLES** - Consider adding usage examples.\n');
    }

    // Call hierarchy
    const renderRefList = (title: string, refs: readonly SchemaRef[] | undefined): void => {
        if (refs?.length) {
            lines.push(`#### ${title}\n`);
            refs.forEach((ref) => lines.push(`- ${createAnchorLink(extractRefName(ref))}`));
            lines.push('');
        }
    };
    renderRefList('Called By', schema.incomingCalls);
    renderRefList('Calls', schema.outgoingCalls);
    if (schema.references.length > 0) renderRefList('See Also', schema.references);

    // Source location (defensive against malformed data)
    const loc = schema.source;
    if (loc?.uri && loc?.range?.start && loc?.range?.end) {
        lines.push(`<details><summary>Source</summary>\`${loc.uri}\` L${loc.range.start.line}-${loc.range.end.line}</details>\n`);
    }

    return lines.join('\n');
}

/**
 * Renders parameters table with harsh mode gap markers.
 */
function renderParametersTableHarsh(parameters: readonly ParameterSchema[]): string {
    if (parameters.length === 0) return '';
    const header = '| Name | Type | Required | Default | Description |\n|------|------|----------|---------|-------------|';
    const rows = parameters.map((p) => {
        const def = p.defaultValue ? `\`${escapeMarkdown(p.defaultValue)}\`` : '-';
        let desc: string;
        if (p.description) {
            desc = escapeMarkdown(p.description);
        } else {
            desc = '**⚠️ UNDOCUMENTED**';
        }
        return `| \`${escapeMarkdown(p.name)}\` | ${formatType(p.type)} | ${p.optional ? 'No' : 'Yes'} | ${def} | ${desc} |`;
    });

    const undocCount = parameters.filter(p => !p.description).length;
    let result = `#### Parameters\n\n${header}\n${rows.join('\n')}`;

    if (undocCount > 0) {
        result += `\n\n<!-- ${undocCount} of ${parameters.length} parameters have no description -->`;
    }

    return result;
}

/**
 * Renders a documentation gaps summary for a module.
 */
function renderGapsSummary(schema: ModuleSchema): string {
    const lines: string[] = ['## Documentation Gaps\n'];

    const symbols = Object.values(schema.definitions);
    const undocSymbols = symbols.filter(s => !s.description?.trim());
    const noExamples = symbols.filter(s =>
        (s.kind === 'function' || s.kind === 'method' || s.kind === 'class') &&
        (!s.examples || s.examples.length === 0)
    );

    let totalParams = 0;
    let undocParams = 0;
    for (const sym of symbols) {
        if (sym.parameters) {
            totalParams += sym.parameters.length;
            undocParams += sym.parameters.filter(p => !p.description).length;
        }
    }

    lines.push('| Metric | Count | Percentage |');
    lines.push('|--------|-------|------------|');
    lines.push(`| Undocumented symbols | ${undocSymbols.length} | ${Math.round((undocSymbols.length / symbols.length) * 100)}% |`);
    lines.push(`| Missing examples | ${noExamples.length} | ${Math.round((noExamples.length / symbols.length) * 100)}% |`);
    if (totalParams > 0) {
        lines.push(`| Undocumented params | ${undocParams} | ${Math.round((undocParams / totalParams) * 100)}% |`);
    }
    lines.push('');

    if (undocSymbols.length > 0) {
        lines.push('### Undocumented Symbols\n');
        for (const sym of undocSymbols.slice(0, 10)) {
            lines.push(`- \`${sym.name}\``);
        }
        if (undocSymbols.length > 10) {
            lines.push(`- ...and ${undocSymbols.length - 10} more`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Renders a complete module documentation page.
 * @param schema - The module schema to render
 * @param _templates - Optional custom templates (reserved for future Handlebars integration)
 * @param config - Optional render configuration
 * @returns Complete Markdown documentation string
 */
export function renderModule(
    schema: ModuleSchema,
    _templates: Templates = defaultTemplates,
    config?: RenderConfig
): string {
    const harshMode = config?.harshMode ?? false;
    const symbols = Object.values(schema.definitions);
    const lines: string[] = [
        `# ${escapeMarkdown(schema.path)}\n`,
        `> Generated: ${new Date().toISOString()}\n`,
        renderTableOfContents(symbols),
        renderImports(schema.imports),
        renderExports(schema.exports),
    ];

    // Harsh mode: show gaps summary at the top
    if (harshMode) {
        lines.push(renderGapsSummary(schema));
    }

    if (symbols.length > 0) {
        lines.push('## Symbols\n');
        for (const symbol of symbols) {
            if (harshMode) {
                lines.push(renderSymbolWithGaps(symbol, true), '---\n');
            } else {
                lines.push(renderSymbol(symbol), '---\n');
            }
        }
    }

    lines.push(renderCrossLinks(schema), '[Back to Index](./index.md)\n');
    return lines.join('\n');
}
