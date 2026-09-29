import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createChatSession,
  createSessionTitle,
  parseChatSessions,
  updateChatSession,
} from '../src/lib/chat-sessions.ts';

test('creates a new empty chat session', () => {
  assert.deepEqual(createChatSession('thread-1', 100), {
    id: 'thread-1',
    title: '新对话',
    updatedAt: 100,
    messages: [],
  });
});

test('builds a compact session title from the first user message', () => {
  assert.equal(createSessionTitle('  请帮我   生成一份 TypeScript 上线检查清单  '), '请帮我 生成一份 TypeScript 上线检查清单');
  assert.equal(createSessionTitle('这是一个非常长的会话标题，需要在侧边栏中保持紧凑并避免撑破布局'), '这是一个非常长的会话标题，需要在侧边栏中保持紧凑并避免撑…');
});

test('updates the active session and moves it to the top', () => {
  const sessions = [createChatSession('newer', 200), createChatSession('older', 100)];
  const updated = updateChatSession(sessions, 'older', { title: '恢复的会话' }, 300);

  assert.equal(updated[0].id, 'older');
  assert.equal(updated[0].title, '恢复的会话');
  assert.equal(updated[0].updatedAt, 300);
});

test('falls back to a safe session when stored data is invalid', () => {
  const fallback = createChatSession('fallback', 100);

  assert.deepEqual(parseChatSessions('{broken json', fallback), [fallback]);
  assert.deepEqual(parseChatSessions('[]', fallback), [fallback]);
});
