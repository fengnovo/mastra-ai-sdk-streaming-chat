import path from 'node:path';
import process from 'node:process';
import { MCPClient } from '@mastra/mcp';

function cleanEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

/**
 * A real MCP client connected to a local stdio MCP server bundled in this project.
 * No external account is required just to prove the MCP path works.
 */
export const localMcpClient = new MCPClient({
  servers: {
    localProject: {
      command: process.execPath,
      args: [path.resolve(process.cwd(), 'mcp/local-server.mjs')],
      env: cleanEnv(),
    },
  },
});

/**
 * Resolve MCP tools lazily so simply importing the app does not spawn a subprocess.
 * If MCP cannot start, the rest of the chat remains usable and the failure is visible in logs.
 */
export async function getLocalMcpTools() {
  try {
    return await localMcpClient.listTools();
  } catch (error) {
    console.error('[mcp] unable to load local MCP tools:', error);
    return {};
  }
}
