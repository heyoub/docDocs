/**
 * @fileoverview Control flow matrix extraction for GenDocs.
 * Analyzes function complexity and decision trees.
 *
 * @module core/analysis/flow
 */

import * as vscode from 'vscode';
import type { AsyncResult } from '../../types/base.js';
import type {
    FunctionFlowMatrix,
    ComplexityLevel,
    FlowMatrixChange
} from '../../types/analysis.js';
// ExtractedSymbol type available for future use

// ============================================================
// Complexity Classification
// ============================================================

/**
 * Classifies complexity level based on branch count.
 */
function classifyComplexity(branches: number): ComplexityLevel {
    if (branches <= 1) return 'trivial';
    if (branches <= 3) return 'simple';
    if (branches <= 7) return 'moderate';
    if (branches <= 15) return 'complex';
    return 'galaxy-brain';
}

// ============================================================
// Flow Analysis Patterns
// ============================================================

/**
 * Patterns for detecting control flow constructs.
 */
const PATTERNS = {
    // Branching patterns
    ifStatement: /\bif\s*\(/g,
    elseIfStatement: /\belse\s+if\s*\(/g,
    elseStatement: /\belse\s*\{/g,
    switchStatement: /\bswitch\s*\(/g,
    caseStatement: /\bcase\s+/g,
    ternary: /\?.*:/g,

    // Match/pattern matching (Rust, Haskell, etc.)
    matchStatement: /\bmatch\s*\{|\bmatch\s+\w+\s*\{/g,
    matchArm: /\s=>\s/g,

    // Early returns
    returnStatement: /\breturn\b/g,
    earlyReturn: /\breturn\s+\w/g,

    // Error paths
    throwStatement: /\bthrow\s+/g,
    panicMacro: /\bpanic!\s*\(/g,
    unreachableMacro: /\bunreachable!\s*\(/g,
    errReturn: /\bErr\s*\(/g,
    raiseStatement: /\braise\s+/g,

    // Loops
    forLoop: /\bfor\s*\(/g,
    forOfLoop: /\bfor\s+\w+\s+of\b/g,
    forInLoop: /\bfor\s+\w+\s+in\b/g,
    whileLoop: /\bwhile\s*\(/g,
    doWhile: /\bdo\s*\{/g,
    loopKeyword: /\bloop\s*\{/g,

    // Async boundaries
    awaitKeyword: /\bawait\s+/g,
    asyncKeyword: /\basync\s+/g,

    // Error types (TypeScript/JavaScript)
    errorType: /\bnew\s+(\w*Error)\s*\(/g,
    customError: /\bclass\s+(\w*Error)\s+extends\s+Error/g
};

// ============================================================
// Flow Matrix Extraction
// ============================================================

/**
 * Extracts a flow matrix from a function's source code.
 *
 * @param code - The function's source code
 * @param signature - The function's signature
 * @returns FunctionFlowMatrix analysis
 */
export function extractFlowMatrix(code: string, signature: string): FunctionFlowMatrix {
    // Count branching constructs
    const ifCount = (code.match(PATTERNS.ifStatement) ?? []).length;
    const elseIfCount = (code.match(PATTERNS.elseIfStatement) ?? []).length;
    const switchCount = (code.match(PATTERNS.switchStatement) ?? []).length;
    const caseCount = (code.match(PATTERNS.caseStatement) ?? []).length;
    const ternaryCount = (code.match(PATTERNS.ternary) ?? []).length;
    const matchCount = (code.match(PATTERNS.matchStatement) ?? []).length;
    const matchArmCount = (code.match(PATTERNS.matchArm) ?? []).length;

    // Total branches
    const branches = ifCount + elseIfCount + switchCount + ternaryCount + matchCount +
                     Math.max(0, caseCount - switchCount) + // cases minus switch statements
                     Math.max(0, matchArmCount - matchCount); // match arms minus match statements

    // Count early returns
    const returnCount = (code.match(PATTERNS.returnStatement) ?? []).length;
    // Early returns are returns before the last return (approximate by checking for multiple returns)
    const earlyReturns = Math.max(0, returnCount - 1);

    // Count error paths
    const throwCount = (code.match(PATTERNS.throwStatement) ?? []).length;
    const panicCount = (code.match(PATTERNS.panicMacro) ?? []).length;
    const errCount = (code.match(PATTERNS.errReturn) ?? []).length;
    const raiseCount = (code.match(PATTERNS.raiseStatement) ?? []).length;
    const errorPaths = throwCount + panicCount + errCount + raiseCount;

    // Count loops
    const forCount = (code.match(PATTERNS.forLoop) ?? []).length;
    const forOfCount = (code.match(PATTERNS.forOfLoop) ?? []).length;
    const forInCount = (code.match(PATTERNS.forInLoop) ?? []).length;
    const whileCount = (code.match(PATTERNS.whileLoop) ?? []).length;
    const doWhileCount = (code.match(PATTERNS.doWhile) ?? []).length;
    const loopCount = (code.match(PATTERNS.loopKeyword) ?? []).length;
    const loops = forCount + forOfCount + forInCount + whileCount + doWhileCount + loopCount;

    // Count async boundaries
    const awaitCount = (code.match(PATTERNS.awaitKeyword) ?? []).length;
    const asyncBoundaries = awaitCount;

    // Extract error types
    const errorTypes = extractErrorTypes(code);

    // Extract conditionals descriptions (simplified)
    const conditionals = extractConditionalDescriptions(code);

    // Generate happy path description
    const happyPath = generateHappyPath(signature, errorPaths, earlyReturns);

    // Classify complexity
    const complexity = classifyComplexity(branches);

    return {
        branches,
        earlyReturns,
        errorPaths,
        happyPath,
        complexity,
        conditionals,
        loops,
        asyncBoundaries,
        errorTypes
    };
}

/**
 * Extracts error type names from code.
 */
function extractErrorTypes(code: string): readonly string[] {
    const errorTypes = new Set<string>();

    // Match "new XxxError(" patterns
    const newErrorMatches = code.matchAll(/\bnew\s+(\w*Error)\s*\(/g);
    for (const match of newErrorMatches) {
        if (match[1]) errorTypes.add(match[1]);
    }

    // Match "throw new XxxException" patterns
    const exceptionMatches = code.matchAll(/\bnew\s+(\w*Exception)\s*\(/g);
    for (const match of exceptionMatches) {
        if (match[1]) errorTypes.add(match[1]);
    }

    // Match Rust Result::Err patterns
    const errMatches = code.matchAll(/Err\s*\(\s*(\w+)/g);
    for (const match of errMatches) {
        if (match[1]) errorTypes.add(match[1]);
    }

    return Array.from(errorTypes);
}

/**
 * Extracts simplified conditional descriptions.
 */
function extractConditionalDescriptions(code: string): readonly string[] {
    const descriptions: string[] = [];

    // Extract if conditions (simplified)
    const ifMatches = code.matchAll(/\bif\s*\(([^)]+)\)/g);
    for (const match of ifMatches) {
        const condition = match[1];
        if (!condition) continue;
        const trimmed = condition.trim();
        // Simplify to first 50 chars
        const simplified = trimmed.length > 50
            ? trimmed.substring(0, 47) + '...'
            : trimmed;
        descriptions.push(`if: ${simplified}`);
    }

    // Limit to first 5 conditionals
    return descriptions.slice(0, 5);
}

/**
 * Generates a description of the happy path.
 * Parses signature to provide more context about the function's purpose.
 */
function generateHappyPath(
    signature: string,
    errorPaths: number,
    earlyReturns: number
): string {
    // Extract return type from signature for better description
    const returnTypeMatch = signature.match(/\):\s*(.+)$/);
    const returnType = returnTypeMatch?.[1]?.trim();

    // Extract function name from signature
    const nameMatch = signature.match(/(?:function\s+)?(\w+)\s*[<(]/);
    const funcName = nameMatch?.[1];

    if (errorPaths === 0 && earlyReturns === 0) {
        if (returnType) {
            return `Linear execution returning ${returnType}`;
        }
        return 'Linear execution path with no branching';
    }

    const parts: string[] = [];

    if (errorPaths > 0) {
        parts.push(`handles ${errorPaths} error case${errorPaths > 1 ? 's' : ''}`);
    }

    if (earlyReturns > 0) {
        parts.push(`${earlyReturns} early exit${earlyReturns > 1 ? 's' : ''}`);
    }

    let description = `Success path after ${parts.join(' and ')}`;

    // Add return type info if available
    if (returnType && funcName) {
        description += ` → returns ${returnType}`;
    }

    return description;
}

// ============================================================
// Flow Matrix Comparison
// ============================================================

/**
 * Compares two flow matrices and determines the change.
 *
 * @param before - Flow matrix before change (null if symbol is new)
 * @param after - Flow matrix after change (null if symbol is removed)
 * @returns FlowMatrixChange analysis
 */
export function compareFlowMatrices(
    before: FunctionFlowMatrix | null,
    after: FunctionFlowMatrix | null
): FlowMatrixChange {
    const branchDelta = (after?.branches ?? 0) - (before?.branches ?? 0);
    const errorPathDelta = (after?.errorPaths ?? 0) - (before?.errorPaths ?? 0);

    const complexityChange = {
        from: before?.complexity ?? null,
        to: after?.complexity ?? null
    };

    // Find new error types
    const beforeErrors = new Set(before?.errorTypes ?? []);
    const newErrorTypes = (after?.errorTypes ?? []).filter(e => !beforeErrors.has(e));

    // Breaking if new error types are added that consumers must handle
    const breaking = newErrorTypes.length > 0 ||
                     (complexityChange.from !== null &&
                      complexityChange.to !== null &&
                      isComplexityBreaking(complexityChange.from, complexityChange.to));

    return {
        before,
        after,
        branchDelta,
        errorPathDelta,
        complexityChange,
        newErrorTypes,
        breaking
    };
}

/**
 * Determines if a complexity increase is breaking.
 */
function isComplexityBreaking(from: ComplexityLevel, to: ComplexityLevel): boolean {
    const levels: ComplexityLevel[] = ['trivial', 'simple', 'moderate', 'complex', 'galaxy-brain'];
    const fromIndex = levels.indexOf(from);
    const toIndex = levels.indexOf(to);

    // Breaking if complexity increased by 2+ levels
    return toIndex - fromIndex >= 2;
}

// ============================================================
// Document Analysis
// ============================================================

/**
 * Extracts flow matrices for all functions in a document.
 *
 * @param uri - Document URI
 * @returns Map of symbol names to their flow matrices
 */
export async function analyzeDocumentFlow(
    uri: vscode.Uri
): AsyncResult<ReadonlyMap<string, FunctionFlowMatrix>, Error> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const text = document.getText();

        // This is a simplified implementation - in practice, you'd want to
        // use the AST from tree-sitter or the LSP to properly identify function bounds

        const flowMatrices = new Map<string, FunctionFlowMatrix>();

        // Find function-like declarations (simplified regex approach)
        const functionPattern = /(?:function|async function|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s*)?\([^)]*\)\s*=>|\([^)]*\)\s*(?::\s*[^{]+)?\s*\{)/g;

        let match;
        while ((match = functionPattern.exec(text)) !== null) {
            const name = match[1];
            if (!name) continue;
            const startIndex = match.index;

            // Find the function body (simplified - just take next 500 chars as approximation)
            const endIndex = Math.min(startIndex + 500, text.length);
            const body = text.substring(startIndex, endIndex);

            const matrix = extractFlowMatrix(body, match[0]);
            flowMatrices.set(name, matrix);
        }

        return { ok: true, value: flowMatrices };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: new Error(`Failed to analyze flow: ${message}`) };
    }
}
