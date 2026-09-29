import { Mastra } from '@mastra/core/mastra';
import { webFetchTool } from '@mastra/core/tools';
import { MastraEditor } from '@mastra/editor';
import {
  Observability,
  MastraStorageExporter,
  SensitiveDataFilter,
} from '@mastra/observability';
import { chatRoute, workflowRoute } from '@mastra/ai-sdk';
import { chatAgent } from './agents/chat-agent';
import { researchAgent } from './agents/research-agent';
import { codingAgent } from './agents/coding-agent';
import { taskExecutorAgent } from './agents/task-executor-agent';
import { approvalWorkflow } from './workflows/approval-workflow';
import { responseQualityScorer } from './scorers/response-quality';
import { storage } from './storage';
import { calculatorTool } from './tools/calculator';
import { orderLookupTool } from './tools/order-lookup';
import { webSearchTool } from './tools/web-search';
import { listFilesTool, readFileTool, writeFileTool } from './tools/file-tools';
import { runCommandTool } from './tools/run-command';

/**
 * Mastra is the single backend application container:
 * Agent + Workflow + Storage + Scorer + Observability + Server routes.
 */
export const mastra = new Mastra({
  agents: {
    'chat-agent': chatAgent,
    'research-agent': researchAgent,
    'coding-agent': codingAgent,
    'task-executor-agent': taskExecutorAgent,
  },
  tools: {
    calculator: calculatorTool,
    'order-lookup': orderLookupTool,
    'web-search': webSearchTool,
    'web-fetch': webFetchTool,
    'list-files': listFilesTool,
    'read-file': readFileTool,
    'write-file': writeFileTool,
    'run-command': runCommandTool,
  },
  workflows: {
    'approval-workflow': approvalWorkflow,
  },
  scorers: {
    'response-quality': responseQualityScorer,
  },
  storage,

  // Enables Agent Editor in Mastra Studio: prompt/tool/sub-agent/workflow config can be versioned as Draft -> Publish.
  editor: new MastraEditor(),

  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra-ai-sdk-chat',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),

  server: {
    apiRoutes: [
      chatRoute({
        path: '/ai/chat',
        agent: 'chat-agent',
        version: 'v7',
      }),
      workflowRoute({
        path: '/ai/workflow',
        workflow: 'approval-workflow',
        version: 'v7',
      }),
    ],
  },
});
