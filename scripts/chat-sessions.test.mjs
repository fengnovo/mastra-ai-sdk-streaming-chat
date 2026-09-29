import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChatSession,
  parseChatSessions,
  removeChatSession,
} from '../src/lib/chat-sessions.ts';

test('removes the requested chat session and preserves the remaining order', () => {
  const first = createChatSession('first', 3);
  const second = createChatSession('second', 2);
  const third = createChatSession('third', 1);

  assert.deepEqual(
    removeChatSession([first, second, third], 'second').map((session) => session.id),
    ['first', 'third'],
  );
});

test('keeps only one empty new session when restoring history', () => {
  const emptyFirst = createChatSession('empty-first', 3);
  const emptySecond = createChatSession('empty-second', 2);
  const filled = {
    ...createChatSession('filled', 1),
    title: '已命名会话',
    messages: [{ id: 'message-1', role: 'user', parts: [] }],
  };

  assert.deepEqual(
    parseChatSessions(JSON.stringify([emptyFirst, emptySecond, filled]), emptyFirst)
      .map((session) => session.id),
    ['empty-first', 'filled'],
  );
});
