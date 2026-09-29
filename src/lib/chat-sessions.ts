import type { UIMessage } from 'ai';

export type ChatRunStatus = 'idle' | 'running' | 'completed' | 'error';

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
  activeRunId?: string;
  runStatus?: ChatRunStatus;
};

export const CHAT_SESSIONS_STORAGE_KEY = 'mastra-demo-chat-sessions-v1';

export function createChatSession(id: string, now = Date.now()): ChatSession {
  return {
    id,
    title: '新对话',
    updatedAt: now,
    messages: [],
  };
}

export function createSessionTitle(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) return '新对话';
  const characters = Array.from(normalized);
  return characters.length > 28 ? `${characters.slice(0, 28).join('')}…` : normalized;
}

function isChatSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.id === 'string' &&
    session.id.length > 0 &&
    typeof session.title === 'string' &&
    Number.isFinite(session.updatedAt) &&
    Array.isArray(session.messages)
  );
}

export function parseChatSessions(raw: string | null, fallback: ChatSession): ChatSession[] {
  if (!raw) return [fallback];

  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [fallback];
    const sessions = value
      .filter(isChatSession)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((session, index, all) => {
        if (session.title !== '新对话' || session.messages.length > 0) return true;
        return all.findIndex((candidate) => candidate.title === '新对话' && candidate.messages.length === 0) === index;
      });
    return sessions.length > 0 ? sessions : [fallback];
  } catch {
    return [fallback];
  }
}

export function updateChatSession(
  sessions: ChatSession[],
  id: string,
  patch: Partial<Pick<ChatSession, 'title' | 'messages' | 'activeRunId' | 'runStatus'>>,
  now = Date.now(),
): ChatSession[] {
  return sessions
    .map(session => (session.id === id ? { ...session, ...patch, updatedAt: now } : session))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function removeChatSession(sessions: ChatSession[], id: string): ChatSession[] {
  return sessions.filter((session) => session.id !== id);
}
