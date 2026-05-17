/**
 * @fileoverview Runtime validation for JSON files read by the MCP layer.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Shared helpers
// ============================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonFile(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as unknown;
  } catch (error) {
    console.warn('[docDocs] Failed to read JSON file:', filePath, error);
    return null;
  }
}

// ============================================================
// Documentation index (.docdocs/index.json)
// ============================================================

export interface DocIndexFileEntry {
  readonly lastGenerated?: string;
}

export interface DocIndex {
  readonly version: number;
  readonly files: Readonly<Record<string, DocIndexFileEntry>>;
  readonly generated?: string;
}

const EMPTY_DOC_INDEX: DocIndex = {
  version: 1,
  files: {},
  generated: new Date().toISOString(),
};

function isDocIndexFileEntry(value: unknown): value is DocIndexFileEntry {
  if (!isPlainObject(value)) {
    return false;
  }
  const record = value;
  return record['lastGenerated'] === undefined || typeof record['lastGenerated'] === 'string';
}

function isDocIndex(value: unknown): value is DocIndex {
  if (!isPlainObject(value)) {
    return false;
  }
  const record = value;
  if (record['version'] !== undefined && typeof record['version'] !== 'number') {
    return false;
  }
  if (record['generated'] !== undefined && typeof record['generated'] !== 'string') {
    return false;
  }
  if (typeof record['files'] !== 'object' || record['files'] === null || Array.isArray(record['files'])) {
    return false;
  }
  return true;
}

function normalizeDocIndex(value: unknown): DocIndex {
  if (!isDocIndex(value)) {
    console.warn('[docDocs] Invalid documentation index; using empty index');
    return { ...EMPTY_DOC_INDEX, generated: new Date().toISOString() };
  }

  const record = value;
  const files: Record<string, DocIndexFileEntry> = {};
  for (const [file, entry] of Object.entries(record.files)) {
    if (isDocIndexFileEntry(entry)) {
      files[file] = entry;
    }
  }

  return {
    version: typeof record.version === 'number' ? record.version : 1,
    files,
    generated: typeof record.generated === 'string' ? record.generated : new Date().toISOString(),
  };
}

export function readDocIndex(projectRoot: string): DocIndex {
  const indexPath = path.join(projectRoot, '.docdocs', 'index.json');
  const parsed = readJsonFile(indexPath);
  if (parsed === null) {
    return { ...EMPTY_DOC_INDEX, generated: new Date().toISOString() };
  }
  return normalizeDocIndex(parsed);
}

export function readDocIndexDates(projectRoot: string): Map<string, Date> {
  const index = readDocIndex(projectRoot);
  const dates = new Map<string, Date>();

  for (const [file, entry] of Object.entries(index.files)) {
    if (entry.lastGenerated) {
      const date = new Date(entry.lastGenerated);
      if (!Number.isNaN(date.getTime())) {
        dates.set(path.resolve(projectRoot, file), date);
      }
    }
  }

  return dates;
}

// ============================================================
// Freshness store (.docdocs/freshness.json)
// ============================================================

export interface McpFreshnessEntry {
  readonly sourceHash: string;
  readonly docHash: string;
  readonly lastGenerated: string;
  readonly gitCommit?: string;
}

export interface McpFreshnessStore {
  readonly version: number;
  readonly files: Readonly<Record<string, McpFreshnessEntry>>;
}

const EMPTY_FRESHNESS_STORE: McpFreshnessStore = {
  version: 1,
  files: {},
};

function isMcpFreshnessEntry(value: unknown): value is McpFreshnessEntry {
  if (!isPlainObject(value)) {
    return false;
  }
  const record = value;
  return (
    typeof record['sourceHash'] === 'string' &&
    typeof record['docHash'] === 'string' &&
    typeof record['lastGenerated'] === 'string' &&
    (record['gitCommit'] === undefined || typeof record['gitCommit'] === 'string')
  );
}

function isMcpFreshnessStore(value: unknown): value is McpFreshnessStore {
  if (!isPlainObject(value)) {
    return false;
  }
  const record = value;
  if (typeof record['version'] !== 'number') {
    return false;
  }
  if (typeof record['files'] !== 'object' || record['files'] === null || Array.isArray(record['files'])) {
    return false;
  }
  return true;
}

function normalizeFreshnessStore(value: unknown): McpFreshnessStore {
  if (!isMcpFreshnessStore(value)) {
    console.warn('[docDocs] Invalid freshness index; using empty store');
    return EMPTY_FRESHNESS_STORE;
  }

  const files: Record<string, McpFreshnessEntry> = {};
  for (const [uri, entry] of Object.entries(value.files)) {
    if (isMcpFreshnessEntry(entry)) {
      files[uri] = entry;
    }
  }

  return {
    version: value.version,
    files,
  };
}

export function readFreshnessIndex(projectRoot: string): McpFreshnessStore {
  const indexPath = path.join(projectRoot, '.docdocs', 'freshness.json');
  const parsed = readJsonFile(indexPath);
  if (parsed === null) {
    return EMPTY_FRESHNESS_STORE;
  }
  return normalizeFreshnessStore(parsed);
}

// ============================================================
// Project config (JSON config files)
// ============================================================

const DEFAULT_MCP_CONFIG: Record<string, unknown> = {
  output: {
    directory: '.docdocs',
    formats: ['markdown', 'ai-context'],
  },
  extraction: {
    treeSitterFallback: true,
    timeout: 5000,
  },
};

function isMcpConfig(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value);
}

export function readMcpConfig(projectRoot: string): Record<string, unknown> {
  const configPaths = [
    '.docdocs.json',
    '.docdocs/config.json',
    'docdocs.config.json',
  ];

  for (const configPath of configPaths) {
    const fullPath = path.join(projectRoot, configPath);
    const parsed = readJsonFile(fullPath);
    if (parsed === null) {
      continue;
    }
    if (!isMcpConfig(parsed)) {
      console.warn('[docDocs] Invalid config file; trying next path:', configPath);
      continue;
    }
    return parsed;
  }

  return { ...DEFAULT_MCP_CONFIG };
}
