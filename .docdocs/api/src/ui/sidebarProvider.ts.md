# src/ui/sidebarProvider.ts

> Generated: 2026-05-17T10:53:05.179Z

## Table of Contents

### Classs

- [SidebarProvider](#sidebarprovider) - *No description*

### Constructors

- [constructor](#constructor) - *No description*

### Functions

- [webviewView.onDidChangeVisibility() callback](#webviewview-ondidchangevisibility-callback) - *No description*
- [getNonce](#getnonce) - *No description*
- [registerSidebarProvider](#registersidebarprovider) - *No description*

### Methods

- [getDefaultConfig](#getdefaultconfig) - *No description*
- [getDefaultCoverage](#getdefaultcoverage) - *No description*
- [getHtml](#gethtml) - *No description*
- [handleMessage](#handlemessage) - *No description*
- [postMessage](#postmessage) - *No description*
- [resolveWebviewView](#resolvewebviewview) - *No description*
- [saveConfig](#saveconfig) - *No description*
- [sendInitialData](#sendinitialdata) - *No description*
- [updateConfig](#updateconfig) - *No description*
- [updateCoverage](#updatecoverage) - *No description*
- [updateFreshness](#updatefreshness) - *No description*
- [updateRecentDocs](#updaterecentdocs) - *No description*
- [updateWatchMode](#updatewatchmode) - *No description*

### Propertys

- [config](#config) - *No description*
- [coverage](#coverage) - *No description*
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
- [recentDocs](#recentdocs) - *No description*
- [enableScripts](#enablescripts) - *No description*
- [localResourceRoots](#localresourceroots) - *No description*
- [config](#config) - *No description*
- [coverage](#coverage) - *No description*
- [freshness](#freshness) - *No description*
- [freshnessHistory](#freshnesshistory) - *No description*
- [models](#models) - *No description*
- [cached](#cached) - *No description*
- [cacheLimit](#cachelimit) - *No description*
- [cacheSize](#cachesize) - *No description*
- [downloads](#downloads) - *No description*
- [recommendations](#recommendations) - *No description*
- [registry](#registry) - *No description*
- [selectedModelId](#selectedmodelid) - *No description*
- [system](#system) - *No description*
- [openRouter](#openrouter) - *No description*
- [hasApiKey](#hasapikey) - *No description*
- [recentDocs](#recentdocs) - *No description*
- [snapshots](#snapshots) - *No description*
- [theme](#theme) - *No description*
- [kind](#kind) - *No description*
- [watchMode](#watchmode) - *No description*
- [payload](#payload) - *No description*
- [type](#type) - *No description*
- [snapshots](#snapshots) - *No description*
- [files](#files) - *No description*
- [view](#view) - *No description*
- [watchMode](#watchmode) - *No description*
- [webviewOptions](#webviewoptions) - *No description*
- [retainContextWhenHidden](#retaincontextwhenhidden) - *No description*

### Variables

- [VIEW_ID](#view-id) - *No description*
- [config](#config) - *No description*
- [nonce](#nonce) - *No description*
- [scriptUri](#scripturi) - *No description*
- [styleUri](#styleuri) - *No description*
- [uri](#uri) - *No description*
- [key](#key) - *No description*
- [section](#section) - *No description*
- [value](#value) - *No description*
- [values](#values) - *No description*
- [initialData](#initialdata) - *No description*
- [theme](#theme) - *No description*
- [themeKind](#themekind) - *No description*
- [i](#i) - *No description*
- [possible](#possible) - *No description*
- [text](#text) - *No description*
- [provider](#provider) - *No description*


## Exports

| Name | Default | Type Only |
|------|---------|-----------|
| `VIEW_ID` | No | No |
| `SidebarProvider` | No | No |
| `registerSidebarProvider` | No | No |
| `constructor` | No | No |
| `config` | No | No |
| `coverage` | No | No |
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
| `handleMessage` | No | No |
| `uri` | No | No |
| `postMessage` | No | No |
| `recentDocs` | No | No |
| `resolveWebviewView` | No | No |
| `enableScripts` | No | No |
| `localResourceRoots` | No | No |
| `webviewView.onDidChangeVisibility() callback` | No | No |
| `saveConfig` | No | No |
| `key` | No | No |
| `section` | No | No |
| `value` | No | No |
| `values` | No | No |
| `sendInitialData` | No | No |
| `initialData` | No | No |
| `models` | No | No |
| `cached` | No | No |
| `cacheLimit` | No | No |
| `cacheSize` | No | No |
| `downloads` | No | No |
| `recommendations` | No | No |
| `registry` | No | No |
| `selectedModelId` | No | No |
| `system` | No | No |
| `hasApiKey` | No | No |
| `snapshots` | No | No |
| `theme` | No | No |
| `kind` | No | No |
| `watchMode` | No | No |
| `payload` | No | No |
| `themeKind` | No | No |
| `type` | No | No |
| `updateConfig` | No | No |
| `updateCoverage` | No | No |
| `updateFreshness` | No | No |
| `updateRecentDocs` | No | No |
| `updateWatchMode` | No | No |
| `files` | No | No |
| `view` | No | No |
| `getNonce` | No | No |
| `i` | No | No |
| `possible` | No | No |
| `text` | No | No |
| `provider` | No | No |
| `webviewOptions` | No | No |
| `retainContextWhenHidden` | No | No |

## Symbols

### VIEW_ID

**Kind:** `variable`

```typescript
VIEW_ID
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L26-26</details>

---

### SidebarProvider

**Kind:** `class`

```typescript
SidebarProvider
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L35-291</details>

---

### constructor

**Kind:** `constructor`

```typescript
constructor
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L48-50</details>

---

### config

**Kind:** `property`

```typescript
config
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L40-40</details>

---

### coverage

**Kind:** `property`

```typescript
coverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L43-43</details>

---

### extensionUri

**Kind:** `property`

```typescript
extensionUri
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L37-37</details>

---

### freshness

**Kind:** `property`

```typescript
freshness
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L41-41</details>

---

### freshnessHistory

**Kind:** `property`

```typescript
freshnessHistory
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L42-42</details>

---

### getDefaultConfig

**Kind:** `method`

```typescript
getDefaultConfig
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L213-244</details>

---

### codeLens

**Kind:** `property`

```typescript
codeLens
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L228-230</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L229-229</details>

---

### config

**Kind:** `variable`

```typescript
config
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L199-199</details>

---

### extraction

**Kind:** `property`

```typescript
extraction
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L239-242</details>

---

### timeout

**Kind:** `property`

```typescript
timeout
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L241-241</details>

---

### treeSitterFallback

**Kind:** `property`

```typescript
treeSitterFallback
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L240-240</details>

---

### ml

**Kind:** `property`

```typescript
ml
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L220-227</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L221-221</details>

---

### model

**Kind:** `property`

```typescript
model
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L222-222</details>

---

### openRouter

**Kind:** `property`

```typescript
openRouter
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L223-226</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L46-46</details>

---

### model

**Kind:** `property`

```typescript
model
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L225-225</details>

---

### output

**Kind:** `property`

```typescript
output
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L216-219</details>

---

### directory

**Kind:** `property`

```typescript
directory
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L217-217</details>

---

### formats

**Kind:** `property`

```typescript
formats
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L218-218</details>

---

### statusBar

**Kind:** `property`

```typescript
statusBar
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L231-234</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L232-232</details>

---

### freshnessThreshold

**Kind:** `property`

```typescript
freshnessThreshold
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L233-233</details>

---

### watch

**Kind:** `property`

```typescript
watch
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L235-238</details>

---

### debounceMs

**Kind:** `property`

```typescript
debounceMs
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L237-237</details>

---

### enabled

**Kind:** `property`

```typescript
enabled
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L236-236</details>

---

### getDefaultCoverage

**Kind:** `method`

```typescript
getDefaultCoverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L249-261</details>

---

### byFile

**Kind:** `property`

```typescript
byFile
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L258-258</details>

---

### byModule

**Kind:** `property`

```typescript
byModule
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L259-259</details>

---

### overall

**Kind:** `property`

```typescript
overall
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L251-257</details>

---

### coverage

**Kind:** `property`

```typescript
coverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L256-256</details>

---

### coveredFiles

**Kind:** `property`

```typescript
coveredFiles
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L253-253</details>

---

### documentedSymbols

**Kind:** `property`

```typescript
documentedSymbols
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L255-255</details>

---

### totalFiles

**Kind:** `property`

```typescript
totalFiles
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L252-252</details>

---

### totalSymbols

**Kind:** `property`

```typescript
totalSymbols
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L254-254</details>

---

### getHtml

**Kind:** `method`

```typescript
getHtml
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L266-290</details>

---

### nonce

**Kind:** `variable`

```typescript
nonce
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L267-267</details>

---

### scriptUri

**Kind:** `variable`

```typescript
scriptUri
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L268-270</details>

---

### styleUri

**Kind:** `variable`

```typescript
styleUri
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L271-273</details>

---

### handleMessage

**Kind:** `method`

```typescript
handleMessage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L132-155</details>

---

### uri

**Kind:** `variable`

```typescript
uri
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L147-147</details>

---

### postMessage

**Kind:** `method`

```typescript
postMessage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L125-127</details>

---

### recentDocs

**Kind:** `property`

```typescript
recentDocs
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L44-44</details>

---

### resolveWebviewView

**Kind:** `method`

```typescript
resolveWebviewView
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L55-80</details>

---

### enableScripts

**Kind:** `property`

```typescript
enableScripts
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L63-63</details>

---

### localResourceRoots

**Kind:** `property`

```typescript
localResourceRoots
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L64-66</details>

---

### webviewView.onDidChangeVisibility() callback

**Kind:** `function`

```typescript
webviewView.onDidChangeVisibility() callback
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L75-79</details>

---

### saveConfig

**Kind:** `method`

```typescript
saveConfig
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L198-208</details>

---

### key

**Kind:** `variable`

```typescript
key
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L203-203</details>

---

### section

**Kind:** `variable`

```typescript
section
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L201-201</details>

---

### value

**Kind:** `variable`

```typescript
value
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L203-203</details>

---

### values

**Kind:** `variable`

```typescript
values
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L201-201</details>

---

### sendInitialData

**Kind:** `method`

```typescript
sendInitialData
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L160-193</details>

---

### initialData

**Kind:** `variable`

```typescript
initialData
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L170-190</details>

---

### config

**Kind:** `property`

```typescript
config
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L171-171</details>

---

### coverage

**Kind:** `property`

```typescript
coverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L174-174</details>

---

### freshness

**Kind:** `property`

```typescript
freshness
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L172-172</details>

---

### freshnessHistory

**Kind:** `property`

```typescript
freshnessHistory
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L173-173</details>

---

### models

**Kind:** `property`

```typescript
models
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L179-188</details>

---

### cached

**Kind:** `property`

```typescript
cached
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L181-181</details>

---

### cacheLimit

**Kind:** `property`

```typescript
cacheLimit
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L187-187</details>

---

### cacheSize

**Kind:** `property`

```typescript
cacheSize
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L186-186</details>

---

### downloads

**Kind:** `property`

```typescript
downloads
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L185-185</details>

---

### recommendations

**Kind:** `property`

```typescript
recommendations
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L182-182</details>

---

### registry

**Kind:** `property`

```typescript
registry
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L180-180</details>

---

### selectedModelId

**Kind:** `property`

```typescript
selectedModelId
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L184-184</details>

---

### system

**Kind:** `property`

```typescript
system
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L183-183</details>

---

### openRouter

**Kind:** `property`

```typescript
openRouter
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L189-189</details>

---

### hasApiKey

**Kind:** `property`

```typescript
hasApiKey
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L189-189</details>

---

### recentDocs

**Kind:** `property`

```typescript
recentDocs
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L175-175</details>

---

### snapshots

**Kind:** `property`

```typescript
snapshots
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L176-176</details>

---

### theme

**Kind:** `property`

```typescript
theme
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L178-178</details>

---

### kind

**Kind:** `property`

```typescript
kind
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L178-178</details>

---

### watchMode

**Kind:** `property`

```typescript
watchMode
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L177-177</details>

---

### payload

**Kind:** `property`

```typescript
payload
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L119-119</details>

---

### theme

**Kind:** `variable`

```typescript
theme
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L162-168</details>

---

### themeKind

**Kind:** `variable`

```typescript
themeKind
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L161-161</details>

---

### type

**Kind:** `property`

```typescript
type
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L119-119</details>

---

### snapshots

**Kind:** `property`

```typescript
snapshots
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L45-45</details>

---

### updateConfig

**Kind:** `method`

```typescript
updateConfig
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L85-88</details>

---

### updateCoverage

**Kind:** `method`

```typescript
updateCoverage
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L101-104</details>

---

### updateFreshness

**Kind:** `method`

```typescript
updateFreshness
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L93-96</details>

---

### updateRecentDocs

**Kind:** `method`

```typescript
updateRecentDocs
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L109-112</details>

---

### updateWatchMode

**Kind:** `method`

```typescript
updateWatchMode
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L117-120</details>

---

### files

**Kind:** `property`

```typescript
files
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L46-46</details>

---

### view

**Kind:** `property`

```typescript
view
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L36-36</details>

---

### watchMode

**Kind:** `property`

```typescript
watchMode
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L46-46</details>

---

### getNonce

**Kind:** `function`

```typescript
getNonce
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L300-307</details>

---

### i

**Kind:** `variable`

```typescript
i
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L303-303</details>

---

### possible

**Kind:** `variable`

```typescript
possible
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L302-302</details>

---

### text

**Kind:** `variable`

```typescript
text
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L301-301</details>

---

### registerSidebarProvider

**Kind:** `function`

```typescript
registerSidebarProvider
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L316-330</details>

---

### provider

**Kind:** `variable`

```typescript
provider
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L319-319</details>

---

### webviewOptions

**Kind:** `property`

```typescript
webviewOptions
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L323-325</details>

---

### retainContextWhenHidden

**Kind:** `property`

```typescript
retainContextWhenHidden
```

*No description provided.*

<details><summary>Source</summary>`file:///home/heyoub/Documents/code/docDocs/src/ui/sidebarProvider.ts` L324-324</details>

---


[Back to Index](./index.md)
