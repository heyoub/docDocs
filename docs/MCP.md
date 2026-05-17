# docdocs-mcp

The **docdocs-mcp** binary exposes docDocs documentation analysis over the [Model Context Protocol](https://modelcontextprotocol.io/) (stdio transport). Use it from Cursor, Claude Desktop, or any MCP-compatible client.

## Prerequisites

- [Bun](https://bun.sh/) (or Node 20+) for building and running
- A project with source files and optionally a `.docdocs/` output directory from prior generation

## Build

```bash
bun install
bun run build:mcp
```

The CLI entry is `dist/mcp/index.js` (also registered as `docdocs-mcp` in `package.json` `bin`).

## Run

From your **project root** (MCP tools use `process.cwd()` as the workspace):

```bash
# After build
node dist/mcp/index.js

# Or via package bin (from repo or after npm/bun link)
bunx docdocs-mcp
```

### Cursor / Claude Desktop config example

```json
{
  "mcpServers": {
    "docdocs": {
      "command": "node",
      "args": ["/absolute/path/to/docDocs/dist/mcp/index.js"],
      "cwd": "/absolute/path/to/your-project"
    }
  }
}
```

Set `cwd` to the repository you want analyzed. Rebuild `dist/mcp/` after pulling docDocs changes.

## Environment variables

| Variable | Description |
|----------|-------------|
| *(none required)* | The server uses stdio only; no API keys are read by MCP itself. |
| `DOCDOCS_OUTPUT_DIR` | *(optional, future)* Override output directory; today tools read `.docdocs/` under `cwd`. |

OpenRouter and local ML settings apply to the **VS Code extension**, not the MCP server. For cloud prose in the IDE, configure the extension (`docdocs.ml.openRouter.*` and SecretStorage commands).

## Tools

Registered in `src/mcp/tools/index.ts` and `src/mcp/tools/vector.ts`:

| Tool | Purpose |
|------|---------|
| `docdocs_analyze_importance` | Rank files by dependency-graph importance |
| `docdocs_analyze_complexity` | Cyclomatic/cognitive complexity for documentation prioritization |
| `docdocs_check_staleness` | Semantic and git-aware documentation freshness |
| `docdocs_find_undocumented` | High-priority undocumented files |
| `docdocs_get_symbols` | Extract functions/classes/interfaces and JSDoc status |
| `docdocs_coverage_report` | Project documentation coverage summary |
| `docdocs_dependency_graph` | Import/dependent graph for a file or project |
| `docdocs_vector_search` | Semantic search over indexed doc/code vectors |
| `docdocs_vector_similar` | Find similar chunks to a query or file |
| `docdocs_vector_index` | Index workspace paths into `.docdocs/vectors` |
| `docdocs_vector_incoherence` | Detect doc/code semantic mismatches |
| `docdocs_vector_stats` | Vector index statistics |
| `docdocs_vector_clear` | Clear the vector database |

## Resources

Read-only URIs from `src/mcp/resources/index.ts`:

- `config://docdocs` — merged `.docdocs.json` / config
- `freshness://project` — `.docdocs/freshness.json`
- `coverage://project` — coverage summary
- `index://project` — documentation index
- `importance://project` — importance rankings
- `complexity://project` — complexity snapshot
- `structure://project` — project structure overview

## Prompts

Templates from `src/mcp/prompts/index.ts`:

- `document` — generate documentation for a file
- `explain` — explain code behavior
- `audit` — documentation quality audit
- `review` — review docs against source
- `summarize` — module summary
- `changelog` — changelog-style diff narrative

## Output layout

Tools expect generated artifacts under `.docdocs/` (default), including `freshness.json`, module schemas, and optional `vectors/` for semantic search. Run **docdocs: Generate Documentation for Workspace** in VS Code or your pipeline before relying on freshness or vector tools.

## Troubleshooting

- **Empty staleness/coverage**: Generate docs first so `.docdocs/` exists.
- **No stdout logs**: The server logs to **stderr** only; stdout is reserved for JSON-RPC.
- **Wrong project**: Ensure the MCP client sets `cwd` to your application repo, not the docDocs extension repo.
