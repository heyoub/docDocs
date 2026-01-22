/**
 * @fileoverview Barrel file for GenDocs type definitions.
 * Re-exports all types from Layer 0 type modules.
 *
 * @module types
 */

// Base types (foundational, no dependencies)
export type {
    FileURI,
    SymbolID,
    SchemaRef,
    Position,
    Range,
    SourceLocation,
    Result,
    AsyncResult,
} from './base.js';

// Config types (no dependencies)
export type {
    OutputFormat,
    LintRule,
    LintSeverity,
    OutputConfig,
    SourceConfig,
    ValidationGateConfig,
    CustomGateConfig,
    ValidationGatesConfig,
    ConvergenceConfig,
    ValidationConfig,
    MLDevice,
    MLConfig,
    LintRulesConfig,
    CoverageConfig,
    LintConfig,
    MarkdownTemplateConfig,
    TemplatesConfig,
    WatchConfig,
    GitConfig,
    OpenAPIExportConfig,
    OpenAPIServerConfig,
    GraphQLExportConfig,
    ExportConfig,
    ExtractionConfig,
    ChangelogConfig,
    GenDocsConfig,
} from './config.js';

// Symbol types (depends on: base)
export type {
    SymbolKind,
    SymbolModifier,
    Visibility,
    SymbolBase,
} from './symbols.js';

// Graph types (depends on: base)
export type {
    GraphNode,
    GraphEdge,
    Graph,
    DependencyNode,
    DependencyEdge,
    DependencyGraph,
    CallGraphNode,
    CallGraphEdge,
    CallGraph,
    CircularDependency,
} from './graph.js';

// Lint types (depends on: base, config)
export type {
    LintResultSeverity,
    TextEdit,
    LintFix,
    LintResult,
} from './lint.js';

// Extraction types (depends on: base, symbols)
export type {
    ExtractionMethod,
    ExtractedSymbol,
    ExtractedParameter,
    ExtractedFunction,
    ImportInfo,
    ExportInfo,
    FileExtraction,
} from './extraction.js';

// Schema types (depends on: base, symbols)
export type {
    TypeKind,
    TypeSchema,
    ParameterSchema,
    DeprecationInfo,
    ExampleSchema,
    ImportSchema,
    ExportSchema,
    SymbolSchema,
    ModuleRef,
    ModuleSchema,
    WorkspaceStatistics,
    WorkspaceSchema,
    ComplexityLevel,
    FlowMatrixSchema,
} from './schema.js';

// Changelog types (depends on: base, schema)
export type {
    SemverBump,
    ChangeType,
    TypeChangeDirection,
    TypeChangeAnalysis,
    ExportedSymbol,
    ModuleAPISnapshot,
    APISnapshot,
    SnapshotStatistics,
    ParameterChange,
    ReturnTypeChange,
    SymbolModification,
    APIChange,
    ModuleChange,
    APIDiff,
    DiffSummary,
    ChangelogSection,
    Changelog,
    CodeSnippet,
    BeforeAfterComparison,
    APIChangeWithCode,
} from './changelog.js';

// Analysis types (depends on: base)
export type {
    ComplexityLevel as AnalysisComplexityLevel,
    FunctionFlowMatrix,
    FlowMatrixChange,
    ImpactLevel,
    ImpactAnalysis,
    IntegrationSurface,
    SpecReference,
    SpecCrossRef,
    TraceabilityGap,
    TraceabilityReport,
    ValidationResult,
    HardeningReport,
    HardeningCheckItem,
    HardeningChecklist,
    StubType,
    DetectedStub,
    StubDetectionResult,
    DocumentationGap,
    HarshModeOutput,
} from './analysis.js';
