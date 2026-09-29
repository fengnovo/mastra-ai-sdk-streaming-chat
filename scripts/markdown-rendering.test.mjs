import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const markdownContent = await readFile(
  new URL('../src/components/MarkdownContent.tsx', import.meta.url),
  'utf8',
);

test('renders chat text through a GFM markdown component', () => {
  assert.match(markdownContent, /ReactMarkdown/);
  assert.match(markdownContent, /remarkGfm/);
  assert.match(markdownContent, /target='_blank'/);
  assert.match(markdownContent, /rel='noreferrer'/);
});
