/**
 * @fileoverview Persistent model cache manager.
 * Handles storing and retrieving downloaded models in VS Code's globalStorage.
 *
 * @module core/ml/cacheManager
 */

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import { formatBytes } from './registry.js';

// ============================================================
// Types
// ============================================================

/**
 * Information about a cached model
 */
export interface CachedModelInfo {
  readonly modelId: string;
  readonly path: string;
  readonly sizeBytes: number;
  readonly downloadedAt: number;
  readonly lastUsedAt: number;
}

/**
 * Cache manifest stored on disk
 */
interface CacheManifest {
  version: number;
  models: Record<string, CachedModelInfo>;
}

// ============================================================
// Constants
// ============================================================

const MANIFEST_VERSION = 1;
const MANIFEST_FILENAME = 'cache-manifest.json';
const MODELS_DIRNAME = 'models';

// ============================================================
// Cache Manager
// ============================================================

/**
 * Manages the persistent model cache in VS Code's global storage.
 */
export class ModelCacheManager {
  private cacheDir: string;
  private manifest: CacheManifest | null = null;
  private manifestPath: string;
  private modelsDir: string;

  constructor(globalStorageUri: vscode.Uri) {
    this.cacheDir = globalStorageUri.fsPath;
    this.manifestPath = path.join(this.cacheDir, MANIFEST_FILENAME);
    this.modelsDir = path.join(this.cacheDir, MODELS_DIRNAME);
  }

  /**
   * Initializes the cache manager, creating directories and loading manifest.
   */
  async initialize(): Promise<void> {
    // Ensure cache directories exist
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.mkdir(this.modelsDir, { recursive: true });

    // Load or create manifest
    await this.loadManifest();
  }

  /**
   * Lists all cached models.
   *
   * @returns Array of cached model information
   */
  async listCached(): Promise<CachedModelInfo[]> {
    await this.ensureManifest();
    return Object.values(this.manifest!.models);
  }

  /**
   * Checks if a model is cached.
   *
   * @param modelId - Model ID to check
   * @returns True if the model is cached
   */
  async isCached(modelId: string): Promise<boolean> {
    await this.ensureManifest();
    const entry = this.manifest!.models[modelId];

    if (!entry) return false;

    // Verify the files actually exist
    try {
      await fs.access(entry.path);
      return true;
    } catch {
      // Files missing - remove from manifest
      delete this.manifest!.models[modelId];
      await this.saveManifest();
      return false;
    }
  }

  /**
   * Gets the cache path for a model.
   *
   * @param modelId - Model ID
   * @returns Path to cached model, or null if not cached
   */
  async getCachePath(modelId: string): Promise<string | null> {
    if (await this.isCached(modelId)) {
      return this.manifest!.models[modelId]?.path ?? null;
    }
    return null;
  }

  /**
   * Gets information about a cached model.
   *
   * @param modelId - Model ID
   * @returns Cached model info, or null if not cached
   */
  async getCachedInfo(modelId: string): Promise<CachedModelInfo | null> {
    if (await this.isCached(modelId)) {
      return this.manifest!.models[modelId] ?? null;
    }
    return null;
  }

