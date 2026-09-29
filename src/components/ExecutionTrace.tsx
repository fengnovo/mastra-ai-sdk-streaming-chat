'use client';

import type { UIMessage } from 'ai';
import { MarkdownContent } from '@/components/MarkdownContent';

type MessagePart = UIMessage['parts'][number];
type ToolState = 'running' | 'waiting' | 'done' | 'failed';

type ToolMeta = {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};


function getToolMeta(part: MessagePart): ToolMeta | null {
  if (!(part.type.startsWith('tool-') || part.type === 'dynamic-tool')) return null;

  const value = part as unknown as Record<string, unknown>;
  const toolName =
    typeof value.toolName === 'string' && value.toolName
      ? value.toolName
      : part.type.startsWith('tool-')
        ? part.type.slice('tool-'.length)
        : 'tool';

  const state = typeof value.state === 'string' ? value.state : 'running';

  return {
    toolName,
    state,
    input: value.input ?? value.args,
    output: value.output ?? value.result,
    errorText:
      typeof value.errorText === 'string'
        ? value.errorText
        : typeof value.error === 'string'
          ? value.error
          : undefined,
  };
}

function normalizeState(meta: ToolMeta, isStreaming: boolean): ToolState {
  const value = meta.state.toLowerCase();
  if (meta.errorText || value.includes('error') || value.includes('fail')) return 'failed';
  if (
    value.includes('output-available') ||
    value.includes('result') ||
    value === 'done' ||
    value === 'completed' ||
    meta.output !== undefined
  ) {
    return 'done';
  }
  if (!isStreaming) return 'waiting';
  return 'running';
}

function classifyTool(toolName: string) {
  const name = toolName.toLowerCase();

  if (name.includes('research')) {
    return { kind: 'SUB-AGENT', label: 'Research Agent', icon: 'R' };
  }
  if (name.includes('coding')) {
    return { kind: 'SUB-AGENT', label: 'Coding Agent', icon: 'C' };
  }
  if (name.includes('approval') || name.includes('workflow')) {
    return { kind: 'WORKFLOW', label: 'Approval Workflow', icon: 'W' };
  }
  if (
    name.includes('mcp') ||
    name.includes('project-capabilities') ||
    name.includes('projectcapabilities') ||
    name.includes('localproject') ||
    name === 'echo'
  ) {
    return { kind: 'MCP', label: toolName, icon: 'M' };
  }
  return { kind: 'TOOL', label: toolName, icon: 'T' };
}

function makeSummary(toolMetas: ToolMeta[], isStreaming: boolean, hasText: boolean) {
  if (toolMetas.length === 0) {
    return isStreaming
      ? '正在分析任务并选择合适的 Agent、Tool 或 Workflow。'
      : hasText
        ? '本次请求不需要外部执行能力，直接生成回答。'
        : '未收到最终回答；请检查任务状态或重新发送。';
  }

  const names = toolMetas.map(meta => classifyTool(meta.toolName));
  const hasCoding = names.some(item => item.label === 'Coding Agent');
  const hasResearch = names.some(item => item.label === 'Research Agent');
  const hasWorkflow = names.some(item => item.kind === 'WORKFLOW');
  const hasMcp = names.some(item => item.kind === 'MCP');

  if (hasCoding) return '检测到代码/文件任务，已进入 Coding Agent 执行链，并根据真实工具结果继续处理。';
  if (hasResearch) return '检测到需要外部资料，已进入 Research Agent 检索链，并基于真实搜索结果整理回答。';
  if (hasWorkflow) return '检测到需要可恢复流程，已进入 Workflow；如果触发 suspend，会等待人工审批后再继续。';
  if (hasMcp) return '正在通过 MCP Client → MCP Server 调用真实 MCP 工具，并等待工具结果。';
  if (hasText && !isStreaming) return '工具调用已完成，正在基于真实执行结果整理最终回答。';
  return '正在执行所需工具；每一步的输入、输出和状态都会在下面实时更新。';
}

function safeJson(value: unknown) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function StepState({ state, kind }: { state: ToolState; kind?: string }) {
  if (state === 'done') return <span className="trace-status done">✓ 完成</span>;
  if (state === 'failed') return <span className="trace-status failed">× 失败</span>;
  if (state === 'waiting') {
    return (
      <span className="trace-status waiting">
        ◌ {kind === 'WORKFLOW' ? '等待人工审批' : '等待恢复'}
      </span>
    );
  }
  return <span className="trace-status running"><span className="trace-spinner" />执行中</span>;
}

