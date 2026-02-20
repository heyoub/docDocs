# Codebase Audit Guide

This guide provides step-by-step instructions for auditing the docDocs codebase to identify and fix runtime issues. The codebase passes linting and tests but has silent runtime failures.

## Audit Priority Order

| Priority | Category | Impact | Files Affected |
|----------|----------|--------|----------------|
| P0 | Event Listener Leaks | Memory leaks, crashes | dashboardProvider.ts |
| P0 | Race Conditions | Silent failures | dashboardProvider.ts, downloadManager.ts |
| P1 | Silent Error Swallowing | Hidden failures | 15+ files |
| P1 | Progress Throttling | UI performance | downloadManager.ts |
| P2 | File Watcher Debounce | Performance | extension.ts |
| P2 | Promise Cleanup | Resource leaks | lspHelpers.ts |

---

## Phase 1: Event Listener & Subscription Leaks

### What to Look For

- `addEventListener` without corresponding `removeEventListener`
- VS Code `on*` events not added to `context.subscriptions`
- Listeners created in repeated function calls

### Search Commands

```bash
# Find all event listeners
grep -rn "addEventListener\|onDidChange\|onDidCreate\|onDidDelete" src/

# Find VS Code subscriptions that might not be disposed
grep -rn "vscode\..*\.on" src/ | grep -v "context.subscriptions.push"

# Find orphaned listeners
grep -rn "window\.on" src/
```

### Critical Files to Review

#### 1. `src/ui/dashboardProvider.ts:214`

**Issue:** Theme change listener created without disposal

```typescript
// CURRENT (BUG)
vscode.window.onDidChangeActiveColorTheme((theme) => {
    this.postMessage({ type: 'theme:update', payload: { kind } });
});

// SHOULD BE
private themeDisposable: vscode.Disposable | undefined;

private createPanel(): vscode.WebviewPanel {
    // ...
    this.themeDisposable = vscode.window.onDidChangeActiveColorTheme((theme) => {
        // ...
    });

    panel.onDidDispose(() => {
        this.themeDisposable?.dispose();
        this.panel = undefined;
    });
}
```

#### 2. `src/ui/webview/graph.ts:196`

**Issue:** Click listener added inside HTML string, created on every render

```typescript
// Look for patterns like:
<script>
    document.addEventListener('click', (e) => { ... });
</script>
```

**Fix:** Move to React component lifecycle or use event delegation with cleanup.

### Validation Checklist

- [ ] All `onDid*` listeners have disposables pushed to `context.subscriptions`
- [ ] Panel-scoped listeners are disposed with panel
- [ ] No listeners created in render loops

---

## Phase 2: Race Conditions & Async Initialization

### What to Look For

- `void asyncFunction()` (fire-and-forget)
- State accessed before async init completes
- Missing `await` on async operations
- Check-then-act patterns without locks

### Search Commands

```bash
# Find fire-and-forget async
grep -rn "void this\." src/
grep -rn "void [a-z]" src/

# Find unguarded state access
grep -rn "if (!this\.[a-z]*)" src/
```

### Critical Files to Review

#### 1. `src/ui/dashboardProvider.ts:72-76`

**Issue:** Model managers initialized asynchronously, used immediately

```typescript
// CURRENT (BUG)
setContext(context: vscode.ExtensionContext): void {
    this.context = context;
    void this.initializeModelManagers();  // Fire and forget!
}

// Methods like handleModelDownload() can be called before managers exist
```

**Fix Options:**

Option A: Guard all manager-dependent methods
```typescript
private async handleModelDownload(modelId: string): Promise<void> {
    if (!this.downloadManager || !this.cacheManager) {
        // Wait for initialization or throw meaningful error
        await this.ensureManagersInitialized();
    }
    // ...
}
```

Option B: Defer webview until init completes
```typescript
setContext(context: vscode.ExtensionContext): void {
    this.context = context;
    this.initPromise = this.initializeModelManagers();
}

show(): void {
    await this.initPromise;  // Wait before showing
    // ...
}
```

#### 2. `src/core/ml/downloadManager.ts:73-77`

**Issue:** Check-then-act race in concurrent downloads

```typescript
// CURRENT (RACE CONDITION)
if (this.isDownloading(modelId)) {
    throw new Error(`Already downloading`);
}
// Another call could slip in here!
this.activeDownloads.set(modelId, { controller, promise });
```

