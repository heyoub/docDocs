/**
 * @fileoverview File importance scoring based on dependency analysis.
 * Deterministic heuristics for identifying high-value documentation targets.
 *
 * @module mcp/heuristics/importance
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Types
// ============================================================

export interface FileImportance {
  path: string;
  score: number;           // 0-10 importance score
  dependents: string[];    // Files that import this file
  dependencies: string[];  // Files this file imports
  metrics: {
    dependentCount: number;
    dependencyCount: number;
    isEntryPoint: boolean;
    isExported: boolean;
    hasPublicAPI: boolean;
    cyclomaticComplexity: number;
    lineCount: number;
  };
}

export interface DependencyGraph {
  files: Map<string, FileImportance>;
  entryPoints: string[];
  publicModules: string[];
}

// ============================================================
// Import Pattern Detection
// ============================================================

const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+(?:\{[^}]*\}\s+)?from\s+['"]([^'"]+)['"]/g,
  ],
  javascript: [
    /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+(?:\{[^}]*\}\s+)?from\s+['"]([^'"]+)['"]/g,
  ],
  python: [
    /from\s+([\w.]+)\s+import/g,
    /import\s+([\w.]+)/g,
  ],
  rust: [
    /use\s+([\w:]+)/g,
    /mod\s+(\w+)/g,
  ],
  go: [
    /import\s+(?:\(\s*)?["']([^"']+)["']/g,
    /import\s+\w+\s+["']([^"']+)["']/g,
  ],
};

const EXPORT_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g,
    /export\s+\{[^}]+\}/g,
    /export\s+\*/g,
  ],
  javascript: [
    /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
    /module\.exports\s*=/g,
    /exports\.\w+\s*=/g,
  ],
  python: [
    /__all__\s*=\s*\[/g,
    /def\s+(?!_)\w+/g, // Public functions (no underscore prefix)
    /class\s+(?!_)\w+/g,
  ],
  rust: [
    /pub\s+(?:fn|struct|enum|trait|mod|type|const)\s+(\w+)/g,
  ],
  go: [
    /func\s+([A-Z]\w*)/g, // Exported functions start with uppercase
    /type\s+([A-Z]\w*)/g,
  ],
};

// ============================================================
// Language Detection
// ============================================================

function getLanguage(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
  };
  return langMap[ext] ?? null;
}

// ============================================================
// Import Extraction
// ============================================================

function extractImports(content: string, language: string): string[] {
  const patterns = IMPORT_PATTERNS[language];
  if (!patterns) return [];

  const imports: string[] = [];
  for (const pattern of patterns) {
    // Reset regex state
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
  }
  return imports;
}

function hasExports(content: string, language: string): boolean {
  const patterns = EXPORT_PATTERNS[language];
  if (!patterns) return false;

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

// ============================================================
// Complexity Estimation
// ============================================================

function estimateCyclomaticComplexity(content: string): number {
  // Count decision points as a rough complexity estimate
  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bwhile\s*\(/g,
    /\bfor\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+\s*:/g, // Ternary
    /&&/g,
    /\|\|/g,
  ];

  let complexity = 1; // Base complexity
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }
  return complexity;
}

// ============================================================
// Path Resolution
// ============================================================

function resolveImportPath(
  importPath: string,
  fromFile: string,
  projectRoot: string,
  existingFiles: Set<string>
): string | null {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  let resolved: string;

  if (importPath.startsWith('.')) {
    resolved = path.resolve(fromDir, importPath);
  } else {
    resolved = path.resolve(projectRoot, importPath);
  }

  // Try common extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', ''];
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (existingFiles.has(withExt)) {
      return withExt;
    }
    // Try index file
    const indexPath = path.join(resolved, `index${ext}`);
    if (existingFiles.has(indexPath)) {
      return indexPath;
    }
  }

  return null;
}

// ============================================================
// Entry Point Detection
// ============================================================

const ENTRY_POINT_PATTERNS = [
  /^index\.[tj]sx?$/,
  /^main\.[tj]sx?$/,
  /^app\.[tj]sx?$/,
  /^server\.[tj]sx?$/,
  /^cli\.[tj]sx?$/,
  /^extension\.[tj]sx?$/,
  /^__main__\.py$/,
  /^main\.py$/,
  /^main\.rs$/,
  /^lib\.rs$/,
  /^main\.go$/,
];

