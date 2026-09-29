'use client';

import { useMemo, useState } from 'react';

type ApiResult = Record<string, unknown>;

type WorkflowView = {
  runId: string | null;
  status: string;
  raw: ApiResult | null;
  error: string | null;
};

type WorkflowPanelProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

function pickStatus(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'unknown';
  const value = payload as Record<string, unknown>;
  if (typeof value.status === 'string') return value.status;
  if ('result' in value && value.result && typeof value.result === 'object') {
    const nested = value.result as Record<string, unknown>;
    if (typeof nested.status === 'string') return nested.status;
  }
  if ('state' in value && value.state && typeof value.state === 'object') {
    const nested = value.state as Record<string, unknown>;
    if (typeof nested.status === 'string') return nested.status;
  }
  return 'loaded';
}

export function WorkflowPanel({ expanded, onExpandedChange }: WorkflowPanelProps) {
  const [task, setTask] = useState('生成一份 5 条要点的 TypeScript Agent 上线检查清单');
  const [amount, setAmount] = useState(1800);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<WorkflowView>({
    runId: null,
    status: 'idle',
    raw: null,
    error: null,
  });

  const isSuspended = useMemo(() => {
    const raw = JSON.stringify(view.raw ?? {}).toLowerCase();
    return view.status === 'suspended' || raw.includes('suspended');
  }, [view]);

  async function start() {
    setBusy(true);
    setView(current => ({ ...current, error: null, status: 'starting' }));
    try {
      const response = await fetch('/api/workflow/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, amount }),
      });
      const json = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(String(json.error ?? 'Workflow start failed'));
      const runId = String(json.runId);
      localStorage.setItem('mastra-last-workflow-run', runId);
      setView({ runId, status: pickStatus(json.result), raw: json, error: null });
    } catch (error) {
      setView(current => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setBusy(false);
    }
  }

  async function resume(approved: boolean) {
    if (!view.runId) return;
    setBusy(true);
    try {
      const response = await fetch('/api/workflow/resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId: view.runId, approved, approver: 'browser-demo-user' }),
      });
      const json = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(String(json.error ?? 'Workflow resume failed'));
      setView(current => ({
        ...current,
        status: pickStatus(json.result),
        raw: json,
        error: null,
      }));
    } catch (error) {
      setView(current => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setBusy(false);
    }
  }

  async function recover(runId?: string) {
    const id = runId ?? localStorage.getItem('mastra-last-workflow-run');
    if (!id) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/workflow/status/${encodeURIComponent(id)}`);
      const json = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(String(json.error ?? 'Workflow recovery failed'));
      setView({ runId: id, status: pickStatus(json.state), raw: json, error: null });
    } catch (error) {
      setView(current => ({
        ...current,
        runId: id,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setBusy(false);
    }
  }

  if (!expanded) {
    return (
      <aside className="workflow-panel-collapsed panel">
        <button
          type="button"
          className="workflow-expand-button"
          aria-expanded={expanded}
          aria-controls="workflow-panel-content"
          onClick={() => onExpandedChange(true)}
        >
          工作流
        </button>
      </aside>
    );
  }

  return (
    <section className="workflow-panel panel" id="workflow-panel-content">
      <header className="panel-head compact">
        <h2>工作流代理</h2>
        <button
          type="button"
          className="workflow-collapse-button"
          aria-expanded={expanded}
          aria-controls="workflow-panel-content"
          onClick={() => onExpandedChange(false)}
        >
          收起
        </button>
      </header>

      <div className="workflow-badges">
        <span>工具循环</span>
        <span>审批等待</span>
        <span>快速恢复</span>
      </div>

      <div className="workflow-form">
        <label>
          <span>任务</span>
          <textarea value={task} rows={4} onChange={event => setTask(event.target.value)} />
        </label>
        <label>
          <span>金额 / 风险值</span>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={event => setAmount(Number(event.target.value))}
          />
          <small>≥ ¥1000 自动 suspend，等待人工审批。</small>
        </label>
        <button className="primary-button wide" disabled={busy || !task.trim()} onClick={() => void start()}>
          {busy ? '处理中…' : '启动 durable workflow'}
        </button>
      </div>

      <div className="workflow-state">
        <div className="state-row">
          <span>Run ID</span>
          <code>{view.runId ?? '—'}</code>
        </div>
        <div className="state-row">
          <span>Status</span>
          <strong className={`status-text ${view.status}`}>{view.status}</strong>
        </div>
        <div className="step-track">
          <div className="step done">
            <span>1</span>
            <div><strong>start</strong><small>持久化 run</small></div>
          </div>
          <div className={isSuspended ? 'step current' : 'step'}>
            <span>2</span>
            <div><strong>human-approval</strong><small>suspend / resume</small></div>
          </div>
          <div className={view.status === 'success' ? 'step done' : 'step'}>
            <span>3</span>
            <div><strong>agent-execution</strong><small>复用 Mastra Agent</small></div>
          </div>
        </div>

        {isSuspended ? (
          <div className="approval-box">
            <strong>需要人工审批</strong>
            <p>当前 workflow 已写入 LibSQL，可以刷新页面、重启服务，再回来恢复。</p>
            <div>
              <button className="primary-button" disabled={busy} onClick={() => void resume(true)}>
                批准并继续
              </button>
              <button className="danger-button" disabled={busy} onClick={() => void resume(false)}>
                拒绝
              </button>
            </div>
          </div>
        ) : null}

        <button className="text-button" disabled={busy} onClick={() => void recover()}>
          ↻ 从 storage 恢复最近一次 Run
        </button>
        {view.error ? <div className="error-banner">{view.error}</div> : null}
        {view.raw ? (
          <details className="raw-output">
            <summary>查看 workflow 原始状态</summary>
            <pre>{JSON.stringify(view.raw, null, 2)}</pre>
          </details>
        ) : null}
      </div>
    </section>
  );
}
