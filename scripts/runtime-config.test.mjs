import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../src/mastra/index.ts', import.meta.url), 'utf8');
const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

test('runtime exposes shared Redis and database configuration', () => {
  assert.match(index, /REDIS_URL/);
  assert.match(index, /RedisServerCache/);
  assert.match(env, /REDIS_URL=/);
  assert.match(env, /DATABASE_URL=/);
  assert.match(index, /mastra-streaming-chat:events:/);
  assert.match(index, /mastra-streaming-chat:cache:/);
});

test('local runtime uses dedicated databases in the existing infrastructure', async () => {
  assert.match(env, /127\.0\.0\.1:55433\/mastra_streaming_chat/);
  assert.match(env, /127\.0\.0\.1:56379\/15/);
  await assert.rejects(access(new URL('../docker-compose.yml', import.meta.url)));
  await assert.rejects(access(new URL('../Dockerfile', import.meta.url)));
});
