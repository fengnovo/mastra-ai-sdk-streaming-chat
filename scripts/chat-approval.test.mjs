import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('chat proxy targets Mastra custom routes at the server root', async () => {
  const content = await source('src/lib/mastra-api.ts');
  assert.match(content, /fetch\(`\$\{mastraApiUrl\}\$\{path\}/);
  assert.doesNotMatch(content, /fetch\(`\$\{mastraApiUrl\}\/api\$\{path\}/);
});

test('chat panel exposes approval requests with an accessible modal', async () => {
  const content = await source('src/components/ChatPanel.tsx');
  assert.match(content, /data-tool-call-suspended/);
  assert.match(content, /data-tool-call-approval/);
  assert.match(content, /role=['"]dialog['"]/);
  assert.match(content, /aria-modal=['"]true['"]/);
  assert.match(content, /批准并继续/);
  assert.match(content, /拒绝/);
});

test('chat API has a durable resume endpoint for approval decisions', async () => {
  const route = await source('src/app/api/chat/runs/[runId]/resume/route.ts');
  const api = await source('src/mastra/chat-api.ts');
  assert.match(route, /proxyToMastra/);
  assert.match(route, /\/resume/);
  assert.match(api, /handleRunResume/);
  assert.match(api, /agent\.resume/);
});
