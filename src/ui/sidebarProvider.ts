/**
 * @fileoverview Sidebar webview provider for DocDocs extension.
 * Renders the React-based sidebar panel in the activity bar.
 *
 * @module ui/sidebarProvider
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
} from '../protocol.js';

// ============================================================
// Constants
// ============================================================

/** View ID for the sidebar (must match package.json) */
const VIEW_ID = 'docdocs.sidebar';

// ============================================================
// Sidebar Provider
// ============================================================

/**
 * Provides the sidebar webview for the DocDocs activity bar.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private extensionUri: vscode.Uri;

  // State that can be updated and pushed to webview
  private config: DocDocsConfig | null = null;
  private freshness: FreshnessMap = {};
  private freshnessHistory: FreshnessHistory = [];
  private coverage: CoverageReport | null = null;
  private recentDocs: RecentDoc[] = [];
  private snapshots: Snapshot[] = [];
  private watchMode = { enabled: false, files: [] as string[] };

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /**
   * Called when the webview view is resolved.
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(this.handleMessage.bind(this));

    // Send initial data when webview is ready
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.sendInitialData();
      }
    });
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
   * Updates watch mode state and notifies the webview.
   */
  updateWatchMode(enabled: boolean, files: string[]): void {
    this.watchMode = { enabled, files };
    this.postMessage({ type: 'watchMode:update', payload: this.watchMode });
  }

  /**
   * Posts a message to the webview.
   */
  private postMessage(message: ToWebview): void {
    this.view?.webview.postMessage(message);
  }

  /**
   * Handles messages from the webview.
   */
  private async handleMessage(message: ToExtension): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.sendInitialData();
        break;

      case 'request:initialData':
        this.sendInitialData();
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
    }
  }

  /**
   * Sends initial data bundle to the webview.
   */
  private sendInitialData(): void {
    const themeKind = vscode.window.activeColorTheme.kind;
    const theme =
      themeKind === vscode.ColorThemeKind.Light
        ? 'light'
        : themeKind === vscode.ColorThemeKind.HighContrast ||
            themeKind === vscode.ColorThemeKind.HighContrastLight
          ? 'high-contrast'
          : 'dark';

    const initialData: InitialData = {
      config: this.config ?? this.getDefaultConfig(),
      freshness: this.freshness,
      freshnessHistory: this.freshnessHistory,
      coverage: this.coverage ?? this.getDefaultCoverage(),
      recentDocs: this.recentDocs,
      snapshots: this.snapshots,
      watchMode: this.watchMode,
      theme: { kind: theme },
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
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'sidebar', 'sidebar.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'style.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>DocDocs</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
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
 * Registers the sidebar webview provider.
 */
export function registerSidebarProvider(
  context: vscode.ExtensionContext
): SidebarProvider {
  const provider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  return provider;
}
