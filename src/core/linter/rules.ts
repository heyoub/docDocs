/**
 * @fileoverview Pure lint rule functions for documentation quality checks.
 * Each rule is a pure function that takes a schema and returns LintResult[].
 * Layer 1 - imports only from types/ (Layer 0).
 *
 * @module core/linter/rules
 */

import type { FileURI, SchemaRef, SourceLocation } from '../../types/base.js';
import type { LintRule } from '../../types/config.js';
import type { LintResult, LintResultSeverity } from '../../types/lint.js';
import type { ModuleSchema, SymbolSchema } from '../../types/schema.js';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Options for creating a lint result with enhanced routing.
 */
interface LintResultOptions {
    /** Paths to relevant spec/doc sections for remediation */
    readonly readPaths?: readonly string[];
    /** Actionable suggestion for fixing the issue */
    readonly suggestion?: string;
}

/**
 * Creates a LintResult with the given parameters.
 * @param rule - The lint rule that was violated
 * @param severity - Severity level of the issue
 * @param message - Human-readable description of the issue
 * @param location - Source location where the issue was found
 * @param options - Optional routing information (readPaths, suggestion)
 * @returns A LintResult object
 */
function createLintResult(
    rule: LintRule,
    severity: LintResultSeverity,
    message: string,
    location: SourceLocation,
    options?: LintResultOptions
): LintResult {
    return {
        rule,
        severity,
        message,
        location,
        ...(options?.readPaths && { readPaths: options.readPaths }),
        ...(options?.suggestion && { suggestion: options.suggestion }),
    };
}

/**
 * Checks if a description is considered missing (empty or whitespace-only).
 * @param description - The description to check
 * @returns true if the description is missing or empty
 */
function isDescriptionMissing(description: string | null | undefined): boolean {
    if (description === null || description === undefined) {
        return true;
    }
    return description.trim().length === 0;
}

/**
 * Checks if a symbol is exported (has 'export' in modifiers or is in exports list).
 * @param symbol - The symbol to check
 * @returns true if the symbol appears to be exported
 */
function isExportedSymbol(symbol: SymbolSchema): boolean {
    // Check for common export-related modifiers
    const exportModifiers = ['export', 'public'];
    return symbol.modifiers.some((mod) =>
        exportModifiers.includes(mod.toLowerCase())
    );
}

/**
 * Extracts the symbol name from a SchemaRef.
 * @param ref - The schema reference (e.g., '#/definitions/MyClass')
 * @returns The symbol name extracted from the ref
 */
function extractSymbolNameFromRef(ref: SchemaRef): string {
    const parts = (ref as string).split('/');
    return parts[parts.length - 1] ?? ref;
}

// ============================================================
// Missing Description Rules
// ============================================================

/**
 * Checks if a symbol is missing a description.
 * Exported symbols should have documentation describing their purpose.
 *
 * **Validates: Requirement 26.1** - Check for missing documentation on exported symbols
 *
 * @param symbol - The symbol schema to check
 * @param severity - Severity level for the lint result (default: 'warning')
 * @returns Array of LintResult for missing descriptions
 */
export function checkMissingDescription(
    symbol: SymbolSchema,
    severity: LintResultSeverity = 'warning'
): readonly LintResult[] {
    const results: LintResult[] = [];

    if (isDescriptionMissing(symbol.description)) {
        results.push(
            createLintResult(
                'missing-description',
                severity,
                `Symbol "${symbol.name}" is missing a description`,
                symbol.source
            )
        );
    }

    return results;
}

/**
 * Checks if any parameters of a symbol are missing descriptions.
 * Parameters should be documented to explain their purpose and expected values.
 *
 * **Validates: Requirement 26.1** - Check for missing documentation
 *
 * @param symbol - The symbol schema to check
 * @param severity - Severity level for the lint result (default: 'warning')
 * @returns Array of LintResult for missing parameter descriptions
 */
