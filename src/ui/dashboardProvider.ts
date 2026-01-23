/**
 * @fileoverview Dashboard webview panel provider for DocDocs extension.
 * Renders the React-based dashboard as a full panel.
 *
 * @module ui/dashboardProvider
 */

import * as vscode from 'vscode';
import type {
  ToWebview,
  ToExtension,
  InitialData,
  DocDocsConfig,
  FreshnessMap,
  FreshnessHistory,
  CoverageReport,
  RecentDoc,
  Snapshot,
  GenerationProgress,
  ModelManagerState,
  ModelInfo,
  CachedModelInfo,
  ModelRecommendation,
  SystemCapabilities,
} from '../protocol.js';
import { MODEL_REGISTRY } from '../core/ml/registry.js';
import { detectSystem, recommendModels, suggestCacheLimit, mergeWebGPUCapabilities } from '../core/ml/systemDetector.js';
import { ModelCacheManager, createCacheManager } from '../core/ml/cacheManager.js';
import { ModelDownloadManager, createDownloadManager } from '../core/ml/downloadManager.js';

// ============================================================
// Constants
// ============================================================

/** View type for the dashboard panel */
const VIEW_TYPE = 'docdocs.dashboard';

// ============================================================
// Dashboard Provider
// ============================================================

/**
 * Manages the dashboard webview panel.
 */
export class DashboardProvider {
  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;
  private context: vscode.ExtensionContext | null = null;

  // State that can be updated and pushed to webview
  private config: DocDocsConfig | null = null;
  private freshness: FreshnessMap = {};
  private freshnessHistory: FreshnessHistory = [];
  private coverage: CoverageReport | null = null;
  private recentDocs: RecentDoc[] = [];
  private snapshots: Snapshot[] = [];
  private watchMode = { enabled: false, files: [] as string[] };

  // Model management state
  private cacheManager: ModelCacheManager | null = null;
  private downloadManager: ModelDownloadManager | null = null;
  private systemCapabilities: SystemCapabilities | null = null;
  private selectedModelId: string | null = null;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /**
   * Sets the extension context for model cache management.
   */
  setContext(context: vscode.ExtensionContext): void {
    this.context = context;
    // Initialize model managers
    void this.initializeModelManagers();
  }

  /**
   * Initializes the model cache and download managers.
   */
  private async initializeModelManagers(): Promise<void> {
    if (!this.context) return;

    try {
      this.cacheManager = await createCacheManager(this.context);
      this.downloadManager = createDownloadManager(this.cacheManager);
      this.systemCapabilities = await detectSystem();

      // Load selected model from settings
      const config = vscode.workspace.getConfiguration('docdocs');
      this.selectedModelId = config.get('ml.model', null);
    } catch (error) {
      console.error('Failed to initialize model managers:', error);
    }
  }

  /**
   * Shows the dashboard panel. Creates it if it doesn't exist.
   */
  show(): void {
    if (this.panel) {
      this.panel.reveal();
    } else {
      this.panel = this.createPanel();
    }
  }

  /**
   * Updates configuration and notifies the webview.
   */
  updateConfig(config: DocDocsConfig): void {
    this.config = config;
    this.postMessage({ type: 'config:update', payload: config });
  }

  /**
   * Updates freshness data and notifies the webview.
   */
  updateFreshness(freshness: FreshnessMap): void {
    this.freshness = freshness;
    this.postMessage({ type: 'freshness:update', payload: freshness });
  }

  /**
   * Updates coverage report and notifies the webview.
   */
  updateCoverage(coverage: CoverageReport): void {
    this.coverage = coverage;
    this.postMessage({ type: 'coverage:update', payload: coverage });
  }

  /**
   * Updates recent docs list and notifies the webview.
   */
  updateRecentDocs(docs: RecentDoc[]): void {
    this.recentDocs = docs;
    this.postMessage({ type: 'recentDocs:update', payload: docs });
  }

  /**
   * Updates snapshots list and notifies the webview.
   */
  updateSnapshots(snapshots: Snapshot[]): void {
    this.snapshots = snapshots;
    this.postMessage({ type: 'snapshots:update', payload: snapshots });
  }

  /**
   * Updates watch mode state and notifies the webview.
   */
  updateWatchMode(enabled: boolean, files: string[]): void {
    this.watchMode = { enabled, files };
    this.postMessage({ type: 'watchMode:update', payload: this.watchMode });
  }

