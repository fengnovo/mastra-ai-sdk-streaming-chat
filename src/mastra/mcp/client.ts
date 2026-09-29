import path from 'node:path';
import process from 'node:process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
const bundledDirectory = path.dirname(fileURLToPath(import.meta.url));
const localMcpServerPath = [
  process.env.MCP_LOCAL_SERVER_PATH,
  path.resolve(process.cwd(), 'mcp/local-server.mjs'),
  path.resolve(bundledDirectory, '../mcp/local-server.mjs'),
  path.resolve(bundledDirectory, '../../mcp/local-server.mjs'),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)))
  ?? path.resolve(process.cwd(), 'mcp/local-server.mjs');

export const localMcpClient = new MCPClient({
  servers: {
    localProject: {
      command: process.execPath,
      args: [localMcpServerPath],
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
