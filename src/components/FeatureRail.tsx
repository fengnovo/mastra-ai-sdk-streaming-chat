import type { ChatSession } from '@/lib/chat-sessions';

type FeatureRailProps = {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  workflowOpen: boolean;
  onWorkflowOpenChange: (open: boolean) => void;
};

function WorkflowIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
      <path d='M6 4v5m0 6v5M18 4v5m0 6v5M6 9h12M6 15h12' />
      <circle cx='6' cy='4' r='2' />
      <circle cx='18' cy='4' r='2' />
      <circle cx='6' cy='20' r='2' />
      <circle cx='18' cy='20' r='2' />
    </svg>
  );
}

function StudioIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
      <path d='M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z' />
      <path d='M8 7h8M8 11h8M8 15h5' />
    </svg>
  );
}

export function FeatureRail({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  workflowOpen,
  onWorkflowOpenChange,
}: FeatureRailProps) {
  return (
    <aside className='feature-rail'>
      <div className='mastra-brand'>
        <div className='brand-mark'>M</div>
        <div>
          <strong>智能体工作台</strong>
        </div>
      </div>

      <div className='rail-actions' aria-label='工作台入口'>
        <button
          type='button'
          className={workflowOpen ? 'rail-action-button active' : 'rail-action-button'}
          aria-label={workflowOpen ? '关闭工作流面板' : '打开工作流面板'}
          title={workflowOpen ? '关闭工作流面板' : '打开工作流面板'}
          aria-pressed={workflowOpen}
          onClick={() => onWorkflowOpenChange(!workflowOpen)}
        >
          <WorkflowIcon />
        </button>
        <a
          className='rail-action-button'
          href='http://localhost:4111'
          target='_blank'
          rel='noreferrer'
          aria-label='打开管理后台'
          title='打开管理后台'
        >
          <StudioIcon />
        </a>
      </div>

      <div className='session-heading'>
        <strong>聊天会话</strong>
        <button
          type='button'
          className='new-chat-button'
          onClick={onNewSession}
        >
          <span aria-hidden='true'>＋</span>
          新建对话
        </button>
      </div>

      <nav className='session-list' aria-label='聊天会话列表'>
        {sessions.map((session) => (
          <div
            className={
              session.id === activeSessionId
                ? 'session-item active'
                : 'session-item'
            }
            key={session.id}
          >
            <button
              type='button'
              className='session-select'
              onClick={() => onSelectSession(session.id)}
              aria-current={session.id === activeSessionId ? 'page' : undefined}
            >
              <span className='session-bubble' aria-hidden='true' />
              <span className='session-copy'>
                <strong>{session.title}</strong>
                <small>
                  {session.messages.length > 0
                    ? `${session.messages.length} 条消息`
                    : '暂无消息'}
                </small>
              </span>
            </button>
            <button
              type='button'
              className='session-delete'
              onClick={() => onDeleteSession(session.id)}
              aria-label={`删除会话：${session.title}`}
              title='删除会话'
            >
              删除
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
