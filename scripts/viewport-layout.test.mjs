import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appShell = await readFile(new URL('../src/components/AppShell.tsx', import.meta.url), 'utf8');
const featureRail = await readFile(new URL('../src/components/FeatureRail.tsx', import.meta.url), 'utf8');
const workflowPanel = await readFile(new URL('../src/components/WorkflowPanel.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const nextConfig = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

test('removes both bottom status bars', () => {
  assert.doesNotMatch(appShell, /className="app-footer"/);
  assert.doesNotMatch(featureRail, /className="rail-footer"/);
  assert.match(nextConfig, /devIndicators:\s*false/);
});

test('locks the application shell to the viewport without outer scrolling', () => {
  assert.match(rule('html, body'), /height:\s*100%/);
  assert.match(rule('html, body'), /overflow:\s*hidden/);
  assert.match(rule('.app-shell'), /height:\s*100dvh/);
  assert.match(rule('.app-shell'), /overflow:\s*hidden/);
});

test('removes workspace gutters and keeps panel scrolling internal', () => {
  assert.match(rule('.workspace'), /padding:\s*0/);
  assert.match(rule('.workspace'), /overflow:\s*hidden/);
  assert.match(rule('.workspace-grid'), /height:\s*100%/);
  assert.match(rule('.workspace-grid'), /gap:\s*0/);
  assert.match(rule('.messages'), /min-height:\s*0/);
  assert.match(rule('.messages'), /max-height:\s*none/);
  assert.match(rule('.workflow-panel'), /overflow-y:\s*auto/);
});

test('uses compact spacing around the Mastra brand', () => {
  assert.match(rule('.feature-rail'), /padding:\s*8px 18px 16px/);
  assert.match(rule('.mastra-brand'), /padding:\s*0 6px 8px/);
  assert.match(rule('.session-heading'), /padding:\s*10px 6px 8px/);
});

test('starts with a collapsed workflow panel that can be expanded and collapsed', () => {
  assert.match(appShell, /const \[workflowOpen, setWorkflowOpen\] = useState\(false\)/);
  assert.match(appShell, /workflowOpen \? 'workspace-grid workflow-open' : 'workspace-grid workflow-collapsed'/);
  assert.match(workflowPanel, /aria-expanded=\{expanded\}/);
  assert.match(workflowPanel, /onExpandedChange\(true\)/);
  assert.match(workflowPanel, /onExpandedChange\(false\)/);
  assert.match(rule('.workspace-grid'), /grid-template-columns:\s*minmax\(0, 1fr\) 44px/);
});

test('does not automatically recover the previous workflow on page entry', () => {
  assert.doesNotMatch(workflowPanel, /useEffect/);
  assert.match(workflowPanel, /onClick=\{\(\) => void recover\(\)\}/);
});
