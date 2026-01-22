/**
 * @fileoverview Doc Explorer tree view for GenDocs extension.
 * Displays documented modules organized by directory with freshness status.
 *
 * @module ui/docExplorer
 * @requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import * as vscode from 'vscode';
import type { FileURI, ModuleSchema } from '../types/index.js';
import { checkFreshness, type FreshnessStatus } from '../state/freshness.js';

// ============================================================
// Constants
// ============================================================

/** View ID for the Doc Explorer */
const VIEW_ID = 'gendocs.docExplorer';

// ============================================================
// Types
// ============================================================

/**
 * Tree item representing a module or folder in the Doc Explorer.
 */
type DocTreeItem = ModuleItem | FolderItem | StatisticsItem;

/**
 * Represents a documented module in the tree.
 */
interface ModuleItem {
    readonly type: 'module';
    readonly uri: FileURI;
    readonly name: string;
    readonly path: string;
    readonly schema: ModuleSchema;
    readonly freshness: FreshnessStatus;
}

/**
 * Represents a folder containing modules.
 */
interface FolderItem {
    readonly type: 'folder';
    readonly name: string;
    readonly path: string;
    readonly children: readonly DocTreeItem[];
}

/**
 * Represents aggregate statistics.
 */
interface StatisticsItem {
    readonly type: 'statistics';
    readonly totalModules: number;
    readonly freshCount: number;
    readonly staleCount: number;
    readonly orphanedCount: number;
}

// ============================================================
// Filter State
// ============================================================

type FilterMode = 'all' | 'fresh' | 'stale' | 'orphaned';

let currentFilter: FilterMode = 'all';

/**
 * Sets the current filter mode.
 * @param mode - The filter mode to apply ('all', 'fresh', 'stale', or 'orphaned')
 * @returns void
 */
export function setFilter(mode: FilterMode): void {
    currentFilter = mode;
}

// ============================================================
// Data Store
// ============================================================

/** Cached module schemas */
const moduleSchemas = new Map<FileURI, ModuleSchema>();

/**
 * Updates the module cache with new schema data.
 * @param uri - The file URI identifying the module
 * @param schema - The module schema to cache
 * @returns void
 */
export function updateModuleSchema(uri: FileURI, schema: ModuleSchema): void {
    moduleSchemas.set(uri, schema);
}

/**
 * Removes a module from the cache.
 * @param uri - The file URI of the module to remove
 * @returns void
 */
export function removeModuleSchema(uri: FileURI): void {
    moduleSchemas.delete(uri);
}

/**
 * Clears all cached schemas.
 * @returns void
 */
export function clearModuleSchemas(): void {
    moduleSchemas.clear();
}

// ============================================================
// Tree Building
// ============================================================

/**
 * Builds the tree structure from cached modules.
 * @returns Array of tree items representing the documentation structure
 */
function buildTree(): DocTreeItem[] {
    const items: DocTreeItem[] = [];
    // Use mutable arrays during construction, convert to readonly when creating FolderItem
    const folderChildren = new Map<string, DocTreeItem[]>();
    const folderMeta = new Map<string, { name: string; path: string }>();

    // Build module items with freshness
    for (const [uri, schema] of moduleSchemas) {
        const freshness = checkFreshness(uri);

        // Apply filter
        if (currentFilter !== 'all' && freshness.status !== currentFilter) {
            continue;
        }

        const moduleItem: ModuleItem = {
            type: 'module',
            uri,
            name: getFileName(schema.path),
            path: schema.path,
            schema,
            freshness,
        };

        // Get or create parent folder
        const folderPath = getParentPath(schema.path);
        if (folderPath) {
            let children = folderChildren.get(folderPath);
            if (!children) {
                children = [];
                folderChildren.set(folderPath, children);
                folderMeta.set(folderPath, {
                    name: getFileName(folderPath),
                    path: folderPath,
                });
            }
            children.push(moduleItem);
        } else {
            items.push(moduleItem);
        }
    }

    // Create immutable folder items and add to items
    for (const [folderPath, children] of folderChildren) {
        const meta = folderMeta.get(folderPath)!;
        const folder: FolderItem = {
            type: 'folder',
            name: meta.name,
            path: meta.path,
            children: children,
        };
        items.push(folder);
    }

    // Add statistics item at the top
    const stats = calculateStatistics();
    items.unshift(stats);

    return items;
}