export function checkMissingParamDescription(
    symbol: SymbolSchema,
    severity: LintResultSeverity = 'warning'
): readonly LintResult[] {
    const results: LintResult[] = [];

    if (!symbol.parameters || symbol.parameters.length === 0) {
        return results;
    }

    for (const param of symbol.parameters) {
        if (isDescriptionMissing(param.description)) {
            results.push(
                createLintResult(
                    'missing-param-description',
                    severity,
                    `Parameter "${param.name}" in "${symbol.name}" is missing a description`,
                    symbol.source
                )
            );
        }
    }

    return results;
}

/**
 * Checks if a function/method is missing a return type description.
 * Return values should be documented to explain what is returned.
 *
 * **Validates: Requirement 26.1** - Check for missing documentation
 *
 * @param symbol - The symbol schema to check
 * @param severity - Severity level for the lint result (default: 'warning')
 * @returns Array of LintResult for missing return descriptions
 */
export function checkMissingReturnDescription(
    symbol: SymbolSchema,
    severity: LintResultSeverity = 'warning'
): readonly LintResult[] {
    const results: LintResult[] = [];

    // Only check functions and methods that have a return type
    const callableKinds = ['function', 'method'];
    if (!callableKinds.includes(symbol.kind)) {
        return results;
    }

    // Skip if no return type or void return
    if (!symbol.returnType) {
        return results;
    }

    const voidTypes = ['void', 'undefined', 'never'];
    if (voidTypes.includes(symbol.returnType.raw.toLowerCase())) {
        return results;
    }

    // Check if description mentions return value (simple heuristic)
    const description = symbol.description ?? '';
    const hasReturnDoc =
        description.toLowerCase().includes('@returns') ||
        description.toLowerCase().includes('@return') ||
        description.toLowerCase().includes('returns ');

    if (!hasReturnDoc) {
        results.push(
            createLintResult(
                'missing-return-description',
                severity,
                `Function "${symbol.name}" is missing a return value description`,
                symbol.source
            )
        );
    }

    return results;
}

/**
 * Checks if a public API symbol is missing code examples.
 * Public APIs should have examples showing how to use them.
 *
 * **Validates: Requirement 26.4** - Check for missing examples on public APIs
 *
 * @param symbol - The symbol schema to check
 * @param severity - Severity level for the lint result (default: 'info')
 * @returns Array of LintResult for missing examples
 */
export function checkMissingExample(
    symbol: SymbolSchema,
    severity: LintResultSeverity = 'info'
): readonly LintResult[] {
    const results: LintResult[] = [];

    // Only check exported/public symbols
    if (!isExportedSymbol(symbol)) {
        return results;
    }

    // Only check functions, classes, and interfaces
    const exampleKinds = ['function', 'method', 'class', 'interface'];
    if (!exampleKinds.includes(symbol.kind)) {
        return results;
    }

    const hasExamples = symbol.examples && symbol.examples.length > 0;
    const descriptionHasExample =
        symbol.description?.toLowerCase().includes('@example') ?? false;

    if (!hasExamples && !descriptionHasExample) {
        results.push(
            createLintResult(
                'missing-example',
                severity,
                `Public symbol "${symbol.name}" is missing a code example`,
                symbol.source
            )
        );
    }

    return results;
}

// ============================================================
// Outdated Documentation Rules
// ============================================================

/**
 * Checks if documented parameter names match actual parameter names.
 * Documentation can become outdated when parameters are renamed.
 *
 * **Validates: Requirement 26.2** - Check for outdated documentation
 *
 * @param symbol - The symbol schema to check
 * @param documentedParams - Map of documented parameter names to their descriptions
 * @param severity - Severity level for the lint result (default: 'warning')
 * @returns Array of LintResult for outdated parameter names
 */
export function checkOutdatedParamName(
    symbol: SymbolSchema,
    documentedParams: ReadonlyMap<string, string>,
    severity: LintResultSeverity = 'warning'
): readonly LintResult[] {
    const results: LintResult[] = [];

    if (!symbol.parameters || symbol.parameters.length === 0) {
        return results;
    }

    // Get actual parameter names
    const actualParamNames = new Set(symbol.parameters.map((p) => p.name));

    // Check for documented params that don't exist in actual params
    for (const [docParamName] of documentedParams) {
        if (!actualParamNames.has(docParamName)) {
            results.push(
                createLintResult(
                    'outdated-param-name',
                    severity,
                    `Documented parameter "${docParamName}" in "${symbol.name}" does not match any actual parameter`,
                    symbol.source
                )
            );
        }
    }

    return results;
}

