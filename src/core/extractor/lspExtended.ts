/**
 * @fileoverview Extended LSP extraction functions for docDocs extension.
 * This module provides additional LSP extraction capabilities beyond core symbols.
 * Layer 3 - imports from types/ (Layer 0) and uses VS Code API.
 *
 * @module core/extractor/lspExtended
 */

import * as vscode from 'vscode';
import type { FileURI, Position, Range, AsyncResult } from '../../types/base.js';
import type {
    Reference,
    SignatureInfo,
    InlayHintInfo,
    LSPError
} from './lspTypes.js';
import {
    executeWithRetry,
    convertPosition,
    convertRange,
    toVSCodePosition,
    toVSCodeRange
} from './lspHelpers.js';

// ============================================================
// Type Definition Extraction
// ============================================================

/**
 * Extracts type definition location for a symbol at a specific position.
 * Uses vscode.executeTypeDefinitionProvider to resolve type definitions.
 *
 * @param uri - The URI of the document
 * @param pos - The position of the symbol
 * @returns Type definition location, `null` when none exists, or {@link LSPError}
 */
export async function extractTypeDefinition(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<Reference | null, LSPError> {
    const locationsResult = await executeWithRetry<vscode.Location[]>(
        'vscode.executeTypeDefinitionProvider',
        [uri, toVSCodePosition(pos)],
        undefined,
        'allow'
    );

    if (!locationsResult.ok) {
        return locationsResult;
    }

    const loc = locationsResult.value?.[0];
    if (!loc) {
        return { ok: true, value: null };
    }

    return {
        ok: true,
        value: { uri: loc.uri.toString() as FileURI, range: convertRange(loc.range) }
    };
}

/**
 * Extracts definition location for a symbol at a specific position.
 * Uses vscode.executeDefinitionProvider to find definitions.
 *
 * @param uri - The URI of the document
 * @param pos - The position of the symbol
 * @returns Definition location, `null` when none exists, or {@link LSPError}
 */
export async function extractDefinition(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<Reference | null, LSPError> {
    const locationsResult = await executeWithRetry<vscode.Location[]>(
        'vscode.executeDefinitionProvider',
        [uri, toVSCodePosition(pos)],
        undefined,
        'allow'
    );

    if (!locationsResult.ok) {
        return locationsResult;
    }

    const loc = locationsResult.value?.[0];
    if (!loc) {
        return { ok: true, value: null };
    }

    return {
        ok: true,
        value: { uri: loc.uri.toString() as FileURI, range: convertRange(loc.range) }
    };
}

/**
 * Extracts implementation locations for an interface/abstract symbol.
 * Uses vscode.executeImplementationProvider to find implementations.
 *
 * @param uri - The URI of the document
 * @param pos - The position of the symbol
 * @returns Implementation locations, empty array when none exist, or {@link LSPError}
 */
export async function extractImplementations(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<readonly Reference[], LSPError> {
    const locationsResult = await executeWithRetry<vscode.Location[]>(
        'vscode.executeImplementationProvider',
        [uri, toVSCodePosition(pos)]
    );

    if (!locationsResult.ok) {
        return locationsResult;
    }

    const references: Reference[] = locationsResult.value.map(loc => ({
        uri: loc.uri.toString() as FileURI,
        range: convertRange(loc.range)
    }));

    return { ok: true, value: references };
}

// ============================================================
// Signature Help Extraction
// ============================================================

/**
 * Extracts signature help at a specific position.
 * Uses vscode.executeSignatureHelpProvider to get parameter info.
 *
 * @param uri - The URI of the document
 * @param pos - The position within a function call
 * @returns Signature help, `null` when none exists, or {@link LSPError}
 */
export async function extractSignatureHelp(
    uri: vscode.Uri,
    pos: Position
): AsyncResult<SignatureInfo | null, LSPError> {
    const helpResult = await executeWithRetry<vscode.SignatureHelp>(
        'vscode.executeSignatureHelpProvider',
        [uri, toVSCodePosition(pos)],
        undefined,
        'allow'
    );

    if (!helpResult.ok) {
        return helpResult;
    }

    const help = helpResult.value;
    if (!help || help.signatures.length === 0) {
        return { ok: true, value: null };
    }

    const signatures = help.signatures.map((sig: vscode.SignatureInformation) => ({
        label: sig.label,
        documentation: typeof sig.documentation === 'string'
            ? sig.documentation
            : sig.documentation?.value ?? null,
        parameters: sig.parameters.map((param: vscode.ParameterInformation) => ({
            label: typeof param.label === 'string'
                ? param.label
                : sig.label.slice(param.label[0], param.label[1]),
            documentation: typeof param.documentation === 'string'
                ? param.documentation
                : param.documentation?.value ?? null
        }))
    }));

    return {
        ok: true,
        value: {
            signatures,
            activeSignature: help.activeSignature,
            activeParameter: help.activeParameter
        }
    };
}

// ============================================================
// Inlay Hints Extraction
// ============================================================

/**
 * Extracts inlay hints for a range in a document.
 * Uses vscode.executeInlayHintProvider to get inferred types and parameter names.
 *
 * @param uri - The URI of the document
 * @param range - The range to get inlay hints for
 * @returns Inlay hints, empty array when none exist, or {@link LSPError}
 */
export async function extractInlayHints(
    uri: vscode.Uri,
    range: Range
): AsyncResult<readonly InlayHintInfo[], LSPError> {
    const hintsResult = await executeWithRetry<vscode.InlayHint[]>(
        'vscode.executeInlayHintProvider',
        [uri, toVSCodeRange(range)]
    );

    if (!hintsResult.ok) {
        return hintsResult;
    }

    const converted: InlayHintInfo[] = hintsResult.value.map((hint: vscode.InlayHint) => {
        const label = typeof hint.label === 'string'
            ? hint.label
            : hint.label.map((part: vscode.InlayHintLabelPart) => part.value).join('');

        let kind: 'type' | 'parameter' | 'other';
        switch (hint.kind) {
            case vscode.InlayHintKind.Type:
                kind = 'type';
                break;
            case vscode.InlayHintKind.Parameter:
                kind = 'parameter';
                break;
            default:
                kind = 'other';
        }

        return { position: convertPosition(hint.position), label, kind };
    });

    return { ok: true, value: converted };
}
