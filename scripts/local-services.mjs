import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const runtimeDirectory = path.join(projectRoot, '.local-runtime');
export const stateFile = path.join(runtimeDirectory, 'processes.json');

export const services = [
  { name: 'studio', script: 'studio', port: 4111, readyUrl: 'http://127.0.0.1:4111/api/agents' },
  { name: 'worker', script: 'mastra:worker', port: 4112, readyUrl: 'http://127.0.0.1:4112/health' },
  { name: 'web', script: 'dev', port: 3000, readyUrl: 'http://127.0.0.1:3000/api/health' },
];

export async function readState() {
  try {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    if (!Array.isArray(state.services)) throw new Error('Invalid process state');
    return state;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeState(state) {
  await mkdir(runtimeDirectory, { recursive: true, mode: 0o700 });
  await writeFile(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export async function removeState() {
  await rm(stateFile, { force: true });
}

export function isProcessGroupAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

export function signalProcessGroup(pid, signal) {
  if (!isProcessGroupAlive(pid)) return;
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

export function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

export async function waitForReady(service, pid, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessGroupAlive(pid)) throw new Error(`${service.name} 进程已退出，请查看日志。`);
    try {
      const response = await fetch(service.readyUrl, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        if (service.name !== 'worker' || (await response.json()).status === 'ready') return;
      }
    } catch {
      // The server may still be booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${service.name} 未在 ${timeoutMs / 1000} 秒内就绪，请查看日志。`);
}

export async function stopServices(state) {
  const tracked = [...state.services].reverse();
  for (const service of tracked) signalProcessGroup(service.pid, 'SIGTERM');

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if ((await Promise.all(tracked.map((service) => isPortOpen(service.port)))).every((open) => !open)) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  for (const service of tracked) {
    if (await isPortOpen(service.port)) signalProcessGroup(service.pid, 'SIGKILL');
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  const remaining = [];
  for (const service of tracked) {
    if (await isPortOpen(service.port)) remaining.push(`${service.name}:${service.port}`);
  }
  if (remaining.length) throw new Error(`以下服务端口仍被占用：${remaining.join(', ')}`);
  await removeState();
}
