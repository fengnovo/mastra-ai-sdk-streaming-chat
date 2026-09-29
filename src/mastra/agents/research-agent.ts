import { Agent } from '@mastra/core/agent';
import { webFetchTool } from '@mastra/core/tools';
import { chatModel } from '../../lib/model';
import { webSearchTool } from '../tools/web-search';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Sub-Agent',
  description:
    '负责需要最新互联网信息、资料检索、网页核验的研究任务。优先搜索，再基于来源整理事实。',
  model: chatModel,
  instructions: `你是研究子代理。\n1. 用户需要最新信息时调用 web-search。\n2. 用户给出具体 URL 时可调用 webFetchTool。\n3. 不要编造搜索结果；工具未配置或失败时明确说明。\n4. 返回给父 Agent 的结果要紧凑、可核验。`,
  tools: {
    webSearch: webSearchTool,
    webFetch: webFetchTool,
  },
  defaultOptions: { maxSteps: 8 },
});
