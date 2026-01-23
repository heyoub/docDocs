/**
 * @fileoverview MCP Tools registration.
 * @module mcp/tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

import {
  analyzeImportance,
  getHighImportanceFiles,
  getUndocumentedHighPriority,
} from '../heuristics/importance.js';
import {
  analyzeComplexity,
  analyzeComplexityBatch,
  getHighComplexityFiles,
} from '../heuristics/complexity.js';
import {
  analyzeStalenessReport,
  getStaleFiles,
} from '../heuristics/staleness.js';

// ============================================================
// Helper Functions
// ============================================================

function getProjectRoot(): string {
  return process.cwd();
}

async function findSourceFiles(projectRoot: string): Promise<string[]> {
  const patterns = [
    '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
    '**/*.py', '**/*.rs', '**/*.go',
  ];
  const ignore = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'];

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: projectRoot, ignore });
    files.push(...matches);
  }
  return [...new Set(files)];
}

function readDocIndex(projectRoot: string): Map<string, Date> {
  const indexPath = path.join(projectRoot, '.docdocs', 'index.json');
  const index = new Map<string, Date>();

  try {
    if (fs.existsSync(indexPath)) {
      const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      for (const [file, info] of Object.entries(data.files || {})) {
        const entry = info as { lastGenerated?: string };
        if (entry.lastGenerated) {
          index.set(path.resolve(projectRoot, file), new Date(entry.lastGenerated));
        }
      }
    }
  } catch {
    // Index doesn't exist or is invalid
  }

  return index;
}

// ============================================================
// Tool Registration
// ============================================================

