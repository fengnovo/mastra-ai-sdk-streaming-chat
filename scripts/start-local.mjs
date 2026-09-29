import { closeSync, openSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import {
  isPortOpen,
  projectRoot,
  readState,
  runtimeDirectory,
  services,
  stopServices,
  waitForReady,
  writeState,
} from './local-services.mjs';

async function loadProjectEnv() {
  const env = {};
  for (const filename of ['.env', '.env.local']) {
    try {
      Object.assign(env, parseEnv(await readFile(path.join(projectRoot, filename), 'utf8')));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  for (const name of ['AI_API_KEY', 'DATABASE_URL', 'REDIS_URL']) {
    if (!env[name] && !process.env[name]) throw new Error(`缺少 ${name}，请检查 .env 或 .env.local。`);
  }
  return { ...env, ...process.env };
}

async function main() {
  const previous = await readState();
  if (previous) {
    const occupied = await Promise.all(previous.services.map((service) => isPortOpen(service.port)));
    if (occupied.some(Boolean)) throw new Error('本项目已有运行中的服务，请先执行 pnpm local:stop。');
  }
  for (const service of services) {
    if (await isPortOpen(service.port)) {
      throw new Error(`端口 ${service.port} 已被占用。请先关闭该端口上的服务，再运行 pnpm local:start。`);
    }
  }

  const env = await loadProjectEnv();
  for (const name of ['DATABASE_URL', 'REDIS_URL']) {
    const url = new URL(env[name]);
    const port = Number(url.port || (name === 'REDIS_URL' ? 6379 : 5432));
    if (!(await isPortOpen(port, url.hostname))) throw new Error(`${name} 指向的服务未运行。`);
  }

  console.log('正在构建 Mastra Worker…');
  const build = spawnSync('pnpm', ['run', 'mastra:worker:build'], {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  });
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error('Worker 构建失败。');

  const state = { startedAt: new Date().toISOString(), services: [] };
  try {
    for (const service of services) {
      const logPath = path.join(runtimeDirectory, `${service.name}.log`);
      await writeState(state);
      const log = openSync(logPath, 'a', 0o600);
      const child = spawn('pnpm', ['run', service.script], {
        cwd: projectRoot,
        env,
        detached: true,
        stdio: ['ignore', log, log],
      });
      closeSync(log);
      if (!child.pid) throw new Error(`无法启动 ${service.name}。`);
      child.unref();
      state.services.push({ name: service.name, pid: child.pid, port: service.port, logPath });
      await writeState(state);
      await waitForReady(service, child.pid);
      console.log(`${service.name} 已就绪：http://127.0.0.1:${service.port}`);
    }
  } catch (error) {
    await stopServices(state);
    throw error;
  }
  console.log('全部服务已启动。执行 pnpm local:stop 可关闭。日志位于 .local-runtime/。');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
