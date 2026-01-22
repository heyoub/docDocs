/**
 * @fileoverview ML prose smoother for generating natural documentation.
 * Uses transformers.js via Web Worker for local inference.
 * Falls back to templates when ML is unavailable.
 *
 * @module core/ml/smoother
 * @requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8
 */

// Web Worker type declarations for Node.js/VS Code environment
declare class Worker {
    constructor(url: string | URL);
    postMessage(message: unknown): void;
    terminate(): void;
    onmessage: ((event: { data: unknown }) => void) | null;
    onerror: ((error: { message: string }) => void) | null;
}

// MessageEvent-like interface available for Worker communication

import type { SymbolSchema } from '../../types/schema.js';
import type {
    WorkerRequest,
    WorkerResponse,
    InitPayload,
    GeneratePayload,
    ProgressPayload,
} from './worker.js';
import { SUPPORTED_MODELS, isModelSupported } from './worker.js';

// ============================================================
// Types
// ============================================================

/**
 * Configuration for the ML smoother.
 */
export interface SmootherConfig {
    readonly modelId: string;
    readonly device: 'cpu' | 'webgpu' | 'auto';
    readonly cacheDir?: string;
    readonly maxTokens: number;
    readonly temperature: number;
}

/**
 * Progress callback for initialization.
 */
export type ProgressCallback = (progress: ProgressPayload) => void;

/**
 * State of the smoother.
 */
export interface SmootherState {
    readonly initialized: boolean;
    readonly modelId: string | null;
    readonly device: 'cpu' | 'webgpu' | null;
}

// ============================================================
// Default Configuration
// ============================================================

const DEFAULT_CONFIG: SmootherConfig = {
    modelId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    device: 'auto',
    maxTokens: 256,
    temperature: 0.7,
};

// ============================================================
// Smoother Class
// ============================================================

/**
 * ML Prose Smoother for generating natural documentation.
 * Runs inference in a Web Worker to avoid blocking the extension host.
 */
