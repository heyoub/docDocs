# Changelog

All notable changes to docDocs are documented in this file.

## [0.2.0] - 2026-05-17

### Added

- **WASM bundling**: Tree-sitter WASM artifacts copied at build time for LSP fallback parsing in the extension host.
- **Watch mode**: Debounced auto-regeneration on file save (`docdocs.watch.*` settings and `docdocs: Toggle Watch Mode`).
- **Cache warming**: Provider and schema cache preloading on activate, file open, and via `docdocs: Warm Documentation Provider Cache`.
- **E2E / CI**: Headless VS Code E2E suite (`test:e2e`) and GitHub Actions workflow (lint, unit tests, xvfb E2E, coverage gate).
- **OpenAPI / GraphQL export**: `docdocs: Export OpenAPI Spec` and `docdocs: Export GraphQL Schema` commands.
- **Analysis reports**: Hardening, traceability, and control-flow reports under `.docdocs/reports/`.
- **OpenRouter fallback**: Cloud prose generation when local ML workers are unavailable (`docdocs.ml.openRouter.*`).
- **Lint stubs**: Documentation linter rules for stub/placeholder detection (`stub-detected` and related checks).
- **MCP server**: `docdocs-mcp` CLI with analysis tools, resources, and prompts (see `docs/MCP.md`).
- **Doc freshness CI**: Pull-request check for `.docdocs` / `freshness.json` staleness.

### Changed

- Coverage gate on unit-tested core modules (70% line threshold in Vitest).
- License aligned to MIT in `package.json`.

## [0.1.0] - 2026-01-01

### Added

- Initial VS Code extension: LSP-powered documentation generation, JSON Schema and Markdown output, AI context files, Doc Explorer, freshness tracking, and local ML prose option.
