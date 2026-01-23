/**
 * VS Code Webview API Bridge
 * Provides type-safe communication between webview and extension
 */

import type { ToExtension, ToWebview } from '../../../protocol';

// Acquire VS Code API (available in webview context)
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

// Singleton VS Code API instance
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

function getVSCodeApi() {
  if (!vscodeApi) {
    try {
      vscodeApi = acquireVsCodeApi();
    } catch {
      // Running outside VS Code (e.g., in dev mode)
      console.warn('VS Code API not available - running in standalone mode');
      vscodeApi = {
        postMessage: (msg) => console.log('[Mock postMessage]', msg),
        getState: () => ({}),
        setState: (state) => console.log('[Mock setState]', state),
      };
    }
  }
  return vscodeApi;
}

/**
 * Send a typed message to the extension
 */
export function postMessage(message: ToExtension): void {
  getVSCodeApi().postMessage(message);
}

/**
 * Get persisted state from VS Code
 */
export function getState<T>(): T | undefined {
  return getVSCodeApi().getState() as T | undefined;
}

/**
 * Persist state in VS Code
 */
export function setState<T>(state: T): void {
  getVSCodeApi().setState(state);
}

/**
 * Subscribe to messages from the extension
 */
export function onMessage(handler: (message: ToWebview) => void): () => void {
  const listener = (event: MessageEvent<ToWebview>) => {
    handler(event.data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

/**
 * Notify extension that webview is ready
 */
export function notifyReady(): void {
  postMessage({ type: 'ready' });
}

/**
 * Run a VS Code command from the webview
 */
export function runCommand(command: string, args?: unknown[]): void {
  postMessage({ type: 'command:run', payload: { command, args } });
}

/**
 * Open a file in VS Code editor
 */
export function openFile(path: string): void {
  postMessage({ type: 'file:open', payload: { path } });
}

/**
 * Save configuration changes
 */
export function saveConfig(config: Record<string, unknown>): void {
  postMessage({ type: 'config:save', payload: config });
}

/**
 * Request initial data from extension
 */
export function requestInitialData(): void {
  postMessage({ type: 'request:initialData' });
}
