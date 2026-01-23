/**
 * @fileoverview System detection and smart model recommendations.
 * Detects hardware capabilities and recommends suitable models.
 *
 * @module core/ml/systemDetector
 */

import * as os from 'os';
import { promises as fs } from 'fs';
import type { ModelInfo } from './registry.js';

// ============================================================
// Types
// ============================================================

/**
 * Detected system capabilities
 */
export interface SystemCapabilities {
  readonly totalRAM: number;
  readonly availableRAM: number;
  readonly hasWebGPU: boolean;
  readonly gpuName?: string | undefined;
  readonly gpuVRAM?: number | undefined;
  readonly platform: 'win32' | 'darwin' | 'linux';
  readonly isWSL: boolean;
}

/**
 * Model recommendation with scoring
 */
export interface ModelRecommendation {
  readonly modelId: string;
  readonly score: number;
  readonly reason: string;
  readonly warnings?: string[];
}

/**
 * Recommendation tier based on score
 */
export type RecommendationTier = 'great' | 'good' | 'marginal';

// ============================================================
// System Detection
// ============================================================

/**
 * Detects if running under WSL.
 *
 * @returns True if running in WSL environment
 */
async function detectWSL(): Promise<boolean> {
  try {
    const version = await fs.readFile('/proc/version', 'utf-8');
    return version.toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

/**
 * Detects system capabilities from the extension host.
 *
 * @returns System capabilities including RAM and platform info
 */
export async function detectSystem(): Promise<SystemCapabilities> {
  const totalRAM = os.totalmem();
  const availableRAM = os.freemem();
  const platform = os.platform() as 'win32' | 'darwin' | 'linux';
  const isWSL = platform === 'linux' ? await detectWSL() : false;

  // WebGPU detection must be done in the webview context
  // We'll assume false here and let the webview report back
  return {
    totalRAM,
    availableRAM,
    hasWebGPU: false,
    platform,
    isWSL,
  };
}

/**
 * Creates system capabilities from webview-reported GPU info.
 *
 * @param baseCapabilities - Base capabilities from extension host
 * @param webGPUInfo - GPU information reported from webview
 * @returns Complete system capabilities
 */
export function mergeWebGPUCapabilities(
  baseCapabilities: SystemCapabilities,
  webGPUInfo: { hasWebGPU: boolean; gpuName?: string; gpuVRAM?: number }
): SystemCapabilities {
  return {
    ...baseCapabilities,
    hasWebGPU: webGPUInfo.hasWebGPU,
    gpuName: webGPUInfo.gpuName,
    gpuVRAM: webGPUInfo.gpuVRAM,
  };
}

// ============================================================
// Model Scoring
// ============================================================

/**
 * Scores a model based on system capabilities.
 *
 * @param model - Model to score
 * @param system - System capabilities
 * @returns Score from 0-100
 */
export function scoreModel(model: ModelInfo, system: SystemCapabilities): number {
  let score = 100;

  // RAM check - model typically needs ~2.5x its size in RAM
  const modelRAM = model.sizeBytes * 2.5;
  const usableRAM = system.availableRAM * 0.7; // Leave 30% for system

  if (modelRAM > usableRAM) {
    score -= 30;
  }
  if (modelRAM > system.availableRAM) {
    score -= 50;
  }

  // WebGPU preference - significant speedup if available
  if (model.requirements.supportsWebGPU && system.hasWebGPU) {
    score += 10;
  }

  // CPU-only check - if no WebGPU and model doesn't support CPU well
  if (!model.requirements.supportsCPU && !system.hasWebGPU) {
    score = 0;
  }

  // Size preference - smaller models are faster
  if (model.sizeBytes < 200_000_000) {
    score += 5; // Tiny models bonus
  } else if (model.sizeBytes < 500_000_000) {
    score += 3; // Small models bonus
  }

  // Recommended models get a small boost
  if (model.recommended) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generates a reason string for a model recommendation.
 *
 * @param model - The model
 * @param score - The model's score
 * @param system - System capabilities
 * @returns Human-readable reason
 */
function generateReason(model: ModelInfo, score: number, system: SystemCapabilities): string {
  const ramGB = Math.round(system.totalRAM / (1024 * 1024 * 1024));

  if (score > 80) {
    if (model.recommended) {
      return `Recommended for your ${ramGB}GB RAM system`;
    }
    if (system.hasWebGPU) {
      return `Great fit with WebGPU acceleration`;
    }
    return `Perfect for your ${ramGB}GB RAM system`;
  }

  if (score > 50) {
    return `Should work on your system`;
  }

  if (score > 0) {
    return `May be slow on your current hardware`;
  }

  return `Not compatible with your system`;
}

/**
 * Generates warnings for a model recommendation.
 *
 * @param model - The model
 * @param system - System capabilities
 * @returns Array of warning strings
 */
function generateWarnings(model: ModelInfo, system: SystemCapabilities): string[] {
  const warnings: string[] = [];
  const modelRAM = model.sizeBytes * 2.5;

  if (modelRAM > system.availableRAM * 0.7) {
    warnings.push('May cause memory pressure');
  }

  if (!system.hasWebGPU && model.sizeBytes > 500_000_000) {
    warnings.push('Will be slow on CPU-only');
  }

  if (system.isWSL) {
    warnings.push('WSL may have limited GPU access');
  }

  return warnings;
}

// ============================================================
// Recommendations
// ============================================================

/**
 * Generates model recommendations based on system capabilities.
 *
 * @param registry - Array of available models
 * @param system - System capabilities
 * @returns Sorted array of recommendations (highest score first)
 */
export function recommendModels(
  registry: readonly ModelInfo[],
  system: SystemCapabilities
): ModelRecommendation[] {
  return registry
    .map((model) => {
      const score = scoreModel(model, system);
      return {
        modelId: model.id,
        score,
        reason: generateReason(model, score, system),
        warnings: generateWarnings(model, system),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Gets the tier for a recommendation score.
 *
 * @param score - The model score (0-100)
 * @returns The recommendation tier
 */
export function getRecommendationTier(score: number): RecommendationTier {
  if (score > 80) return 'great';
  if (score >= 50) return 'good';
  return 'marginal';
}

// ============================================================
// Cache Limit Recommendations
// ============================================================

/**
 * Cache limit recommendations based on system RAM.
 */
const CACHE_LIMITS: Array<{ minRAM: number; limit: number }> = [
  { minRAM: 32 * 1024 * 1024 * 1024, limit: 20 * 1024 * 1024 * 1024 }, // 32GB+ -> 20GB
  { minRAM: 16 * 1024 * 1024 * 1024, limit: 10 * 1024 * 1024 * 1024 }, // 16-32GB -> 10GB
  { minRAM: 8 * 1024 * 1024 * 1024, limit: 5 * 1024 * 1024 * 1024 }, // 8-16GB -> 5GB
  { minRAM: 4 * 1024 * 1024 * 1024, limit: 2 * 1024 * 1024 * 1024 }, // 4-8GB -> 2GB
  { minRAM: 0, limit: 1 * 1024 * 1024 * 1024 }, // <4GB -> 1GB
];

/**
 * Suggests a cache limit based on system capabilities.
 *
 * @param system - System capabilities
 * @returns Recommended cache limit in bytes
 */
export function suggestCacheLimit(system: SystemCapabilities): number {
  for (const { minRAM, limit } of CACHE_LIMITS) {
    if (system.totalRAM >= minRAM) {
      return limit;
    }
  }
  return 1 * 1024 * 1024 * 1024; // Default 1GB
}

/**
 * Formats system capabilities for display.
 *
 * @param system - System capabilities
 * @returns Formatted display object
 */
export function formatSystemInfo(system: SystemCapabilities): {
  ram: string;
  availableRam: string;
  gpu: string;
  platform: string;
} {
  const formatGB = (bytes: number) => `${Math.round(bytes / (1024 * 1024 * 1024))}GB`;

  return {
    ram: formatGB(system.totalRAM),
    availableRam: formatGB(system.availableRAM),
    gpu: system.hasWebGPU ? (system.gpuName ?? 'WebGPU Available') : 'CPU Only',
    platform: system.isWSL
      ? 'Linux (WSL)'
      : system.platform.charAt(0).toUpperCase() + system.platform.slice(1),
  };
}
