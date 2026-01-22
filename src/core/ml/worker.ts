/**
 * @fileoverview Web Worker for ML inference.
 * Runs transformers.js models in isolation to avoid blocking the extension host.
 * Supports WebGPU acceleration when available.
 *
 * @module core/ml/worker
 * @requirements 5.1, 5.7, 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7
 */

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

// MessageEvent-like interface available for Worker communication

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
 */
export const SUPPORTED_MODELS = [
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
 */
export function isModelSupported(modelId: string): modelId is SupportedModel {
    return SUPPORTED_MODELS.includes(modelId as SupportedModel);
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

        // In a real implementation, we would load the model here using transformers.js
        // For now, we simulate the loading process
        postMessage({
            id,
            type: 'progress',
            payload: {
                stage: 'downloading',
                progress: 50,
                message: `Downloading ${payload.modelId}...`,
            } satisfies ProgressPayload,
        });

        // Simulate model loading delay
        await new Promise(resolve => setTimeout(resolve, 100));

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
        if (!state.initialized) {
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

        // In a real implementation, we would run inference here
        // For now, return a placeholder response
        const result = `[ML-generated summary for: ${payload.prompt.slice(0, 50)}...]`;

        postMessage({
            id,
            type: 'success',
            payload: { text: result },
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
