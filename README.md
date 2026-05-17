# docDocs - Universal Documentation Generator

A VS Code extension that provides universal, LSP-powered documentation generation with JSON Schema output, Markdown rendering, and AI-optimized context files.

## Features

- **Zero Custom Parsers**: Uses VS Code's built-in LSP integration for any language
- **Multi-Language Support**: Works with TypeScript, Haskell, Rust, Go, Python, C#, Java, and any LSP-enabled language
- **Agent-Grokable Output**: Structured JSON optimized for AI assistant consumption
- **Local ML for Prose**: Optional tiny transformer model for natural prose generation
- **OpenRouter Cloud Fallback**: When local Web Workers are unavailable in the extension host, docDocs can use [OpenRouter](https://openrouter.ai/) (`openrouter/auto` or a model you pick from their live catalog)
- **Validation Gates**: Pre-generation checks ensure code quality
- **Watch Mode**: Debounced auto-regeneration on save
- **MCP Server**: Exposes AI-accessible tools for documentation analysis

## Commands

| Command | Description |
|---------|-------------|
| `docdocs: Generate Documentation for File` | Document the active file |
| `docdocs: Generate Documentation for Folder` | Document all files in a folder |
| `docdocs: Generate Documentation for Workspace` | Document the entire workspace |
| `docdocs: Generate Docs for Selection` | Document symbols in the current selection |
| `docdocs: Check Documentation Freshness` | Report stale documentation |
| `docdocs: Preview Documentation` | Open live preview webview |
| `docdocs: Open Doc Explorer` | Open documentation tree view |
| `docdocs: Lint Documentation` | Validate documentation quality |
| `docdocs: Show Coverage Report` | Display documentation coverage |
| `docdocs: Export LSIF Index` | Export pre-computed index |
| `docdocs: Export OpenAPI Spec` | Export OpenAPI 3 document |
| `docdocs: Export GraphQL Schema` | Export GraphQL SDL |
| `docdocs: Export Hardening Report` | Write documentation hardening checklist |
| `docdocs: Export Traceability Report` | Write spec/code traceability report |
| `docdocs: Export Control Flow Report` | Analyze control flow for active editor |
| `docdocs: Toggle Watch Mode` | Enable/disable auto-regeneration |
| `docdocs: Warm Documentation Provider Cache` | Preload completion/symbol caches |
| `docdocs: Open Setup Wizard` | Configure docDocs for your project |
| `docdocs: Open Dashboard` | View documentation metrics and stats |
| `docdocs: Configure OpenRouter API Key` | Store API key in VS Code SecretStorage |
| `docdocs: Pick OpenRouter Model` | Choose cloud model (defaults to `openrouter/auto`) |

### OpenRouter cloud prose (extension host)

1. Run **docdocs: Configure OpenRouter API Key** (from [openrouter.ai/keys](https://openrouter.ai/keys)).
2. Optional: **docdocs: Pick OpenRouter Model** — lists models via the OpenRouter SDK (newest first); default is `openrouter/auto` for dynamic routing.
3. Enable ML in `.docdocs.json` or `docdocs.ml.enabled`.

Prose pipeline: **local ML** (if Web Worker works) → **OpenRouter** (if API key + `docdocs.ml.openRouter.enabled`) → **templates**.

## Configuration

Create a **`.docdocs.json`** file in your workspace root:

```json
{
  "version": 1,
  "output": {
    "directory": ".docdocs",
    "formats": ["markdown", "ai-context"]
  },
  "source": {
    "include": ["src/**/*.ts"],
    "exclude": ["**/*.test.ts"]
  },
  "ml": {
    "enabled": false,
    "model": "HuggingFaceTB/SmolLM2-360M-Instruct",
    "openRouter": {
      "enabled": true,
      "model": "openrouter/auto"
    }
  }
}
```

Generated docs and freshness data go into the `output.directory` folder (default `.docdocs`). Analysis reports are written to `.docdocs/reports/`.

## Development

```bash
# Install dependencies
bun install

# Build extension (includes tree-sitter WASM copy)
bun run build

# Unit and property tests
bun run test

# Headless VS Code E2E tests (requires xvfb on Linux CI)
bun run test:e2e

# Watch mode
bun run watch
```

CI runs `lint:extension`, `test`, and `xvfb-run -a bun run test:e2e` on every pull request (see `.github/workflows/ci.yml`).

## Requirements

- VS Code 1.80.0 or later
- Compatible with Cursor and Kiro IDE

## License

See `package.json` for the current license field.
