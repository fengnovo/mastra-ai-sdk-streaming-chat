import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('chat agent uses fire-and-forget durable execution', async () => {
  const content = await source('src/mastra/agents/chat-agent.ts');
  assert.match(content, /createEventedAgent/);
  assert.match(content, /chatAgent\s*=\s*createEventedAgent/);
});

test('mastra registers shared event infrastructure and recovery', async () => {
  const content = await source('src/mastra/index.ts');
  assert.match(content, /RedisStreamsPubSub/);
  assert.match(content, /recovery:\s*\{[\s\S]*durableAgents:[\s\S]*['"]auto['"]/s);
  assert.match(content, /backgroundTasks:\s*\{\s*enabled:\s*true/s);
});

test('chat reconnect route and server run routes exist', async () => {
  for (const path of [
    'src/app/api/chat/runs/route.ts',
    'src/app/api/chat/runs/[runId]/route.ts',
    'src/app/api/chat/runs/[runId]/events/route.ts',
    'src/app/api/chat/runs/[runId]/cancel/route.ts',
  ]) {
    await access(new URL(`../${path}`, import.meta.url));
  }
});

test('chat panel resumes and captures server run identifiers', async () => {
  const content = await source('src/components/ChatPanel.tsx');
  assert.match(content, /resume:\s*Boolean\(session\.activeRunId\)/);
  assert.match(content, /onData/);
  assert.match(content, /data-chat-run/);
});