/**
 * Checks if the documented return type matches the actual return type.
 * Documentation can become outdated when return types change.
 *
 * **Validates: Requirement 26.2** - Check for outdated documentation
 *
 * @param symbol - The symbol schema to check
 * @param documentedReturnType - The return type mentioned in documentation
 * @param severity - Severity level for the lint result (default: 'warning')
 * @returns Array of LintResult for outdated return types
 */
export function checkOutdatedReturnType(
    symbol: SymbolSchema,
    documentedReturnType: string | null,
    severity: LintResultSeverity = 'warning'
): readonly LintResult[] {
    const results: LintResult[] = [];

    if (!documentedReturnType || !symbol.returnType) {
        return results;
    }

    // Normalize types for comparison (remove whitespace, lowercase)
    const normalizeType = (t: string): string =>
        t.replace(/\s+/g, '').toLowerCase();

    const actualType = normalizeType(symbol.returnType.raw);
    const docType = normalizeType(documentedReturnType);

    // Simple mismatch check (could be enhanced with type compatibility)
    if (actualType !== docType && !actualType.includes(docType)) {
        results.push(
            createLintResult(
                'outdated-return-type',
                severity,
                `Documented return type "${documentedReturnType}" in "${symbol.name}" does not match actual type "${symbol.returnType.raw}"`,
                symbol.source
            )
        );
    }

    return results;
}

// ============================================================
// Reference Validation Rules
// ============================================================

/**
 * Checks if all cross-references in a symbol resolve to valid symbols.
 * Broken references can occur when referenced symbols are renamed or deleted.
 *
 * **Validates: Requirement 26.3** - Check for broken cross-references
 *
 * @param symbol - The symbol schema to check
 * @param allSymbols - Set of all valid symbol IDs in the workspace
 * @param severity - Severity level for the lint result (default: 'error')
 * @returns Array of LintResult for broken references
 */
export function checkBrokenReference(
    symbol: SymbolSchema,
    allSymbols: ReadonlySet<string>,
    severity: LintResultSeverity = 'error'
): readonly LintResult[] {
    const results: LintResult[] = [];

    // Check references array
    for (const ref of symbol.references) {
        const refName = extractSymbolNameFromRef(ref);
        if (!allSymbols.has(refName) && !allSymbols.has(ref as string)) {
            results.push(
                createLintResult(
                    'broken-reference',
                    severity,
                    `Symbol "${symbol.name}" has a broken reference to "${refName}"`,
                    symbol.source
                )
            );
        }
    }

    // Check incoming calls
    if (symbol.incomingCalls) {
        for (const ref of symbol.incomingCalls) {
            const refName = extractSymbolNameFromRef(ref);
            if (!allSymbols.has(refName) && !allSymbols.has(ref as string)) {
                results.push(
                    createLintResult(
                        'broken-reference',
                        severity,
                        `Symbol "${symbol.name}" has a broken incoming call reference to "${refName}"`,
                        symbol.source
                    )
                );
            }
        }
    }

    // Check outgoing calls
    if (symbol.outgoingCalls) {
        for (const ref of symbol.outgoingCalls) {
            const refName = extractSymbolNameFromRef(ref);
            if (!allSymbols.has(refName) && !allSymbols.has(ref as string)) {
                results.push(
                    createLintResult(
                        'broken-reference',
                        severity,
                        `Symbol "${symbol.name}" has a broken outgoing call reference to "${refName}"`,
                        symbol.source
                    )
                );
            }
        }
    }

    return results;
}

// ============================================================
// Module-Level Rules
// ============================================================

/**
 * Checks if a module has undocumented exports.
 * All exported symbols should have documentation.
 *
 * **Validates: Requirement 26.1** - Check for missing documentation on exported symbols
 *
 * @param module - The module schema to check
 * @param severity - Severity level for the lint result (default: 'warning')
 * @returns Array of LintResult for undocumented exports
 */