export function registerTools(server: McpServer): void {
  // --------------------------------------------------------
  // docdocs_analyze_importance
  // --------------------------------------------------------
  server.tool(
    'docdocs_analyze_importance',
    'Analyze file importance based on dependency graph. Returns files ranked by how critical they are to the codebase (more dependents = higher importance).',
    {
      path: z.string().optional().describe('Specific file or directory to analyze. Defaults to entire project.'),
      threshold: z.number().min(0).max(10).default(3).describe('Minimum importance score (0-10) to include in results'),
      limit: z.number().min(1).max(100).default(20).describe('Maximum number of files to return'),
    },
    async ({ path: targetPath, threshold, limit }) => {
      const projectRoot = getProjectRoot();
      const files = await findSourceFiles(projectRoot);

      const graph = await analyzeImportance(projectRoot, files);
      let results = getHighImportanceFiles(graph, threshold);

      if (targetPath) {
        const absPath = path.resolve(projectRoot, targetPath);
        results = results.filter(f => f.path.startsWith(absPath));
      }

      results = results.slice(0, limit);

      const output = results.map(f => ({
        path: path.relative(projectRoot, f.path),
        score: f.score.toFixed(1),
        dependents: f.metrics.dependentCount,
        dependencies: f.metrics.dependencyCount,
        isEntryPoint: f.metrics.isEntryPoint,
        complexity: f.metrics.cyclomaticComplexity,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: {
              totalFiles: files.length,
              highImportanceFiles: results.length,
              entryPoints: graph.entryPoints.map(e => path.relative(projectRoot, e)),
            },
            files: output,
          }, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // docdocs_analyze_complexity
  // --------------------------------------------------------
  server.tool(
    'docdocs_analyze_complexity',
    'Analyze code complexity metrics for files. Identifies code that needs documentation due to high cyclomatic/cognitive complexity.',
    {
      path: z.string().optional().describe('Specific file or directory to analyze'),
      threshold: z.number().min(0).max(10).default(4).describe('Minimum complexity score (0-10) to include'),
      limit: z.number().min(1).max(100).default(20).describe('Maximum number of files to return'),
    },
    async ({ path: targetPath, threshold, limit }) => {
      const projectRoot = getProjectRoot();
      let files = await findSourceFiles(projectRoot);

      if (targetPath) {
        const absPath = path.resolve(projectRoot, targetPath);
        files = files.filter(f => path.resolve(projectRoot, f).startsWith(absPath));
      }

      const absoluteFiles = files.map(f => path.resolve(projectRoot, f));
      const metrics = await analyzeComplexityBatch(absoluteFiles);
      const complex = getHighComplexityFiles(metrics, threshold).slice(0, limit);

      const output = complex.map(m => ({
        path: path.relative(projectRoot, m.path),
        overallScore: m.overall,
        cyclomatic: m.cyclomatic,
        cognitive: m.cognitive,
        maintainability: m.maintainability.toFixed(1),
        lines: m.details.lineCount,
        functions: m.details.functionCount,
        maxNesting: m.details.maxNesting,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: {
              filesAnalyzed: files.length,
              highComplexityFiles: complex.length,
              avgComplexity: (Array.from(metrics.values()).reduce((s, m) => s + m.overall, 0) / metrics.size).toFixed(1),
            },
            files: output,
          }, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // docdocs_check_staleness
  // --------------------------------------------------------
  server.tool(
    'docdocs_check_staleness',
    'Check documentation freshness. Identifies stale docs using semantic diff (signature changes, new exports, etc.) and git history.',
    {
      path: z.string().optional().describe('Specific file or directory to check'),
      includeReasons: z.boolean().default(true).describe('Include detailed reasons for staleness'),
      limit: z.number().min(1).max(100).default(20).describe('Maximum number of stale files to return'),
    },
    async ({ path: targetPath, includeReasons, limit }) => {
      const projectRoot = getProjectRoot();
      let files = await findSourceFiles(projectRoot);

      if (targetPath) {
        const absPath = path.resolve(projectRoot, targetPath);
        files = files.filter(f => path.resolve(projectRoot, f).startsWith(absPath));
      }

      const docIndex = readDocIndex(projectRoot);
      const reports = await analyzeStalenessReport(projectRoot, files, docIndex);
      const stale = getStaleFiles(reports, 1).slice(0, limit);

      const output = stale.map(r => {
        const base: Record<string, unknown> = {
          path: path.relative(projectRoot, r.path),
          status: r.status,
          score: r.score,
          lastDocUpdate: r.lastDocUpdate?.toISOString(),
          lastCodeChange: r.lastCodeChange?.toISOString(),
          changesSinceDoc: r.changesSinceDoc,
        };

        if (includeReasons && r.reasons.length > 0) {
          base['reasons'] = r.reasons.map(reason => ({
            type: reason.type,
            description: reason.description,
            severity: reason.severity,
          }));
        }

        if (r.semanticChanges.length > 0) {
          base['semanticChanges'] = r.semanticChanges.slice(0, 5);
        }

        return base;
      });

      const statusCounts = {
        fresh: 0,
        stale: 0,
        'very-stale': 0,
        orphaned: 0,
        undocumented: 0,
      };
      for (const r of reports.values()) {
        statusCounts[r.status]++;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: {
              totalFiles: files.length,
              documented: docIndex.size,
              statusCounts,
            },
            staleFiles: output,
          }, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // docdocs_find_undocumented
  // --------------------------------------------------------
  server.tool(
    'docdocs_find_undocumented',
    'Find undocumented symbols prioritized by importance. Combines dependency analysis and complexity to identify highest-value documentation targets.',
    {
      path: z.string().optional().describe('Specific file or directory to scan'),
      limit: z.number().min(1).max(50).default(15).describe('Maximum number of files to return'),
      minImportance: z.number().min(0).max(10).default(2).describe('Minimum importance score'),
    },
    async ({ path: targetPath, limit, minImportance }) => {
      const projectRoot = getProjectRoot();
      let files = await findSourceFiles(projectRoot);

      if (targetPath) {
        const absPath = path.resolve(projectRoot, targetPath);
        files = files.filter(f => path.resolve(projectRoot, f).startsWith(absPath));
      }

      const docIndex = readDocIndex(projectRoot);
      const documentedFiles = new Set(docIndex.keys());
      const graph = await analyzeImportance(projectRoot, files);
      const undocumented = getUndocumentedHighPriority(graph, documentedFiles, limit * 2);

      // Filter by minimum importance
      const filtered = undocumented
        .filter(f => f.score >= minImportance)
        .slice(0, limit);

      // Get complexity for each
      const output = await Promise.all(filtered.map(async f => {
        let complexity = 0;
        try {
          const metrics = await analyzeComplexity(f.path);
          complexity = metrics.overall;
        } catch {
          // Skip complexity if analysis fails
        }

        return {
          path: path.relative(projectRoot, f.path),
          importance: f.score.toFixed(1),
          complexity,
          dependents: f.metrics.dependentCount,
          isEntryPoint: f.metrics.isEntryPoint,
          hasPublicAPI: f.metrics.hasPublicAPI,
          recommendation: f.score >= 7 ? 'critical' :
                         f.score >= 5 ? 'high' :
                         f.score >= 3 ? 'medium' : 'low',
        };
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: {
              totalFiles: files.length,
              documentedFiles: docIndex.size,
              undocumentedHighPriority: output.length,
            },
            files: output,
          }, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // docdocs_get_symbols
  // --------------------------------------------------------
  server.tool(
    'docdocs_get_symbols',
    'Extract symbols (functions, classes, interfaces, types) from a file with their signatures and documentation status.',
    {
      path: z.string().describe('File path to extract symbols from'),
      includePrivate: z.boolean().default(false).describe('Include private/internal symbols'),
    },
    async ({ path: filePath, includePrivate }) => {
      const projectRoot = getProjectRoot();
      const absolutePath = path.resolve(projectRoot, filePath);

      if (!fs.existsSync(absolutePath)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'File not found' }) }],
          isError: true,
        };
      }

      const content = fs.readFileSync(absolutePath, 'utf-8');
      const symbols: Array<{
        kind: string;
        name: string;
        line: number;
        signature: string;
        exported: boolean;
        documented: boolean;
      }> = [];

      // Extract functions
      const funcPattern = /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{;]+))?/g;
      let match;
      while ((match = funcPattern.exec(content)) !== null) {
        const isExported = !!match[1];
        const name = match[2]!;
        if (!includePrivate && name.startsWith('_')) continue;

        const line = content.slice(0, match.index).split('\n').length;
        const params = match[4] || '';
        const returnType = match[5]?.trim() || 'void';
        const hasJsdoc = content.slice(Math.max(0, match.index - 200), match.index).includes('/**');

        symbols.push({
          kind: 'function',
          name,
          line,
          signature: `(${params}): ${returnType}`,
          exported: isExported,
          documented: hasJsdoc,
        });
      }

      // Extract classes
      const classPattern = /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
      while ((match = classPattern.exec(content)) !== null) {
        const isExported = !!match[1];
        const name = match[2]!;
        if (!includePrivate && name.startsWith('_')) continue;

        const line = content.slice(0, match.index).split('\n').length;
        const hasJsdoc = content.slice(Math.max(0, match.index - 200), match.index).includes('/**');

        symbols.push({
          kind: 'class',
          name,
          line,
          signature: name,
          exported: isExported,
          documented: hasJsdoc,
        });
      }

      // Extract interfaces
      const interfacePattern = /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?interface\s+(\w+)(<[^>]*>)?/g;
      while ((match = interfacePattern.exec(content)) !== null) {
        const isExported = !!match[1];
        const name = match[2]!;
        if (!includePrivate && name.startsWith('_')) continue;

        const line = content.slice(0, match.index).split('\n').length;
        const generics = match[3] || '';
        const hasJsdoc = content.slice(Math.max(0, match.index - 200), match.index).includes('/**');

        symbols.push({
          kind: 'interface',
          name,
          line,
          signature: `${name}${generics}`,
          exported: isExported,
          documented: hasJsdoc,
        });
      }

      // Extract type aliases
      const typePattern = /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?type\s+(\w+)(<[^>]*>)?\s*=/g;
      while ((match = typePattern.exec(content)) !== null) {
        const isExported = !!match[1];
        const name = match[2]!;
        if (!includePrivate && name.startsWith('_')) continue;

        const line = content.slice(0, match.index).split('\n').length;
        const generics = match[3] || '';
        const hasJsdoc = content.slice(Math.max(0, match.index - 200), match.index).includes('/**');

        symbols.push({
          kind: 'type',
          name,
          line,
          signature: `${name}${generics}`,
          exported: isExported,
          documented: hasJsdoc,
        });
      }

      const documented = symbols.filter(s => s.documented).length;
      const exported = symbols.filter(s => s.exported).length;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            path: filePath,
            summary: {
              total: symbols.length,
              documented,
              undocumented: symbols.length - documented,
              exported,
              coverage: symbols.length > 0 ? ((documented / symbols.length) * 100).toFixed(1) + '%' : 'N/A',
            },
            symbols: symbols.sort((a, b) => a.line - b.line),
          }, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // docdocs_coverage_report
  // --------------------------------------------------------
  server.tool(
    'docdocs_coverage_report',
    'Generate comprehensive documentation coverage report with actionable recommendations.',
    {
      path: z.string().optional().describe('Specific directory to analyze'),
      detailed: z.boolean().default(false).describe('Include per-file breakdown'),
    },
    async ({ path: targetPath, detailed }) => {
      const projectRoot = getProjectRoot();
      let files = await findSourceFiles(projectRoot);

      if (targetPath) {
        const absPath = path.resolve(projectRoot, targetPath);
        files = files.filter(f => path.resolve(projectRoot, f).startsWith(absPath));
      }

      const docIndex = readDocIndex(projectRoot);
      const graph = await analyzeImportance(projectRoot, files);

      // Calculate coverage stats
      let totalSymbols = 0;
      let documentedSymbols = 0;
      const fileStats: Array<{
        path: string;
        symbols: number;
        documented: number;
        coverage: string;
        importance: number;
      }> = [];

      for (const file of files) {
        const absolutePath = path.resolve(projectRoot, file);
        try {
          const content = fs.readFileSync(absolutePath, 'utf-8');

          // Count symbols (simplified)
          const funcCount = (content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+/g) || []).length;
          const classCount = (content.match(/(?:export\s+)?class\s+\w+/g) || []).length;
          const interfaceCount = (content.match(/(?:export\s+)?interface\s+\w+/g) || []).length;
          const typeCount = (content.match(/(?:export\s+)?type\s+\w+\s*=/g) || []).length;

          const symbols = funcCount + classCount + interfaceCount + typeCount;
          const jsdocCount = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
          const documented = Math.min(symbols, jsdocCount);

          totalSymbols += symbols;
          documentedSymbols += documented;

          const importance = graph.files.get(absolutePath)?.score ?? 0;

          if (detailed || importance >= 5) {
            fileStats.push({
              path: file,
              symbols,
              documented,
              coverage: symbols > 0 ? ((documented / symbols) * 100).toFixed(0) + '%' : 'N/A',
              importance,
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Sort by importance and coverage (prioritize important undocumented files)
      fileStats.sort((a, b) => {
        const aCoverage = parseInt(a.coverage) || 100;
        const bCoverage = parseInt(b.coverage) || 100;
        // Prioritize high importance + low coverage
        return (b.importance * (100 - bCoverage)) - (a.importance * (100 - aCoverage));
      });

      const coverage = totalSymbols > 0
        ? ((documentedSymbols / totalSymbols) * 100).toFixed(1)
        : '0';

      // Generate recommendations
      const recommendations: string[] = [];
      const lowCoverageImportant = fileStats.filter(f =>
        f.importance >= 5 && parseInt(f.coverage) < 50
      );

      if (lowCoverageImportant.length > 0) {
        recommendations.push(
          `Priority: ${lowCoverageImportant.length} high-importance files have <50% coverage`
        );
      }

      if (parseFloat(coverage) < 30) {
        recommendations.push('Coverage is critically low. Focus on entry points and public APIs first.');
      } else if (parseFloat(coverage) < 60) {
        recommendations.push('Coverage is below target. Prioritize files with high dependent count.');
      }

      const undocEntryPoints = graph.entryPoints.filter(e => !docIndex.has(e));
      if (undocEntryPoints.length > 0) {
        recommendations.push(
          `${undocEntryPoints.length} entry points are undocumented (critical)`
        );
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: {
              totalFiles: files.length,
              totalSymbols,
              documentedSymbols,
              coverage: coverage + '%',
              entryPoints: graph.entryPoints.length,
              publicModules: graph.publicModules.length,
            },
            recommendations,
            files: detailed ? fileStats : fileStats.slice(0, 15),
          }, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // docdocs_dependency_graph
  // --------------------------------------------------------
  server.tool(
    'docdocs_dependency_graph',
    'Get the dependency graph for a file or the entire project. Shows what imports what.',
    {
      path: z.string().optional().describe('Specific file to get dependencies for'),
      depth: z.number().min(1).max(5).default(2).describe('How many levels of dependencies to traverse'),
      direction: z.enum(['dependents', 'dependencies', 'both']).default('both').describe('Which direction to traverse'),
    },
    async ({ path: targetPath, depth, direction }) => {
      const projectRoot = getProjectRoot();
      const files = await findSourceFiles(projectRoot);
      const graph = await analyzeImportance(projectRoot, files);

      if (targetPath) {
        const absolutePath = path.resolve(projectRoot, targetPath);
        const fileInfo = graph.files.get(absolutePath);

        if (!fileInfo) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'File not found in dependency graph' }) }],
            isError: true,
          };
        }

        // Build dependency tree
        const visited = new Set<string>();
        const buildTree = (filePath: string, currentDepth: number): Record<string, unknown> => {
          if (currentDepth > depth || visited.has(filePath)) {
            return {};
          }
          visited.add(filePath);

          const info = graph.files.get(filePath);
          if (!info) return {};

          const node: Record<string, unknown> = {
            path: path.relative(projectRoot, filePath),
            importance: info.score.toFixed(1),
          };

          if (direction !== 'dependents' && info.dependencies.length > 0) {
            node['dependencies'] = info.dependencies
              .filter(d => !visited.has(d))
              .slice(0, 10)
              .map(d => buildTree(d, currentDepth + 1));
          }

          if (direction !== 'dependencies' && info.dependents.length > 0) {
            node['dependents'] = info.dependents
              .filter(d => !visited.has(d))
              .slice(0, 10)
              .map(d => buildTree(d, currentDepth + 1));
          }

          return node;
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              root: path.relative(projectRoot, absolutePath),
              tree: buildTree(absolutePath, 0),
            }, null, 2),
          }],
        };
      }

      // Return summary of entire graph
      const summary = {
        totalFiles: graph.files.size,
        entryPoints: graph.entryPoints.map(e => path.relative(projectRoot, e)),
        mostDepended: Array.from(graph.files.values())
          .sort((a, b) => b.metrics.dependentCount - a.metrics.dependentCount)
          .slice(0, 10)
          .map(f => ({
            path: path.relative(projectRoot, f.path),
            dependents: f.metrics.dependentCount,
            importance: f.score.toFixed(1),
          })),
        mostDependencies: Array.from(graph.files.values())
          .sort((a, b) => b.metrics.dependencyCount - a.metrics.dependencyCount)
          .slice(0, 10)
          .map(f => ({
            path: path.relative(projectRoot, f.path),
            dependencies: f.metrics.dependencyCount,
          })),
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        }],
      };
    }
  );
}
