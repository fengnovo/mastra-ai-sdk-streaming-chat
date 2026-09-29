import type { UIMessage } from 'ai';

export function MessagePart({ part }: { part: UIMessage['parts'][number] }) {
  if (part.type === 'text') {
    return <div className="message-text">{part.text}</div>;
  }

  if (part.type === 'reasoning') {
    return (
      <details className="reasoning-block">
        <summary>Reasoning</summary>
        <div>{part.text}</div>
      </details>
    );
  }

  if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
    const toolPart = part as unknown as Record<string, unknown>;
    const state = String(toolPart.state ?? 'running');
    const toolName =
      String(toolPart.toolName ?? '') ||
      (part.type.startsWith('tool-') ? part.type.slice('tool-'.length) : 'tool');

    return (
      <div className="tool-card">
        <div className="tool-card-head">
          <span className="tool-icon">↻</span>
          <strong>{toolName}</strong>
          <span className={`tool-state ${state}`}>{state}</span>
        </div>
        {'input' in toolPart && toolPart.input ? (
          <pre>{JSON.stringify(toolPart.input, null, 2)}</pre>
        ) : null}
        {'output' in toolPart && toolPart.output ? (
          <pre>{JSON.stringify(toolPart.output, null, 2)}</pre>
        ) : null}
        {'errorText' in toolPart && toolPart.errorText ? (
          <div className="tool-error">{String(toolPart.errorText)}</div>
        ) : null}
      </div>
    );
  }

  return null;
}