function isEntryPoint(filePath: string): boolean {
  const fileName = path.basename(filePath);
  return ENTRY_POINT_PATTERNS.some(pattern => pattern.test(fileName));
}

// ============================================================
// Main Analysis Function
// ============================================================

export async function analyzeImportance(
  projectRoot: string,
  files: string[]
): Promise<DependencyGraph> {
  const graph: DependencyGraph = {
    files: new Map(),
    entryPoints: [],
    publicModules: [],
  };

  const fileSet = new Set(files.map(f => path.resolve(projectRoot, f)));

  // First pass: analyze each file
  for (const file of files) {
    const absolutePath = path.resolve(projectRoot, file);
    const language = getLanguage(file);
    if (!language) continue;

    let content: string;
    try {
      content = fs.readFileSync(absolutePath, 'utf-8');
    } catch {
      continue;
    }

    const imports = extractImports(content, language);
    const dependencies: string[] = [];

    for (const imp of imports) {
      const resolved = resolveImportPath(imp, absolutePath, projectRoot, fileSet);
      if (resolved) {
        dependencies.push(resolved);
      }
    }

    const lineCount = content.split('\n').length;
    const complexity = estimateCyclomaticComplexity(content);
    const exported = hasExports(content, language);
    const entryPoint = isEntryPoint(file);

    graph.files.set(absolutePath, {
      path: absolutePath,
      score: 0, // Calculated in second pass
      dependents: [],
      dependencies,
      metrics: {
        dependentCount: 0,
        dependencyCount: dependencies.length,
        isEntryPoint: entryPoint,
        isExported: exported,
        hasPublicAPI: exported,
        cyclomaticComplexity: complexity,
        lineCount,
      },
    });

    if (entryPoint) {
      graph.entryPoints.push(absolutePath);
    }
    if (exported) {
      graph.publicModules.push(absolutePath);
    }
  }

  // Second pass: calculate dependents
  for (const [filePath, info] of graph.files) {
    for (const dep of info.dependencies) {
      const depInfo = graph.files.get(dep);
      if (depInfo) {
        depInfo.dependents.push(filePath);
        depInfo.metrics.dependentCount++;
      }
    }
  }

  // Third pass: calculate importance scores
  for (const [, info] of graph.files) {
    info.score = calculateImportanceScore(info, graph);
  }

  return graph;
}

// ============================================================
// Importance Score Calculation
// ============================================================

function calculateImportanceScore(
  file: FileImportance,
  graph: DependencyGraph
): number {
  let score = 0;

  // Dependent count (most important factor)
  // More files depending on this = higher importance
  score += Math.min(file.metrics.dependentCount * 1.5, 4);

  // Entry points are critical
  if (file.metrics.isEntryPoint) {
    score += 2;
  }

  // Public API files matter
  if (file.metrics.hasPublicAPI) {
    score += 1;
  }

  // Bonus for files that are dependencies of entry points
  const isDirectEntryDep = graph.entryPoints.some(ep => {
    const entryFile = graph.files.get(ep);
    return entryFile?.dependencies.includes(file.path);
  });
  if (isDirectEntryDep) {
    score += 0.5;
  }

  // Complexity factor (more complex = needs more docs)
  if (file.metrics.cyclomaticComplexity > 20) {
    score += 1.5;
  } else if (file.metrics.cyclomaticComplexity > 10) {
    score += 1;
  } else if (file.metrics.cyclomaticComplexity > 5) {
    score += 0.5;
  }

  // Size factor (larger files need docs)
  if (file.metrics.lineCount > 500) {
    score += 1;
  } else if (file.metrics.lineCount > 200) {
    score += 0.5;
  }

  // Penalty for leaf nodes with no dependents
  if (file.metrics.dependentCount === 0 && !file.metrics.isEntryPoint) {
    score -= 0.5;
  }

  // Clamp to 0-10
  return Math.max(0, Math.min(10, score));
}

// ============================================================
// Utility Functions
// ============================================================

export function getHighImportanceFiles(
  graph: DependencyGraph,
  threshold: number = 5
): FileImportance[] {
  return Array.from(graph.files.values())
    .filter(f => f.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export function getUndocumentedHighPriority(
  graph: DependencyGraph,
  documentedFiles: Set<string>,
  limit: number = 10
): FileImportance[] {
  return Array.from(graph.files.values())
    .filter(f => !documentedFiles.has(f.path))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