/**
 * Calculates aggregate statistics.
 */
function calculateStatistics(): StatisticsItem {
    let freshCount = 0;
    let staleCount = 0;
    let orphanedCount = 0;

    for (const uri of moduleSchemas.keys()) {
        const status = checkFreshness(uri);
        switch (status.status) {
            case 'fresh':
                freshCount++;
                break;
            case 'stale':
                staleCount++;
                break;
            case 'orphaned':
                orphanedCount++;
                break;
        }
    }

    return {
        type: 'statistics',
        totalModules: moduleSchemas.size,
        freshCount,
        staleCount,
        orphanedCount,
    };
}

// ============================================================
// Path Utilities
// ============================================================

function getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
}

function getParentPath(path: string): string | null {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash > 0 ? path.substring(0, lastSlash) : null;
}

// ============================================================
// Tree Data Provider
// ============================================================

/**
 * Tree data provider for the Doc Explorer view.
 * Shows documented modules with freshness status icons.
 */
export class DocExplorerProvider implements vscode.TreeDataProvider<DocTreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<DocTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /**
     * Refreshes the tree view.
     * @returns void
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Gets tree item representation for display.
     * @param element - The tree item to convert
     * @returns The VS Code TreeItem representation
     */
    getTreeItem(element: DocTreeItem): vscode.TreeItem {
        switch (element.type) {
            case 'module':
                return this.createModuleTreeItem(element);
            case 'folder':
                return this.createFolderTreeItem(element);
            case 'statistics':
                return this.createStatisticsTreeItem(element);
        }
    }

    /**
     * Gets children of a tree element.
     * @param element - The parent element, or undefined for root
     * @returns Array of child tree items
     */
    getChildren(element?: DocTreeItem): DocTreeItem[] {
        if (!element) {
            return buildTree();
        }
        if (element.type === 'folder') {
            return [...element.children];
        }
        return [];
    }

    private createModuleTreeItem(item: ModuleItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(item.name, vscode.TreeItemCollapsibleState.None);
        treeItem.description = item.path;
        treeItem.iconPath = this.getFreshnessIcon(item.freshness.status);
        treeItem.tooltip = `${item.name} - ${item.freshness.status}`;
        treeItem.command = {
            command: 'gendocs.openDocumentation',
            title: 'Open Documentation',
            arguments: [item.uri],
        };
        return treeItem;
    }

    private createFolderTreeItem(item: FolderItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(item.name, vscode.TreeItemCollapsibleState.Expanded);
        treeItem.iconPath = new vscode.ThemeIcon('folder');
        return treeItem;
    }

    private createStatisticsTreeItem(item: StatisticsItem): vscode.TreeItem {
        const label = `📊 ${item.freshCount}/${item.totalModules} fresh`;
        const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = `Fresh: ${item.freshCount}, Stale: ${item.staleCount}, Orphaned: ${item.orphanedCount}`;
        return treeItem;
    }

    private getFreshnessIcon(status: string): vscode.ThemeIcon {
        switch (status) {
            case 'fresh':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            case 'stale':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconFailed'));
            case 'orphaned':
                return new vscode.ThemeIcon('trash', new vscode.ThemeColor('errorForeground'));
            default:
                return new vscode.ThemeIcon('question');
        }
    }

    /**
     * Disposes of the provider resources.
     * @returns void
     */
    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}

// ============================================================
// Registration
// ============================================================

/**
 * Registers the Doc Explorer tree view.
 * @param context - The VS Code extension context for subscription management
 * @returns The created DocExplorerProvider instance
 */
export function registerDocExplorer(context: vscode.ExtensionContext): DocExplorerProvider {
    const provider = new DocExplorerProvider();

    const treeView = vscode.window.createTreeView(VIEW_ID, {
        treeDataProvider: provider,
        showCollapseAll: true,
    });

    // Register filter commands
    const filterAll = vscode.commands.registerCommand('gendocs.filterAll', () => {
        setFilter('all');
        provider.refresh();
    });
    const filterFresh = vscode.commands.registerCommand('gendocs.filterFresh', () => {
        setFilter('fresh');
        provider.refresh();
    });
    const filterStale = vscode.commands.registerCommand('gendocs.filterStale', () => {
        setFilter('stale');
        provider.refresh();
    });

    context.subscriptions.push(treeView, provider, filterAll, filterFresh, filterStale);
    return provider;
}
