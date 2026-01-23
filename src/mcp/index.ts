/**
 * @fileoverview DocDocs MCP Server CLI entry point.
 * Run with: npx docdocs-mcp
 *
 * @module mcp
 */

import { startServer } from './server.js';

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('[docdocs-mcp] Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[docdocs-mcp] Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('[docdocs-mcp] Fatal error:', error);
  process.exit(1);
});
