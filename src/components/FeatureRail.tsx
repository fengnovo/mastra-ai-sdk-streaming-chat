import type { ChatSession } from '@/lib/chat-sessions';

type FeatureRailProps = {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
};

export function FeatureRail({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
}: FeatureRailProps) {
  return (
    <aside className="feature-rail">
      <div className="mastra-brand">
        <div className="brand-mark">M</div>
        <div>
          <strong>MASTRA</strong>
          <span>智能体工作台</span>
        </div>
      </div>

      <div className="session-heading">
        <strong>聊天会话</strong>
        <button type="button" className="new-chat-button" onClick={onNewSession}>
          <span aria-hidden="true">＋</span>
          新建对话
        </button>
      </div>

      <nav className="session-list" aria-label="聊天会话列表">
        {sessions.map(session => (
          <button
            type="button"
            className={session.id === activeSessionId ? 'session-item active' : 'session-item'}
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            aria-current={session.id === activeSessionId ? 'page' : undefined}
          >
            <span className="session-bubble" aria-hidden="true" />
            <span className="session-copy">
              <strong>{session.title}</strong>
              <small>{session.messages.length > 0 ? `${session.messages.length} 条消息` : '暂无消息'}</small>
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