  /**
   * Sends generation progress to the webview.
   */
  updateGenerationProgress(progress: GenerationProgress): void {
    this.postMessage({ type: 'generation:progress', payload: progress });
  }

  /**
   * Sends generation complete notification to the webview.
   */
  notifyGenerationComplete(files: string[], errors: Array<{ file: string; error: string }>, duration: number): void {
    this.postMessage({
      type: 'generation:complete',
      payload: { files, errors, duration },
    });
  }

  /**
   * Disposes the dashboard panel.
   */
  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  /**
   * Posts a message to the webview.
   */
  private postMessage(message: ToWebview): void {
    this.panel?.webview.postMessage(message);
  }

  /**
   * Creates the dashboard panel.
   */
  private createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      'DocDocs Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        ],
      }
    );

    panel.webview.html = this.getHtml(panel.webview);

    panel.onDidDispose(() => {
      this.panel = undefined;
    });

    panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));

    // Listen for theme changes
    vscode.window.onDidChangeActiveColorTheme((theme) => {
      const kind =
        theme.kind === vscode.ColorThemeKind.Light
          ? 'light'
          : theme.kind === vscode.ColorThemeKind.HighContrast ||
              theme.kind === vscode.ColorThemeKind.HighContrastLight
            ? 'high-contrast'
            : 'dark';
      this.postMessage({ type: 'theme:update', payload: { kind } });
    });

    return panel;
  }

  /**
   * Handles messages from the webview.
   */
  private async handleMessage(message: ToExtension): Promise<void> {
    switch (message.type) {
      case 'ready':
      case 'request:initialData':
        await this.sendInitialData();
        break;

      case 'command:run':
        await vscode.commands.executeCommand(
          message.payload.command,
          ...(message.payload.args ?? [])
        );
        break;

      case 'file:open':
        const uri = vscode.Uri.file(message.payload.path);
        await vscode.window.showTextDocument(uri);
        break;

      case 'config:save':
        await this.saveConfig(message.payload);
        break;

      case 'snapshot:create':
        await vscode.commands.executeCommand(
          'docdocs.createSnapshot',
          message.payload.name
        );
        break;

      case 'snapshot:compare':
        await vscode.commands.executeCommand(
          'docdocs.compareSnapshots',
          message.payload.fromId,
          message.payload.toId
        );
        break;

      case 'generation:start':
        await vscode.commands.executeCommand(
          'docdocs.generateWorkspace',
          message.payload
        );
        break;

      case 'generation:cancel':
        await vscode.commands.executeCommand('docdocs.cancelGeneration');
        break;

      // Model management messages
      case 'models:requestState':
        await this.sendModelState();
        break;

      case 'models:reportWebGPU':
        if (this.systemCapabilities) {
          this.systemCapabilities = mergeWebGPUCapabilities(
            this.systemCapabilities,
            message.payload
          );
          await this.sendModelState();
        }
        break;

      case 'model:download':
        await this.handleModelDownload(message.payload.modelId);
        break;

      case 'model:download:cancel':
        this.downloadManager?.cancel(message.payload.modelId);
        break;

      case 'model:delete':
        await this.handleModelDelete(message.payload.modelId);
        break;

      case 'model:select':
        await this.handleModelSelect(message.payload.modelId);
        break;
    }
  }

  /**
   * Handles model download request.
   */
  private async handleModelDownload(modelId: string): Promise<void> {
    if (!this.downloadManager || !this.cacheManager) {
      this.postMessage({
        type: 'model:download:error',
        payload: { modelId, error: 'Model manager not initialized' },
      });
      return;
    }

    // Notify download starting
    this.postMessage({
      type: 'model:download:start',
      payload: { modelId },
    });

    try {
      const path = await this.downloadManager.download(modelId, (progress) => {
        this.postMessage({
          type: 'model:download:progress',
          payload: progress,
        });
      });

      this.postMessage({
        type: 'model:download:complete',
        payload: { modelId, path },
      });

      // Refresh state
      await this.sendModelState();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      this.postMessage({
        type: 'model:download:error',
        payload: { modelId, error: errorMessage },
      });
    }
  }

  /**
   * Handles model deletion request.
   */
  private async handleModelDelete(modelId: string): Promise<void> {
    if (!this.cacheManager) return;

    try {
      await this.cacheManager.delete(modelId);

      // If the deleted model was selected, clear selection
      if (this.selectedModelId === modelId) {
        this.selectedModelId = null;
        const config = vscode.workspace.getConfiguration('docdocs');
        await config.update('ml.model', '', vscode.ConfigurationTarget.Workspace);
      }

      await this.sendModelState();
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  }

  /**
   * Handles model selection.
   */
  private async handleModelSelect(modelId: string): Promise<void> {
    this.selectedModelId = modelId;

    // Save to settings
    const config = vscode.workspace.getConfiguration('docdocs');
    await config.update('ml.model', modelId, vscode.ConfigurationTarget.Workspace);
    await config.update('ml.enabled', true, vscode.ConfigurationTarget.Workspace);

    this.postMessage({
      type: 'model:selected',
      payload: { modelId },
    });

    // Refresh config
    this.config = this.getDefaultConfig();
    this.postMessage({ type: 'config:update', payload: this.config });
  }

  /**
   * Gets the current model manager state.
   */
  private async getModelState(): Promise<ModelManagerState> {
    const cached = this.cacheManager ? await this.cacheManager.listCached() : [];
    const cacheStats = this.cacheManager ? await this.cacheManager.getCacheStats() : { totalSizeBytes: 0 };
    const recommendations = this.systemCapabilities
      ? recommendModels(MODEL_REGISTRY, this.systemCapabilities)
      : [];
    const cacheLimit = this.systemCapabilities
      ? suggestCacheLimit(this.systemCapabilities)
      : 5 * 1024 * 1024 * 1024;

    return {
      registry: [...MODEL_REGISTRY] as ModelInfo[],
      cached: cached as CachedModelInfo[],
      recommendations: recommendations as ModelRecommendation[],
      system: this.systemCapabilities,
      selectedModelId: this.selectedModelId,
      downloads: {},
      cacheSize: cacheStats.totalSizeBytes,
      cacheLimit,
    };
  }

  /**
   * Sends model state to the webview.
   */
  private async sendModelState(): Promise<void> {
    const state = await this.getModelState();
    this.postMessage({ type: 'models:state', payload: state });
  }

  /**
   * Sends initial data bundle to the webview.
   */
  private async sendInitialData(): Promise<void> {
    const themeKind = vscode.window.activeColorTheme.kind;
    const theme =
      themeKind === vscode.ColorThemeKind.Light
        ? 'light'
        : themeKind === vscode.ColorThemeKind.HighContrast ||
            themeKind === vscode.ColorThemeKind.HighContrastLight
          ? 'high-contrast'
          : 'dark';

    const modelState = await this.getModelState();

    const initialData: InitialData = {
      config: this.config ?? this.getDefaultConfig(),
      freshness: this.freshness,
      freshnessHistory: this.freshnessHistory,
      coverage: this.coverage ?? this.getDefaultCoverage(),
      recentDocs: this.recentDocs,
      snapshots: this.snapshots,
      watchMode: this.watchMode,
      theme: { kind: theme },
      models: modelState,
    };

    this.postMessage({ type: 'initialData', payload: initialData });
  }

  /**
   * Saves configuration to VS Code settings.
   */
  private async saveConfig(partial: Partial<DocDocsConfig>): Promise<void> {
    const config = vscode.workspace.getConfiguration('docdocs');

    for (const [section, values] of Object.entries(partial)) {
      if (values && typeof values === 'object') {
        for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
          await config.update(`${section}.${key}`, value, vscode.ConfigurationTarget.Workspace);
        }
      }
    }

    // Refresh config and notify webview
    this.config = this.getDefaultConfig();
    this.postMessage({ type: 'config:update', payload: this.config });
  }

  /**
   * Gets the default configuration from VS Code settings.
   */
  private getDefaultConfig(): DocDocsConfig {
    const config = vscode.workspace.getConfiguration('docdocs');
    return {
      output: {
        directory: config.get('output.directory', '.docdocs'),
        formats: config.get('output.formats', ['markdown', 'ai-context']),
      },
      ml: {
        enabled: config.get('ml.enabled', false),
        model: config.get('ml.model', 'HuggingFaceTB/SmolLM2-360M-Instruct'),
      },
      codeLens: {
        enabled: config.get('codeLens.enabled', true),
      },
      statusBar: {
        enabled: config.get('statusBar.enabled', true),
        freshnessThreshold: config.get('statusBar.freshnessThreshold', 80),
      },
      watch: {
        enabled: config.get('watch.enabled', false),
        debounceMs: config.get('watch.debounceMs', 1000),
      },
      extraction: {
        treeSitterFallback: config.get('extraction.treeSitterFallback', true),
        timeout: config.get('extraction.timeout', 5000),
      },
    };
  }

  /**
   * Gets the default coverage report.
   */
  private getDefaultCoverage(): CoverageReport {
    return {
      overall: {
        totalFiles: 0,
        coveredFiles: 0,
        totalSymbols: 0,
        documentedSymbols: 0,
        coverage: 0,
      },
      byFile: [],
      byModule: {},
    };
  }

  /**
   * Generates the HTML content for the webview.
   */
  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'dashboard', 'dashboard.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'style.css')
    );

    // CSP with nonce for secure script loading
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>DocDocs Dashboard</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

