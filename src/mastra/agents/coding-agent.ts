import { Agent } from '@mastra/core/agent';
import { chatModel } from '../../lib/model';
import { getLocalMcpTools } from '../mcp/client';
import { listFilesTool, readFileTool, writeFileTool } from '../tools/file-tools';
import { runCommandTool } from '../tools/run-command';

export const codingAgent = new Agent({
  id: 'coding-agent',
  name: 'Coding Sub-Agent',
  description:
    '负责 workspace 内代码/文件任务：查看目录、读取文件、写入文件、执行命令、检查结果，并可调用本地 MCP 工具。',
  model: chatModel,
  instructions: `你是编码执行子代理，只在 AGENT_WORKSPACE_ROOT 内工作。\n执行代码任务时遵循：\n1. 先 list-files/read-file 了解现状。\n2. 再 write-file 修改。\n3. 必要时 run-command 执行 typecheck/test/build。\n4. 失败时根据 stderr 修复，不要假装命令成功。\n5. 用户要求验证 MCP 时，调用 localProject MCP 暴露的工具。`,
  tools: async () => ({
    listFiles: listFilesTool,
    readFile: readFileTool,
    writeFile: writeFileTool,
    runCommand: runCommandTool,
    ...(await getLocalMcpTools()),
  }),
  defaultOptions: { maxSteps: 12 },
});