export function ExecutionTrace({
  parts,
  isStreaming,
}: {
  parts: UIMessage['parts'];
  isStreaming: boolean;
}) {
  const toolMetas = parts.map(getToolMeta).filter((value): value is ToolMeta => Boolean(value));
  const text = parts
    .filter((part): part is Extract<MessagePart, { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('')
    .trim();
  const hasText = text.length > 0;
  const planningDone = toolMetas.length > 0 || hasText;
  const states = toolMetas.map(meta => normalizeState(meta, isStreaming));
  const hasFailedTool = states.some(state => state === 'failed');
  const hasWaitingTool = states.some(state => state === 'waiting');
  const allToolsDone = states.length > 0 && states.every(state => state === 'done' || state === 'failed');
  const answerState: ToolState = hasFailedTool && !hasText
    ? 'failed'
    : hasWaitingTool
      ? 'waiting'
      : isStreaming && !hasText
        ? 'running'
        : 'done';
  const missingAnswer = !isStreaming && !hasText && toolMetas.length === 0;
  const overallStatus = isStreaming ? 'running' : hasFailedTool || missingAnswer ? 'warning' : hasWaitingTool ? 'waiting' : 'done';

  return (
    <div className="agent-response">
      <details className="execution-card" open={isStreaming || toolMetas.length > 0}>
        <summary className="execution-summary-row">
          <div>
            <strong>{isStreaming ? '正在执行' : missingAnswer ? '执行未完成' : hasWaitingTool ? '等待恢复' : '执行过程'}</strong>
          </div>
          <span className={`trace-overall ${overallStatus}`}>
            {isStreaming ? 'LIVE' : missingAnswer ? '未完成' : hasFailedTool ? 'WITH ERROR' : hasWaitingTool ? 'WAITING' : 'DONE'}
          </span>
        </summary>

        <div className="reasoning-summary">
          <span className="reasoning-icon">◎</span>
          <div>
            <strong>执行摘要</strong>
            <p>{makeSummary(toolMetas, isStreaming, hasText)}</p>
            <small>这里只展示可核验的执行摘要，不展示模型内部原始隐藏思维链。</small>
          </div>
        </div>

        <div className="trace-timeline">
          <div className={`trace-step ${planningDone ? 'done' : 'running'}`}>
            <span className="trace-node">{planningDone ? '✓' : '1'}</span>
            <div className="trace-step-main">
              <div className="trace-step-head">
                <div>
                  <span className="trace-kind">PLANNING</span>
                  <strong>分析任务与选择执行路径</strong>
                </div>
                <StepState state={planningDone ? 'done' : 'running'} />
              </div>
            </div>
          </div>

          {toolMetas.map((meta, index) => {
            const state = normalizeState(meta, isStreaming);
            const classification = classifyTool(meta.toolName);
            return (
              <div className={`trace-step ${state}`} key={`${meta.toolName}-${index}`}>
                <span className="trace-node">{state === 'done' ? '✓' : state === 'failed' ? '!' : classification.icon}</span>
                <div className="trace-step-main">
                  <div className="trace-step-head">
                    <div>
                      <span className="trace-kind">{classification.kind}</span>
                      <strong>{classification.label}</strong>
                      {classification.label !== meta.toolName ? <code>{meta.toolName}</code> : null}
                    </div>
                    <StepState state={state} kind={classification.kind} />
                  </div>

                  {(meta.input !== undefined || meta.output !== undefined || meta.errorText) ? (
                    <details className="trace-details">
                      <summary>查看真实输入 / 输出</summary>
                      {meta.input !== undefined ? (
                        <div className="trace-io">
                          <span>INPUT</span>
                          <pre>{safeJson(meta.input)}</pre>
                        </div>
                      ) : null}
                      {meta.output !== undefined ? (
                        <div className="trace-io">
                          <span>OUTPUT</span>
                          <pre>{safeJson(meta.output)}</pre>
                        </div>
                      ) : null}
                      {meta.errorText ? <div className="trace-error">{meta.errorText}</div> : null}
                    </details>
                  ) : null}
                </div>
              </div>
            );
          })}

          {(toolMetas.length > 0 || isStreaming || hasText) ? (
            <div className={`trace-step ${answerState}`}>
              <span className="trace-node">{answerState === 'done' ? '✓' : answerState === 'failed' ? '!' : 'A'}</span>
              <div className="trace-step-main">
                <div className="trace-step-head">
                  <div>
                    <span className="trace-kind">ANSWER</span>
                    <strong>{allToolsDone || hasText ? '整理最终回答' : '等待执行结果'}</strong>
                  </div>
                  <StepState state={answerState} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </details>

      {hasText ? (
        <section className="final-answer">
          <div className="final-answer-title">
            <strong>最终回答</strong>
          </div>
          <MarkdownContent content={text} />
        </section>
      ) : null}
    </div>
  );
}

export function PendingExecution() {
  return (
    <article className="message assistant pending-assistant">
      <div className="avatar">M</div>
      <div className="bubble">
        <div className="pending-trace">
          <span className="trace-spinner" />
          <div>
            <strong>正在分析任务…</strong>
            <small>准备选择 Agent / Tool / MCP / Workflow</small>
          </div>
        </div>
      </div>
    </article>
  );
}