**Fix:** Use atomic check-and-set
```typescript
if (this.activeDownloads.has(modelId)) {
    throw new Error(`Already downloading`);
}
const entry = { controller, promise };
this.activeDownloads.set(modelId, entry);  // Move immediately after check
```

### Validation Checklist

- [ ] All `void asyncFn()` calls have proper error handling
- [ ] State guards exist for async-initialized dependencies
- [ ] No check-then-act patterns without synchronization

---

## Phase 3: Silent Error Swallowing

### What to Look For

- Empty catch blocks: `catch { }` or `catch { /* ignore */ }`
- Catch blocks that only log without proper handling
- Swallowed errors in critical paths

### Search Commands

```bash
# Find empty catch blocks
grep -rn "catch {" src/
grep -rn "catch.*{.*}" src/ | grep -v "throw\|return err\|console"

# Find catch blocks that might need review
grep -A3 "} catch" src/
```

### Critical Files to Review

#### Priority 1: Core ML Module

| File | Line | Current | Risk |
|------|------|---------|------|
| `downloadManager.ts` | 338 | `catch { }` in getDirectorySize | File ops fail silently |
| `cacheManager.ts` | 101 | `catch { return false; }` | Cache corruption hidden |
| `cacheManager.ts` | 313 | `catch { }` | Manifest save failures hidden |

**Pattern to Fix:**
```typescript
// CURRENT (BAD)
try {
    await fs.access(entry.path);
    return true;
} catch {
    return false;  // Why? Permission? Missing? Corrupted?
}

// BETTER
try {
    await fs.access(entry.path);
    return true;
} catch (error) {
    // Node.js filesystem errors have a 'code' property.
    // We check if the error is the expected "file not found" case.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        // Expected: file doesn't exist, so it's not in the cache.
        return false;
    }
    
    // For any other error (e.g., permissions), it's unexpected and should be logged.
    console.error(`Unexpected error during cache verification for ${modelId}:`, error);
    return false;
}
```

#### Priority 2: MCP Tools

| File | Line | Issue |
|------|------|-------|
| `src/mcp/tools/index.ts` | 65 | Doc index read errors hidden |
| `src/mcp/tools/index.ts` | 290 | Tool execution errors hidden |
| `src/mcp/tools/index.ts` | 523 | Search errors hidden |

#### Priority 3: Vector Operations

| File | Line | Issue |
|------|------|-------|
| `src/core/vector/db.ts` | 75 | Table creation errors hidden |
| `src/core/vector/db.ts` | 92 | Insert errors hidden |
| `src/core/vector/db.ts` | 150 | Query errors hidden |
| `src/core/vector/db.ts` | 203 | Close errors hidden |

### Validation Checklist

- [ ] All catch blocks log or handle errors appropriately
- [ ] Critical path errors are surfaced to user
- [ ] Error types are checked before deciding to ignore

---

## Phase 4: Progress/Notification Throttling

### What to Look For

- Callbacks in tight loops without throttling
- `showInformationMessage` in rapid succession
- Unthrottled webview message posting

### Search Commands

```bash
# Find progress callbacks
grep -rn "onProgress\|progress\." src/ | grep -v "test"

# Find notification patterns
grep -rn "showInformationMessage\|showWarningMessage" src/
```

### Critical Files to Review

#### `src/core/ml/downloadManager.ts:286-295`

**Issue:** Progress callback fired on every HTTP chunk

```typescript
// CURRENT (UI FLOOD)
response.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    onProgress({
        downloadedBytes,  // Called 100s of times per second!
        // ...
    });
});
```

**Fix:** Throttle to reasonable rate
```typescript
let lastProgressTime = 0;
const PROGRESS_THROTTLE_MS = 100;  // Max 10 updates/second

response.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;

    const now = Date.now();
    if (now - lastProgressTime >= PROGRESS_THROTTLE_MS) {
        lastProgressTime = now;
        onProgress({
            downloadedBytes,
            // ...
        });
    }
});

// Also send final update when done
response.on('end', () => {
    onProgress({ downloadedBytes, /* final state */ });
});
```

### Validation Checklist

- [ ] Progress callbacks throttled to max 10-20/second
- [ ] Final progress state always sent
- [ ] No notification spam on rapid operations

---

## Phase 5: File Watcher Debouncing

### What to Look For

