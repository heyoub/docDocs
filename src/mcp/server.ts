/**
 * @fileoverview DocDocs MCP Server - Main entry point.
 * Provides AI-accessible tools for documentation analysis and generation.
 *
 * @module mcp/server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

// ============================================================
// Server Configuration
// ============================================================

const SERVER_NAME = 'docdocs';
const SERVER_VERSION = '1.0.0';

// ============================================================
// Server Instance
// ============================================================

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register all capabilities
  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

// ============================================================
// Main Entry Point
// ============================================================

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Log to stderr (never stdout - that's for JSON-RPC)
  console.error(`[docdocs-mcp] Starting server v${SERVER_VERSION}`);

  await server.connect(transport);

  console.error('[docdocs-mcp] Server connected and ready');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('[docdocs-mcp] Fatal error:', error);
    process.exit(1);
  });
}
