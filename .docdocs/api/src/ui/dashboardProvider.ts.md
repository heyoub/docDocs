# src/ui/dashboardProvider.ts

> Generated: 2026-05-17T10:53:05.390Z

## Table of Contents

### Classs

- [DashboardProvider](#dashboardprovider) - *No description*
- [OnboardingProvider](#onboardingprovider) - *No description*

### Constructors

- [constructor](#constructor) - *No description*
- [constructor](#constructor) - *No description*

### Functions

- [panel.onDidDispose() callback](#panel-ondiddispose-callback) - *No description*
- [vscode.window.onDidChangeActiveColorTheme() callback](#vscode-window-ondidchangeactivecolortheme-callback) - *No description*
- [downloadManager.download() callback](#downloadmanager-download-callback) - *No description*
- [applyDocDocsConfigPartial](#applydocdocsconfigpartial) - *No description*
- [getNonce](#getnonce) - *No description*
- [registerDashboardProvider](#registerdashboardprovider) - *No description*
- [vscode.commands.registerCommand('docdocs.openDashboard') callback](#vscode-commands-registercommand-docdocs-opendashboard-callback) - *No description*
- [registerOnboardingProvider](#registeronboardingprovider) - *No description*
- [vscode.commands.registerCommand('docdocs.openOnboarding') callback](#vscode-commands-registercommand-docdocs-openonboarding-callback) - *No description*

### Methods

- [createPanel](#createpanel) - *No description*
- [dispose](#dispose) - *No description*
- [ensureManagersInitialized](#ensuremanagersinitialized) - *No description*
- [getDefaultConfig](#getdefaultconfig) - *No description*
- [getDefaultCoverage](#getdefaultcoverage) - *No description*
- [getHtml](#gethtml) - *No description*
- [getModelState](#getmodelstate) - *No description*
- [handleMessage](#handlemessage) - *No description*
- [handleModelDelete](#handlemodeldelete) - *No description*
- [handleModelDownload](#handlemodeldownload) - *No description*
- [handleModelSelect](#handlemodelselect) - *No description*
- [initializeModelManagers](#initializemodelmanagers) - *No description*
- [notifyGenerationComplete](#notifygenerationcomplete) - *No description*
- [postMessage](#postmessage) - *No description*
- [refreshConfigAndOpenRouterState](#refreshconfigandopenrouterstate) - *No description*
- [saveConfig](#saveconfig) - *No description*
- [sendInitialData](#sendinitialdata) - *No description*
- [sendModelState](#sendmodelstate) - *No description*
- [sendOpenRouterState](#sendopenrouterstate) - *No description*
- [setContext](#setcontext) - *No description*
- [show](#show) - *No description*
- [updateConfig](#updateconfig) - *No description*
- [updateCoverage](#updatecoverage) - *No description*
- [updateFreshness](#updatefreshness) - *No description*
- [updateGenerationProgress](#updategenerationprogress) - *No description*
- [updateRecentDocs](#updaterecentdocs) - *No description*
- [updateSnapshots](#updatesnapshots) - *No description*
- [updateWatchMode](#updatewatchmode) - *No description*
- [createPanel](#createpanel) - *No description*
- [dispose](#dispose) - *No description*
- [getHtml](#gethtml) - *No description*
- [handleMessage](#handlemessage) - *No description*
- [markOnboardingComplete](#markonboardingcomplete) - *No description*
- [saveConfig](#saveconfig) - *No description*
- [setContext](#setcontext) - *No description*
- [show](#show) - *No description*
- [dispose](#dispose) - *No description*
- [dispose](#dispose) - *No description*

### Propertys

- [cacheManager](#cachemanager) - *No description*
- [config](#config) - *No description*
- [context](#context) - *No description*
- [coverage](#coverage) - *No description*
- [enableScripts](#enablescripts) - *No description*
- [localResourceRoots](#localresourceroots) - *No description*
- [retainContextWhenHidden](#retaincontextwhenhidden) - *No description*
- [payload](#payload) - *No description*
- [kind](#kind) - *No description*
- [type](#type) - *No description*
- [downloadManager](#downloadmanager) - *No description*
- [extensionUri](#extensionuri) - *No description*
- [freshness](#freshness) - *No description*
- [freshnessHistory](#freshnesshistory) - *No description*
- [codeLens](#codelens) - *No description*
- [enabled](#enabled) - *No description*
- [extraction](#extraction) - *No description*
- [timeout](#timeout) - *No description*
- [treeSitterFallback](#treesitterfallback) - *No description*
- [ml](#ml) - *No description*
- [enabled](#enabled) - *No description*
- [model](#model) - *No description*
- [openRouter](#openrouter) - *No description*
- [enabled](#enabled) - *No description*
- [model](#model) - *No description*
- [output](#output) - *No description*
- [directory](#directory) - *No description*
- [formats](#formats) - *No description*
- [statusBar](#statusbar) - *No description*
- [enabled](#enabled) - *No description*
- [freshnessThreshold](#freshnessthreshold) - *No description*
- [watch](#watch) - *No description*
- [debounceMs](#debouncems) - *No description*
- [enabled](#enabled) - *No description*
- [byFile](#byfile) - *No description*
- [byModule](#bymodule) - *No description*
- [overall](#overall) - *No description*
- [coverage](#coverage) - *No description*
- [coveredFiles](#coveredfiles) - *No description*
- [documentedSymbols](#documentedsymbols) - *No description*
- [totalFiles](#totalfiles) - *No description*
- [totalSymbols](#totalsymbols) - *No description*
- [cached](#cached) - *No description*
- [cacheLimit](#cachelimit) - *No description*
- [cacheSize](#cachesize) - *No description*
- [totalSizeBytes](#totalsizebytes) - *No description*
- [downloads](#downloads) - *No description*
- [recommendations](#recommendations) - *No description*
- [registry](#registry) - *No description*
- [selectedModelId](#selectedmodelid) - *No description*
- [system](#system) - *No description*
- [payload](#payload) - *No description*
- [type](#type) - *No description*
- [error](#error) - *No description*
- [modelId](#modelid) - *No description*
- [path](#path) - *No description*
- [initPromise](#initpromise) - *No description*
- [duration](#duration) - *No description*
- [errors](#errors) - *No description*
- [files](#files) - *No description*
- [panel](#panel) - *No description*
- [recentDocs](#recentdocs) - *No description*
- [selectedModelId](#selectedmodelid) - *No description*
- [config](#config) - *No description*
- [coverage](#coverage) - *No description*
- [freshness](#freshness) - *No description*
- [freshnessHistory](#freshnesshistory) - *No description*
- [models](#models) - *No description*
- [openRouter](#openrouter) - *No description*
- [hasApiKey](#hasapikey) - *No description*
- [recentDocs](#recentdocs) - *No description*
- [snapshots](#snapshots) - *No description*
- [theme](#theme) - *No description*
- [watchMode](#watchmode) - *No description*
- [hasApiKey](#hasapikey) - *No description*
- [snapshots](#snapshots) - *No description*
- [systemCapabilities](#systemcapabilities) - *No description*
- [themeDisposable](#themedisposable) - *No description*
- [files](#files) - *No description*
- [watchMode](#watchmode) - *No description*
- [context](#context) - *No description*
- [extensionUri](#extensionuri) - *No description*
- [panel](#panel) - *No description*

### Variables

- [VIEW_TYPE](#view-type) - *No description*
- [panel](#panel) - *No description*
- [kind](#kind) - *No description*
- [config](#config) - *No description*
- [nonce](#nonce) - *No description*
- [scriptUri](#scripturi) - *No description*
- [styleUri](#styleuri) - *No description*
- [cacheStats](#cachestats) - *No description*
- [cfg](#cfg) - *No description*
- [uri](#uri) - *No description*
- [error](#error) - *No description*
- [errorMessage](#errormessage) - *No description*
- [path](#path) - *No description*
- [initialData](#initialdata) - *No description*
- [modelState](#modelstate) - *No description*
- [theme](#theme) - *No description*
- [themeKind](#themekind) - *No description*
- [state](#state) - *No description*
- [config](#config) - *No description*
- [section](#section) - *No description*
- [values](#values) - *No description*
- [writeEntries](#writeentries) - *No description*
- [key](#key) - *No description*
- [value](#value) - *No description*
- [i](#i) - *No description*
- [possible](#possible) - *No description*
- [text](#text) - *No description*
- [provider](#provider) - *No description*
- [hasRunBefore](#hasrunbefore) - *No description*
- [provider](#provider) - *No description*


## Exports

| Name | Default | Type Only |
|------|---------|-----------|
| `VIEW_TYPE` | No | No |
| `DashboardProvider` | No | No |
| `OnboardingProvider` | No | No |
| `registerDashboardProvider` | No | No |
| `registerOnboardingProvider` | No | No |
| `constructor` | No | No |
| `cacheManager` | No | No |
| `config` | No | No |
| `context` | No | No |
| `coverage` | No | No |
| `createPanel` | No | No |
| `panel` | No | No |
| `enableScripts` | No | No |
| `localResourceRoots` | No | No |
| `retainContextWhenHidden` | No | No |
| `panel.onDidDispose() callback` | No | No |
| `vscode.window.onDidChangeActiveColorTheme() callback` | No | No |
| `kind` | No | No |
| `payload` | No | No |
| `type` | No | No |
| `dispose` | No | No |
| `downloadManager` | No | No |
| `ensureManagersInitialized` | No | No |
| `extensionUri` | No | No |
| `freshness` | No | No |
| `freshnessHistory` | No | No |
| `getDefaultConfig` | No | No |
| `codeLens` | No | No |
| `enabled` | No | No |
| `extraction` | No | No |
| `timeout` | No | No |
| `treeSitterFallback` | No | No |
| `ml` | No | No |
| `model` | No | No |
| `openRouter` | No | No |
| `output` | No | No |
| `directory` | No | No |
| `formats` | No | No |
| `statusBar` | No | No |
| `freshnessThreshold` | No | No |
| `watch` | No | No |
| `debounceMs` | No | No |
| `getDefaultCoverage` | No | No |
| `byFile` | No | No |
| `byModule` | No | No |
| `overall` | No | No |
| `coveredFiles` | No | No |
| `documentedSymbols` | No | No |
| `totalFiles` | No | No |
| `totalSymbols` | No | No |
| `getHtml` | No | No |
| `nonce` | No | No |
| `scriptUri` | No | No |
| `styleUri` | No | No |
| `getModelState` | No | No |
| `cached` | No | No |
| `cacheLimit` | No | No |
| `cacheSize` | No | No |
| `cacheStats` | No | No |
| `totalSizeBytes` | No | No |
| `downloads` | No | No |
| `recommendations` | No | No |
| `registry` | No | No |
| `selectedModelId` | No | No |
| `system` | No | No |
| `handleMessage` | No | No |
| `cfg` | No | No |
| `uri` | No | No |
| `handleModelDelete` | No | No |
| `error` | No | No |
| `handleModelDownload` | No | No |
| `errorMessage` | No | No |
| `path` | No | No |
| `downloadManager.download() callback` | No | No |
| `modelId` | No | No |
| `handleModelSelect` | No | No |
| `initializeModelManagers` | No | No |
| `initPromise` | No | No |
| `notifyGenerationComplete` | No | No |
| `duration` | No | No |
| `errors` | No | No |
| `files` | No | No |
| `postMessage` | No | No |
| `recentDocs` | No | No |
| `refreshConfigAndOpenRouterState` | No | No |
| `saveConfig` | No | No |
| `sendInitialData` | No | No |
| `initialData` | No | No |
| `models` | No | No |
| `hasApiKey` | No | No |
| `snapshots` | No | No |
| `theme` | No | No |
| `watchMode` | No | No |
| `modelState` | No | No |
| `themeKind` | No | No |
| `sendModelState` | No | No |
| `state` | No | No |
| `sendOpenRouterState` | No | No |
| `setContext` | No | No |
| `show` | No | No |
| `systemCapabilities` | No | No |
| `themeDisposable` | No | No |
| `updateConfig` | No | No |
| `updateCoverage` | No | No |
| `updateFreshness` | No | No |
| `updateGenerationProgress` | No | No |
| `updateRecentDocs` | No | No |
| `updateSnapshots` | No | No |
| `updateWatchMode` | No | No |
| `markOnboardingComplete` | No | No |
| `applyDocDocsConfigPartial` | No | No |
| `section` | No | No |
| `values` | No | No |
| `writeEntries` | No | No |
| `key` | No | No |
| `value` | No | No |
| `getNonce` | No | No |
| `i` | No | No |
| `possible` | No | No |
| `text` | No | No |
| `provider` | No | No |
| `vscode.commands.registerCommand('docdocs.openDashboard') callback` | No | No |
| `hasRunBefore` | No | No |
| `vscode.commands.registerCommand('docdocs.openOnboarding') callback` | No | No |

## Symbols

### VIEW_TYPE

**Kind:** `variable`

```typescript
VIEW_TYPE
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L36-36</details>

---

### DashboardProvider

**Kind:** `class`

```typescript
DashboardProvider
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L45-606</details>

---

### constructor

**Kind:** `constructor`

```typescript
constructor
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L70-72</details>

---

### cacheManager

**Kind:** `property`

```typescript
cacheManager
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L65-65</details>

---

### config

**Kind:** `property`

```typescript
config
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L56-56</details>

---

### context

**Kind:** `property`

```typescript
context
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L48-48</details>

---

### coverage

**Kind:** `property`

```typescript
coverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L59-59</details>

---

### createPanel

**Kind:** `method`

```typescript
createPanel
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L204-241</details>

---

### panel

**Kind:** `variable`

```typescript
panel
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L651-662</details>

---

### enableScripts

**Kind:** `property`

```typescript
enableScripts
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L656-656</details>

---

### localResourceRoots

**Kind:** `property`

```typescript
localResourceRoots
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L658-660</details>

---

### retainContextWhenHidden

**Kind:** `property`

```typescript
retainContextWhenHidden
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L657-657</details>

---

### panel.onDidDispose() callback

**Kind:** `function`

```typescript
panel.onDidDispose() callback
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L666-668</details>

---

### vscode.window.onDidChangeActiveColorTheme() callback

**Kind:** `function`

```typescript
vscode.window.onDidChangeActiveColorTheme() callback
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L229-238</details>

---

### kind

**Kind:** `variable`

```typescript
kind
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L230-236</details>

---

### payload

**Kind:** `property`

```typescript
payload
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L237-237</details>

---

### kind

**Kind:** `property`

```typescript
kind
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L505-505</details>

---

### type

**Kind:** `property`

```typescript
type
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L237-237</details>

---

### dispose

**Kind:** `method`

```typescript
dispose
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L187-192</details>

---

### downloadManager

**Kind:** `property`

```typescript
downloadManager
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L66-66</details>

---

### ensureManagersInitialized

**Kind:** `method`

```typescript
ensureManagersInitialized
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L180-182</details>

---

### extensionUri

**Kind:** `property`

```typescript
extensionUri
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L47-47</details>

---

### freshness

**Kind:** `property`

```typescript
freshness
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L57-57</details>

---

### freshnessHistory

**Kind:** `property`

```typescript
freshnessHistory
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L58-58</details>

---

### getDefaultConfig

**Kind:** `method`

```typescript
getDefaultConfig
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L528-559</details>

---

### codeLens

**Kind:** `property`

```typescript
codeLens
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L543-545</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L544-544</details>

---

### config

**Kind:** `variable`

```typescript
config
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L94-94</details>

---

### extraction

**Kind:** `property`

```typescript
extraction
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L554-557</details>

---

### timeout

**Kind:** `property`

```typescript
timeout
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L556-556</details>

---

### treeSitterFallback

**Kind:** `property`

```typescript
treeSitterFallback
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L555-555</details>

---

### ml

**Kind:** `property`

```typescript
ml
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L535-542</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L536-536</details>

---

### model

**Kind:** `property`

```typescript
model
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L537-537</details>

---

### openRouter

**Kind:** `property`

```typescript
openRouter
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L538-541</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L62-62</details>

---

### model

**Kind:** `property`

```typescript
model
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L540-540</details>

---

### output

**Kind:** `property`

```typescript
output
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L531-534</details>

---

### directory

**Kind:** `property`

```typescript
directory
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L532-532</details>

---

### formats

**Kind:** `property`

```typescript
formats
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L533-533</details>

---

### statusBar

**Kind:** `property`

```typescript
statusBar
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L546-549</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L547-547</details>

---

### freshnessThreshold

**Kind:** `property`

```typescript
freshnessThreshold
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L548-548</details>

---

### watch

**Kind:** `property`

```typescript
watch
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L550-553</details>

---

### debounceMs

**Kind:** `property`

```typescript
debounceMs
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L552-552</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L551-551</details>

---

### getDefaultCoverage

**Kind:** `method`

```typescript
getDefaultCoverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L564-576</details>

---

### byFile

**Kind:** `property`

```typescript
byFile
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L573-573</details>

---

### byModule

**Kind:** `property`

```typescript
byModule
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L574-574</details>

---

### overall

**Kind:** `property`

```typescript
overall
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L566-572</details>

---

### coverage

**Kind:** `property`

```typescript
coverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L571-571</details>

---

### coveredFiles

**Kind:** `property`

```typescript
coveredFiles
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L568-568</details>

---

### documentedSymbols

**Kind:** `property`

```typescript
documentedSymbols
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L570-570</details>

---

### totalFiles

**Kind:** `property`

```typescript
totalFiles
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L567-567</details>

---

### totalSymbols

**Kind:** `property`

```typescript
totalSymbols
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L569-569</details>

---

### getHtml

**Kind:** `method`

```typescript
getHtml
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L581-605</details>

---

### nonce

**Kind:** `variable`

```typescript
nonce
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L717-717</details>

---

### scriptUri

**Kind:** `variable`

```typescript
scriptUri
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L718-720</details>

---

### styleUri

**Kind:** `variable`

```typescript
styleUri
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L721-723</details>

---

### getModelState

**Kind:** `method`

```typescript
getModelState
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L451-471</details>

---

### cached

**Kind:** `property`

```typescript
cached
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L463-463</details>

---

### cacheLimit

**Kind:** `property`

```typescript
cacheLimit
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L469-469</details>

---

### cacheSize

**Kind:** `property`

```typescript
cacheSize
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L468-468</details>

---

### cacheStats

**Kind:** `variable`

```typescript
cacheStats
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L453-453</details>

---

### totalSizeBytes

**Kind:** `property`

```typescript
totalSizeBytes
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L453-453</details>

---

### downloads

**Kind:** `property`

```typescript
downloads
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L467-467</details>

---

### recommendations

**Kind:** `property`

```typescript
recommendations
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L464-464</details>

---

### registry

**Kind:** `property`

```typescript
registry
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L462-462</details>

---

### selectedModelId

**Kind:** `property`

```typescript
selectedModelId
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L466-466</details>

---

### system

**Kind:** `property`

```typescript
system
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L465-465</details>

---

### handleMessage

**Kind:** `method`

```typescript
handleMessage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L246-347</details>

---

### cfg

**Kind:** `variable`

```typescript
cfg
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L337-337</details>

---

### uri

**Kind:** `variable`

```typescript
uri
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L261-261</details>

---

### handleModelDelete

**Kind:** `method`

```typescript
handleModelDelete
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L408-425</details>

---

### error

**Kind:** `variable`

```typescript
error
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L96-96</details>

---

### handleModelDownload

**Kind:** `method`

```typescript
handleModelDownload
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L365-403</details>

---

### errorMessage

**Kind:** `variable`

```typescript
errorMessage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L397-397</details>

---

### path

**Kind:** `variable`

```typescript
path
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L756-756</details>

---

### downloadManager.download() callback

**Kind:** `function`

```typescript
downloadManager.download() callback
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L382-387</details>

---

### payload

**Kind:** `property`

```typescript
payload
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L157-157</details>

---

### type

**Kind:** `property`

```typescript
type
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L157-157</details>

---

### error

**Kind:** `property`

```typescript
error
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L400-400</details>

---

### modelId

**Kind:** `property`

```typescript
modelId
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L440-440</details>

---

### path

**Kind:** `property`

```typescript
path
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L391-391</details>

---

### handleModelSelect

**Kind:** `method`

```typescript
handleModelSelect
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L430-446</details>

---

### initializeModelManagers

**Kind:** `method`

```typescript
initializeModelManagers
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L85-99</details>

---

### initPromise

**Kind:** `property`

```typescript
initPromise
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L53-53</details>

---

### notifyGenerationComplete

**Kind:** `method`

```typescript
notifyGenerationComplete
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L170-175</details>

---

### duration

**Kind:** `property`

```typescript
duration
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L173-173</details>

---

### errors

**Kind:** `property`

```typescript
errors
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L173-173</details>

---

### files

**Kind:** `property`

```typescript
files
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L173-173</details>

---

### panel

**Kind:** `property`

```typescript
panel
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L46-46</details>

---

### postMessage

**Kind:** `method`

```typescript
postMessage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L197-199</details>

---

### recentDocs

**Kind:** `property`

```typescript
recentDocs
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L60-60</details>

---

### refreshConfigAndOpenRouterState

**Kind:** `method`

```typescript
refreshConfigAndOpenRouterState
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L349-353</details>

---

### saveConfig

**Kind:** `method`

```typescript
saveConfig
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L516-523</details>

---

### selectedModelId

**Kind:** `property`

```typescript
selectedModelId
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L68-68</details>

---

### sendInitialData

**Kind:** `method`

```typescript
sendInitialData
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L484-511</details>

---

### initialData

**Kind:** `variable`

```typescript
initialData
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L497-508</details>

---

### config

**Kind:** `property`

```typescript
config
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L498-498</details>

---

### coverage

**Kind:** `property`

```typescript
coverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L501-501</details>

---

### freshness

**Kind:** `property`

```typescript
freshness
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L499-499</details>

---

### freshnessHistory

**Kind:** `property`

```typescript
freshnessHistory
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L500-500</details>

---

### models

**Kind:** `property`

```typescript
models
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L506-506</details>

---

### openRouter

**Kind:** `property`

```typescript
openRouter
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L507-507</details>

---

### hasApiKey

**Kind:** `property`

```typescript
hasApiKey
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L507-507</details>

---

### recentDocs

**Kind:** `property`

```typescript
recentDocs
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L502-502</details>

---

### snapshots

**Kind:** `property`

```typescript
snapshots
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L503-503</details>

---

### theme

**Kind:** `property`

```typescript
theme
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L505-505</details>

---

### watchMode

**Kind:** `property`

```typescript
watchMode
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L504-504</details>

---

### modelState

**Kind:** `variable`

```typescript
modelState
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L495-495</details>

---

### theme

**Kind:** `variable`

```typescript
theme
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L487-493</details>

---

### themeKind

**Kind:** `variable`

```typescript
themeKind
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L486-486</details>

---

### sendModelState

**Kind:** `method`

```typescript
sendModelState
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L476-479</details>

---

### state

**Kind:** `variable`

```typescript
state
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L477-477</details>

---

### sendOpenRouterState

**Kind:** `method`

```typescript
sendOpenRouterState
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L355-360</details>

---

### hasApiKey

**Kind:** `property`

```typescript
hasApiKey
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L358-358</details>

---

### setContext

**Kind:** `method`

```typescript
setContext
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L77-80</details>

---

### show

**Kind:** `method`

```typescript
show
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L104-110</details>

---

### snapshots

**Kind:** `property`

```typescript
snapshots
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L61-61</details>

---

### systemCapabilities

**Kind:** `property`

```typescript
systemCapabilities
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L67-67</details>

---

### themeDisposable

**Kind:** `property`

```typescript
themeDisposable
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L51-51</details>

---

### updateConfig

**Kind:** `method`

```typescript
updateConfig
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L115-118</details>

---

### updateCoverage

**Kind:** `method`

```typescript
updateCoverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L131-134</details>

---

### updateFreshness

**Kind:** `method`

```typescript
updateFreshness
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L123-126</details>

---

### updateGenerationProgress

**Kind:** `method`

```typescript
updateGenerationProgress
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L163-165</details>

---

### updateRecentDocs

**Kind:** `method`

```typescript
updateRecentDocs
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L139-142</details>

---

### updateSnapshots

**Kind:** `method`

```typescript
updateSnapshots
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L147-150</details>

---

### updateWatchMode

**Kind:** `method`

```typescript
updateWatchMode
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L155-158</details>

---

### files

**Kind:** `property`

```typescript
files
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L62-62</details>

---

### watchMode

**Kind:** `property`

```typescript
watchMode
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L62-62</details>

---

### OnboardingProvider

**Kind:** `class`

```typescript
OnboardingProvider
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L615-741</details>

---

### constructor

**Kind:** `constructor`

```typescript
constructor
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L620-622</details>

---

### context

**Kind:** `property`

```typescript
context
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L618-618</details>

---

### createPanel

**Kind:** `method`

```typescript
createPanel
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L650-673</details>

---

### dispose

**Kind:** `method`

```typescript
dispose
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L642-645</details>

---

### extensionUri

**Kind:** `property`

```typescript
extensionUri
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L617-617</details>

---

### getHtml

**Kind:** `method`

```typescript
getHtml
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L716-740</details>

---

### handleMessage

**Kind:** `method`

```typescript
handleMessage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L678-699</details>

---

### markOnboardingComplete

**Kind:** `method`

```typescript
markOnboardingComplete
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L701-704</details>

---

### panel

**Kind:** `property`

```typescript
panel
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L616-616</details>

---

### saveConfig

**Kind:** `method`

```typescript
saveConfig
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L709-711</details>

---

### setContext

**Kind:** `method`

```typescript
setContext
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L624-626</details>

---

### show

**Kind:** `method`

```typescript
show
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L631-637</details>

---

### applyDocDocsConfigPartial

**Kind:** `function`

```typescript
applyDocDocsConfigPartial
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L751-770</details>

---

### config

**Kind:** `variable`

```typescript
config
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L752-752</details>

---

### section

**Kind:** `variable`

```typescript
section
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L765-765</details>

---

### values

**Kind:** `variable`

```typescript
values
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L765-765</details>

---

### writeEntries

**Kind:** `variable`

```typescript
writeEntries
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L754-763</details>

---

### key

**Kind:** `variable`

```typescript
key
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L755-755</details>

---

### value

**Kind:** `variable`

```typescript
value
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L755-755</details>

---

### getNonce

**Kind:** `function`

```typescript
getNonce
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L772-779</details>

---

### i

**Kind:** `variable`

```typescript
i
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L775-775</details>

---

### possible

**Kind:** `variable`

```typescript
possible
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L774-774</details>

---

### text

**Kind:** `variable`

```typescript
text
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L773-773</details>

---

### registerDashboardProvider

**Kind:** `function`

```typescript
registerDashboardProvider
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L788-804</details>

---

### dispose

**Kind:** `method`

```typescript
dispose
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L801-801</details>

---

### provider

**Kind:** `variable`

```typescript
provider
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L791-791</details>

---

### vscode.commands.registerCommand('docdocs.openDashboard') callback

**Kind:** `function`

```typescript
vscode.commands.registerCommand('docdocs.openDashboard') callback
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L796-798</details>

---

### registerOnboardingProvider

**Kind:** `function`

```typescript
registerOnboardingProvider
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L809-833</details>

---

### dispose

**Kind:** `method`

```typescript
dispose
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L830-830</details>

---

### hasRunBefore

**Kind:** `variable`

```typescript
hasRunBefore
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L823-823</details>

---

### provider

**Kind:** `variable`

```typescript
provider
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L812-812</details>

---

### vscode.commands.registerCommand('docdocs.openOnboarding') callback

**Kind:** `function`

```typescript
vscode.commands.registerCommand('docdocs.openOnboarding') callback
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/dashboardProvider.ts` L817-819</details>

---


[Back to Index](./index.md)
