import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const index = await readFile(new URL('../src/mastra/index.ts', import.meta.url), 'utf8');

test('package exposes API and worker lifecycle commands', () => {
  assert.match(pkg.scripts['mastra:api'], /MASTRA_WORKERS=false/);
  assert.match(pkg.scripts['mastra:worker'], /MASTRA_WORKERS=orchestration,backgroundTasks/);
  assert.match(pkg.scripts.studio, /MASTRA_WORKERS=false/);
  assert.match(pkg.scripts['mastra:local:build'], /mastra:worker:build/);
  assert.match(pkg.scripts['mastra:worker:build'], /--output-dir \.mastra-worker/);
  assert.match(pkg.scripts['mastra:worker'], /--dir \.mastra-worker/);
  assert.match(pkg.scripts['mastra:worker'], /--env \.env.local/);
  assert.match(pkg.scripts['mastra:worker'], /PORT=4112/);
  assert.match(pkg.scripts['mastra:api'], /--env \.env.local/);
  assert.match(pkg.scripts.dev, /MASTRA_WORKERS=false/);
});

test('split API and Worker require shared Postgres and Redis', () => {
  assert.match(index, /process\.env\.MASTRA_WORKERS && \(!redisUrl \|\| !databaseUrl\)/);
});
