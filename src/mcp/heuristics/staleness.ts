/**
 * @fileoverview Smart staleness detection using AST diffing and semantic analysis.
 * Determines if documentation needs updating based on code changes.
 *
 * @module mcp/heuristics/staleness
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

// ============================================================
// Types
// ============================================================

export interface StalenessReport {
  path: string;
  status: 'fresh' | 'stale' | 'very-stale' | 'orphaned' | 'undocumented';
  score: number;            // 0-10 staleness score (higher = more stale)
  reasons: StalenessReason[];
  lastDocUpdate?: Date;
  lastCodeChange?: Date;
  changesSinceDoc: number;  // Number of commits since last doc update
  semanticChanges: SemanticChange[];
}

export interface StalenessReason {
  type: 'signature-change' | 'new-export' | 'removed-export' | 'logic-change' |
        'dependency-change' | 'time-decay' | 'high-churn' | 'breaking-change';
  description: string;
  severity: 'low' | 'medium' | 'high';
  line?: number;
}

export interface SemanticChange {
  type: 'function' | 'class' | 'interface' | 'type' | 'export' | 'import';
  name: string;
  change: 'added' | 'removed' | 'modified' | 'signature-changed';
  details?: string;
}

export interface SignatureInfo {
  functions: Map<string, string>;  // name -> signature hash
  classes: Map<string, string>;
  interfaces: Map<string, string>;
  types: Map<string, string>;
  exports: Set<string>;
  imports: Set<string>;
}

// ============================================================
// Signature Extraction
// ============================================================

function extractSignatures(content: string): SignatureInfo {
  const info: SignatureInfo = {
    functions: new Map(),
    classes: new Map(),
    interfaces: new Map(),
    types: new Map(),
    exports: new Set(),
    imports: new Set(),
  };

  // Extract function signatures
  const funcPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{;]+))?/g;
  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    const name = match[1]!;
    const generics = match[2] || '';
    const params = match[3] || '';
    const returnType = match[4]?.trim() || 'void';
    const signature = `${generics}(${normalizeParams(params)}): ${returnType}`;
    info.functions.set(name, hashSignature(signature));
  }

  // Extract arrow function signatures
  const arrowPattern = /(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>/g;
  while ((match = arrowPattern.exec(content)) !== null) {
    const name = match[1]!;
    const params = match[2] || '';
    const returnType = match[3]?.trim() || 'void';
    const signature = `(${normalizeParams(params)}): ${returnType}`;
    info.functions.set(name, hashSignature(signature));
  }

  // Extract class signatures
  const classPattern = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g;
  while ((match = classPattern.exec(content)) !== null) {
    const name = match[1]!;
    const ext = match[2] || '';
    const impl = match[3]?.trim() || '';
    const signature = `${ext ? `extends ${ext}` : ''} ${impl ? `implements ${impl}` : ''}`.trim();
    info.classes.set(name, hashSignature(signature));
  }

  // Extract interface signatures
  const interfacePattern = /(?:export\s+)?interface\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+([^{]+))?\s*\{([^}]*)\}/g;
  while ((match = interfacePattern.exec(content)) !== null) {
    const name = match[1]!;
    const ext = match[2]?.trim() || '';
    const body = normalizeInterfaceBody(match[3] || '');
    const signature = `${ext ? `extends ${ext}` : ''} {${body}}`;
    info.interfaces.set(name, hashSignature(signature));
  }

  // Extract type aliases
  const typePattern = /(?:export\s+)?type\s+(\w+)(?:<[^>]*>)?\s*=\s*([^;]+);/g;
  while ((match = typePattern.exec(content)) !== null) {
    const name = match[1]!;
    const definition = match[2]?.trim() || '';
    info.types.set(name, hashSignature(definition));
  }

  // Extract exports
  const exportPattern = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;
  while ((match = exportPattern.exec(content)) !== null) {
    info.exports.add(match[1]!);
  }

  const namedExportPattern = /export\s+\{\s*([^}]+)\s*\}/g;
  while ((match = namedExportPattern.exec(content)) !== null) {
    const names = match[1]!.split(',').map(n => n.trim().split(/\s+as\s+/)[0]!.trim());
    for (const name of names) {
      if (name) info.exports.add(name);
    }
  }

  // Extract imports
  const importPattern = /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = importPattern.exec(content)) !== null) {
    const module = match[3]!;
    info.imports.add(module);
  }

  return info;
}

function normalizeParams(params: string): string {
  return params
    .split(',')
    .map(p => {
      const [name, type] = p.split(':').map(s => s.trim());
      return type ? `${name}: ${type}` : name;
    })
    .filter(p => p)
    .join(', ');
}

function normalizeInterfaceBody(body: string): string {
  return body
    .split(/[;\n]/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
    .sort()
    .join('; ');
}

function hashSignature(signature: string): string {
  return crypto.createHash('md5').update(signature).digest('hex').slice(0, 8);
}

// ============================================================
// Semantic Diff
// ============================================================

function computeSemanticDiff(
  oldSig: SignatureInfo,
  newSig: SignatureInfo
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  // Check functions
  for (const [name, hash] of newSig.functions) {
    const oldHash = oldSig.functions.get(name);
    if (!oldHash) {
      changes.push({ type: 'function', name, change: 'added' });
    } else if (oldHash !== hash) {
      changes.push({ type: 'function', name, change: 'signature-changed' });
    }
  }
  for (const name of oldSig.functions.keys()) {
    if (!newSig.functions.has(name)) {
      changes.push({ type: 'function', name, change: 'removed' });
    }
  }

  // Check classes
  for (const [name, hash] of newSig.classes) {
    const oldHash = oldSig.classes.get(name);
    if (!oldHash) {
      changes.push({ type: 'class', name, change: 'added' });
    } else if (oldHash !== hash) {
      changes.push({ type: 'class', name, change: 'modified' });
    }
  }
  for (const name of oldSig.classes.keys()) {
    if (!newSig.classes.has(name)) {
      changes.push({ type: 'class', name, change: 'removed' });
    }
  }

  // Check interfaces
  for (const [name, hash] of newSig.interfaces) {
    const oldHash = oldSig.interfaces.get(name);
    if (!oldHash) {
      changes.push({ type: 'interface', name, change: 'added' });
    } else if (oldHash !== hash) {
      changes.push({ type: 'interface', name, change: 'modified' });
    }
  }
  for (const name of oldSig.interfaces.keys()) {
    if (!newSig.interfaces.has(name)) {
      changes.push({ type: 'interface', name, change: 'removed' });
    }
  }

  // Check types
  for (const [name, hash] of newSig.types) {
    const oldHash = oldSig.types.get(name);
    if (!oldHash) {
      changes.push({ type: 'type', name, change: 'added' });
    } else if (oldHash !== hash) {
      changes.push({ type: 'type', name, change: 'modified' });
    }
  }
  for (const name of oldSig.types.keys()) {
    if (!newSig.types.has(name)) {
      changes.push({ type: 'type', name, change: 'removed' });
    }
  }

  // Check exports
  for (const name of newSig.exports) {
    if (!oldSig.exports.has(name)) {
      changes.push({ type: 'export', name, change: 'added' });
    }
  }
  for (const name of oldSig.exports) {
    if (!newSig.exports.has(name)) {
      changes.push({ type: 'export', name, change: 'removed' });
    }
  }

  return changes;
}

// ============================================================
// Git Integration
// ============================================================

function getGitInfo(filePath: string, projectRoot: string): {
  lastModified?: Date;
  commitsSince?: number;
  authors: string[];
} {
  try {
    const relativePath = path.relative(projectRoot, filePath);

    // Get last modification date
    const logOutput = execSync(
      `git log -1 --format="%aI" -- "${relativePath}"`,
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    const lastModified = logOutput ? new Date(logOutput) : undefined;

    // Get commit count in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0];

    const commitCount = execSync(
      `git rev-list --count --since="${sinceDate}" HEAD -- "${relativePath}"`,
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    // Get unique authors
    const authorsOutput = execSync(
      `git log --format="%an" -- "${relativePath}" | sort -u | head -5`,
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    return {
      lastModified,
      commitsSince: parseInt(commitCount, 10) || 0,
      authors: authorsOutput.split('\n').filter(a => a),
    };
  } catch {
    return { authors: [] };
  }
}

function getFileContentAtCommit(
  filePath: string,
  projectRoot: string,
  commit: string
): string | null {
  try {
    const relativePath = path.relative(projectRoot, filePath);
    return execSync(
      `git show ${commit}:"${relativePath}"`,
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch {
    return null;
  }
}

// ============================================================
// Main Analysis
// ============================================================

export async function analyzeStaleness(
  filePath: string,
  projectRoot: string,
  lastDocUpdate?: Date,
  previousContent?: string
): Promise<StalenessReport> {
  const reasons: StalenessReason[] = [];
  let score = 0;

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return {
      path: filePath,
      status: 'orphaned',
      score: 10,
      reasons: [{ type: 'removed-export', description: 'File no longer exists', severity: 'high' }],
      changesSinceDoc: 0,
      semanticChanges: [],
    };
  }

  const currentContent = fs.readFileSync(filePath, 'utf-8');
  const gitInfo = getGitInfo(filePath, projectRoot);

  // If no previous content, try to get from git
  let oldContent = previousContent;
  if (!oldContent && lastDocUpdate) {
    // Find commit closest to doc update date
    try {
      const commitHash = execSync(
        `git rev-list -1 --before="${lastDocUpdate.toISOString()}" HEAD`,
        { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();

      if (commitHash) {
        oldContent = getFileContentAtCommit(filePath, projectRoot, commitHash) ?? undefined;
      }
    } catch {
      // Git not available or file not tracked
    }
  }

  // Analyze semantic changes
  let semanticChanges: SemanticChange[] = [];
  if (oldContent) {
    const oldSig = extractSignatures(oldContent);
    const newSig = extractSignatures(currentContent);
    semanticChanges = computeSemanticDiff(oldSig, newSig);

    // Score based on changes
    for (const change of semanticChanges) {
      if (change.change === 'removed') {
        reasons.push({
          type: 'removed-export',
          description: `${change.type} '${change.name}' was removed`,
          severity: 'high',
        });
        score += 2;
      } else if (change.change === 'signature-changed') {
        reasons.push({
          type: 'signature-change',
          description: `${change.type} '${change.name}' signature changed`,
          severity: 'high',
        });
        score += 2;
      } else if (change.change === 'added') {
        reasons.push({
          type: 'new-export',
          description: `New ${change.type} '${change.name}' added`,
          severity: 'medium',
        });
        score += 1;
      } else if (change.change === 'modified') {
        reasons.push({
          type: 'logic-change',
          description: `${change.type} '${change.name}' was modified`,
          severity: 'medium',
        });
        score += 1;
      }
    }
  }

  // Time decay factor
  if (lastDocUpdate && gitInfo.lastModified) {
    const daysSinceDoc = Math.floor(
      (Date.now() - lastDocUpdate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysSinceCode = Math.floor(
      (Date.now() - gitInfo.lastModified.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceCode < daysSinceDoc && daysSinceDoc > 30) {
      reasons.push({
        type: 'time-decay',
        description: `Documentation is ${daysSinceDoc} days old, code changed ${daysSinceCode} days ago`,
        severity: daysSinceDoc > 90 ? 'high' : 'medium',
      });
      score += daysSinceDoc > 90 ? 2 : 1;
    }
  }

  // High churn detection
  if (gitInfo.commitsSince && gitInfo.commitsSince > 10) {
    reasons.push({
      type: 'high-churn',
      description: `${gitInfo.commitsSince} commits in last 30 days`,
      severity: gitInfo.commitsSince > 20 ? 'high' : 'medium',
    });
    score += gitInfo.commitsSince > 20 ? 2 : 1;
  }

  // Determine status
  let status: StalenessReport['status'];
  if (!lastDocUpdate) {
    status = 'undocumented';
    score = 8;
  } else if (score >= 6) {
    status = 'very-stale';
  } else if (score >= 3) {
    status = 'stale';
  } else {
    status = 'fresh';
  }

  return {
    path: filePath,
    status,
    score: Math.min(10, score),
    reasons,
    lastDocUpdate,
    lastCodeChange: gitInfo.lastModified,
    changesSinceDoc: gitInfo.commitsSince ?? 0,
    semanticChanges,
  };
}

// ============================================================
// Batch Analysis
// ============================================================

export async function analyzeStalenessReport(
  projectRoot: string,
  files: string[],
  docIndex: Map<string, Date>
): Promise<Map<string, StalenessReport>> {
  const results = new Map<string, StalenessReport>();

  for (const file of files) {
    const absolutePath = path.resolve(projectRoot, file);
    const lastDocUpdate = docIndex.get(absolutePath);

    try {
      const report = await analyzeStaleness(absolutePath, projectRoot, lastDocUpdate);
      results.set(absolutePath, report);
    } catch {
      // Skip files that can't be analyzed
    }
  }

  return results;
}

export function getStaleFiles(
  reports: Map<string, StalenessReport>,
  minScore: number = 3
): StalenessReport[] {
  return Array.from(reports.values())
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
