import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const route = await readFile(new URL('../src/app/api/workflow/start/route.ts', import.meta.url), 'utf8');

test('workflow start uses the Mastra v1 run creation API', () => {
  assert.doesNotMatch(route, /createRunAsync/, 'createRunAsync was removed in Mastra v1');
  assert.match(route, /await workflow\.createRun\(\)/, 'workflow runs must be created with createRun');
});
