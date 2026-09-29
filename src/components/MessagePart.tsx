import type { UIMessage } from 'ai';

/**
 * Lightweight fallback renderer used for non-assistant messages.
 * Assistant messages use ExecutionTrace so tool/sub-agent/workflow events are grouped
 * into one realtime execution timeline instead of being rendered as disconnected cards.
 */
export function MessagePart({ part }: { part: UIMessage['parts'][number] }) {
  if (part.type === 'text') {
    return <div className='message-text'>{part.text}</div>;
  }

  if (part.type === 'reasoning') {
    return null;
  }

  if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
    return null;
  }

  return null;
}
