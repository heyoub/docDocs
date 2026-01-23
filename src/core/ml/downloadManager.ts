/**
 * @fileoverview Model download manager with progress tracking.
 * Handles downloading models from HuggingFace with progress updates.
 *
 * @module core/ml/downloadManager
 */

import * as https from 'https';
import * as http from 'http';
import { promises as fs, createWriteStream } from 'fs';
import * as path from 'path';
import type { ModelCacheManager } from './cacheManager.js';
import type { ModelInfo } from './registry.js';
import { getModelById } from './registry.js';

// ============================================================
// Types
// ============================================================

/**
 * Download progress information
 */
export interface DownloadProgress {
  readonly modelId: string;
  readonly percent: number;
  readonly downloadedBytes: number;
  readonly totalBytes: number;
  readonly speed: string;
  readonly eta: string;
  readonly status: 'downloading' | 'extracting' | 'complete' | 'error' | 'cancelled';
  readonly error?: string;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Active download state
 */
interface ActiveDownload {
  controller: AbortController;
  promise: Promise<string>;
}

// ============================================================
// Constants
// ============================================================

// ============================================================
// Download Manager
// ============================================================

/**
 * Manages model downloads with progress tracking and cancellation.
 */
export class ModelDownloadManager {
  private activeDownloads = new Map<string, ActiveDownload>();
  private cacheManager: ModelCacheManager;

  constructor(cacheManager: ModelCacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * Downloads a model with progress tracking.
   *
   * @param modelId - Model ID to download
   * @param onProgress - Progress callback
   * @returns Path to the downloaded model
   */
  async download(modelId: string, onProgress?: ProgressCallback): Promise<string> {
    // Check if already downloading
    if (this.isDownloading(modelId)) {
      throw new Error(`Model ${modelId} is already downloading`);
    }

    // Check if already cached
    const cached = await this.cacheManager.getCachePath(modelId);
    if (cached) {
      onProgress?.({
        modelId,
        percent: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: '',
        eta: '',
        status: 'complete',
      });
      return cached;
    }

    // Get model info
    const modelInfo = getModelById(modelId);
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    // Create abort controller for cancellation
    const controller = new AbortController();

    // Start download
    const promise = this.downloadModel(modelInfo, controller.signal, onProgress);

    // Track active download
    this.activeDownloads.set(modelId, { controller, promise });

    try {
      const result = await promise;
      return result;
    } finally {
      this.activeDownloads.delete(modelId);
    }
  }

  /**
   * Cancels an active download.
   *
   * @param modelId - Model ID to cancel
   */
  cancel(modelId: string): void {
    const download = this.activeDownloads.get(modelId);
    if (download) {
      download.controller.abort();
      this.activeDownloads.delete(modelId);
    }
  }

  /**
   * Checks if a model is currently downloading.
   *
   * @param modelId - Model ID to check
   * @returns True if downloading
   */
  isDownloading(modelId: string): boolean {
    return this.activeDownloads.has(modelId);
  }

  /**
   * Gets the count of active downloads.
   */
  get activeCount(): number {
    return this.activeDownloads.size;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async downloadModel(
    modelInfo: ModelInfo,
    signal: AbortSignal,
    onProgress?: ProgressCallback
  ): Promise<string> {
    // Get cache directory for this model
    const modelDir = await this.cacheManager.getModelCacheDir(modelInfo.id);

    // For HuggingFace models, we need to download the ONNX files
    // We'll download a config.json and the model files
    const files = await this.getModelFiles(modelInfo);

    let totalBytes = 0;
    let downloadedBytes = 0;
    const startTime = Date.now();

    // Estimate total size from model info
    totalBytes = modelInfo.sizeBytes;

    // Download each file
    for (const file of files) {
      if (signal.aborted) {
        throw new Error('Download cancelled');
      }

      const filePath = path.join(modelDir, file.name);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });

      await this.downloadFile(file.url, filePath, signal, (progress) => {
        downloadedBytes = progress.downloadedBytes;

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? downloadedBytes / elapsed : 0;
        const remaining = totalBytes > downloadedBytes ? (totalBytes - downloadedBytes) / speed : 0;

        onProgress?.({
          modelId: modelInfo.id,
          percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
          downloadedBytes,
          totalBytes,
          speed: this.formatSpeed(speed),
          eta: this.formatETA(remaining),
          status: 'downloading',
        });
      });
    }

    // Register in cache
    const actualSize = await this.getDirectorySize(modelDir);
    await this.cacheManager.registerModel(modelInfo.id, modelDir, actualSize);

    onProgress?.({
      modelId: modelInfo.id,
      percent: 100,
      downloadedBytes: actualSize,
      totalBytes: actualSize,
      speed: '',
      eta: '',
      status: 'complete',
    });

    return modelDir;
  }

  private async getModelFiles(
    modelInfo: ModelInfo
  ): Promise<Array<{ name: string; url: string }>> {
    // For simplicity, we'll download the main model files
    // In production, you'd query the HuggingFace API for the file list
    const baseUrl = modelInfo.downloadUrl;

    // Common ONNX model files
    const files = [
      { name: 'config.json', url: `${baseUrl}/resolve/main/config.json` },
      { name: 'tokenizer.json', url: `${baseUrl}/resolve/main/tokenizer.json` },
      { name: 'tokenizer_config.json', url: `${baseUrl}/resolve/main/tokenizer_config.json` },
    ];

    // Add ONNX model file based on provider
    if (modelInfo.downloadUrl.includes('onnx-community') || modelInfo.downloadUrl.includes('ONNX')) {
      files.push({
        name: 'onnx/model.onnx',
        url: `${baseUrl}/resolve/main/onnx/model.onnx`,
      });
      files.push({
        name: 'onnx/model_quantized.onnx',
        url: `${baseUrl}/resolve/main/onnx/model_quantized.onnx`,
      });
    } else {
      // For non-ONNX models, include model weights
      files.push({
        name: 'model.safetensors',
        url: `${baseUrl}/resolve/main/model.safetensors`,
      });
    }

    return files;
  }

  private downloadFile(
    url: string,
    destPath: string,
    signal: AbortSignal,
    onProgress: (p: { downloadedBytes: number }) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      let downloadedBytes = 0;

      const request = protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.downloadFile(redirectUrl, destPath, signal, onProgress)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (response.statusCode === 404) {
          // File not found - skip silently (some optional files may not exist)
          resolve();
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }

        const file = createWriteStream(destPath);

        response.on('data', (chunk: Buffer) => {
          if (signal.aborted) {
            file.close();
            request.destroy();
            reject(new Error('Download cancelled'));
            return;
          }
          downloadedBytes += chunk.length;
          onProgress({ downloadedBytes });
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          file.close();
          fs.unlink(destPath).catch(() => {});
          reject(err);
        });
      });

      request.on('error', (err) => {
        reject(err);
      });

      // Handle abort
      signal.addEventListener('abort', () => {
        request.destroy();
        reject(new Error('Download cancelled'));
      });
    });
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.getDirectorySize(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          size += stat.size;
        }
      }
    } catch {
      // Ignore errors
    }

    return size;
  }

  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${Math.round(bytesPerSecond)} B/s`;
    }
    if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    }
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  private formatETA(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) {
      return 'calculating...';
    }
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    }
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
}

// ============================================================
// Factory
// ============================================================

/**
 * Creates a new model download manager.
 *
 * @param cacheManager - Cache manager instance
 * @returns Download manager
 */
export function createDownloadManager(cacheManager: ModelCacheManager): ModelDownloadManager {
  return new ModelDownloadManager(cacheManager);
}
