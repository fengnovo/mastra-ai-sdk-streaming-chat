import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('feature rail exposes workflow and Mastra Studio icon entries', async () => {
  const content = await source('src/components/FeatureRail.tsx');
  assert.match(content, /工作流/);
  assert.match(content, /管理后台/);
  assert.match(content, /http:\/\/localhost:4111/);
  assert.match(content, /aria-label=/);
  assert.match(content, /<svg/);
});

test('app shell renders workflow as an overlay instead of a collapsed right rail', async () => {
  const content = await source('src/components/AppShell.tsx');
  assert.match(content, /workflowOpen/);
  assert.match(content, /onWorkflowOpenChange/);
  assert.match(content, /workflow-drawer/);
  assert.doesNotMatch(content, /workflow-panel-collapsed/);
  assert.doesNotMatch(content, /grid-template-columns: minmax\(0, 1fr\) 44px/);
});

test('workflow panel uses a compact close icon and no text collapse action', async () => {
  const content = await source('src/components/WorkflowPanel.tsx');
  assert.match(content, /workflow-close-button/);
  assert.match(content, />×</);
  assert.match(content, /关闭工作流面板/);
  assert.doesNotMatch(content, />收起</);
});

test('workflow drawer styles provide compact spacing and visible focus states', async () => {
  const content = await source('src/app/globals.css');
  assert.match(content, /\.workflow-drawer/);
  assert.match(content, /\.workflow-close-button/);
  assert.match(content, /\.rail-actions/);
  assert.match(content, /\.rail-action-button:focus-visible/);
});
