'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { MessagePart } from '@/components/MessagePart';
import { AssistantMessage } from '@/components/AssistantMessage';
import { PendingExecution } from '@/components/ExecutionTrace';
import { createSessionTitle, type ChatSession } from '@/lib/chat-sessions';

type ChatPanelProps = {
  session: ChatSession;
  onSessionTitleChange: (sessionId: string, title: string) => void;
  onSessionMessagesChange: (sessionId: string, messages: UIMessage[]) => void;
};

function getThreadId() {
  if (typeof window === 'undefined') return 'ssr-thread';
  const key = 'mastra-demo-thread-id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
}

const examples = [
  '查询订单 A1001，然后计算订单金额加 10% 服务费，一步一步调用工具。',
  '请委托 research 子代理搜索 Mastra 最近一个版本有什么新能力。',
  '请委托 coding 子代理：在 workspace 里创建 hello.ts，然后执行 node --version 和 ls -la 验证。',
  '请调用本地 MCP 的 project-capabilities 工具，告诉我这条链路是否真的走了 MCP。',
];

export function ChatPanel({
  session,
  onSessionTitleChange,
  onSessionMessagesChange,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [threadId] = useState(getThreadId);
  const scrollAnchor = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest({ messages, id }) {
          return {
            body: {
              id,
              messages,
              memory: {
                thread: threadId,
                resource: 'browser-demo-user',
              },
            },
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: session.messages,
    transport,
    onFinish({ messages: finishedMessages }) {
      onSessionMessagesChange(threadId, finishedMessages);
    },
  });

  const isRunning = status === 'submitted' || status === 'streaming';
  const lastMessage = messages.at(-1);
  const waitingForAssistant = isRunning && lastMessage?.role === 'user';

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
              onClick={() => stop()}
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
