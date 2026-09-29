import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const chatPanel = await readFile(new URL('../src/components/ChatPanel.tsx', import.meta.url), 'utf8');

test('ChatPanel does not submit while an IME composition is active', () => {
  assert.match(
    chatPanel,
    /event\.key === 'Enter'\s*&&\s*!event\.shiftKey\s*&&\s*!event\.nativeEvent\.isComposing\s*&&\s*event\.nativeEvent\.keyCode !== 229/,
    'Enter from an active IME composition must not submit the message',
  );
});
