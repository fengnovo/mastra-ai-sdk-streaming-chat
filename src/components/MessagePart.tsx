import type { UIMessage } from 'ai';
import { MarkdownContent } from '@/components/MarkdownContent';

/**
 * Lightweight fallback renderer used for non-assistant messages.
 * Assistant messages use ExecutionTrace so tool/sub-agent/workflow events are grouped
 * into one realtime execution timeline instead of being rendered as disconnected cards.
 */
export function MessagePart({ part }: { part: UIMessage['parts'][number] }) {
  if (part.type === 'text') {
    return <MarkdownContent content={part.text} />;
  }

  if (part.type === 'reasoning') {
    return null;
  }

  if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
    return null;
  }

  return null;
}
