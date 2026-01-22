/**
 * @fileoverview Analysis module exports.
 * Re-exports all analysis-related functions and types.
 *
 * @module core/analysis
 */

// Control flow analysis
export {
    extractFlowMatrix,
    compareFlowMatrices,
    analyzeDocumentFlow
} from './flow.js';

// Traceability analysis
export {
    analyzeSpecCrossRef,
    detectGaps,
    generateTraceabilityReport,
    findSpecFiles
} from './traceability.js';

// Hardening checklist
export {
    generateHardeningChecklist,
    getFailedChecks,
    getChecksBySeverity,
    formatChecklistMarkdown,
    computeValidation
} from './hardening.js';
