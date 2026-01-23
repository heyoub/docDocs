/**
 * @fileoverview Web Worker for ML inference.
 * Runs transformers.js models in isolation to avoid blocking the extension host.
 * Supports WebGPU acceleration when available.
 *
 * @module core/ml/worker
 * @requirements 5.1, 5.7, 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7
 */

// Import transformers.js for actual ML inference
// Note: In Web Worker context, we use dynamic imports
type Pipeline = (prompt: string, options?: Record<string, unknown>) => Promise<Array<{ generated_text: string }>>;
type PipelineFactory = (
    task: string,
    model: string,
    options?: { device?: string; progress_callback?: (progress: unknown) => void }
) => Promise<Pipeline>;

// Web Worker/WebGPU type declarations for Node.js/VS Code environment
declare const self: {
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage(message: unknown): void;
};

declare class Worker {
    postMessage(message: unknown): void;
}

interface GPU {
    requestAdapter(): Promise<GPUAdapter | null>;
}

interface GPUAdapter {
    readonly name: string;
}

// Transformers.js pipeline reference
let pipelineFactory: PipelineFactory | null = null;

// ============================================================
// Types
// ============================================================

/**
 * Message types for worker communication.
 */
export type WorkerMessageType = 'init' | 'generate' | 'dispose' | 'status';

/**
 * Incoming message to the worker.
 */
export interface WorkerRequest {
    readonly id: string;
    readonly type: WorkerMessageType;
    readonly payload: unknown;
}

/**
 * Outgoing message from the worker.
 */
export interface WorkerResponse {
    readonly id: string;
    readonly type: 'success' | 'error' | 'progress';
    readonly payload: unknown;
}

/**
 * Initialization payload.
 */
export interface InitPayload {
    readonly modelId: string;
    readonly device: 'cpu' | 'webgpu' | 'auto';
    readonly cacheDir?: string;
    readonly cachedModelPath?: string;  // Path to locally cached model
}

/**
 * Generation payload.
 */
export interface GeneratePayload {
    readonly prompt: string;
    readonly maxTokens: number;
    readonly temperature?: number;
}

/**
 * Progress update payload.
 */
export interface ProgressPayload {
    readonly stage: 'downloading' | 'loading' | 'ready' | 'generating';
    readonly progress: number;
    readonly message: string;
}

/**
 * Worker state.
 */
interface WorkerState {
    initialized: boolean;
    modelId: string | null;
    pipeline: unknown | null;
    device: 'cpu' | 'webgpu';
}

// ============================================================
// State
// ============================================================

const state: WorkerState = {
    initialized: false,
    modelId: null,
    pipeline: null,
    device: 'cpu',
};

// ============================================================
// Supported Models
// ============================================================

/**
 * List of supported HuggingFace model IDs.
 * Includes both original models and new recommended models.
 */
export const SUPPORTED_MODELS = [
    // New recommended models
    'tiiuae/Falcon-H1-Tiny-Coder-90M',
    'ibm-granite/granite-4.0-nano-350m-instruct',
    'ibm-granite/granite-4.0-nano-1.5b-instruct',
    // Original models
    'HuggingFaceTB/SmolLM2-135M-Instruct',
    'HuggingFaceTB/SmolLM2-360M-Instruct',
    'HuggingFaceTB/SmolLM2-1.7B-Instruct',
    'Qwen/Qwen2.5-0.5B-Instruct',
    'Qwen/Qwen2.5-1.5B-Instruct',
    'microsoft/Phi-3-mini-4k-instruct',
] as const;

export type SupportedModel = typeof SUPPORTED_MODELS[number];

/**
 * Checks if a model ID is supported.
 * Also allows models from the registry that may not be in SUPPORTED_MODELS.
 */
export function isModelSupported(modelId: string): boolean {
    // Allow all models from the registry or supported list
    return SUPPORTED_MODELS.includes(modelId as SupportedModel) ||
           modelId.includes('/');  // Allow any HuggingFace model path
}

// ============================================================
// Device Detection
// ============================================================

/**
 * Checks if WebGPU is available.
 */
async function isWebGPUAvailable(): Promise<boolean> {
    if (typeof navigator === 'undefined') return false;
    if (!('gpu' in navigator)) return false;

    try {
        const adapter = await (navigator as Navigator & { gpu: GPU }).gpu.requestAdapter();
        return adapter !== null;
    } catch {
        return false;
    }
}

/**
 * Selects the best available device.
 */
async function selectDevice(preference: 'cpu' | 'webgpu' | 'auto'): Promise<'cpu' | 'webgpu'> {
    if (preference === 'cpu') return 'cpu';
    if (preference === 'webgpu') {
        const available = await isWebGPUAvailable();
        return available ? 'webgpu' : 'cpu';
    }
    // Auto: prefer WebGPU if available
    const available = await isWebGPUAvailable();
    return available ? 'webgpu' : 'cpu';
}

// ============================================================
// Message Handlers
// ============================================================

/**
 * Loads the transformers.js library dynamically.
 */
