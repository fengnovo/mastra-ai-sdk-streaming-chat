import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getWorkspaceRoot } from './file-tools';

const execAsync = promisify(exec);
const MAX_BUFFER = 1024 * 1024;

// Guard only the obviously destructive host-level commands. For a truly isolated production coding agent,
// replace this local process executor with a container/VM sandbox.
const dangerousPatterns = [
  /\bsudo\b/i,
  /\brm\s+-[^\n]*r[^\n]*f\s+\/(?:\s|$)/i,
  /\bmkfs\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bdd\s+if=/i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/,
];

export const runCommandTool = createTool({
  id: 'run-command',
  description:
    'Run a real shell command inside the local agent workspace and return stdout/stderr/exitCode. Intended for install, typecheck, tests, git status, ls, etc.',
  inputSchema: z.object({
    command: z.string().min(1),
    timeoutMs: z.number().int().min(1000).max(60_000).default(20_000),
  }),
  outputSchema: z.object({
    command: z.string(),
    cwd: z.string(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
    blocked: z.boolean(),
  }),
  execute: async ({ command, timeoutMs }) => {
    const cwd = getWorkspaceRoot();
    const allowUnsafe = process.env.ALLOW_UNSAFE_COMMANDS === 'true';
    if (!allowUnsafe && dangerousPatterns.some(pattern => pattern.test(command))) {
      return {
        command: command,
        cwd,
        exitCode: 126,
        stdout: '',
        stderr: '命令被安全规则拦截。若你确实在隔离环境中需要执行，可显式设置 ALLOW_UNSAFE_COMMANDS=true。',
        blocked: true,
      };
    }

    try {
      const result = await execAsync(command, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        env: process.env,
        shell: process.env.SHELL ?? '/bin/sh',
      });
      return {
        command: command,
        cwd,
        exitCode: 0,
        stdout: result.stdout.slice(-MAX_BUFFER),
        stderr: result.stderr.slice(-MAX_BUFFER),
        blocked: false,
      };
    } catch (error) {
      const err = error as Error & { code?: number | string; stdout?: string; stderr?: string };
      return {
        command: command,
        cwd,
        exitCode: typeof err.code === 'number' ? err.code : 1,
        stdout: String(err.stdout ?? '').slice(-MAX_BUFFER),
        stderr: String(err.stderr ?? err.message).slice(-MAX_BUFFER),
        blocked: false,
      };
    }
  },
});
