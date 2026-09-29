import assert from 'node:assert/strict';
import test from 'node:test';

import { createChatSession, removeChatSession } from '../src/lib/chat-sessions.ts';

test('removes the requested chat session and preserves the remaining order', () => {
  const first = createChatSession('first', 3);
  const second = createChatSession('second', 2);
  const third = createChatSession('third', 1);

  assert.deepEqual(
    removeChatSession([first, second, third], 'second').map((session) => session.id),
    ['first', 'third'],
  );
});
