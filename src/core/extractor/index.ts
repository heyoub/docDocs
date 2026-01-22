/**
 * @fileoverview Extraction module exports.
 * Re-exports all LSP and tree-sitter extraction functions and types.
 *
 * @module core/extractor
 */

// Core LSP extraction functions
export {
    extractSymbols,
    extractHover,
    extractReferences,
    extractCallHierarchy,
    extractIncomingCalls,
    extractOutgoingCalls,
    extractSemanticTokens,
    isLSPAvailable
} from './lsp.js';

// Extended LSP extraction functions
export {
    extractTypeDefinition,
    extractDefinition,
    extractImplementations,
    extractSignatureHelp,
    extractInlayHints
} from './lspExtended.js';

// Tree-sitter fallback extraction functions
export {
    isSupported as isTreeSitterSupported,
    loadLanguage as loadTreeSitterLanguage,
    extractSymbols as extractSymbolsTreeSitter,
    extractDocComments as extractDocCommentsTreeSitter
} from './treeSitter.js';

// Tree-sitter types
export type { DocComment } from './treeSitter.js';

// LSP Types
export type {
    HoverInfo,
    Reference,
    CallHierarchyItem,
    SemanticToken,
    SignatureInfo,
    InlayHintInfo,
    LSPError
} from './lspTypes.js';

// Export extraction functions
export {
    extractExports,
    isSymbolExported,
    getDefaultExport
} from './exports.js';

// Export extraction types
export type { ExportExtractionResult } from './exports.js';

// Helpers (for testing and advanced usage)
export {
    DEFAULT_TIMEOUT_MS,
    RETRY_TIMEOUT_MULTIPLIER,
    MAX_RETRIES,
    executeWithTimeout,
    executeWithRetry,
    convertPosition,
    convertRange,
    toVSCodePosition,
    toVSCodeRange,
    convertSymbolKind,
    generateSymbolId,
    extractDocumentation,
    extractSignature,
    getDefaultSemanticTokensLegend
} from './lspHelpers.js';
