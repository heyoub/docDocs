/**
 * @fileoverview Shared prompts for local and cloud prose generation.
 *
 * @module core/ml/prosePrompts
 */

import type { SymbolSchema } from '../../types/schema.js';

export function buildSummaryPrompt(schema: SymbolSchema): string {
    return `Write a single concise documentation sentence for this ${schema.kind}.
Name: ${schema.name}
Signature: ${schema.signature}
Existing notes: ${schema.description || 'none'}

Reply with only the sentence, no markdown headings.`;
}

export function buildTransitionPrompt(from: SymbolSchema, to: SymbolSchema): string {
    return `Write one short transition sentence linking these symbols.
From: ${from.kind} ${from.name}
To: ${to.kind} ${to.name}

Reply with only the sentence.`;
}

export function buildWhyItMattersPrompt(schema: SymbolSchema): string {
    return `Explain in one sentence why this ${schema.kind} matters to API consumers.
Name: ${schema.name}
Signature: ${schema.signature}

Reply with only the sentence.`;
}

export function templateSummary(schema: SymbolSchema): string {
    const kind = schema.kind.charAt(0).toUpperCase() + schema.kind.slice(1);
    return `${kind} \`${schema.name}\` ${schema.description || 'provides functionality as defined by its signature'}.`;
}

export function templateTransition(from: SymbolSchema, to: SymbolSchema): string {
    return `After understanding \`${from.name}\`, we can explore \`${to.name}\`.`;
}

export function templateWhyItMatters(schema: SymbolSchema): string {
    return `This ${schema.kind.toLowerCase()} is part of the module's public API and may be used by consumers.`;
}
