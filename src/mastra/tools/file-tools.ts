import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const MAX_READ_BYTES = 256 * 1024;
const MAX_WRITE_BYTES = 256 * 1024;

export function getWorkspaceRoot() {
  const configured = process.env.AGENT_WORKSPACE_ROOT ?? './workspace';
  return path.resolve(process.cwd(), configured);
}

/** Convert a user/model supplied relative path into a path that cannot escape AGENT_WORKSPACE_ROOT. */
function resolveWorkspacePath(relativePath: string) {
  if (path.isAbsolute(relativePath)) {
    throw new Error('只允许 workspace 内的相对路径，不允许绝对路径。');
  }
  const root = getWorkspaceRoot();
  const resolved = path.resolve(root, relativePath || '.');
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('路径越界：不能访问 AGENT_WORKSPACE_ROOT 之外的文件。');
  }
  return { root, resolved };
}

export const listFilesTool = createTool({
  id: 'list-files',
  description: 'List files/directories inside the local agent workspace. Never reads outside AGENT_WORKSPACE_ROOT.',
  inputSchema: z.object({
    path: z.string().default('.'),
  }),
  outputSchema: z.object({
    workspaceRoot: z.string(),
    path: z.string(),
    entries: z.array(
      z.object({
        name: z.string(),
        type: z.enum(['file', 'directory', 'other']),
        size: z.number(),
      }),
    ),
  }),
  execute: async ({ path: relativePath }) => {
    const { root, resolved } = resolveWorkspacePath(relativePath);
    await mkdir(resolved, { recursive: true });
    const names = await readdir(resolved);
    const entries = await Promise.all(
      names.slice(0, 200).map(async name => {
        const fullPath = path.join(resolved, name);
        const info = await stat(fullPath);
        return {
          name,
          type: info.isFile() ? ('file' as const) : info.isDirectory() ? ('directory' as const) : ('other' as const),
          size: info.size,
        };
      }),
    );
    return { workspaceRoot: root, path: relativePath, entries };
  },
});

export const readFileTool = createTool({
  id: 'read-file',
  description: 'Read a UTF-8 text file inside AGENT_WORKSPACE_ROOT.',
  inputSchema: z.object({
    path: z.string().min(1),
  }),
  outputSchema: z.object({
    path: z.string(),
    content: z.string(),
    bytes: z.number(),
  }),
  execute: async ({ path: relativePath }) => {
    const { resolved } = resolveWorkspacePath(relativePath);
    const info = await stat(resolved);
    if (!info.isFile()) throw new Error('目标不是文件。');
    if (info.size > MAX_READ_BYTES) {
      throw new Error(`文件过大：${info.size} bytes，Demo 单次最多读取 ${MAX_READ_BYTES} bytes。`);
    }
    const content = await readFile(resolved, 'utf8');
    return { path: relativePath, content, bytes: Buffer.byteLength(content) };
  },
});

export const writeFileTool = createTool({
  id: 'write-file',
  description:
    'Create or overwrite a UTF-8 text file inside AGENT_WORKSPACE_ROOT. Parent directories are created automatically.',
  inputSchema: z.object({
    path: z.string().min(1),
    content: z.string(),
  }),
  outputSchema: z.object({
    path: z.string(),
    bytes: z.number(),
    ok: z.boolean(),
  }),
  execute: async ({ path: relativePath, content }) => {
    const bytes = Buffer.byteLength(content);
    if (bytes > MAX_WRITE_BYTES) {
      throw new Error(`内容过大：${bytes} bytes，Demo 单次最多写入 ${MAX_WRITE_BYTES} bytes。`);
    }
    const { resolved } = resolveWorkspacePath(relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, content, 'utf8');
    return { path: relativePath, bytes, ok: true };
  },
});
