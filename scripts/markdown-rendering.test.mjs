import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const markdownContent = await readFile(
  new URL('../src/components/MarkdownContent.tsx', import.meta.url),
  'utf8',
);
const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');

test('renders chat text through a GFM markdown component', () => {
  assert.match(markdownContent, /ReactMarkdown/);
  assert.match(markdownContent, /remarkGfm/);
  assert.match(markdownContent, /target='_blank'/);
  assert.match(markdownContent, /rel='noreferrer'/);
});

test('keeps markdown lists compact inside chat bubbles', () => {
  assert.match(css, /\.message-text li > p\s*\{[^}]*margin:\s*0/);
  assert.match(css, /\.message-text li \+ li\s*\{[^}]*margin-top:\s*6px/);
  assert.doesNotMatch(css, /\.message-text \{[^}]*white-space:\s*pre-wrap/);
});
