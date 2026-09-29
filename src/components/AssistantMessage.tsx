'use client';

import type { UIMessage } from 'ai';
import { ExecutionTrace } from '@/components/ExecutionTrace';

export function AssistantMessage({
  message,
  isStreaming,
}: {
  message: UIMessage;
  isStreaming: boolean;
}) {
  return (
    <article className="message assistant">
      <div className="avatar">M</div>
      <div className="bubble assistant-bubble">
        <div className="message-role">MASTRA AGENT</div>
        <ExecutionTrace parts={message.parts} isStreaming={isStreaming} />
      </div>
    </article>
  );
}