// ============================================================
// Onboarding Provider
// ============================================================

/**
 * Manages the onboarding wizard webview panel.
 */
export class OnboardingProvider {
  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /**
   * Shows the onboarding wizard panel.
   */
  show(): void {
    if (this.panel) {
      this.panel.reveal();
    } else {
      this.panel = this.createPanel();
    }
  }

  /**
   * Disposes the onboarding panel.
   */
  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  /**
   * Creates the onboarding panel.
   */
  private createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'docdocs.onboarding',
      'DocDocs Setup Wizard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        ],
      }
    );

    panel.webview.html = this.getHtml(panel.webview);

    panel.onDidDispose(() => {
      this.panel = undefined;
    });

    panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));

    return panel;
  }

  /**
   * Handles messages from the webview.
   */
  private async handleMessage(message: ToExtension): Promise<void> {
    switch (message.type) {
      case 'command:run':
        await vscode.commands.executeCommand(
          message.payload.command,
          ...(message.payload.args ?? [])
        );
        // Close onboarding when opening dashboard
        if (message.payload.command === 'docdocs.openDashboard') {
          this.dispose();
        }
        break;

      case 'config:save':
        await this.saveConfig(message.payload);
        break;
    }
  }

  /**
   * Saves configuration to VS Code settings.
   */
  private async saveConfig(partial: Partial<DocDocsConfig>): Promise<void> {
    const config = vscode.workspace.getConfiguration('docdocs');

    for (const [section, values] of Object.entries(partial)) {
      if (values && typeof values === 'object') {
        for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
          await config.update(`${section}.${key}`, value, vscode.ConfigurationTarget.Workspace);
        }
      }
    }
  }

  /**
   * Generates the HTML content for the webview.
   */
  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'onboarding', 'onboarding.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'style.css')
    );

    // CSP with nonce for secure script loading
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>DocDocs Setup Wizard</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

