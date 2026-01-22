/**
 * @fileoverview Diagnostics provider for GenDocs extension.
 * Maps lint results to VS Code diagnostics in the Problems panel.
 *
 * @module providers/diagnostics
 * @requirements 26.5
 */

import * as vscode from 'vscode';
import type { FileURI, LintResult, LintResultSeverity, SourceLocation } from '../types/index.js';

// ============================================================
// Constants
// ============================================================

/** Diagnostic source identifier */
const DIAGNOSTIC_SOURCE = 'GenDocs';

/** Diagnostic collection name */
const COLLECTION_NAME = 'gendocs-lint';

// ============================================================
// Severity Mapping
// ============================================================

/**
 * Maps GenDocs lint severity to VS Code diagnostic severity.
 */
function mapSeverity(severity: LintResultSeverity): vscode.DiagnosticSeverity {
    switch (severity) {
        case 'error':
            return vscode.DiagnosticSeverity.Error;
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;
        case 'info':
            return vscode.DiagnosticSeverity.Information;
        default:
            return vscode.DiagnosticSeverity.Warning;
    }
}

// ============================================================
// Diagnostic Creation
// ============================================================

/**
 * Creates a VS Code Range from a SourceLocation.
 */
function createRange(location: SourceLocation): vscode.Range {
    return new vscode.Range(
        location.range.start.line,
        location.range.start.character,
        location.range.end.line,
        location.range.end.character
    );
}

/**
 * Creates a VS Code Diagnostic from a LintResult.
 */
function createDiagnostic(result: LintResult): vscode.Diagnostic {
    const range = createRange(result.location);
    const severity = mapSeverity(result.severity);

    const diagnostic = new vscode.Diagnostic(range, result.message, severity);
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = result.rule;

    return diagnostic;
}

// ============================================================
// Diagnostics Manager
// ============================================================

/**
 * Manages GenDocs diagnostics in VS Code's Problems panel.
 * Provides methods to update, clear, and refresh diagnostics.
 */
export class GenDocsDiagnosticsManager {
    private readonly collection: vscode.DiagnosticCollection;

    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
    }

    /**
     * Updates diagnostics for a single file.
     */
    updateFile(uri: FileURI, results: readonly LintResult[]): void {
        const vsUri = vscode.Uri.parse(uri);
        const diagnostics = results.map(createDiagnostic);
        this.collection.set(vsUri, diagnostics);
    }

    /**
     * Updates diagnostics for multiple files.
     */
    updateFiles(resultsByFile: Map<FileURI, readonly LintResult[]>): void {
        const entries: Array<[vscode.Uri, vscode.Diagnostic[]]> = [];

        for (const [uri, results] of resultsByFile) {
            const vsUri = vscode.Uri.parse(uri);
            const diagnostics = results.map(createDiagnostic);
            entries.push([vsUri, diagnostics]);
        }

        this.collection.set(entries);
    }

    /**
     * Clears diagnostics for a single file.
     */
    clearFile(uri: FileURI): void {
        const vsUri = vscode.Uri.parse(uri);
        this.collection.delete(vsUri);
    }

    /**
     * Clears all diagnostics.
     */
    clearAll(): void {
        this.collection.clear();
    }

    /**
     * Gets the number of diagnostics for a file.
     */
    getCount(uri: FileURI): number {
        const vsUri = vscode.Uri.parse(uri);
        const diagnostics = this.collection.get(vsUri);
        return diagnostics?.length ?? 0;
    }

    /**
     * Disposes of the diagnostic collection.
     */
    dispose(): void {
        this.collection.dispose();
    }
}

// ============================================================
// Registration
// ============================================================

/**
 * Creates and registers the diagnostics manager.
 * Returns the manager instance for external updates.
 */
export function registerDiagnosticsManager(
    context: vscode.ExtensionContext
): GenDocsDiagnosticsManager {
    const manager = new GenDocsDiagnosticsManager();
    context.subscriptions.push(manager);
    return manager;
}
