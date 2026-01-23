/**
 * @fileoverview MCP Resources registration.
 * Provides read-only access to documentation state.
 *
 * @module mcp/resources
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

import { analyzeImportance } from '../heuristics/importance.js';
import { analyzeComplexityBatch } from '../heuristics/complexity.js';

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

function readConfig(projectRoot: string): Record<string, unknown> {
  const configPaths = [
    '.docdocs.json',
    '.docdocs/config.json',
    'docdocs.config.json',
  ];

  for (const configPath of configPaths) {
    const fullPath = path.join(projectRoot, configPath);
    try {
      if (fs.existsSync(fullPath)) {
        return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      }
    } catch {
      // Continue to next path
    }
  }

  // Default config
  return {
    output: {
      directory: '.docdocs',
      formats: ['markdown', 'ai-context'],
    },
    extraction: {
      treeSitterFallback: true,
      timeout: 5000,
    },
  };
}

function readFreshnessIndex(projectRoot: string): Record<string, unknown> {
  const indexPath = path.join(projectRoot, '.docdocs', 'freshness.json');
  try {
    if (fs.existsSync(indexPath)) {
      return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    }
  } catch {
    // Index doesn't exist
  }
  return { version: 1, files: {} };
}

function readDocIndex(projectRoot: string): Record<string, unknown> {
  const indexPath = path.join(projectRoot, '.docdocs', 'index.json');
  try {
    if (fs.existsSync(indexPath)) {
      return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    }
  } catch {
    // Index doesn't exist
  }
  return { version: 1, files: {}, generated: new Date().toISOString() };
}

// ============================================================
// Resource Registration
// ============================================================

export function registerResources(server: McpServer): void {
  // --------------------------------------------------------
  // config://docdocs
  // --------------------------------------------------------
  server.resource(
    'config://docdocs',
    'DocDocs Configuration',
    async (uri) => {
      const projectRoot = getProjectRoot();
      const config = readConfig(projectRoot);

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(config, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // freshness://project
  // --------------------------------------------------------
  server.resource(
    'freshness://project',
    'Documentation freshness status for all tracked files',
    async (uri) => {
      const projectRoot = getProjectRoot();
      const freshness = readFreshnessIndex(projectRoot);

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(freshness, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // coverage://project
  // --------------------------------------------------------
  server.resource(
    'coverage://project',
    'Documentation coverage summary for the project',
    async (uri) => {
      const projectRoot = getProjectRoot();
      const files = await findSourceFiles(projectRoot);
      const docIndex = readDocIndex(projectRoot);
      const indexFiles = docIndex.files as Record<string, unknown> || {};

      // Calculate coverage
      let totalSymbols = 0;
      let documentedSymbols = 0;

      for (const file of files) {
        const absolutePath = path.resolve(projectRoot, file);
        try {
          const content = fs.readFileSync(absolutePath, 'utf-8');

          const funcCount = (content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+/g) || []).length;
          const classCount = (content.match(/(?:export\s+)?class\s+\w+/g) || []).length;
          const interfaceCount = (content.match(/(?:export\s+)?interface\s+\w+/g) || []).length;
          const typeCount = (content.match(/(?:export\s+)?type\s+\w+\s*=/g) || []).length;

          const symbols = funcCount + classCount + interfaceCount + typeCount;
          const jsdocCount = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;

          totalSymbols += symbols;
          documentedSymbols += Math.min(symbols, jsdocCount);
        } catch {
          // Skip
        }
      }

      const coverage = {
        timestamp: new Date().toISOString(),
        totalFiles: files.length,
        documentedFiles: Object.keys(indexFiles).length,
        totalSymbols,
        documentedSymbols,
        coveragePercent: totalSymbols > 0 ? ((documentedSymbols / totalSymbols) * 100).toFixed(1) : '0',
      };

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(coverage, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // index://project
  // --------------------------------------------------------
  server.resource(
    'index://project',
    'Documentation index with all generated docs',
    async (uri) => {
      const projectRoot = getProjectRoot();
      const docIndex = readDocIndex(projectRoot);

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(docIndex, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // importance://project
  // --------------------------------------------------------
  server.resource(
    'importance://project',
    'File importance rankings based on dependency analysis',
    async (uri) => {
      const projectRoot = getProjectRoot();
      const files = await findSourceFiles(projectRoot);
      const graph = await analyzeImportance(projectRoot, files);

      const rankings = Array.from(graph.files.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map(f => ({
          path: path.relative(projectRoot, f.path),
          score: f.score.toFixed(1),
          dependents: f.metrics.dependentCount,
          dependencies: f.metrics.dependencyCount,
          isEntryPoint: f.metrics.isEntryPoint,
        }));

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            timestamp: new Date().toISOString(),
            totalFiles: files.length,
            entryPoints: graph.entryPoints.map(e => path.relative(projectRoot, e)),
            rankings,
          }, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // complexity://project
  // --------------------------------------------------------
  server.resource(
    'complexity://project',
    'Code complexity analysis for the project',
    async (uri) => {
      const projectRoot = getProjectRoot();
      const files = await findSourceFiles(projectRoot);
      const absoluteFiles = files.map(f => path.resolve(projectRoot, f));

      const metrics = await analyzeComplexityBatch(absoluteFiles);

      const rankings = Array.from(metrics.values())
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 30)
        .map(m => ({
          path: path.relative(projectRoot, m.path),
          overall: m.overall,
          cyclomatic: m.cyclomatic,
          cognitive: m.cognitive,
          maintainability: m.maintainability.toFixed(0),
          lines: m.details.lineCount,
        }));

      // Calculate averages
      const allMetrics = Array.from(metrics.values());
      const avgComplexity = allMetrics.reduce((s, m) => s + m.overall, 0) / allMetrics.length;
      const avgMaintainability = allMetrics.reduce((s, m) => s + m.maintainability, 0) / allMetrics.length;

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            timestamp: new Date().toISOString(),
            totalFiles: files.length,
            averageComplexity: avgComplexity.toFixed(1),
            averageMaintainability: avgMaintainability.toFixed(0),
            highComplexityCount: allMetrics.filter(m => m.overall >= 5).length,
            rankings,
          }, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------
  // structure://project
  // --------------------------------------------------------
  server.resource(
    'structure://project',
    'Project structure overview with directories and file counts',
    async (uri) => {
      const projectRoot = getProjectRoot();
      const files = await findSourceFiles(projectRoot);

      // Build directory tree
      const dirs = new Map<string, { files: number; types: Set<string> }>();

      for (const file of files) {
        const dir = path.dirname(file);
        const ext = path.extname(file);

        if (!dirs.has(dir)) {
          dirs.set(dir, { files: 0, types: new Set() });
        }
        const entry = dirs.get(dir)!;
        entry.files++;
        entry.types.add(ext);
      }

      const structure = Array.from(dirs.entries())
        .sort((a, b) => b[1].files - a[1].files)
        .map(([dir, info]) => ({
          directory: dir || '.',
          fileCount: info.files,
          fileTypes: Array.from(info.types),
        }));

      // Detect project type
      const hasPackageJson = fs.existsSync(path.join(projectRoot, 'package.json'));
      const hasCargo = fs.existsSync(path.join(projectRoot, 'Cargo.toml'));
      const hasPyproject = fs.existsSync(path.join(projectRoot, 'pyproject.toml'));
      const hasGoMod = fs.existsSync(path.join(projectRoot, 'go.mod'));

      let projectType = 'unknown';
      if (hasPackageJson) projectType = 'node/typescript';
      else if (hasCargo) projectType = 'rust';
      else if (hasPyproject) projectType = 'python';
      else if (hasGoMod) projectType = 'go';

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            projectRoot: projectRoot,
            projectType,
            totalFiles: files.length,
            directories: structure.slice(0, 30),
          }, null, 2),
        }],
      };
    }
  );
}
