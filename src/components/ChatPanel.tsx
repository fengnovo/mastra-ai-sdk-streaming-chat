'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { MessagePart } from '@/components/MessagePart';
import { AssistantMessage } from '@/components/AssistantMessage';
import { PendingExecution } from '@/components/ExecutionTrace';
import {
  createSessionTitle,
  type ChatRunStatus,
  type ChatSession,
} from '@/lib/chat-sessions';

type ChatPanelProps = {
  session: ChatSession;
  onSessionTitleChange: (sessionId: string, title: string) => void;
  onSessionMessagesChange: (sessionId: string, messages: UIMessage[]) => void;
  onSessionRunChange: (
    sessionId: string,
    patch: { activeRunId?: string; runStatus?: ChatRunStatus },
  ) => void;
};

const examples = [
  '查询订单 A1001，然后计算订单金额加 10% 服务费，一步一步调用工具。',
  '请委托 research 子代理搜索 Mastra 最近一个版本有什么新能力。',
  '请委托 coding 子代理：在 workspace 里创建 hello.ts，然后执行 node --version 和 ls -la 验证。',
  '请调用本地 MCP 的 project-capabilities 工具，告诉我这条链路是否真的走了 MCP。',
];

type ChatApprovalRequest = {
  runId: string;
  toolCallId: string;
  toolName: string;
  payload: unknown;
};

function findPendingApproval(messages: UIMessage[]): ChatApprovalRequest | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant') continue;
    const parts = message.parts as Array<Record<string, any>>;

    for (const part of [...parts].reverse()) {
      if (
        part.type !== 'data-tool-call-suspended' &&
        part.type !== 'data-tool-call-approval'
      ) {
        continue;
      }

      const data = (part.data ?? {}) as Record<string, any>;
      if (!data.runId || !data.toolCallId) continue;

      const matchingToolPart = parts.find(
        (candidate) =>
          candidate.toolCallId === data.toolCallId &&
          typeof candidate.state === 'string',
      );
      if (
        matchingToolPart?.state === 'approval-responded' ||
        matchingToolPart?.state === 'output-available' ||
        matchingToolPart?.state === 'output-error' ||
        matchingToolPart?.state === 'output-denied'
      ) {
        continue;
      }

      return {
        runId: data.runId,
        toolCallId: data.toolCallId,
        toolName: data.toolName ?? '需要审批的操作',
        payload: data.suspendPayload ?? data.args ?? data.input,
      };
    }
  }

  return null;
}

