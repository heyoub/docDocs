/**
 * @fileoverview Spec cross-reference engine for requirement traceability.
 * Matches specs to code and exposes gaps in both directions.
 *
 * @module core/analysis/traceability
 */

import * as vscode from 'vscode';
import type { FileURI, AsyncResult } from '../../types/base.js';
import type {
    SpecReference,
    SpecCrossRef,
    TraceabilityGap,
    TraceabilityReport
} from '../../types/analysis.js';

// ============================================================
// Spec Reference Patterns
// ============================================================

/**
 * Patterns for detecting spec/requirement references in code.
 */
const CODE_PATTERNS = {
    // JSDoc/TSDoc tags
    requirements: /@requirements?\s+([^\n*]+)/gi,
    spec: /@spec\s+([^\n*]+)/gi,
    ticket: /@ticket\s+([^\n*]+)/gi,
    see: /@see\s+([^\n*]+)/gi,

    // Comment patterns
    reqComment: /\/\/\s*REQ[-_]?(\d+)/gi,
    specComment: /\/\/\s*SPEC[-_]?([A-Z0-9-]+)/gi,
    todoTicket: /TODO[:\s]+([A-Z]+-\d+)/gi,
    fixmeTicket: /FIXME[:\s]+([A-Z]+-\d+)/gi,

    // Rust doc comments
    rustRequirements: /\/\/!\s*Requirements?:\s*([^\n]+)/gi,

    // Python docstrings
    pythonSpec: /""".*?Requirements?:?\s*([^"]+)/gis
};

/**
 * Patterns for detecting specs in markdown files.
 */
const MARKDOWN_PATTERNS = {
    // Requirement headers
    reqHeader: /^#+\s*(?:REQ|Requirement)[-_\s]*(\d+|[A-Z0-9-]+)/gim,

    // Spec sections
    specHeader: /^#+\s*(?:SPEC|Specification)[-_\s]*([A-Z0-9-]+)/gim,

    // Checkbox items
    checkboxItem: /^-\s*\[[ x]\]\s*(?:REQ|SPEC)?[-_]?([A-Z0-9-]+)?:?\s*(.+)/gim,

    // Numbered requirements
    numberedReq: /^\d+\.\s*(?:REQ|Requirement)[-_]?(\d+)?:?\s*(.+)/gim
};

// ============================================================
// Spec Extraction
// ============================================================

/**
 * Extracts spec references from code files.
 *
 * @param uri - File URI
 * @param content - File content
 * @returns Array of spec references found
 */
function extractSpecsFromCode(
    uri: FileURI,
    content: string
): readonly SpecReference[] {
    const refs: SpecReference[] = [];

    // Search each pattern
    for (const [patternName, pattern] of Object.entries(CODE_PATTERNS)) {
        let match;
        pattern.lastIndex = 0; // Reset regex state

        while ((match = pattern.exec(content)) !== null) {
            const matchIndex = match.index;
            const lineNumber = content.substring(0, matchIndex).split('\n').length;

            // Parse the spec ID(s) from the match
            const matchedText = match[1] ?? '';
            const specIds = parseSpecIds(matchedText);

            for (const id of specIds) {
                refs.push({
                    id,
                    source: uri,
                    line: lineNumber,
                    description: null,
                    type: categorizeSpecType(patternName)
                });
            }
        }
    }

    return refs;
}

/**
 * Extracts spec definitions from markdown files.
 *
 * @param uri - File URI
 * @param content - File content
 * @returns Array of spec references defined
 */
function extractSpecsFromMarkdown(
    uri: FileURI,
    content: string
): readonly SpecReference[] {
    const refs: SpecReference[] = [];

    for (const [_patternName, pattern] of Object.entries(MARKDOWN_PATTERNS)) {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(content)) !== null) {
            const matchIndex = match.index;
            const lineNumber = content.substring(0, matchIndex).split('\n').length;

            const id = match[1] ?? generateAutoId(match[2], lineNumber);
            const description = match[2] ?? null;

            refs.push({
                id,
                source: uri,
                line: lineNumber,
                description,
                type: 'spec'
            });
        }
    }

    return refs;
}

/**
 * Parses spec IDs from a string (may contain multiple comma-separated IDs).
 */
function parseSpecIds(input: string): readonly string[] {
    return input
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * Categorizes the type of spec reference based on pattern name.
 */
function categorizeSpecType(
    patternName: string
): 'requirement' | 'spec' | 'ticket' | 'doc' {
    if (patternName.includes('req') || patternName.includes('Req')) {
        return 'requirement';
    }
    if (patternName.includes('ticket') || patternName.includes('todo') || patternName.includes('fixme')) {
        return 'ticket';
    }
    if (patternName.includes('spec') || patternName.includes('Spec')) {
        return 'spec';
    }
    return 'doc';
}

/**
 * Generates an auto ID for specs without explicit IDs.
 */
function generateAutoId(description: string | undefined, line: number): string {
    if (!description) {
        return `AUTO-${line}`;
    }

    // Generate from first few words
    const words = description
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .slice(0, 3)
        .join('-')
        .toUpperCase();

    return words || `AUTO-${line}`;
}

// ============================================================
// Cross-Reference Analysis
// ============================================================

/**
 * Analyzes cross-references between code and specs.
 *
 * @param codeSpecs - Spec references found in code
 * @param markdownSpecs - Spec definitions found in markdown
 * @param exportedSymbols - List of exported symbol names
 * @returns Cross-reference analysis
 */
export function analyzeSpecCrossRef(
    codeSpecs: readonly SpecReference[],
    markdownSpecs: readonly SpecReference[],
    exportedSymbols: readonly string[]
): SpecCrossRef {
    // Create sets for lookup
    const codeSpecIds = new Set(codeSpecs.map(s => s.id));
    const markdownSpecIds = new Set(markdownSpecs.map(s => s.id));

    // Find implemented specs (in code)
    const implementedSpecs = codeSpecs.filter(spec =>
        markdownSpecIds.has(spec.id) || spec.type === 'ticket'
    );

    // Find unimplemented specs (in markdown but not in code)
    const unimplementedSpecs = markdownSpecs.filter(spec =>
        !codeSpecIds.has(spec.id)
    );

    // Find undocumented symbols (exported but not mentioned in specs)
    const symbolsInSpecs = new Set<string>();
    for (const spec of [...codeSpecs, ...markdownSpecs]) {
        if (spec.description) {
            // Check if any symbol name appears in the description
            for (const symbol of exportedSymbols) {
                if (spec.description.includes(symbol)) {
                    symbolsInSpecs.add(symbol);
                }
            }
        }
    }

    const undocumentedSymbols = exportedSymbols.filter(s => !symbolsInSpecs.has(s));

    return {
        implementedSpecs,
        unimplementedSpecs,
        undocumentedSymbols
    };
}

// ============================================================
// Gap Detection
// ============================================================

/**
 * Detects traceability gaps from cross-reference data.
 *
 * @param crossRef - Cross-reference analysis
 * @returns Array of traceability gaps
 */
export function detectGaps(crossRef: SpecCrossRef): readonly TraceabilityGap[] {
    const gaps: TraceabilityGap[] = [];

    // Gaps for unimplemented specs
    for (const spec of crossRef.unimplementedSpecs) {
        gaps.push({
            type: 'spec-not-implemented',
            description: `Spec ${spec.id} is documented but not referenced in code`,
            source: spec.source,
            line: spec.line,
            severity: 'warning'
        });
    }

    // Gaps for undocumented symbols
    for (const symbol of crossRef.undocumentedSymbols) {
        gaps.push({
            type: 'symbol-not-documented',
            description: `Symbol '${symbol}' is exported but not mentioned in any spec`,
            source: '' as FileURI, // Unknown source
            line: null,
            severity: 'info'
        });
    }

    return gaps;
}

// ============================================================
// Main Analysis Function
// ============================================================

/**
 * Generates a complete traceability report for a workspace.
 *
 * @param workspaceUri - Workspace URI
 * @param codeFiles - URIs of code files to analyze
 * @param specFiles - URIs of spec/doc files to analyze
 * @param exportedSymbols - List of exported symbol names
 * @returns Complete traceability report
 */
export async function generateTraceabilityReport(
    workspaceUri: FileURI,
    codeFiles: readonly vscode.Uri[],
    specFiles: readonly vscode.Uri[],
    exportedSymbols: readonly string[]
): AsyncResult<TraceabilityReport, Error> {
    try {
        // Extract specs from code files
        const codeSpecs: SpecReference[] = [];
        for (const uri of codeFiles) {
            const doc = await vscode.workspace.openTextDocument(uri);
            const specs = extractSpecsFromCode(uri.toString() as FileURI, doc.getText());
            codeSpecs.push(...specs);
        }

        // Extract specs from markdown files
        const markdownSpecs: SpecReference[] = [];
        for (const uri of specFiles) {
            const doc = await vscode.workspace.openTextDocument(uri);
            const specs = extractSpecsFromMarkdown(uri.toString() as FileURI, doc.getText());
            markdownSpecs.push(...specs);
        }

        // Analyze cross-references
        const crossRef = analyzeSpecCrossRef(codeSpecs, markdownSpecs, exportedSymbols);

        // Detect gaps
        const gaps = detectGaps(crossRef);

        // Calculate coverage
        const totalSpecs = markdownSpecs.length;
        const implementedCount = crossRef.implementedSpecs.length;
        const coveragePercent = totalSpecs > 0
            ? (implementedCount / totalSpecs) * 100
            : 100;

        return {
            ok: true,
            value: {
                workspaceUri,
                generatedAt: new Date().toISOString(),
                crossRef,
                gaps,
                coveragePercent
            }
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: new Error(`Traceability analysis failed: ${message}`) };
    }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Finds spec files in a workspace.
 *
 * @param workspaceFolder - The workspace folder
 * @returns URIs of spec files
 */
export async function findSpecFiles(
    workspaceFolder: vscode.WorkspaceFolder
): Promise<readonly vscode.Uri[]> {
    const patterns = [
        '**/*.md',
        '**/SPEC*',
        '**/REQUIREMENTS*',
        '**/docs/**/*.md'
    ];

    const files: vscode.Uri[] = [];
    for (const pattern of patterns) {
        const found = await vscode.workspace.findFiles(
            new vscode.RelativePattern(workspaceFolder, pattern),
            '**/node_modules/**'
        );
        files.push(...found);
    }

    // Deduplicate
    return [...new Set(files.map(f => f.toString()))].map(s => vscode.Uri.parse(s));
}