  /**
   * Gets the directory path where a model should be cached.
   * Creates the directory if it doesn't exist.
   *
   * @param modelId - Model ID
   * @returns Path to the model cache directory
   */
  async getModelCacheDir(modelId: string): Promise<string> {
    // Sanitize model ID for filesystem use
    const safeName = modelId.replace(/[/\\:*?"<>|]/g, '_');
    const modelDir = path.join(this.modelsDir, safeName);
    await fs.mkdir(modelDir, { recursive: true });
    return modelDir;
  }

  /**
   * Registers a downloaded model in the cache.
   *
   * @param modelId - Model ID
   * @param modelPath - Path where the model was downloaded
   * @param sizeBytes - Size of the downloaded model
   */
  async registerModel(modelId: string, modelPath: string, sizeBytes: number): Promise<void> {
    await this.ensureManifest();

    const now = Date.now();
    this.manifest!.models[modelId] = {
      modelId,
      path: modelPath,
      sizeBytes,
      downloadedAt: now,
      lastUsedAt: now,
    };

    await this.saveManifest();
  }

  /**
   * Updates the last used timestamp for a model.
   *
   * @param modelId - Model ID
   */
  async touchModel(modelId: string): Promise<void> {
    await this.ensureManifest();

    const entry = this.manifest!.models[modelId];
    if (entry) {
      this.manifest!.models[modelId] = {
        ...entry,
        lastUsedAt: Date.now(),
      };
      await this.saveManifest();
    }
  }

  /**
   * Deletes a cached model.
   *
   * @param modelId - Model ID to delete
   */
  async delete(modelId: string): Promise<void> {
    await this.ensureManifest();

    const entry = this.manifest!.models[modelId];
    if (entry) {
      // Delete model files
      try {
        await fs.rm(entry.path, { recursive: true, force: true });
      } catch (error) {
        // Log but don't fail if files already missing
        console.warn(`Failed to delete model files: ${error}`);
      }

      // Remove from manifest
      delete this.manifest!.models[modelId];
      await this.saveManifest();
    }
  }

  /**
   * Gets the total size of all cached models.
   *
   * @returns Total cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    await this.ensureManifest();
    return Object.values(this.manifest!.models).reduce((sum, m) => sum + m.sizeBytes, 0);
  }

  /**
   * Gets formatted cache statistics.
   *
   * @returns Cache statistics for display
   */
  async getCacheStats(): Promise<{
    modelCount: number;
    totalSize: string;
    totalSizeBytes: number;
  }> {
    const models = await this.listCached();
    const totalSizeBytes = models.reduce((sum, m) => sum + m.sizeBytes, 0);

    return {
      modelCount: models.length,
      totalSize: formatBytes(totalSizeBytes),
      totalSizeBytes,
    };
  }

  /**
   * Clears the entire cache.
   */
  async clearCache(): Promise<void> {
    await this.ensureManifest();

    // Delete all model directories
    try {
      await fs.rm(this.modelsDir, { recursive: true, force: true });
      await fs.mkdir(this.modelsDir, { recursive: true });
    } catch (error) {
      console.warn(`Failed to clear cache: ${error}`);
    }

    // Reset manifest
    this.manifest = {
      version: MANIFEST_VERSION,
      models: {},
    };
    await this.saveManifest();
  }

  /**
   * Prunes cache to fit within a size limit using LRU strategy.
   *
   * @param maxSizeBytes - Maximum cache size in bytes
   * @returns Array of deleted model IDs
   */
  async pruneToLimit(maxSizeBytes: number): Promise<string[]> {
    await this.ensureManifest();

    const models = Object.values(this.manifest!.models);
    const totalSize = models.reduce((sum, m) => sum + m.sizeBytes, 0);

    if (totalSize <= maxSizeBytes) {
      return [];
    }

    // Sort by last used (oldest first)
    const sorted = [...models].sort((a, b) => a.lastUsedAt - b.lastUsedAt);

    const deleted: string[] = [];
    let currentSize = totalSize;

    for (const model of sorted) {
      if (currentSize <= maxSizeBytes) break;

      await this.delete(model.modelId);
      deleted.push(model.modelId);
      currentSize -= model.sizeBytes;
    }

    return deleted;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async loadManifest(): Promise<void> {
    try {
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(content) as CacheManifest;

      // Migrate if needed
      if (this.manifest.version !== MANIFEST_VERSION) {
        this.manifest.version = MANIFEST_VERSION;
        await this.saveManifest();
      }
    } catch {
      // Create new manifest
      this.manifest = {
        version: MANIFEST_VERSION,
        models: {},
      };
      await this.saveManifest();
    }
  }

  private async saveManifest(): Promise<void> {
    if (!this.manifest) return;
    await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }

  private async ensureManifest(): Promise<void> {
    if (!this.manifest) {
      await this.loadManifest();
    }
  }
}

// ============================================================
// Factory
// ============================================================

/**
 * Creates a new model cache manager.
 *
 * @param context - VS Code extension context
 * @returns Initialized cache manager
 */
export async function createCacheManager(
  context: vscode.ExtensionContext
): Promise<ModelCacheManager> {
  const manager = new ModelCacheManager(context.globalStorageUri);
  await manager.initialize();
  return manager;
}
