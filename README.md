# docDocs - Universal Documentation Generator

A VS Code extension that provides universal, LSP-powered documentation generation with JSON Schema output, Markdown rendering, and AI-optimized context files.

## Features

- **Zero Custom Parsers**: Uses VS Code's built-in LSP integration for any language
- **Multi-Language Support**: Works with TypeScript, Haskell, Rust, Go, Python, C#, Java, and any LSP-enabled language
- **Agent-Grokable Output**: Structured JSON optimized for AI assistant consumption
- **Local ML for Prose**: Optional tiny transformer model for natural prose generation
- **Validation Gates**: Pre-generation checks ensure code quality
- **MCP Server**: Exposes AI-accessible tools for documentation analysis

## Commands

| Command | Description |
|---------|-------------|
| `docdocs: Generate Documentation for File` | Document the active file |
| `docdocs: Generate Documentation for Folder` | Document all files in a folder |
| `docdocs: Generate Documentation for Workspace` | Document the entire workspace |
| `docdocs: Check Documentation Freshness` | Report stale documentation |
| `docdocs: Preview Documentation` | Open live preview webview |
| `docdocs: Open Doc Explorer` | Open documentation tree view |
| `docdocs: Lint Documentation` | Validate documentation quality |
| `docdocs: Show Coverage Report` | Display documentation coverage |
| `docdocs: Export LSIF Index` | Export pre-computed index |
| `docdocs: Toggle Watch Mode` | Enable/disable auto-regeneration |
| `docdocs: Open Setup Wizard` | Configure docDocs for your project |
| `docdocs: Open Dashboard` | View documentation metrics and stats |

## Configuration

Create a `.docdocs.json` file in your workspace root:

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
