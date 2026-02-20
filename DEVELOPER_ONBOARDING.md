# Developer Onboarding Guide for docDocs

Welcome to the docDocs codebase! This document provides practical guidance for understanding and contributing to this VS Code extension.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Entry Points](#key-entry-points)
3. [Data Flow Patterns](#data-flow-patterns)
4. [Known Issues & Pitfalls](#known-issues--pitfalls)
5. [Development Workflow](#development-workflow)
6. [Debugging Tips](#debugging-tips)

---

## Architecture Overview

docDocs is a VS Code extension for universal documentation generation with AI capabilities. It follows a layered architecture:

```
src/
├── extension.ts          # Main entry point (activation/deactivation)
├── protocol.ts           # Message types for extension ↔ webview communication
├── types/                # Type definitions (Layer 0 - no deps)
│   ├── base.ts           # FileURI, Position, Range, Result
│   ├── config.ts         # Configuration types
│   ├── symbols.ts        # Symbol metadata
│   └── extraction.ts     # LSP extraction results
├── utils/                # Utilities (Layer 1 - only types)
│   ├── hash.ts           # Content hashing for freshness
│   ├── tokens.ts         # Token estimation for LLMs
│   └── result.ts         # Result<T, E> error handling
├── core/                 # Business logic (Layer 2)
│   ├── extractor/        # LSP + Tree-sitter symbol extraction
│   ├── schema/           # JSON Schema generation
│   ├── renderer/         # Markdown, AI context output
│   ├── changelog/        # API diff and changelog
│   ├── graph/            # Call/dependency graph analysis
│   ├── linter/           # Documentation linting
│   ├── ml/               # Model download/cache/inference
│   └── vector/           # Vector DB and semantic search
├── state/                # State management (Layer 3)
│   ├── freshness.ts      # Documentation staleness tracking
│   ├── config.ts         # .gendocs.json loading
│   └── snapshots.ts      # API snapshot management
├── commands/             # Command handlers (Layer 4)
│   ├── generate.ts       # Doc generation commands
│   ├── preview.ts        # Preview webview
│   └── lint.ts           # Linting commands
├── providers/            # VS Code providers
│   ├── codeLens.ts       # Inline doc actions
│   ├── diagnostics.ts    # Problems panel
│   └── completion.ts     # Autocompletion
├── ui/                   # UI components
│   ├── dashboardProvider.ts  # Main dashboard webview
│   ├── sidebarProvider.ts    # Sidebar panel
│   ├── docExplorer.ts        # Tree view
│   └── statusBar.ts          # Status bar item
├── webview/              # React UI (separate build)
│   ├── dashboard/        # Dashboard app
│   ├── sidebar/          # Sidebar app
│   ├── onboarding/       # Setup wizard
│   └── shared/           # Shared components, hooks, Jotai store
└── mcp/                  # MCP server (separate entry point)
    ├── server.ts         # MCP server setup
    └── tools/            # AI-accessible tools
```

### Layer Dependencies

| Layer | Can Import From |
|-------|-----------------|
| Layer 0 (types) | Nothing |
| Layer 1 (utils) | types |
| Layer 2 (core) | types, utils |
| Layer 3 (state) | types, utils, core |
| Layer 4 (commands, providers, ui) | All above |

---

## Key Entry Points

### Extension Activation
**File:** `src/extension.ts:47`

```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // 1. Restore persisted state (freshness, snapshots)
    // 2. Register all commands
    // 3. Register providers (CodeLens, Completion, Diagnostics)
    // 4. Register UI components (DocExplorer, StatusBar, Webviews)
    // 5. Set up file watchers
}
```

### Dashboard Webview
**File:** `src/ui/dashboardProvider.ts:45`

The `DashboardProvider` class manages the main React-based dashboard. Key methods:

| Method | Line | Purpose |
|--------|------|---------|
| `setContext()` | 72 | Sets extension context, triggers model manager init |
| `show()` | 100 | Creates/reveals the webview panel |
| `handleMessage()` | 231 | Processes messages from webview |
| `sendInitialData()` | 434 | Sends full state bundle on webview ready |

### MCP Server
**File:** `src/mcp/index.ts`

Standalone CLI tool (`docdocs-mcp`) for AI assistant integration. Uses stdio transport for JSON-RPC.

---

## Data Flow Patterns

### Extension ↔ Webview Communication

All messages are strongly typed in `src/protocol.ts`:

```
Extension (TypeScript)              Webview (React + Jotai)
        │                                    │
        │─── ToWebview message ─────────────>│
        │    (type: 'config:update')         │
        │                                    │
        │<─── ToExtension message ──────────│
        │    (type: 'command:run')           │
```

**ToWebview** (extension → webview): Config updates, freshness data, generation progress, model state
**ToExtension** (webview → extension): Command requests, file opens, config saves, model downloads

### State Flow

```
User Action → Command Handler → Core Logic → State Update → UI Notification
     │              │                │              │              │
     └──────────────┴────────────────┴──────────────┴──────────────┘
                    All connected via postMessage
```

---

## Known Issues & Pitfalls

### CRITICAL: Event Listener Leak
**File:** `src/ui/dashboardProvider.ts:214`

```typescript
// BUG: This listener is NOT disposed when panel closes
vscode.window.onDidChangeActiveColorTheme((theme) => {
    this.postMessage({ type: 'theme:update', payload: { kind } });
});
```

**Impact:** Memory leak - listener persists after panel disposal.

**Fix Required:** Store the disposable and add to panel's dispose handler:
```typescript
const themeDisposable = vscode.window.onDidChangeActiveColorTheme(...);
panel.onDidDispose(() => {
    themeDisposable.dispose();
    this.panel = undefined;
});
```

### CRITICAL: Race Condition in Model Init
**File:** `src/ui/dashboardProvider.ts:75`

```typescript
// BUG: Fire-and-forget async - no wait, no error surface
void this.initializeModelManagers();
```

**Impact:** Model-related commands can fail silently if called before init completes.

**Symptoms:** "Model manager not initialized" errors, silent download failures.

### WARNING: Progress Message Flooding
**File:** `src/core/ml/downloadManager.ts:332-337`

```typescript
const path = await this.downloadManager.download(modelId, (progress) => {
    this.postMessage({  // Called on EVERY chunk!
        type: 'model:download:progress',
        payload: progress,
    });
});
```

**Impact:** Hundreds of messages/second during downloads, UI jank.

**Fix Required:** Throttle progress updates (e.g., max 10/second).

### WARNING: File Watcher Without Debounce
**File:** `src/extension.ts:207-220`

```typescript
fileWatcher.onDidChange(() => {
    docExplorer.refresh();       // Called immediately on every change
    updateFreshnessStatus(statusBar);
});
```

**Impact:** Excessive refreshes on rapid file changes (e.g., git checkout).

### WARNING: Silent Error Swallowing

Multiple files use empty catch blocks:

| File | Pattern | Risk |
|------|---------|------|
| `src/core/ml/downloadManager.ts:338` | `catch { }` | Hides file size calculation errors |
| `src/core/ml/cacheManager.ts:101` | `catch { return false; }` | Hides cache verification failures |
| `src/mcp/tools/index.ts:65` | `catch { }` | Hides doc index read errors |
| `src/core/vector/db.ts` (multiple) | `catch { }` | Hides database operation errors |

---

## Development Workflow

### Build Commands

```bash
# Full build (extension + webview + MCP)
bun run build

# Watch mode
bun run watch

# Individual builds
bun run build:extension   # → dist/extension.js (CJS)
bun run build:webview     # → dist/webview/*/  (React apps)
bun run build:mcp         # → dist/mcp/index.js (ESM executable)
```

### Testing

```bash
bun run test              # Run all tests
bun run test:watch        # Watch mode
bun run test:coverage     # With coverage report
```

Test organization:
- `test/unit/` - Pure function tests
- `test/property/` - Property-based tests (fast-check)
- `test/component/` - Integration tests
- `test/smoke/` - Core feature smoke tests
- `test/fuzz/` - Robustness tests
- `test/golden/` - Snapshot tests

### Linting

```bash
bun run lint:extension
bun run lint:webview
bun run lint:mcp
```

---

## Debugging Tips

### Extension Debugging

1. Press `F5` in VS Code to launch Extension Development Host
2. Open **Output** panel → "GenDocs" channel for extension logs
3. Check `console.log('GenDocs extension activating...')` at startup

### Webview Debugging

1. In the dashboard webview: **Help → Toggle Developer Tools**
2. Or run **Developer: Open Webview Developer Tools** from command palette
3. React components are in `dist/webview/dashboard/`

### Common Debug Scenarios

**"Dashboard shows nothing"**
1. Check Output → "Log (Extension Host)" for activation errors
2. Verify `dist/webview/dashboard/dashboard.js` exists
3. Check Webview Developer Tools console

**"Notifications going crazy"**
1. Check which command is firing repeatedly
2. Look for loops in `handleMessage()` in dashboardProvider.ts
3. Check file watcher callbacks in extension.ts

**"Model download fails silently"**
1. Model managers may not be initialized (race condition)
2. Check `handleModelDownload()` at line 316
3. Add breakpoint to verify `this.downloadManager` exists

### Key Log Points

| Location | What It Shows |
|----------|---------------|
| `extension.ts:48` | "GenDocs extension activating..." |
| `extension.ts:108` | "GenDocs extension activated" |
| `dashboardProvider.ts:93` | Model manager init errors |
| `downloadManager.ts` | Download progress and errors |

---

## Quick Reference

### Main Files to Know

| Purpose | File | Key Line |
|---------|------|----------|
| Extension entry | `src/extension.ts` | `activate()` at :47 |
| Command registration | `src/commands/generate.ts` | `registerGenerateCommands()` |
| Dashboard UI | `src/ui/dashboardProvider.ts` | `DashboardProvider` class |
| Message protocol | `src/protocol.ts` | `ToWebview`, `ToExtension` types |
| React state | `src/webview/shared/store/index.ts` | Jotai atoms |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Extension manifest, commands, settings |
| `tsconfig.json` | TypeScript config (ES2022, Node16) |
| `vitest.config.ts` | Test runner config |
| `.gendocs.json` | Per-project runtime config |

### VS Code Integration Points

| Feature | File |
|---------|------|
| CodeLens | `src/providers/codeLens.ts` |
| Problems panel | `src/providers/diagnostics.ts` |
| Completion | `src/providers/completion.ts` |
| Activity bar | `src/ui/docExplorer.ts` |
| Status bar | `src/ui/statusBar.ts` |

---

## Next Steps

1. Run `bun install && bun run build` to set up the project
2. Press F5 to launch the Extension Development Host
3. Open the dashboard via command palette: "DocDocs: Open Dashboard"
4. Review the [Codebase Audit Guide](./CODEBASE_AUDIT_GUIDE.md) for patterns to fix
