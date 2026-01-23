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
export type ModelCategory = 'code' | 'general' | 'reasoning' | 'embedding';

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
  // ============================================================
  // Falcon H1 Tiny Family (15 models - the tiny powerhouses)
  // ============================================================

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

  // Falcon H1 Tiny Instruct - General purpose chat
  {
    id: 'tiiuae/Falcon-H1-Tiny-90M-Instruct',
    name: 'Falcon H1 Tiny Instruct',
    provider: 'huggingface',
    size: '90M',
    sizeBytes: 180_000_000,
    description: 'Instruction-tuned tiny Falcon. Fast general-purpose assistant.',
    category: 'general',
    requirements: {
      minRAM: '512MB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-Tiny-90M-Instruct',
  },

  // Falcon H1 Tiny Reasoning - 90M reasoning specialist
  {
    id: 'tiiuae/Falcon-H1-Tiny-R-90M',
    name: 'Falcon H1 Tiny Reasoning 90M',
    provider: 'huggingface',
    size: '90M',
    sizeBytes: 180_000_000,
    description: 'Tiny reasoning model trained on long reasoning traces. Punches above its weight.',
    category: 'reasoning',
    requirements: {
      minRAM: '512MB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-Tiny-R-90M',
  },

  // Falcon H1 Tiny Reasoning - 600M reasoning powerhouse
  {
    id: 'tiiuae/Falcon-H1-Tiny-R-0.6B',
    name: 'Falcon H1 Tiny Reasoning 600M',
    provider: 'huggingface',
    size: '600M',
    sizeBytes: 1_200_000_000,
    description: 'State-of-the-art tiny reasoning model. Outperforms larger models on AIME, Math500.',
    category: 'reasoning',
    requirements: {
      minRAM: '2GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-Tiny-R-0.6B',
  },

  // Falcon H1 Tiny Tool Calling - Function calling specialist
  {
    id: 'tiiuae/Falcon-H1-Tiny-Tool-Calling',
    name: 'Falcon H1 Tiny Tool Calling',
    provider: 'huggingface',
    size: '90M',
    sizeBytes: 180_000_000,
    description: 'Trained for function calling & tool use. Perfect for agentic workflows.',
    category: 'code',
    requirements: {
      minRAM: '512MB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-Tiny-Tool-Calling',
  },

  // Falcon H1 Tiny Multilingual - 100+ languages
  {
    id: 'tiiuae/Falcon-H1-Tiny-Multilingual-100M-Instruct',
    name: 'Falcon H1 Tiny Multilingual',
    provider: 'huggingface',
    size: '100M',
    sizeBytes: 200_000_000,
    description: 'Multilingual tiny model. Supports 100+ languages for international docs.',
    category: 'general',
    requirements: {
      minRAM: '512MB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-Tiny-Multilingual-100M-Instruct',
  },

  // ============================================================
  // Falcon H1 Main Family (0.5B - 7B, hybrid architecture)
  // ============================================================

  // Falcon H1 0.5B - Performance rivals 2024's 7B models
  {
    id: 'tiiuae/Falcon-H1-0.5B-Instruct',
    name: 'Falcon H1 0.5B',
    provider: 'huggingface',
    size: '0.5B',
    sizeBytes: 1_000_000_000,
    description: 'Hybrid Transformer/Mamba. Rivals 2024\'s 7B models. 256K context, 18 languages.',
    category: 'general',
    requirements: {
      minRAM: '2GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-0.5B-Instruct',
  },

  // Falcon H1 1.5B - Sweet spot for edge
  {
    id: 'tiiuae/Falcon-H1-1.5B-Instruct',
    name: 'Falcon H1 1.5B',
    provider: 'huggingface',
    size: '1.5B',
    sizeBytes: 3_000_000_000,
    description: 'Sweet spot for edge deployment. Hybrid architecture, 256K context.',
    category: 'general',
    requirements: {
      minRAM: '4GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-1.5B-Instruct',
  },

  // Falcon H1 1.5B-Deep - Rivals 7B-10B models
  {
    id: 'tiiuae/Falcon-H1-1.5B-Deep-Instruct',
    name: 'Falcon H1 1.5B Deep',
    provider: 'huggingface',
    size: '1.5B',
    sizeBytes: 3_000_000_000,
    description: 'Deep variant that rivals 7B-10B models. Maximum performance at small size.',
    category: 'general',
    recommended: true,
    requirements: {
      minRAM: '4GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-1.5B-Deep-Instruct',
  },

  // Falcon H1 3B
  {
    id: 'tiiuae/Falcon-H1-3B-Instruct',
    name: 'Falcon H1 3B',
    provider: 'huggingface',
    size: '3B',
    sizeBytes: 6_000_000_000,
    description: 'Mid-size Falcon H1. Good balance of capability and resource usage.',
    category: 'general',
    requirements: {
      minRAM: '8GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-3B-Instruct',
  },

  // Falcon H1 7B
  {
    id: 'tiiuae/Falcon-H1-7B-Instruct',
    name: 'Falcon H1 7B',
    provider: 'huggingface',
    size: '7B',
    sizeBytes: 14_000_000_000,
    description: 'Full-size Falcon H1. 256K context, 18 languages, hybrid efficiency.',
    category: 'general',
    requirements: {
      minRAM: '16GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1-7B-Instruct',
  },

  // Falcon H1R 7B - SOTA Reasoning
  {
    id: 'tiiuae/Falcon-H1R-7B',
    name: 'Falcon H1R 7B Reasoning',
    provider: 'huggingface',
    size: '7B',
    sizeBytes: 14_000_000_000,
    description: 'SOTA reasoning model. Beats models 2-7x larger. 88.1% AIME24, 256K context.',
    category: 'reasoning',
    recommended: true,
    requirements: {
      minRAM: '16GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/tiiuae/Falcon-H1R-7B',
  },

  // ============================================================
  // Embedding Models (for semantic search & RAG)
  // ============================================================

  // Qwen3 Embedding - #1 on MTEB-Code (PRIMARY for code)
  {
    id: 'Qwen/Qwen3-Embedding-0.6B',
    name: 'Qwen3 Embedding 0.6B',
    provider: 'huggingface',
    size: '0.6B',
    sizeBytes: 1_200_000_000,
    description: '#1 on MTEB-Code benchmark. Best for code embeddings. Apache 2.0 license.',
    category: 'embedding',
    recommended: true,
    requirements: {
      minRAM: '2GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/Qwen/Qwen3-Embedding-0.6B',
  },

  // Nomic Embed Code - Lightweight code embedder
  {
    id: 'nomic-ai/nomic-embed-code',
    name: 'Nomic Embed Code',
    provider: 'huggingface',
    size: '137M',
    sizeBytes: 275_000_000,
    description: 'Best lightweight code embedder. Rivals closed-source, ONNX ready.',
    category: 'embedding',
    requirements: {
      minRAM: '512MB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/nomic-ai/nomic-embed-code',
  },

  // Jina Code v2 - 8K context code embeddings
  {
    id: 'jinaai/jina-embeddings-v2-base-code',
    name: 'Jina Code v2',
    provider: 'huggingface',
    size: '161M',
    sizeBytes: 322_000_000,
    description: '8K context window for code. Excellent for long functions/classes.',
    category: 'embedding',
    requirements: {
      minRAM: '1GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/jinaai/jina-embeddings-v2-base-code',
  },

  // Google EmbeddingGemma - Best-in-class open embeddings (general)
  {
    id: 'google/embeddinggemma-300m',
    name: 'EmbeddingGemma 300M',
    provider: 'huggingface',
    size: '308M',
    sizeBytes: 616_000_000,
    description: 'Google\'s best general embedder. 100+ languages, Matryoshka dims, on-device ready.',
    category: 'embedding',
    requirements: {
      minRAM: '1GB',
      supportsWebGPU: true,
      supportsCPU: true,
    },
    downloadUrl: 'https://huggingface.co/google/embeddinggemma-300m',
  },

  // ============================================================
  // IBM Granite (Hybrid Mamba/Transformer)
  // ============================================================

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
