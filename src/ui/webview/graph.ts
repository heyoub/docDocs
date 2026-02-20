/**
 * @fileoverview Interactive graph webview for GenDocs extension.
 * Renders dependency and call graphs with D3.js visualization.
 *
 * @module ui/webview/graph
 * @requirements 17.6, 27.5, 36.2, 36.3, 36.4, 36.5
 */

import * as vscode from 'vscode';
import type { DependencyGraph, CallGraph } from '../../types/index.js';
import { renderDependencyGraph, renderCallGraph } from '../../core/renderer/mermaid.js';

// ============================================================
// Constants
// ============================================================

/** View type for the graph panel */
const VIEW_TYPE = 'gendocs.graph';

// ============================================================
// Types
// ============================================================

type GraphType = 'dependency' | 'call';

interface GraphData {
    readonly type: GraphType;
    readonly graph: DependencyGraph | CallGraph;
    readonly mermaid: string;
}

// ============================================================
// Graph Panel Manager
// ============================================================

/**
 * Manages the interactive graph webview panel.
 */
export class GraphPanelManager {
    private panel: vscode.WebviewPanel | null = null;
    private currentData: GraphData | null = null;

    /**
     * Shows the dependency graph.
     */
    showDependencyGraph(graph: DependencyGraph): void {
        const mermaid = renderDependencyGraph(graph);
        this.currentData = { type: 'dependency', graph, mermaid };
        this.showPanel('Dependency Graph');
    }

    /**
     * Shows the call graph.
     */
    showCallGraph(graph: CallGraph): void {
        const mermaid = renderCallGraph(graph);
        this.currentData = { type: 'call', graph, mermaid };
        this.showPanel('Call Graph');
    }

    /**
     * Disposes of the graph panel.
     */
    dispose(): void {
        this.panel?.dispose();
        this.panel = null;
    }

    private showPanel(title: string): void {
        if (this.panel) {
            this.panel.reveal();
            this.panel.title = title;
        } else {
            this.panel = this.createPanel(title);
        }
        this.updateContent();
    }

    private createPanel(title: string): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            VIEW_TYPE,
            title,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        panel.onDidDispose(() => {
            this.panel = null;
        });

        panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));

        return panel;
    }

    private handleMessage(message: { command: string; node?: string }): void {
        switch (message.command) {
            case 'nodeClick':
                if (message.node) {
                    this.handleNodeClick(message.node);
                }
                break;
            case 'zoomIn':
            case 'zoomOut':
            case 'resetZoom':
                // Handled in webview
                break;
        }
    }

    private handleNodeClick(nodeId: string): void {
        // Open the file associated with the node
        const uri = vscode.Uri.file(nodeId);
        vscode.window.showTextDocument(uri, { preview: true });
    }

    private updateContent(): void {
        if (!this.panel || !this.currentData) return;
        this.panel.webview.html = this.getHtml();
    }

    private getHtml(): string {
        const mermaidCode = this.currentData?.mermaid || '';
        const hasCircular = this.hasCircularDependencies();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Graph View</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body { font-family: var(--vscode-font-family); padding: 16px; margin: 0; }
        .toolbar { margin-bottom: 16px; display: flex; gap: 8px; }
        button { padding: 4px 12px; }
        .graph-container { 
            overflow: auto; 
            border: 1px solid var(--vscode-panel-border);
            padding: 16px;
            min-height: 400px;
        }
        .warning { 
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            padding: 8px;
            margin-bottom: 16px;
        }
        .mermaid { text-align: center; }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="zoomIn()">Zoom In</button>
        <button onclick="zoomOut()">Zoom Out</button>
        <button onclick="resetZoom()">Reset</button>
    </div>
    ${hasCircular ? '<div class="warning">⚠️ Circular dependencies detected (shown in red)</div>' : ''}
    <div class="graph-container" id="graph">
        <pre class="mermaid">${escapeHtml(mermaidCode)}</pre>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let scale = 1;
        
        mermaid.initialize({ 
            startOnLoad: true,
            theme: 'dark',
            securityLevel: 'loose'
        });

        function zoomIn() { 
            scale *= 1.2;
            applyZoom();
        }
        function zoomOut() { 
            scale /= 1.2;
            applyZoom();
        }
        function resetZoom() { 
            scale = 1;
            applyZoom();
        }
        function applyZoom() {
            const container = document.querySelector('.mermaid');
            if (container) {
                container.style.transform = 'scale(' + scale + ')';
                container.style.transformOrigin = 'top center';
            }
        }

        // Handle node clicks (remove previous listener to avoid duplicates when HTML is re-set)
        if (window.__docDocsGraphClickHandler) {
            document.removeEventListener('click', window.__docDocsGraphClickHandler);
        }
        window.__docDocsGraphClickHandler = (e) => {
            const node = e.target.closest('.node');
            if (node) {
                vscode.postMessage({ command: 'nodeClick', node: node.id });
            }
        };
        document.addEventListener('click', window.__docDocsGraphClickHandler);
    </script>
</body>
</html>`;
    }

    private hasCircularDependencies(): boolean {
        if (!this.currentData || this.currentData.type !== 'dependency') {
            return false;
        }
        const graph = this.currentData.graph as DependencyGraph;
        return graph.edges.some(e => (e as import('../../types/index.js').DependencyEdge).isCircular);
    }
}

// ============================================================
// Utilities
// ============================================================

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================
// Registration
// ============================================================

/**
 * Creates and registers the graph panel manager.
 */
export function registerGraphPanel(context: vscode.ExtensionContext): GraphPanelManager {
    const manager = new GraphPanelManager();
    context.subscriptions.push({ dispose: () => manager.dispose() });
    return manager;
}