export function checkUndocumentedExport(
    module: ModuleSchema,
    severity: LintResultSeverity = 'warning'
): readonly LintResult[] {
    const results: LintResult[] = [];

    // Check each exported symbol for documentation
    for (const exportInfo of module.exports) {
        const symbolDef = module.definitions[exportInfo.name];

        if (!symbolDef) {
            // Export references a symbol not in definitions
            const location: SourceLocation = {
                uri: module.$id as unknown as FileURI,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 },
                },
            };
            results.push(
                createLintResult(
                    'undocumented-export',
                    severity,
                    `Export "${exportInfo.name}" in module "${module.path}" has no corresponding symbol definition`,
                    location
                )
            );
            continue;
        }

        if (isDescriptionMissing(symbolDef.description)) {
            results.push(
                createLintResult(
                    'undocumented-export',
                    severity,
                    `Exported symbol "${exportInfo.name}" in module "${module.path}" is missing documentation`,
                    symbolDef.source
                )
            );
        }
    }

    return results;
}

// ============================================================
// Stub/Placeholder Detection Rules
// ============================================================

/**
 * Extended lint rules for stub/placeholder detection.
 * These complement the standard LintRule type from config.
 */
export type ExtendedLintRule =
    | LintRule
    | 'stub-detected'
    | 'placeholder-string'
    | 'incomplete-signature';

/**
 * Rich pattern definition for stub detection.
 * Includes context and actionable suggestion for each pattern.
 */
interface StubPatternDefinition {
    /** Regex to detect the pattern */
    readonly regex: RegExp;
    /** Human-readable context explaining what was detected */
    readonly context: string;
    /** Actionable suggestion for fixing the issue */
    readonly suggestion: string;
    /** Paths to relevant documentation sections */
    readonly readPaths: readonly string[];
}

/**
 * Rich stub pattern definitions with context and suggestions.
 */
