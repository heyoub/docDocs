/**
 * @fileoverview Code complexity analysis heuristics.
 * Deterministic metrics for identifying code that needs documentation.
 *
 * @module mcp/heuristics/complexity
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Types
// ============================================================

export interface ComplexityMetrics {
  path: string;
  overall: number;           // 0-10 complexity score
  cyclomatic: number;        // McCabe cyclomatic complexity
  cognitive: number;         // Cognitive complexity (nesting-aware)
  halstead: HalsteadMetrics; // Halstead complexity measures
  maintainability: number;   // Maintainability index (0-100, higher is better)
  details: {
    lineCount: number;
    codeLines: number;       // Non-blank, non-comment lines
    commentLines: number;
    functionCount: number;
    maxNesting: number;
    avgFunctionLength: number;
    parameterCount: number;  // Total parameters across functions
  };
}

export interface HalsteadMetrics {
  operators: number;
  operands: number;
  uniqueOperators: number;
  uniqueOperands: number;
  vocabulary: number;
  length: number;
  difficulty: number;
  effort: number;
}

export interface FunctionComplexity {
  name: string;
  line: number;
  cyclomatic: number;
  cognitive: number;
  parameters: number;
  lineCount: number;
}

// ============================================================
// Pattern Definitions
// ============================================================

const DECISION_PATTERNS = [
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,
  /\bwhile\s*\(/g,
  /\bfor\s*\(/g,
  /\bswitch\s*\(/g,
  /\bcase\s+[^:]+:/g,
  /\bcatch\s*\(/g,
  /\?\s*[^:]+\s*:/g,  // Ternary
];

const LOGICAL_OPERATORS = [
  /&&/g,
  /\|\|/g,
  /\?\?/g,  // Nullish coalescing
];

const FUNCTION_PATTERNS: Record<string, RegExp> = {
  typescript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>|(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{)/g,
  javascript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>|(\w+)\s*\([^)]*\)\s*\{)/g,
  python: /def\s+(\w+)\s*\(/g,
  rust: /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g,
  go: /func\s+(?:\([^)]+\)\s+)?(\w+)/g,
};

const COMMENT_PATTERNS: Record<string, RegExp[]> = {
  typescript: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
  javascript: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
  python: [/#.*$/gm, /'''[\s\S]*?'''/g, /"""[\s\S]*?"""/g],
  rust: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
  go: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g],
};

const OPERATORS = [
  '+', '-', '*', '/', '%', '**',
  '=', '+=', '-=', '*=', '/=',
  '==', '===', '!=', '!==', '<', '>', '<=', '>=',
  '&&', '||', '!', '??',
  '&', '|', '^', '~', '<<', '>>',
  '.', '?.', '?.[', '?.(',
  '++', '--',
  'new', 'delete', 'typeof', 'instanceof',
  'return', 'throw', 'await', 'yield',
];

// ============================================================
// Helper Functions
// ============================================================

function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
  };
  return langMap[ext] ?? 'typescript';
}

function stripComments(content: string, language: string): string {
  const patterns = COMMENT_PATTERNS[language] ?? COMMENT_PATTERNS['typescript'];
  if (!patterns) return content;
  let stripped = content;
  for (const pattern of patterns) {
    stripped = stripped.replace(pattern, '');
  }
  return stripped;
}

function countCommentLines(content: string, language: string): number {
  const patterns = COMMENT_PATTERNS[language] ?? COMMENT_PATTERNS['typescript'];
  if (!patterns) return 0;
  let count = 0;
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        count += match.split('\n').length;
      }
    }
  }
  return count;
}

// ============================================================
// Cyclomatic Complexity
// ============================================================

function calculateCyclomaticComplexity(content: string): number {
  const stripped = stripComments(content, 'typescript');
  let complexity = 1; // Base complexity

  for (const pattern of DECISION_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = stripped.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  for (const pattern of LOGICAL_OPERATORS) {
    pattern.lastIndex = 0;
    const matches = stripped.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

// ============================================================
// Cognitive Complexity
// ============================================================

function calculateCognitiveComplexity(content: string): number {
  const lines = content.split('\n');
  let complexity = 0;
  let nestingLevel = 0;

  const nestingIncrement = [
    /\bif\s*\(/,
    /\belse\s*\{/,
    /\bfor\s*\(/,
    /\bwhile\s*\(/,
    /\bswitch\s*\(/,
    /\btry\s*\{/,
    /\bcatch\s*\(/,
    /=>\s*\{/,
    /function.*\{/,
  ];

  const simpleIncrement = [
    /\bbreak\s/,
    /\bcontinue\s/,
    /\?.*:/,  // Ternary
    /&&/,
    /\|\|/,
  ];

  for (const line of lines) {
    // Check for nesting structures
    for (const pattern of nestingIncrement) {
      if (pattern.test(line)) {
        complexity += 1 + nestingLevel;
        if (line.includes('{')) {
          nestingLevel++;
        }
      }
    }

    // Check for simple increments
    for (const pattern of simpleIncrement) {
      const matches = line.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    // Track nesting via braces (simplified)
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    nestingLevel = Math.max(0, nestingLevel + opens - closes);
  }

  return complexity;
}

// ============================================================
// Halstead Metrics
// ============================================================

function calculateHalsteadMetrics(content: string): HalsteadMetrics {
  const stripped = stripComments(content, 'typescript');

  // Extract operators and operands
  const operatorSet = new Set<string>();
  const operandSet = new Set<string>();
  let totalOperators = 0;
  let totalOperands = 0;

  // Count operators
  for (const op of OPERATORS) {
    const escaped = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'g');
    const matches = stripped.match(pattern);
    if (matches) {
      totalOperators += matches.length;
      operatorSet.add(op);
    }
  }

  // Count operands (identifiers and literals)
  const identifierPattern = /\b[a-zA-Z_]\w*\b/g;
  const numberPattern = /\b\d+(?:\.\d+)?\b/g;
  const stringPattern = /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g;

  const identifiers = stripped.match(identifierPattern) || [];
  const numbers = stripped.match(numberPattern) || [];
  const strings = stripped.match(stringPattern) || [];

  for (const id of identifiers) {
    if (!OPERATORS.includes(id)) {
      totalOperands++;
      operandSet.add(id);
    }
  }
  totalOperands += numbers.length + strings.length;
  for (const n of numbers) operandSet.add(n);
  for (const s of strings) operandSet.add(s);

  const n1 = operatorSet.size;
  const n2 = operandSet.size;
  const N1 = totalOperators;
  const N2 = totalOperands;

  const vocabulary = n1 + n2;
  const length = N1 + N2;
  const difficulty = n2 > 0 ? (n1 / 2) * (N2 / n2) : 0;
  const effort = vocabulary > 0 ? length * Math.log2(vocabulary) * difficulty : 0;

  return {
    operators: N1,
    operands: N2,
    uniqueOperators: n1,
    uniqueOperands: n2,
    vocabulary,
    length,
    difficulty,
    effort,
  };
}

// ============================================================
// Function Analysis
// ============================================================

function analyzeFunctions(content: string, language: string): FunctionComplexity[] {
  const pattern = FUNCTION_PATTERNS[language];
  if (!pattern) return [];

  const functions: FunctionComplexity[] = [];
  const lines = content.split('\n');

  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const name = match[1] || match[2] || match[3] || 'anonymous';
    const startPos = match.index;
    const startLine = content.slice(0, startPos).split('\n').length;

    // Find function body (simplified - count braces)
    let braceCount = 0;
    let started = false;
    let endLine = startLine;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
          if (started && braceCount === 0) {
            endLine = i + 1;
            break;
          }
        }
      }
      if (started && braceCount === 0) break;
    }

    const functionBody = lines.slice(startLine - 1, endLine).join('\n');
    const cyclomatic = calculateCyclomaticComplexity(functionBody);
    const cognitive = calculateCognitiveComplexity(functionBody);

    // Count parameters
    const paramMatch = functionBody.match(/\(([^)]*)\)/);
    const params = paramMatch?.[1]?.split(',').filter(p => p.trim()).length ?? 0;

    functions.push({
      name,
      line: startLine,
      cyclomatic,
      cognitive,
      parameters: params,
      lineCount: endLine - startLine + 1,
    });
  }

  return functions;
}

// ============================================================
// Maintainability Index
// ============================================================

function calculateMaintainabilityIndex(
  halstead: HalsteadMetrics,
  cyclomatic: number,
  lineCount: number
): number {
  // Microsoft's Maintainability Index formula
  // MI = 171 - 5.2 * ln(V) - 0.23 * G - 16.2 * ln(LOC)
  // Normalized to 0-100

  const V = halstead.effort > 0 ? Math.log(halstead.effort) : 0;
  const G = cyclomatic;
  const LOC = lineCount > 0 ? Math.log(lineCount) : 0;

  const mi = 171 - 5.2 * V - 0.23 * G - 16.2 * LOC;

  // Normalize to 0-100
  return Math.max(0, Math.min(100, mi * 100 / 171));
}

// ============================================================
// Max Nesting Depth
// ============================================================

function calculateMaxNesting(content: string): number {
  let maxNesting = 0;
  let currentNesting = 0;

  for (const char of content) {
    if (char === '{' || char === '(' || char === '[') {
      currentNesting++;
      maxNesting = Math.max(maxNesting, currentNesting);
    } else if (char === '}' || char === ')' || char === ']') {
      currentNesting = Math.max(0, currentNesting - 1);
    }
  }

  return maxNesting;
}

// ============================================================
// Main Analysis Function
// ============================================================

export async function analyzeComplexity(filePath: string): Promise<ComplexityMetrics> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const language = getLanguage(filePath);
  const stripped = stripComments(content, language);

  const lines = content.split('\n');
  const codeLines = stripped.split('\n').filter(l => l.trim()).length;
  const commentLines = countCommentLines(content, language);

  const cyclomatic = calculateCyclomaticComplexity(content);
  const cognitive = calculateCognitiveComplexity(content);
  const halstead = calculateHalsteadMetrics(content);
  const functions = analyzeFunctions(content, language);
  const maxNesting = calculateMaxNesting(stripped);

  const avgFunctionLength = functions.length > 0
    ? functions.reduce((sum, f) => sum + f.lineCount, 0) / functions.length
    : 0;

  const totalParams = functions.reduce((sum, f) => sum + f.parameters, 0);

  const maintainability = calculateMaintainabilityIndex(halstead, cyclomatic, codeLines);

  // Calculate overall complexity score (0-10)
  let overall = 0;

  // Cyclomatic complexity contribution (max 3 points)
  if (cyclomatic > 50) overall += 3;
  else if (cyclomatic > 20) overall += 2;
  else if (cyclomatic > 10) overall += 1;

  // Cognitive complexity contribution (max 3 points)
  if (cognitive > 100) overall += 3;
  else if (cognitive > 50) overall += 2;
  else if (cognitive > 20) overall += 1;

  // Maintainability (inverted, max 2 points)
  if (maintainability < 20) overall += 2;
  else if (maintainability < 40) overall += 1;

  // Nesting depth (max 1 point)
  if (maxNesting > 6) overall += 1;

  // Function complexity (max 1 point)
  const complexFunctions = functions.filter(f => f.cyclomatic > 10).length;
  if (complexFunctions > 3) overall += 1;

  return {
    path: filePath,
    overall: Math.min(10, overall),
    cyclomatic,
    cognitive,
    halstead,
    maintainability,
    details: {
      lineCount: lines.length,
      codeLines,
      commentLines,
      functionCount: functions.length,
      maxNesting,
      avgFunctionLength,
      parameterCount: totalParams,
    },
  };
}

// ============================================================
// Batch Analysis
// ============================================================

export async function analyzeComplexityBatch(
  files: string[]
): Promise<Map<string, ComplexityMetrics>> {
  const results = new Map<string, ComplexityMetrics>();

  for (const file of files) {
    try {
      const metrics = await analyzeComplexity(file);
      results.set(file, metrics);
    } catch {
      // Skip files that can't be analyzed
    }
  }

  return results;
}

export function getHighComplexityFiles(
  metrics: Map<string, ComplexityMetrics>,
  threshold: number = 5
): ComplexityMetrics[] {
  return Array.from(metrics.values())
    .filter(m => m.overall >= threshold)
    .sort((a, b) => b.overall - a.overall);
}
