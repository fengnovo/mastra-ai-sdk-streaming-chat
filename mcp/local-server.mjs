#!/usr/bin/env node
import process from 'node:process';
import { MCPServer } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const capabilitiesTool = createTool({
  id: 'project-capabilities',
  description: 'Return the capabilities intentionally exposed by this local demo MCP server.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    source: z.string(),
    capabilities: z.array(z.string()),
  }),
  execute: async () => ({
    source: 'local-mastra-mcp-server',
    capabilities: [
      'MCP stdio transport',
      'Mastra MCPClient -> MCPServer round trip',
      'tool discovery',
      'tool execution from an Agent',
    ],
  }),
});

const echoTool = createTool({
  id: 'mcp-echo',
  description: 'Echo a message through a real local MCP stdio server. Useful for verifying MCP wiring.',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ via: z.string(), message: z.string(), pid: z.number() }),
  execute: async ({ message }) => ({ via: 'MCP stdio', message, pid: process.pid }),
});

const server = new MCPServer({
  name: 'mastra-local-demo-mcp',
  version: '1.0.0',
  tools: {
    projectCapabilities: capabilitiesTool,
    echo: echoTool,
  },
});

server.startStdio().catch(error => {
  console.error('[local-mcp] failed:', error);
  process.exit(1);
});