const STUB_PATTERNS: readonly StubPatternDefinition[] = [
    {
        regex: /throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented['"`]\s*\)/i,
        context: 'Function throws "not implemented" error',
        suggestion: 'Implement the function body or mark with @stub tag if intentional',
        readPaths: ['CONTRIBUTING.md#implementing-stubs', 'docs/api-guidelines.md#stub-functions']
    },
    {
        regex: /throw\s+['"`]not\s+implemented['"`]/i,
        context: 'Function throws string "not implemented"',
        suggestion: 'Implement the function body or document as intentional stub',
        readPaths: ['CONTRIBUTING.md#implementing-stubs']
    },
    {
        regex: /unimplemented!\s*\(\s*\)/,
        context: 'Rust unimplemented! macro detected',
        suggestion: 'Implement the function or use todo! with description',
        readPaths: ['docs/rust-guidelines.md#stub-macros']
    },
    {
        regex: /todo!\s*\(\s*\)/,
        context: 'Rust todo! macro without description',
        suggestion: 'Add description to todo! or implement the function',
        readPaths: ['docs/rust-guidelines.md#todo-usage']
    },
    {
        regex: /panic!\s*\(\s*['"`]not\s+implemented['"`]\s*\)/,
        context: 'Rust panic! with "not implemented" message',
        suggestion: 'Implement the function body or use todo! macro',
        readPaths: ['docs/rust-guidelines.md#panic-usage']
    },
    {
        regex: /pass\s*#\s*TODO/i,
        context: 'Python pass with TODO comment',
        suggestion: 'Implement the function or raise NotImplementedError with description',
        readPaths: ['docs/python-guidelines.md#stub-functions']
    },
    {
        regex: /raise\s+NotImplementedError/i,
        context: 'Python NotImplementedError raised',
        suggestion: 'Implement the function or document as abstract method',
        readPaths: ['docs/python-guidelines.md#abstract-methods']
    },
    {
        regex: /\{\s*\}\s*$/,
        context: 'Empty function body detected',
        suggestion: 'Add implementation or document as intentional no-op',
        readPaths: ['CONTRIBUTING.md#empty-functions']
    },
    {
        regex: /=>\s*\{\s*\}\s*$/,
        context: 'Empty arrow function body detected',
        suggestion: 'Add implementation or document as intentional no-op',
        readPaths: ['CONTRIBUTING.md#empty-functions']
    },
    {
        regex: /return\s+null\s*;?\s*$/,
        context: 'Function just returns null',
        suggestion: 'Implement actual logic or document the null return case',
        readPaths: ['docs/api-guidelines.md#null-returns']
    },
    {
        regex: /return\s+undefined\s*;?\s*$/,
        context: 'Function just returns undefined',
        suggestion: 'Implement actual logic or make function void',
        readPaths: ['docs/api-guidelines.md#return-types']
    },
    {
        regex: /return\s+\{\s*\}\s*;?\s*$/,
        context: 'Function just returns empty object',
        suggestion: 'Implement actual logic or document the empty return case',
        readPaths: ['docs/api-guidelines.md#empty-returns']
    },
    {
        regex: /return\s+\[\s*\]\s*;?\s*$/,
        context: 'Function just returns empty array',
        suggestion: 'Implement actual logic or document the empty return case',
        readPaths: ['docs/api-guidelines.md#empty-returns']
    }
];

/**
 * Checks if a function body appears to be a stub or placeholder.
 * Detects empty bodies, throw "not implemented", TODO bodies, etc.
 *
 * @param symbol - The symbol schema to check
 * @param signature - The full signature/body text (if available)
 * @param severity - Severity level for the lint result (default: 'warning')
 * @returns Array of LintResult for detected stubs
 */
export function checkStubDetected(
    symbol: SymbolSchema,
    signature: string,
    severity: LintResultSeverity = 'warning'
): readonly LintResult[] {
    const results: LintResult[] = [];

    // Only check functions and methods
    const callableKinds = ['function', 'method'];
    if (!callableKinds.includes(symbol.kind)) {
        return results;
    }

    for (const pattern of STUB_PATTERNS) {
        if (pattern.regex.test(signature)) {
            results.push(
                createLintResult(
                    'missing-description' as LintRule,
                    severity,
                    `Function "${symbol.name}" appears to be a stub: ${pattern.context}`,
                    symbol.source,
                    {
                        readPaths: pattern.readPaths,
                        suggestion: pattern.suggestion
                    }
                )
            );
            break;
        }
    }

    return results;
}

/**
 * Rich pattern definition for placeholder detection.
 */
interface PlaceholderPatternDefinition {
    readonly regex: RegExp;
    readonly context: string;
    readonly suggestion: string;
    readonly readPaths: readonly string[];
}

/**
 * Rich placeholder pattern definitions with context and suggestions.
 */
const PLACEHOLDER_PATTERNS: readonly PlaceholderPatternDefinition[] = [
    {
        regex: /\bTODO\b/i,
        context: 'Documentation contains TODO marker',
        suggestion: 'Replace TODO with actual documentation',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\bFIXME\b/i,
        context: 'Documentation contains FIXME marker',
        suggestion: 'Fix the issue and update documentation',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\bXXX\b/,
        context: 'Documentation contains XXX marker',
        suggestion: 'Address the marked issue and update documentation',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\bHACK\b/i,
        context: 'Documentation contains HACK marker',
        suggestion: 'Document the workaround properly or refactor',
        readPaths: ['docs/code-quality.md#avoiding-hacks']
    },
    {
        regex: /\bplaceholder\b/i,
        context: 'Documentation contains "placeholder" text',
        suggestion: 'Replace placeholder with actual description',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\blorem\s+ipsum\b/i,
        context: 'Documentation contains Lorem Ipsum',
        suggestion: 'Replace Lorem Ipsum with actual description',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\bdocumentation\s+needed\b/i,
        context: 'Documentation explicitly marked as needed',
        suggestion: 'Add the required documentation',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\bfill\s+in\b/i,
        context: 'Documentation contains "fill in" instruction',
        suggestion: 'Fill in the required information',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\badd\s+description\b/i,
        context: 'Documentation contains "add description" instruction',
        suggestion: 'Add a proper description',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\binsert\s+.*\s+here\b/i,
        context: 'Documentation contains "insert here" instruction',
        suggestion: 'Insert the required content',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\bTBD\b/i,
        context: 'Documentation contains TBD (To Be Determined)',
        suggestion: 'Determine and document the actual behavior',
        readPaths: ['CONTRIBUTING.md#documentation-guidelines']
    },
    {
        regex: /\bcoming\s+soon\b/i,
        context: 'Documentation says "coming soon"',
        suggestion: 'Implement and document, or remove if not planned',
        readPaths: ['CONTRIBUTING.md#roadmap-items']
    }
];

/**
 * Checks if documentation contains placeholder strings.
 * Detects TODO, FIXME, placeholder, lorem ipsum, etc.
 *
 * @param symbol - The symbol schema to check
 * @param severity - Severity level for the lint result (default: 'warning')
 * @returns Array of LintResult for detected placeholders
 */
export function checkPlaceholderString(
    symbol: SymbolSchema,
    severity: LintResultSeverity = 'warning'
): readonly LintResult[] {
    const results: LintResult[] = [];

    const description = symbol.description ?? '';

    for (const pattern of PLACEHOLDER_PATTERNS) {
        if (pattern.regex.test(description)) {
            results.push(
                createLintResult(
                    'missing-description' as LintRule,
                    severity,
                    `Symbol "${symbol.name}" has placeholder documentation: ${pattern.context}`,
                    symbol.source,
                    {
                        readPaths: pattern.readPaths,
                        suggestion: pattern.suggestion
                    }
                )
            );
            break;
        }
    }

    return results;
}

/**
 * Checks if parameters have generic/placeholder names.
 * Detects names like x, arg1, data, input, etc.
 *
 * @param symbol - The symbol schema to check
 * @param severity - Severity level for the lint result (default: 'info')
 * @returns Array of LintResult for generic parameter names
 */
export function checkIncompleteSignature(
    symbol: SymbolSchema,
    severity: LintResultSeverity = 'info'
): readonly LintResult[] {
    const results: LintResult[] = [];

    if (!symbol.parameters || symbol.parameters.length === 0) {
        return results;
    }

    // Generic/placeholder parameter name patterns with suggestions
    const genericNameSuggestions: Record<string, string> = {
        'x': 'Use a domain-specific name like "coordinate", "amount", or "value"',
        'y': 'Use a domain-specific name like "coordinate", "result", or "target"',
        'z': 'Use a domain-specific name like "coordinate", "depth", or "level"',
        'a': 'Use a descriptive name reflecting the parameter\'s purpose',
        'b': 'Use a descriptive name reflecting the parameter\'s purpose',
        'c': 'Use a descriptive name reflecting the parameter\'s purpose',
        'd': 'Use a descriptive name reflecting the parameter\'s purpose',
        'arg': 'Use a name describing what the argument represents',
        'param': 'Use a name describing what the parameter does',
        'data': 'Be specific: "userData", "requestData", "responsePayload", etc.',
        'input': 'Be specific: "userInput", "searchQuery", "formValues", etc.',
        'output': 'Be specific: "processedResult", "formattedOutput", etc.',
        'value': 'Be specific: "count", "amount", "setting", "measurement", etc.',
        'obj': 'Use the type name or purpose: "user", "config", "options", etc.',
        'object': 'Use the type name or purpose: "user", "config", "options", etc.',
        'item': 'Be specific: "product", "listEntry", "queueItem", etc.',
        'element': 'Be specific: "domNode", "arrayItem", "component", etc.',
        'temp': 'Remove or rename to reflect actual purpose',
        'tmp': 'Remove or rename to reflect actual purpose',
        'foo': 'Replace with a meaningful name for production code',
        'bar': 'Replace with a meaningful name for production code',
        'baz': 'Replace with a meaningful name for production code',
    };

    const genericNames = new Set(Object.keys(genericNameSuggestions));

    for (const param of symbol.parameters) {
        const nameLower = param.name.toLowerCase();
        // Check if name is generic or matches pattern like arg1, param2
        if (genericNames.has(nameLower) || /^(arg|param|input|data)\d*$/i.test(param.name)) {
            const baseName = nameLower.replace(/\d+$/, '');
            const suggestion = genericNameSuggestions[baseName] ??
                'Use a descriptive name reflecting the parameter\'s purpose';

            results.push(
                createLintResult(
                    'missing-param-description' as LintRule,
                    severity,
                    `Parameter "${param.name}" in "${symbol.name}" has a generic/placeholder name`,
                    symbol.source,
                    {
                        readPaths: ['CONTRIBUTING.md#naming-conventions', 'docs/api-guidelines.md#parameter-naming'],
                        suggestion
                    }
                )
            );
        }
    }

    return results;
}

/**
 * Runs all stub/placeholder detection rules on a symbol.
 *
 * @param symbol - The symbol to check
 * @param signature - The full signature/body text
 * @param severities - Optional severity overrides
 * @returns Array of all LintResults
 */
export function lintStubsAndPlaceholders(
    symbol: SymbolSchema,
    signature: string,
    severities?: Partial<Record<ExtendedLintRule, LintResultSeverity>>
): readonly LintResult[] {
    const results: LintResult[] = [];

    const getSeverity = (
        rule: ExtendedLintRule,
        defaultSeverity: LintResultSeverity
    ): LintResultSeverity => severities?.[rule] ?? defaultSeverity;

    results.push(
        ...checkStubDetected(
            symbol,
            signature,
            getSeverity('stub-detected', 'warning')
        )
    );
    results.push(
        ...checkPlaceholderString(
            symbol,
            getSeverity('placeholder-string', 'warning')
        )
    );
    results.push(
        ...checkIncompleteSignature(
            symbol,
            getSeverity('incomplete-signature', 'info')
        )
    );

    return results;
}

// ============================================================
// Composite Rule Runners
// ============================================================

/**
 * Runs all symbol-level lint rules on a single symbol.
 * Aggregates results from all applicable rules.
 *
 * @param symbol - The symbol schema to lint
 * @param allSymbols - Set of all valid symbol IDs for reference checking
 * @param severities - Optional severity overrides for each rule
 * @returns Array of all LintResults from all rules
 */
export function lintSymbol(
    symbol: SymbolSchema,
    allSymbols: ReadonlySet<string>,
    severities?: Partial<Record<LintRule, LintResultSeverity>>
): readonly LintResult[] {
    const results: LintResult[] = [];

    const getSeverity = (
        rule: LintRule,
        defaultSeverity: LintResultSeverity
    ): LintResultSeverity => severities?.[rule] ?? defaultSeverity;

    // Run all symbol-level rules
    results.push(
        ...checkMissingDescription(
            symbol,
            getSeverity('missing-description', 'warning')
        )
    );
    results.push(
        ...checkMissingParamDescription(
            symbol,
            getSeverity('missing-param-description', 'warning')
        )
    );
    results.push(
        ...checkMissingReturnDescription(
            symbol,
            getSeverity('missing-return-description', 'warning')
        )
    );
    results.push(
        ...checkMissingExample(symbol, getSeverity('missing-example', 'info'))
    );
    results.push(
        ...checkBrokenReference(
            symbol,
            allSymbols,
            getSeverity('broken-reference', 'error')
        )
    );

    return results;
}

/**
 * Runs all module-level lint rules on a single module.
 * Includes both module-specific rules and symbol rules for all definitions.
 *
 * @param module - The module schema to lint
 * @param allSymbols - Set of all valid symbol IDs for reference checking
 * @param severities - Optional severity overrides for each rule
 * @returns Array of all LintResults from all rules
 */
export function lintModule(
    module: ModuleSchema,
    allSymbols: ReadonlySet<string>,
    severities?: Partial<Record<LintRule, LintResultSeverity>>
): readonly LintResult[] {
    const results: LintResult[] = [];

    const getSeverity = (
        rule: LintRule,
        defaultSeverity: LintResultSeverity
    ): LintResultSeverity => severities?.[rule] ?? defaultSeverity;

    // Run module-level rules
    results.push(
        ...checkUndocumentedExport(
            module,
            getSeverity('undocumented-export', 'warning')
        )
    );

    // Run symbol-level rules on all definitions
    for (const symbolName of Object.keys(module.definitions)) {
        const symbol = module.definitions[symbolName];
        if (symbol) {
            results.push(...lintSymbol(symbol, allSymbols, severities));
        }
    }

    return results;
}