export function ChatPanel({
  session,
  onSessionTitleChange,
  onSessionMessagesChange,
  onSessionRunChange,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [approvalFromStream, setApprovalFromStream] =
    useState<ChatApprovalRequest | null>(null);
  const [approvalDecisionPending, setApprovalDecisionPending] = useState(false);
  const threadId = session.id;
  const scrollAnchor = useRef<HTMLDivElement>(null);
  const activeRunIdRef = useRef(session.activeRunId);

  useEffect(() => {
    activeRunIdRef.current = session.activeRunId;
  }, [session.activeRunId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest({ messages, id }) {
          return {
            body: {
              id,
              messages,
              trigger: 'submit-message',
              memory: {
                thread: threadId,
                resource: 'browser-demo-user',
              },
            },
          };
        },
        prepareReconnectToStreamRequest() {
          if (!session.activeRunId) return { api: '/api/chat' };
          return {
            api: `/api/chat/runs/${encodeURIComponent(session.activeRunId)}/stream`,
          };
        },
      }),
    [session.activeRunId, threadId],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    setMessages,
    addToolApprovalResponse,
  } = useChat({
    id: threadId,
    messages: session.messages,
    transport,
    resume: Boolean(session.activeRunId),
    onData(dataPart) {
      const part = dataPart as {
        type?: string;
        data?: {
          runId?: string;
          toolCallId?: string;
          toolName?: string;
          suspendPayload?: unknown;
          args?: unknown;
          input?: unknown;
        };
      };
      if (part.type === 'data-chat-run' && part.data?.runId) {
        activeRunIdRef.current = part.data.runId;
        onSessionRunChange(threadId, {
          activeRunId: part.data.runId,
          runStatus: 'running',
        });
        return;
      }

      if (
        (part.type === 'data-tool-call-suspended' ||
          part.type === 'data-tool-call-approval') &&
        part.data?.runId &&
        part.data.toolCallId
      ) {
        setApprovalFromStream({
          runId: part.data.runId,
          toolCallId: part.data.toolCallId,
          toolName: part.data.toolName ?? '需要审批的操作',
          payload:
            part.data.suspendPayload ?? part.data.args ?? part.data.input,
        });
      }
    },
    onFinish({ messages: finishedMessages }) {
      onSessionMessagesChange(threadId, finishedMessages);
      const pendingApproval = findPendingApproval(finishedMessages);
      if (pendingApproval) {
        onSessionRunChange(threadId, {
          activeRunId: pendingApproval.runId,
          runStatus: 'running',
        });
      } else {
        setApprovalFromStream(null);
        onSessionRunChange(threadId, {
          activeRunId: undefined,
          runStatus: 'completed',
        });
      }
    },
    onError() {
      onSessionRunChange(threadId, { runStatus: 'error' });
    },
  });

  const isRunning =
    status === 'submitted' ||
    status === 'streaming' ||
    session.runStatus === 'running';
  const lastMessage = messages.at(-1);
  const waitingForAssistant = isRunning && lastMessage?.role === 'user';
  const approvalRequest = approvalFromStream ?? findPendingApproval(messages);

  // Persist the user message immediately, so switching tabs does not lose the
  // only local copy while the detached Mastra run continues in the backend.
  const persistedMessages = useRef('');
  useEffect(() => {
    const serialized = JSON.stringify(messages);
    if (!serialized || serialized === persistedMessages.current) return;
    persistedMessages.current = serialized;
    onSessionMessagesChange(threadId, messages);
  }, [messages, onSessionMessagesChange, threadId]);

  useEffect(() => {
    if (!session.activeRunId || session.messages.length > 0) return;
    let cancelled = false;

    fetch(
      `/api/chat/threads/${encodeURIComponent(threadId)}/messages?resourceId=browser-demo-user`,
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { messages?: UIMessage[] } | null) => {
        if (!cancelled && payload?.messages?.length) setMessages(payload.messages);
      })
      .catch(() => {
        // The stream reconnect remains the source of truth if history is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [session.activeRunId, session.messages.length, setMessages, threadId]);

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({
      behavior: isRunning ? 'smooth' : 'auto',
    });
  }, [messages, status, isRunning]);

  async function submit(text: string) {
    const value = text.trim();
    if (!value || isRunning) return;
    if (session.title === '新对话') {
      onSessionTitleChange(threadId, createSessionTitle(value));
    }
    setInput('');
    await sendMessage({ text: value });
    setTimeout(
      () => scrollAnchor.current?.scrollIntoView({ behavior: 'smooth' }),
      20,
    );
  }

  async function cancelActiveRun() {
    const runId = session.activeRunId;
    await stop();
    if (!runId) return;

    try {
      await fetch(`/api/chat/runs/${encodeURIComponent(runId)}/cancel`, {
        method: 'POST',
      });
    } finally {
      onSessionRunChange(threadId, {
        activeRunId: undefined,
        runStatus: 'completed',
      });
    }
  }

  async function decideApproval(approved: boolean) {
    if (!approvalRequest || approvalDecisionPending) return;

    setApprovalDecisionPending(true);
    try {
      await addToolApprovalResponse({
        id: `${approvalRequest.runId}::${approvalRequest.toolCallId}`,
        approved,
        reason: approved ? undefined : '用户拒绝了这次人工审批。',
      });
      onSessionRunChange(threadId, {
        activeRunId: approvalRequest.runId,
        runStatus: 'running',
      });
      // The custom Mastra route extracts the approval-responded part and
      // resumes the durable agent run with its original toolCallId.
      await sendMessage();
    } finally {
      setApprovalDecisionPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(input);
  }

  return (
    <section className='chat-panel panel'>
      <div className='messages'>
        {messages.length === 0 ? (
          <div className='empty-state'>
            <div className='empty-logo'>M</div>
            <h3>直接用下面请求验证真实能力</h3>
            <p>
              显示可核验的 Agent / Tool / MCP / Workflow
              事件，而不是伪造隐藏思维链。
            </p>
            <div className='example-grid'>
              {examples.map((example) => (
                <button
                  type='button'
                  key={example}
                  onClick={() => void submit(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, messageIndex) => {
          const isLastAssistantStreaming =
            isRunning &&
            message.role === 'assistant' &&
            messageIndex === messages.length - 1;

          if (message.role === 'assistant') {
            return (
              <AssistantMessage
                key={message.id}
                message={message}
                isStreaming={isLastAssistantStreaming}
              />
            );
          }

          return (
            <article className={`message ${message.role}`} key={message.id}>
              <div className='avatar'>
                {message.role === 'user' ? '你' : 'M'}
              </div>
              <div className='bubble'>
                {message.parts.map((part, index) => (
                  <MessagePart key={`${message.id}-${index}`} part={part} />
                ))}
              </div>
            </article>
          );
        })}

        {waitingForAssistant ? <PendingExecution /> : null}
        {error ? (
          <div className='error-banner'>请求失败：{error.message}</div>
        ) : null}
        <div ref={scrollAnchor} />
      </div>

      {approvalRequest ? (
        <div className='approval-modal-backdrop'>
          <section
            className='approval-modal'
            role='dialog'
            aria-modal='true'
            aria-labelledby='chat-approval-title'
            aria-describedby='chat-approval-description'
          >
            <div className='approval-modal-kicker'>人工审核</div>
            <h2 id='chat-approval-title'>需要你的确认才能继续</h2>
            <p id='chat-approval-description'>
              Agent 已暂停当前任务。请确认下面的操作后，后台 durable run 才会恢复执行。
            </p>
            <div className='approval-modal-details'>
              <strong>{approvalRequest.toolName}</strong>
              <pre>
                {typeof approvalRequest.payload === 'string'
                  ? approvalRequest.payload
                  : JSON.stringify(approvalRequest.payload, null, 2)}
              </pre>
            </div>
            <div className='approval-modal-actions'>
              <button
                type='button'
                className='danger-button'
                disabled={approvalDecisionPending}
                onClick={() => void decideApproval(false)}
              >
                拒绝
              </button>
              <button
                type='button'
                className='primary-button'
                disabled={approvalDecisionPending}
                onClick={() => void decideApproval(true)}
              >
                {approvalDecisionPending ? '正在恢复…' : '批准并继续'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <form className='composer' onSubmit={onSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              event.nativeEvent.keyCode !== 229
            ) {
              event.preventDefault();
              void submit(input);
            }
          }}
          placeholder='输入消息；Enter 发送，Shift+Enter 换行'
          rows={3}
        />
        <div className='composer-actions'>
          <span className='thread-label'>thread: {threadId.slice(0, 8)}…</span>
          {isRunning ? (
            <button
              type='button'
              className='secondary-button'
              onClick={() => void cancelActiveRun()}
            >
              停止
            </button>
          ) : (
            <button
              type='submit'
              className='primary-button'
              disabled={!input.trim()}
            >
              发送 ↗
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
