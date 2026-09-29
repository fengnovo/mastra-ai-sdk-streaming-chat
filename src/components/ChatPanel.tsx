'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { MessagePart } from '@/components/MessagePart';
import { createSessionTitle, type ChatSession } from '@/lib/chat-sessions';

type ChatPanelProps = {
  session: ChatSession;
  onSessionTitleChange: (sessionId: string, title: string) => void;
  onSessionMessagesChange: (sessionId: string, messages: UIMessage[]) => void;
};

const examples = [
  '请计算 37 × 48，必须调用计算器工具。',
  '查询订单 A1001，然后计算订单金额加 10% 服务费，一步一步调用工具。',
  '记住我喜欢 TypeScript。下一轮我会问你还记不记得。',
];

export function ChatPanel({ session, onSessionTitleChange, onSessionMessagesChange }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const threadId = session.id;
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

  async function submit(text: string) {
    const value = text.trim();
    if (!value || isRunning) return;
    if (session.title === '新对话') {
      onSessionTitleChange(threadId, createSessionTitle(value));
    }
    setInput('');
    await sendMessage({ text: value });
    setTimeout(() => scrollAnchor.current?.scrollIntoView({ behavior: 'smooth' }), 20);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(input);
  }

  return (
    <section className="chat-panel panel">
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-logo">M</div>
            <h3>先用这三个请求验证核心能力</h3>
            <p>第二个请求会触发「查订单 → 再计算」的多步工具循环。</p>
            <div className="example-grid">
              {examples.map(example => (
                <button type="button" key={example} onClick={() => void submit(example)}>
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map(message => (
          <article className={`message ${message.role}`} key={message.id}>
            <div className="avatar">{message.role === 'user' ? '你' : 'M'}</div>
            <div className="bubble">
              <div className="message-role">{message.role === 'user' ? 'USER' : 'MASTRA AGENT'}</div>
              {message.parts.map((part, index) => (
                <MessagePart key={`${message.id}-${index}`} part={part} />
              ))}
            </div>
          </article>
        ))}
        {error ? <div className="error-banner">请求失败：{error.message}</div> : null}
        <div ref={scrollAnchor} />
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
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
          placeholder="输入消息；Enter 发送，Shift+Enter 换行"
          rows={3}
        />
        <div className="composer-actions">
          <span className="thread-label">thread: {threadId.slice(0, 8)}…</span>
          {isRunning ? (
            <button type="button" className="secondary-button" onClick={() => stop()}>
              停止
            </button>
          ) : (
            <button type="submit" className="primary-button" disabled={!input.trim()}>
              发送 ↗
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