async function loadTransformers(): Promise<PipelineFactory> {
    if (pipelineFactory) return pipelineFactory;

    try {
        // Dynamic import for transformers.js
        const transformers = await import('@huggingface/transformers');
        pipelineFactory = transformers.pipeline as unknown as PipelineFactory;
        return pipelineFactory;
    } catch (error) {
        throw new Error(`Failed to load transformers.js: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Handles initialization request.
 */
async function handleInit(
    id: string,
    payload: InitPayload,
    postMessage: (msg: WorkerResponse) => void
): Promise<void> {
    try {
        // Validate model
        if (!isModelSupported(payload.modelId)) {
            postMessage({
                id,
                type: 'error',
                payload: { message: `Unsupported model: ${payload.modelId}` },
            });
            return;
        }

        // Select device
        state.device = await selectDevice(payload.device);
        postMessage({
            id,
            type: 'progress',
            payload: {
                stage: 'loading',
                progress: 0,
                message: `Using ${state.device} for inference`,
            } satisfies ProgressPayload,
        });

        // Load transformers.js
        const pipeline = await loadTransformers();

        // Progress callback for model download
        const progressCallback = (progress: unknown) => {
            const p = progress as { status?: string; progress?: number; file?: string };
            if (p.status === 'downloading' || p.status === 'progress') {
                postMessage({
                    id,
                    type: 'progress',
                    payload: {
                        stage: 'downloading',
                        progress: Math.round((p.progress ?? 0) * 100),
                        message: p.file ? `Downloading ${p.file}...` : `Downloading ${payload.modelId}...`,
                    } satisfies ProgressPayload,
                });
            }
        };

        // Initialize the text generation pipeline
        postMessage({
            id,
            type: 'progress',
            payload: {
                stage: 'downloading',
                progress: 0,
                message: `Loading ${payload.modelId}...`,
            } satisfies ProgressPayload,
        });

        state.pipeline = await pipeline(
            'text-generation',
            payload.modelId,
            {
                device: state.device === 'webgpu' ? 'webgpu' : 'cpu',
                progress_callback: progressCallback,
            }
        );

        postMessage({
            id,
            type: 'progress',
            payload: {
                stage: 'ready',
                progress: 100,
                message: 'Model loaded successfully',
            } satisfies ProgressPayload,
        });

        state.initialized = true;
        state.modelId = payload.modelId;

        postMessage({
            id,
            type: 'success',
            payload: {
                modelId: payload.modelId,
                device: state.device,
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        postMessage({
            id,
            type: 'error',
            payload: { message: `Failed to initialize model: ${message}` },
        });
    }
}

/**
 * Handles generation request.
 */
async function handleGenerate(
    id: string,
    payload: GeneratePayload,
    postMessage: (msg: WorkerResponse) => void
): Promise<void> {
    try {
        if (!state.initialized || !state.pipeline) {
            postMessage({
                id,
                type: 'error',
                payload: { message: 'Model not initialized' },
            });
            return;
        }

        postMessage({
            id,
            type: 'progress',
            payload: {
                stage: 'generating',
                progress: 0,
                message: 'Generating...',
            } satisfies ProgressPayload,
        });

        // Run actual inference with the loaded pipeline
        const pipeline = state.pipeline as Pipeline;
        const outputs = await pipeline(payload.prompt, {
            max_new_tokens: payload.maxTokens,
            temperature: payload.temperature ?? 0.7,
            do_sample: true,
            top_p: 0.9,
        });

        // Extract generated text
        const generated = outputs[0];
        const result = generated?.generated_text ?? '';

        // Remove the original prompt from the output if present
        const text = result.startsWith(payload.prompt)
            ? result.slice(payload.prompt.length).trim()
            : result.trim();

        postMessage({
            id,
            type: 'success',
            payload: { text },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        postMessage({
            id,
            type: 'error',
            payload: { message: `Generation failed: ${message}` },
        });
    }
}

/**
 * Handles dispose request.
 */
function handleDispose(
    id: string,
    postMessage: (msg: WorkerResponse) => void
): void {
    state.initialized = false;
    state.modelId = null;
    state.pipeline = null;

    postMessage({
        id,
        type: 'success',
        payload: { message: 'Worker disposed' },
    });
}

/**
 * Handles status request.
 */
function handleStatus(
    id: string,
    postMessage: (msg: WorkerResponse) => void
): void {
    postMessage({
        id,
        type: 'success',
        payload: {
            initialized: state.initialized,
            modelId: state.modelId,
            device: state.device,
        },
    });
}

// ============================================================
// Worker Entry Point
// ============================================================

/**
 * Main message handler for the worker.
 */
export function handleMessage(
    request: WorkerRequest,
    postMessage: (msg: WorkerResponse) => void
): void {
    switch (request.type) {
        case 'init':
            void handleInit(request.id, request.payload as InitPayload, postMessage);
            break;
        case 'generate':
            void handleGenerate(request.id, request.payload as GeneratePayload, postMessage);
            break;
        case 'dispose':
            handleDispose(request.id, postMessage);
            break;
        case 'status':
            handleStatus(request.id, postMessage);
            break;
        default:
            postMessage({
                id: request.id,
                type: 'error',
                payload: { message: `Unknown message type: ${request.type}` },
            });
    }
}

// Worker self-registration (when running as actual Web Worker)
if (typeof self !== 'undefined' && 'onmessage' in self) {
    self.onmessage = (event: { data: unknown }) => {
        handleMessage(event.data as WorkerRequest, (msg) => {
            self.postMessage(msg);
        });
    };
}
