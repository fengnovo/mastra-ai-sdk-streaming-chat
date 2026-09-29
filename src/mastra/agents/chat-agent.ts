import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { webFetchTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { chatModel } from '../../lib/model';
import { storage } from '../storage';
import { calculatorTool } from '../tools/calculator';
import { orderLookupTool } from '../tools/order-lookup';
import { webSearchTool } from '../tools/web-search';
import {
  listFilesTool,
  readFileTool,
  writeFileTool,
} from '../tools/file-tools';
import { runCommandTool } from '../tools/run-command';
import { responseQualityScorer } from '../scorers/response-quality';
import { researchAgent } from './research-agent';
import { codingAgent } from './coding-agent';
import { approvalWorkflow } from '../workflows/approval-workflow';
import { getLocalMcpTools } from '../mcp/client';

const baseChatAgent = new Agent({
  id: 'chat-agent',
  name: 'Mastra Streaming Assistant',
  description:
    'Supervisor-style streaming assistant with tools, MCP, durable memory, workflow delegation, research/coding sub-agents and live scoring.',
  model: chatModel,
  instructions: `你是一个可执行任务的 Mastra Supervisor Agent，不只是聊天机器人。默认用中文回答。\n\n你拥有以下能力：\n- 普通问答与流式输出\n- calculator：真实计算\n- orderLookup：查询 Demo 订单 A1001/A1002/A1003\n- webSearch / webFetch：最新信息搜索与网页抓取\n- listFiles/readFile/writeFile：在 AGENT_WORKSPACE_ROOT 内读写文件\n- runCommand：在 workspace 内真实执行命令\n- MCP：可调用 localProject MCP server 暴露的工具\n- research 子代理：最新资料研究\n- coding 子代理：代码、文件、命令执行\n- approval workflow：需要人工审批且可 suspend/resume 的任务\n\n执行规则：\n1. 明确数学运算必须调用 calculator。\n2. A1001/A1002/A1003 必须调用 orderLookup。\n3. 最新/当前信息优先委托 research 子代理或调用 webSearch。\n4. 代码/文件/命令任务优先委托 coding 子代理。\n5. 用户明确要求 MCP 验证时，调用 MCP 工具，不要假装调用。\n6. 用户要求审批/长流程时，调用 approval workflow。\n7. 一个任务需要多个工具时继续 Agent Loop，直到工具结果足够再回答。\n8. 工具失败必须基于真实 error/stdout/stderr 说明，不要编造成功。\n9. 最终回答简洁列出：做了什么、调用了什么、结果是什么。\n10. 不要伪造或在最终回答中输出内部原始思维链；可以给简短、可核验的执行摘要。`,
  tools: async () => ({
    calculator: calculatorTool,
    orderLookup: orderLookupTool,
    webSearch: webSearchTool,
    webFetch: webFetchTool,
    listFiles: listFilesTool,
    readFile: readFileTool,
    writeFile: writeFileTool,
    runCommand: runCommandTool,
    ...(await getLocalMcpTools()),
  }),
  agents: {
    research: researchAgent,
    coding: codingAgent,
  },
  workflows: {
    approval: approvalWorkflow,
  },
  memory: new Memory({
    storage,
    options: {
      lastMessages: 20,
    },
  }),
  scorers: {
    responseQuality: {
      scorer: responseQualityScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
  },
  defaultOptions: {
    maxSteps: 16,
  },
});

/**
 * The chat entry point is evented so the agentic loop is owned by Mastra's
 * durable workflow engine instead of the HTTP request that started it.
 *
 * A disconnected browser now only loses its observer stream. The run keeps
 * publishing to shared PubSub/cache and can be observed again by runId.
 */
export const chatAgent = createEventedAgent({
  agent: baseChatAgent,
  maxSteps: 16,
  // createEventedAgent's public type omits this inherited option in Mastra
  // 1.71, but the runtime accepts it and keeps reconnectable streams around.
  cleanupTimeoutMs: 60 * 60 * 1000,
} as never);