export class MLProseSmoother {
    private worker: Worker | null = null;
    private config: SmootherConfig;
    private initialized = false;
    private modelId: string | null = null;
    private device: 'cpu' | 'webgpu' | null = null;
    private pendingRequests = new Map<string, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
    }>();
    private requestId = 0;

    constructor(config: Partial<SmootherConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initializes the ML model.
     *
     * @param onProgress - Optional progress callback
     * @returns Promise that resolves when initialization is complete
     */
    async initialize(onProgress?: ProgressCallback): Promise<void> {
        if (this.initialized) return;

        if (!isModelSupported(this.config.modelId)) {
            throw new Error(`Unsupported model: ${this.config.modelId}`);
        }

        try {
            // Create worker
            this.worker = this.createWorker();
            this.setupWorkerHandlers(onProgress);

            // Send init message
            const payload: InitPayload = {
                modelId: this.config.modelId as InitPayload['modelId'],
                device: this.config.device,
                ...(this.config.cacheDir !== undefined && { cacheDir: this.config.cacheDir }),
            };

            const result = await this.sendRequest<{ modelId: string; device: 'cpu' | 'webgpu' }>('init', payload);
            this.initialized = true;
            this.modelId = result.modelId;
            this.device = result.device;
        } catch (e) {
            this.dispose();
            throw e;
        }
    }

    /**
     * Checks if the smoother is ready for inference.
     *
     * @returns True if the model is initialized and worker is running
     */
    isReady(): boolean {
        return this.initialized && this.worker !== null;
    }

    /**
     * Gets the current state of the smoother.
     *
     * @returns Current smoother state including initialization status
     */
    getState(): SmootherState {
        return {
            initialized: this.initialized,
            modelId: this.modelId,
            device: this.device,
        };
    }

    /**
     * Generates a summary for a symbol.
     * Falls back to template if ML fails.
     *
     * @param schema - The symbol schema to summarize
     * @returns Generated summary text
     */
    async generateSummary(schema: SymbolSchema): Promise<string> {
        if (!this.isReady()) {
            return this.templateSummary(schema);
        }

        try {
            const prompt = this.buildSummaryPrompt(schema);
            const result = await this.generate(prompt);
            return result || this.templateSummary(schema);
        } catch {
            return this.templateSummary(schema);
        }
    }

    /**
     * Generates transition text between two symbols.
     * Falls back to template if ML fails.
     *
     * @param from - The source symbol
     * @param to - The target symbol
     * @returns Generated transition text
     */
    async generateTransition(from: SymbolSchema, to: SymbolSchema): Promise<string> {
        if (!this.isReady()) {
            return this.templateTransition(from, to);
        }

        try {
            const prompt = this.buildTransitionPrompt(from, to);
            const result = await this.generate(prompt);
            return result || this.templateTransition(from, to);
        } catch {
            return this.templateTransition(from, to);
        }
    }

    /**
     * Generates "why it matters" explanation for a symbol.
     * Falls back to template if ML fails.
     *
     * @param schema - The symbol schema
     * @returns Generated explanation text
     */
    async generateWhyItMatters(schema: SymbolSchema): Promise<string> {
        if (!this.isReady()) {
            return this.templateWhyItMatters(schema);
        }

        try {
            const prompt = this.buildWhyItMattersPrompt(schema);
            const result = await this.generate(prompt);
            return result || this.templateWhyItMatters(schema);
        } catch {
            return this.templateWhyItMatters(schema);
        }
    }

    /**
     * Disposes of the worker and releases resources.
     *
     * @returns void
     */
    dispose(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.initialized = false;
        this.modelId = null;
        this.device = null;
        this.pendingRequests.clear();
    }

    // ============================================================
    // Private Methods
    // ============================================================

    private createWorker(): Worker {
        // In a real implementation, this would create a Web Worker
        // For now, we create a mock worker for testing
        const workerCode = `
            importScripts('worker.js');
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        return new Worker(URL.createObjectURL(blob));
    }

    private setupWorkerHandlers(onProgress?: ProgressCallback): void {
        if (!this.worker) return;

        this.worker.onmessage = (event: { data: unknown }) => {
            const response = event.data as WorkerResponse;
            const pending = this.pendingRequests.get(response.id);

            if (response.type === 'progress' && onProgress) {
                onProgress(response.payload as ProgressPayload);
                return;
            }

            if (!pending) return;

            if (response.type === 'success') {
                pending.resolve(response.payload);
            } else if (response.type === 'error') {
                const error = response.payload as { message: string };
                pending.reject(new Error(error.message));
            }

            this.pendingRequests.delete(response.id);
        };

        this.worker.onerror = (error) => {
            // Reject all pending requests
            for (const [id, pending] of this.pendingRequests) {
                pending.reject(new Error(`Worker error: ${error.message}`));
                this.pendingRequests.delete(id);
            }
        };
    }

    private sendRequest<T>(type: string, payload: unknown): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Worker not initialized'));
                return;
            }

            const id = `req-${++this.requestId}`;
            this.pendingRequests.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject,
            });

            const request: WorkerRequest = { id, type: type as WorkerRequest['type'], payload };
            this.worker.postMessage(request);
        });
    }

    private async generate(prompt: string): Promise<string> {
        const payload: GeneratePayload = {
            prompt,
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature,
        };

        const result = await this.sendRequest<{ text: string }>('generate', payload);
        return result.text;
    }

    // ============================================================
    // Prompt Builders
    // ============================================================

    private buildSummaryPrompt(schema: SymbolSchema): string {
        return `Summarize this ${schema.kind} in one sentence:
Name: ${schema.name}
Signature: ${schema.signature}
Description: ${schema.description || 'No description'}

Summary:`;
    }

    private buildTransitionPrompt(from: SymbolSchema, to: SymbolSchema): string {
        return `Write a brief transition from ${from.name} to ${to.name}:
From: ${from.kind} ${from.name} - ${from.description || 'No description'}
To: ${to.kind} ${to.name} - ${to.description || 'No description'}

Transition:`;
    }

    private buildWhyItMattersPrompt(schema: SymbolSchema): string {
        return `Explain why this ${schema.kind} matters in one sentence:
Name: ${schema.name}
Signature: ${schema.signature}
Description: ${schema.description || 'No description'}

Why it matters:`;
    }

    // ============================================================
    // Template Fallbacks
    // ============================================================

    private templateSummary(schema: SymbolSchema): string {
        const kind = schema.kind.charAt(0).toUpperCase() + schema.kind.slice(1);
        return `${kind} \`${schema.name}\` ${schema.description || 'provides functionality as defined by its signature'}.`;
    }

    private templateTransition(from: SymbolSchema, to: SymbolSchema): string {
        return `After understanding \`${from.name}\`, we can explore \`${to.name}\`.`;
    }

    private templateWhyItMatters(schema: SymbolSchema): string {
        const kind = schema.kind.toLowerCase();
        return `This ${kind} is part of the module's public API and may be used by consumers.`;
    }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * Creates a new ML prose smoother with the given configuration.
 *
 * @param config - Optional configuration overrides
 * @returns New MLProseSmoother instance
 */
export function createSmoother(config?: Partial<SmootherConfig>): MLProseSmoother {
    return new MLProseSmoother(config);
}

/**
 * Re-export supported models for convenience.
 */
export { SUPPORTED_MODELS, isModelSupported };