// ============================================================
// Utilities
// ============================================================

/**
 * Generates a random nonce for CSP.
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers the dashboard panel provider.
 */
export function registerDashboardProvider(
  context: vscode.ExtensionContext
): DashboardProvider {
  const provider = new DashboardProvider(context.extensionUri);
  provider.setContext(context);

  // Register the open dashboard command
  context.subscriptions.push(
    vscode.commands.registerCommand('docdocs.openDashboard', () => {
      provider.show();
    })
  );

  context.subscriptions.push({ dispose: () => provider.dispose() });

  return provider;
}

/**
 * Registers the onboarding wizard provider.
 */
export function registerOnboardingProvider(
  context: vscode.ExtensionContext
): OnboardingProvider {
  const provider = new OnboardingProvider(context.extensionUri);

  // Register the open onboarding command
  context.subscriptions.push(
    vscode.commands.registerCommand('docdocs.openOnboarding', () => {
      provider.show();
    })
  );

  // Check if this is first run
  const hasRunBefore = context.globalState.get<boolean>('docdocs.hasRunBefore', false);
  if (!hasRunBefore) {
    // Show onboarding on first run
    provider.show();
    context.globalState.update('docdocs.hasRunBefore', true);
  }

  context.subscriptions.push({ dispose: () => provider.dispose() });

  return provider;
}