- File watcher callbacks that trigger heavy operations
- Missing debounce on workspace file changes
- Refresh operations without batching

### Critical Files to Review

#### `src/extension.ts:207-220`

**Issue:** File watcher triggers immediate refresh on every change

```typescript
// CURRENT (NO DEBOUNCE)
fileWatcher.onDidChange(() => {
    docExplorer.refresh();
    updateFreshnessStatus(statusBar);
});
```

**Fix:** Add debounce utility
```typescript
function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
    let timeoutId: NodeJS.Timeout | undefined;

    const debounced = (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };

    debounced.cancel = () => {
        clearTimeout(timeoutId);
    };

    return debounced;
}

const debouncedRefresh = debounce(() => {
    docExplorer.refresh();
    updateFreshnessStatus(statusBar);
}, 300);

fileWatcher.onDidChange(debouncedRefresh);
fileWatcher.onDidCreate(debouncedRefresh);
fileWatcher.onDidDelete(debouncedRefresh);
```

---

## Phase 6: Promise and Timer Cleanup

### What to Look For

- `Promise.race` without cleanup of losing promise
- `setTimeout`/`setInterval` without clear
- AbortController not properly wired

### Search Commands

```bash
# Find Promise.race usage
grep -rn "Promise\.race" src/

# Find timer usage
grep -rn "setTimeout\|setInterval" src/
```

### Critical Files to Review

#### `src/core/extractor/lspHelpers.ts:33-59`

**Issue:** Timeout timer continues after Promise.race completes

```typescript
// CURRENT (TIMER LEAK)
function createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new TimeoutError()), ms);
    });
}

const result = await Promise.race([
    vscode.commands.executeCommand(...),
    createTimeout(5000)  // Timer keeps running!
]);
```

**Fix:** Clearable timeout with AbortSignal
```typescript
function createTimeout(ms: number, signal?: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new TimeoutError()), ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new AbortError());
        });
    });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const controller = new AbortController();
    try {
        return await Promise.race([
            promise,
            createTimeout(ms, controller.signal)
        ]);
    } finally {
        controller.abort();  // Clean up timer
    }
}
```

---

## Automated Tools & Commands

### Static Analysis

```bash
# TypeScript strict checks
bun run lint:extension
bun run lint:webview
bun run lint:mcp

# Find unused exports
npx ts-prune src/

# Check for circular dependencies
npx madge --circular src/
```

### Runtime Validation

1. Open Extension Development Host (F5)
2. Open VS Code Developer Tools (Help → Toggle Developer Tools)
3. Check Memory tab for leaks
4. Watch Console for errors during:
   - Opening/closing dashboard multiple times
   - Rapid file saves
   - Model downloads

### Test Commands

```bash
# Run all tests
bun run test

# Watch specific test file
bun run test:watch test/unit/specific.test.ts

# Coverage for core modules
bun run test:coverage -- --include="src/core/**"
```

---

## Fix Verification Checklist

For each fix:

- [ ] Issue reproducible before fix
- [ ] Root cause addressed (not just symptom)
- [ ] No new lint errors
- [ ] Existing tests pass
- [ ] New test covers the fix
- [ ] Manual verification in Extension Dev Host
- [ ] No performance regression

---

## Summary: Issues Found

### Critical (Fix Immediately)
1. **Event listener leak** in `dashboardProvider.ts:214` - theme listener not disposed
2. **Race condition** in `dashboardProvider.ts:75` - model managers used before init

### High Priority
3. **Silent errors** in `downloadManager.ts` - download failures hidden
4. **Silent errors** in `cacheManager.ts` - cache corruption hidden
5. **UI flooding** in `downloadManager.ts:332` - unthrottled progress

### Medium Priority
6. **No debounce** in `extension.ts:207` - file watcher spam
7. **Timer leak** in `lspHelpers.ts:33` - Promise.race timeout
8. **Duplicate listeners** in `graph.ts:196` - click handlers in HTML

### Low Priority
9. **Empty catch** blocks in `mcp/tools/index.ts`
10. **Empty catch** blocks in `vector/db.ts`

---

## Recommended PR Order

1. **PR 1:** Fix critical resource leaks (items 1-2)
2. **PR 2:** Fix error handling in ML module (items 3-5)
3. **PR 3:** Fix performance issues (items 6-7)
4. **PR 4:** Clean up remaining issues (items 8-10)
