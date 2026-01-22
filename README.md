# GenDocs - Universal Documentation Generator

A VS Code extension that provides universal, LSP-powered documentation generation with JSON Schema output, Markdown rendering, and AI-optimized context files.

## Features

- **Zero Custom Parsers**: Uses VS Code's built-in LSP integration for any language
- **Multi-Language Support**: Works with TypeScript, Haskell, Rust, Go, Python, C#, Java, and any LSP-enabled language
- **Agent-Grokable Output**: Structured JSON optimized for AI assistant consumption
- **Local ML for Prose**: Optional tiny transformer model for natural prose generation
- **Validation Gates**: Pre-generation checks ensure code quality

## Commands

| Command | Description |
|---------|-------------|
| `GenDocs: Generate Documentation for File` | Document the active file |
| `GenDocs: Generate Documentation for Folder` | Document all files in a folder |
| `GenDocs: Generate Documentation for Workspace` | Document the entire workspace |
| `GenDocs: Check Documentation Freshness` | Report stale documentation |
| `GenDocs: Preview Documentation` | Open live preview webview |
| `GenDocs: Open Doc Explorer` | Open documentation tree view |
| `GenDocs: Lint Documentation` | Validate documentation quality |
| `GenDocs: Show Coverage Report` | Display documentation coverage |
| `GenDocs: Export LSIF Index` | Export pre-computed index |
| `GenDocs: Toggle Watch Mode` | Enable/disable auto-regeneration |

## Configuration

Create a `.gendocs.json` file in your workspace root:

```json
{
  "version": 1,
  "output": {
    "directory": ".gendocs",
    "formats": ["markdown", "ai-context"]
  },
  "source": {
    "include": ["src/**/*.ts"],
    "exclude": ["**/*.test.ts"]
  },
  "ml": {
    "enabled": false,
    "model": "HuggingFaceTB/SmolLM2-360M-Instruct"
  }
}
```

## Development

```bash
# Install dependencies
bun install

# Build extension
bun run build

# Run tests
bun test

# Watch mode
bun run watch
```

## Requirements

- VS Code 1.80.0 or later
- Compatible with Cursor and Kiro IDE

## License

MIT
# docDocs
