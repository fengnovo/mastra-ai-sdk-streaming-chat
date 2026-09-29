import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const executionTrace = await readFile(
  new URL('../src/components/ExecutionTrace.tsx', import.meta.url),
  'utf8',
);

test('does not label unresolved tools as running after the stream has ended', () => {
  assert.match(executionTrace, /type ToolState = '[^']+' \| 'waiting'/);
  assert.match(executionTrace, /!isStreaming[\s\S]*return 'waiting'/);
  assert.match(executionTrace, /等待人工审批|等待恢复/);
});
