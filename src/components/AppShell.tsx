'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UIMessage } from 'ai';
import { FeatureRail } from '@/components/FeatureRail';
import { ChatPanel } from '@/components/ChatPanel';
import { WorkflowPanel } from '@/components/WorkflowPanel';
import {
  CHAT_SESSIONS_STORAGE_KEY,
  createChatSession,
  removeChatSession,
  parseChatSessions,
  updateChatSession,
  type ChatSession,
} from '@/lib/chat-sessions';

type Health = {
  aiConfigured: boolean;
  model: string;
  providerBaseURL: string;
  storage: string;
};

const INITIAL_SESSION = createChatSession('ssr-thread', 0);
const LEGACY_THREAD_STORAGE_KEY = 'mastra-demo-thread-id';

export function AppShell() {
  const [health, setHealth] = useState<Health | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([INITIAL_SESSION]);
  const [activeSessionId, setActiveSessionId] = useState(INITIAL_SESSION.id);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    const legacyThreadId = window.localStorage.getItem(
      LEGACY_THREAD_STORAGE_KEY,
    );
    const fallback = createChatSession(legacyThreadId ?? crypto.randomUUID());
    const restored = parseChatSessions(
      window.localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY),
      fallback,
    );
    setSessions(restored);
    setActiveSessionId(restored[0].id);
    setSessionsLoaded(true);
  }, []);

  useEffect(() => {
    if (!sessionsLoaded) return;
    try {
      window.localStorage.setItem(
        CHAT_SESSIONS_STORAGE_KEY,
        JSON.stringify(sessions),
      );
      window.localStorage.setItem(LEGACY_THREAD_STORAGE_KEY, activeSessionId);
    } catch {
      // Keep the chat usable if browser storage is unavailable or full.
    }
  }, [activeSessionId, sessions, sessionsLoaded]);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0];

  const createNewSession = useCallback(() => {
    const session = createChatSession(crypto.randomUUID());
    setSessions((current) => [session, ...current].slice(0, 20));
    setActiveSessionId(session.id);
  }, []);

  const updateSession = useCallback(
    (
      sessionId: string,
      patch: Partial<Pick<ChatSession, 'title' | 'messages'>>,
    ) => {
      setSessions((current) => updateChatSession(current, sessionId, patch));
    },
    [],
  );

  const updateSessionMessages = useCallback(
    (sessionId: string, messages: UIMessage[]) =>
      updateSession(sessionId, { messages }),
    [updateSession],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      const deletedIndex = sessions.findIndex((session) => session.id === sessionId);
      if (deletedIndex < 0) return;

      const remaining = removeChatSession(sessions, sessionId);
      if (remaining.length === 0) {
        const replacement = createChatSession(crypto.randomUUID());
        setSessions([replacement]);
        setActiveSessionId(replacement.id);
        return;
      }

      setSessions(remaining);
      if (sessionId === activeSessionId) {
        const nextActive = remaining[Math.min(deletedIndex, remaining.length - 1)];
        setActiveSessionId(nextActive.id);
      }
    },
    [activeSessionId, sessions],
  );

  return (
    <main className='app-shell'>
      <FeatureRail
        sessions={sessions}
        activeSessionId={activeSession.id}
        onNewSession={createNewSession}
        onSelectSession={setActiveSessionId}
        onDeleteSession={deleteSession}
      />
      <div className='workspace'>
        {!health?.aiConfigured && health ? (
          <div className='config-warning'>
            先复制 <code>.env.example</code> 为 <code>.env.local</code>，填入
            AI_API_KEY；其余功能已接好。
          </div>
        ) : null}
        <div
          className={
            workflowOpen
              ? 'workspace-grid workflow-open'
              : 'workspace-grid workflow-collapsed'
          }
        >
          <ChatPanel
            key={activeSession.id}
            session={activeSession}
            onSessionTitleChange={(sessionId, title) =>
              updateSession(sessionId, { title })
            }
            onSessionMessagesChange={updateSessionMessages}
          />
          <WorkflowPanel
            expanded={workflowOpen}
            onExpandedChange={setWorkflowOpen}
          />
        </div>
      </div>
    </main>
  );
}
