#!/usr/bin/env node
/**
 * PR check: remind contributors to keep .docdocs in sync.
 * Exits 1 when .docdocs/freshness.json exists and lists stale entries (hash mismatch).
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const docdocsDir = path.join(root, '.docdocs');
const freshnessPath = path.join(docdocsDir, 'freshness.json');

function log(msg) {
  console.log(`[doc-freshness] ${msg}`);
}

function uriToPath(uri) {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(new URL(uri).pathname);
  }
  return path.isAbsolute(uri) ? uri : path.join(root, uri);
}

async function hashFile(absolutePath) {
  const content = await readFile(absolutePath);
  return createHash('sha256').update(content).digest('hex');
}

function printInstructions() {
  log('');
  log('Documentation freshness check');
  log('  1. Run "docdocs: Generate Documentation for Workspace" in VS Code, or');
  log('  2. Commit updated .docdocs/ if your team tracks generated docs in git.');
  log('  3. Use "docdocs: Check Documentation Freshness" before opening a PR.');
  log('');
}

async function countStale(freshness) {
  let stale = 0;
  const files = freshness.files ?? {};

  for (const [uri, entry] of Object.entries(files)) {
    const absolutePath = uriToPath(uri);
    if (!existsSync(absolutePath)) {
      continue;
    }
    try {
      const currentHash = await hashFile(absolutePath);
      if (currentHash !== entry.sourceHash) {
        stale += 1;
      }
    } catch {
      // Skip unreadable paths
    }
  }

  return stale;
}

async function main() {
  if (!existsSync(docdocsDir)) {
    log('.docdocs/ not found — skipping strict freshness gate.');
    printInstructions();
    process.exit(0);
  }

  if (!existsSync(freshnessPath)) {
    log('.docdocs/ exists but freshness.json is missing — reminder only.');
    printInstructions();
    process.exit(0);
  }

  let freshness;
  try {
    freshness = JSON.parse(readFileSync(freshnessPath, 'utf8'));
  } catch (error) {
    console.error('[doc-freshness] Failed to parse freshness.json:', error);
    process.exit(1);
  }

  const staleCount = await countStale(freshness);
  const tracked = Object.keys(freshness.files ?? {}).length;

  log(`Tracked files: ${tracked}, stale (hash mismatch): ${staleCount}`);

  if (staleCount > 0) {
    console.error(
      `[doc-freshness] ${staleCount} file(s) have stale documentation. Regenerate docs before merging.`,
    );
    printInstructions();
    process.exit(1);
  }

  log('Freshness OK.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[doc-freshness] Unexpected error:', error);
  process.exit(1);
});
