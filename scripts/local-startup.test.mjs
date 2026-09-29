import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { services } from './local-services.mjs';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('web child starts Next.js instead of recursively starting the service launcher', () => {
  const web = services.find((service) => service.name === 'web');
  assert.ok(web);
  assert.match(pkg.scripts[web.script], /\bnext dev\b/);
  assert.equal(new URL(web.readyUrl).port, String(web.port));
});

test('web child binds the same port that startup checks for readiness', () => {
  const web = services.find((service) => service.name === 'web');
  assert.ok(web);
  assert.match(pkg.scripts[web.script], new RegExp(`(?:--port|-p)\\s+${web.port}(?:\\s|$)`));
});
