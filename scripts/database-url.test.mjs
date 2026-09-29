import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDatabaseUrl } from '../src/mastra/database-url.ts';

test('resolves a relative SQLite URL from the Mastra project root', () => {
  assert.equal(
    resolveDatabaseUrl('file:./data/mastra.db', '/workspace/app'),
    'file:///workspace/app/data/mastra.db',
  );
});

test('normalizes the .mastra directory supplied by mastra dev to the project root', () => {
  assert.equal(
    resolveDatabaseUrl('file:./data/mastra.db', '/workspace/app/.mastra'),
    'file:///workspace/app/data/mastra.db',
  );
});

test('normalizes the bundled .mastra output directory to the project root', () => {
  assert.equal(
    resolveDatabaseUrl('file:./data/mastra.db', '/workspace/app/.mastra/output'),
    'file:///workspace/app/data/mastra.db',
  );
});

test('keeps absolute and remote database URLs unchanged', () => {
  assert.equal(resolveDatabaseUrl('file:/var/data/mastra.db', '/workspace/app'), 'file:/var/data/mastra.db');
  assert.equal(resolveDatabaseUrl('libsql://example.turso.io', '/workspace/app'), 'libsql://example.turso.io');
});
