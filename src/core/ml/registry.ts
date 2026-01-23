/**
 * @fileoverview Model registry with metadata for the Ollama-style model manager.
 * Provides a curated list of models with their specifications and requirements.
 *
 * @module core/ml/registry
 */

// ============================================================
// Types
// ============================================================

/**
 * Model category for filtering
 */
export type ModelCategory = 'code' | 'general' | 'reasoning';

/**
 * Model provider source
 */
export type ModelProvider = 'huggingface' | 'local';

/**
 * Hardware requirements for a model
 */
export interface ModelRequirements {
  readonly minRAM: string;
  readonly supportsWebGPU: boolean;
  readonly supportsCPU: boolean;
}

/**
 * Complete information about a model
 */
export interface ModelInfo {
  readonly id: string;
  readonly name: string;
  readonly provider: ModelProvider;
  readonly size: string;
  readonly sizeBytes: number;
  readonly description: string;
  readonly category: ModelCategory;
  readonly recommended?: boolean;
  readonly requirements: ModelRequirements;
  readonly downloadUrl: string;
}

// ============================================================
// Model Registry
// ============================================================

/**
 * Curated registry of available models for documentation generation.
 * Models are selected for their balance of quality, size, and performance.
 */
export const MODEL_REGISTRY: readonly ModelInfo[] = [
  // Falcon H1 Tiny Coder - Code specialist (RECOMMENDED)
  {
    id: 'tiiuae/Falcon-H1-Tiny-Coder-90M',
    name: 'Falcon H1 Tiny Coder',
    provider: 'huggingface',
    size: '90M',
    sizeBytes: 180_000_000,
    description: 'Code-aware 90M model, trained for code generation. Perfect for documentation prose.',
    category: 'code',
    recommended: true,
    requirements: {
      minRAM: '512MB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/onnx-community/Falcon-H1-Tiny-Coder-90M-ONNX',
  },

  // IBM Granite 4.0 Nano - Hybrid architecture
  {
    id: 'ibm-granite/granite-4.0-nano-350m-instruct',
    name: 'IBM Granite 4.0 Nano 350M',
    provider: 'huggingface',
    size: '350M',
    sizeBytes: 700_000_000,
    description: 'Hybrid Mamba/Transformer from IBM. Browser-optimized, runs on CPU with 2GB RAM.',
    category: 'general',
    requirements: {
      minRAM: '1GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/onnx-community/granite-4.0-nano-350m-instruct-ONNX',
  },

  // IBM Granite 4.0 Nano 1.5B - Larger variant
  {
    id: 'ibm-granite/granite-4.0-nano-1.5b-instruct',
    name: 'IBM Granite 4.0 Nano 1.5B',
    provider: 'huggingface',
    size: '1.5B',
    sizeBytes: 3_000_000_000,
    description: 'Larger Granite model. Better quality, needs 6GB+ RAM or GPU.',
    category: 'general',
    requirements: {
      minRAM: '6GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/onnx-community/granite-4.0-nano-1.5b-instruct-ONNX',
  },

  // SmolLM2 variants (existing supported models)
  {
    id: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    name: 'SmolLM2 135M',
    provider: 'huggingface',
    size: '135M',
    sizeBytes: 270_000_000,
    description: 'Compact model from HuggingFace. Fast inference, good for quick documentation.',
    category: 'general',
    requirements: {
      minRAM: '1GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct',
  },

  {
    id: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    name: 'SmolLM2 360M',
    provider: 'huggingface',
    size: '360M',
    sizeBytes: 720_000_000,
    description: 'Medium-sized SmolLM2 variant. Balance between speed and quality.',
    category: 'general',
    requirements: {
      minRAM: '2GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct',
  },

  {
    id: 'HuggingFaceTB/SmolLM2-1.7B-Instruct',
    name: 'SmolLM2 1.7B',
    provider: 'huggingface',
    size: '1.7B',
    sizeBytes: 3_400_000_000,
    description: 'Largest SmolLM2 variant. Best quality, requires more resources.',
    category: 'general',
    requirements: {
      minRAM: '8GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct',
  },

  // Qwen variants
  {
    id: 'Qwen/Qwen2.5-0.5B-Instruct',
    name: 'Qwen 2.5 0.5B',
    provider: 'huggingface',
    size: '0.5B',
    sizeBytes: 1_000_000_000,
    description: 'Efficient Qwen model. Good multilingual support.',
    category: 'general',
    requirements: {
      minRAM: '2GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct',
  },

  {
    id: 'Qwen/Qwen2.5-1.5B-Instruct',
    name: 'Qwen 2.5 1.5B',
    provider: 'huggingface',
    size: '1.5B',
    sizeBytes: 3_000_000_000,
    description: 'Larger Qwen model. Excellent multilingual documentation.',
    category: 'general',
    requirements: {
      minRAM: '6GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct',
  },

  // Phi-3 Mini
  {
    id: 'microsoft/Phi-3-mini-4k-instruct',
    name: 'Phi-3 Mini 4K',
    provider: 'huggingface',
    size: '3.8B',
    sizeBytes: 7_600_000_000,
    description: 'Microsoft Phi-3 Mini. High quality reasoning, needs 16GB RAM or GPU.',
    category: 'reasoning',
    requirements: {
      minRAM: '16GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct',
  },
] as const;

// ============================================================
// Utility Functions
// ============================================================

/**
 * Gets a model from the registry by ID.
 *
 * @param modelId - The model ID to look up
 * @returns The model info if found, undefined otherwise
 */
export function getModelById(modelId: string): ModelInfo | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId);
}

/**
 * Filters models by category.
 *
 * @param category - The category to filter by
 * @returns Models matching the category
 */
export function getModelsByCategory(category: ModelCategory): ModelInfo[] {
  return MODEL_REGISTRY.filter((m) => m.category === category);
}

/**
 * Gets the recommended model.
 *
 * @returns The recommended model, or the first model if none is marked as recommended
 */
export function getRecommendedModel(): ModelInfo | undefined {
  return MODEL_REGISTRY.find((m) => m.recommended) ?? MODEL_REGISTRY[0];
}

/**
 * Checks if a model ID exists in the registry.
 *
 * @param modelId - The model ID to check
 * @returns True if the model exists in the registry
 */
export function isRegisteredModel(modelId: string): boolean {
  return MODEL_REGISTRY.some((m) => m.id === modelId);
}

/**
 * Formats bytes into human-readable size.
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Parses a RAM requirement string to bytes.
 *
 * @param ram - RAM string (e.g., "2GB", "512MB")
 * @returns Size in bytes
 */
export function parseRAMRequirement(ram: string): number {
  const match = ram.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|KB|TB)$/i);
  if (!match || !match[1] || !match[2]) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] ?? 1);
}
