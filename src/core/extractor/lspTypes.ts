/**
 * @fileoverview Type definitions for LSP extraction.
 * This module defines types specific to LSP extraction results.
 * Layer 3 - imports from types/ (Layer 0).
 *
 * @module core/extractor/lspTypes
 */

import type { FileURI, Position, Range } from '../../types/base.js';
import type { SymbolKind } from '../../types/symbols.js';

// ============================================================
// Hover Types
// ============================================================

/**
 * Hover information extracted from LSP.
 */
export interface HoverInfo {
    readonly contents: string;
    readonly range: Range | null;
}

// ============================================================
// Reference Types
// ============================================================

/**
 * Reference information extracted from LSP.
 */
export interface Reference {
    readonly uri: FileURI;
    readonly range: Range;
}

// ============================================================
// Call Hierarchy Types
// ============================================================

/**
 * Call hierarchy item extracted from LSP.
 */
export interface CallHierarchyItem {
    readonly name: string;
    readonly kind: SymbolKind;
    readonly uri: FileURI;
    readonly range: Range;
    readonly selectionRange: Range;
}

// ============================================================
// Semantic Token Types
// ============================================================

/**
 * Semantic token extracted from LSP.
 */
export interface SemanticToken {
    readonly line: number;
    readonly startChar: number;
    readonly length: number;
    readonly tokenType: string;
    readonly tokenModifiers: readonly string[];
}

// ============================================================
// Signature Help Types
// ============================================================

/**
 * Parameter information from signature help.
 */
export interface ParameterInfo {
    readonly label: string;
    readonly documentation: string | null;
}

/**
 * Signature information from signature help.
 */
export interface SignatureInfoItem {
    readonly label: string;
    readonly documentation: string | null;
    readonly parameters: readonly ParameterInfo[];
}

/**
 * Signature help information extracted from LSP.
 */
export interface SignatureInfo {
    readonly signatures: readonly SignatureInfoItem[];
    readonly activeSignature: number;
    readonly activeParameter: number;
}

// ============================================================
// Inlay Hint Types
// ============================================================

/**
 * Inlay hint kind.
 */
export type InlayHintKind = 'type' | 'parameter' | 'other';

/**
 * Inlay hint information extracted from LSP.
 */
export interface InlayHintInfo {
    readonly position: Position;
    readonly label: string;
    readonly kind: InlayHintKind;
}

// ============================================================
// Error Types
// ============================================================

/**
 * Error types for LSP operations.
 */
export type LSPError =
    | { readonly type: 'timeout'; readonly message: string }
    | { readonly type: 'unavailable'; readonly message: string }
    | { readonly type: 'unknown'; readonly message: string };
