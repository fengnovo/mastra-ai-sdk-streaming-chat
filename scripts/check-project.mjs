import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const required = [
  'package.json',
  '.npmrc',
  'mcp/local-server.mjs',
  'src/mastra/index.ts',
  'src/mastra/mcp/client.ts',
  'src/mastra/agents/chat-agent.ts',
  'src/mastra/agents/research-agent.ts',
  'src/mastra/agents/coding-agent.ts',
  'src/mastra/tools/web-search.ts',
  'src/mastra/tools/file-tools.ts',
  'src/mastra/tools/run-command.ts',
  'src/mastra/workflows/approval-workflow.ts',
  'src/app/api/chat/route.ts',
  'src/components/ChatPanel.tsx',
  'src/components/WorkflowPanel.tsx',
];

for (const file of required) await access(path.join(root, file));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
for (const dep of [
  '@mastra/core',
  '@mastra/editor',
  '@mastra/mcp',
  '@mastra/ai-sdk',
  '@ai-sdk/react',
  'ai',
  'next',
]) {
  if (!pkg.dependencies[dep]) throw new Error(`Missing dependency: ${dep}`);
}
if (pkg.dependencies['@mastra/core'] !== '1.71.0')
  throw new Error('Pin @mastra/core to 1.71.0');
if (pkg.dependencies['@mastra/editor'] !== '0.15.3')
  throw new Error('Pin @mastra/editor to 0.15.3');
console.log('Project structure/version check passed.');
