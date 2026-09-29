import { Mastra } from '@mastra/core/mastra';
import { RedisServerCache, nodeRedisPreset } from '@mastra/redis';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { createClient } from 'redis';
import { webFetchTool } from '@mastra/core/tools';
import { MastraEditor } from '@mastra/editor';
import {
  Observability,
  MastraStorageExporter,
  SensitiveDataFilter,
} from '@mastra/observability';
import { workflowRoute } from '@mastra/ai-sdk';
import { chatApiRoutes } from './chat-api';
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

const redisUrl = process.env.REDIS_URL;
const databaseUrl = process.env.DATABASE_URL;

if (process.env.MASTRA_WORKERS && (!redisUrl || !databaseUrl)) {
  throw new Error('Mastra API/Worker requires DATABASE_URL and REDIS_URL for shared local infrastructure.');
}

const redisCacheClient = redisUrl ? createClient({ url: redisUrl }) : undefined;
if (redisCacheClient) {
  redisCacheClient.on('error', (error) => {
    console.error('[mastra-cache] Redis connection error', error);
  });
  void redisCacheClient.connect();
}

const sharedRuntime = redisUrl
  ? {
      pubsub: new RedisStreamsPubSub({
        url: redisUrl,
        keyPrefix: 'mastra-streaming-chat:events:',
        streamIdleTtlMs: 24 * 60 * 60 * 1000,
      }),
      cache: new RedisServerCache(
        { client: redisCacheClient as never },
        {
          ...nodeRedisPreset,
          keyPrefix: 'mastra-streaming-chat:cache:',
          ttlSeconds: 24 * 60 * 60,
        },
      ),
    }
  : {};

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
  ...sharedRuntime,

  // The API produces runs; the Worker recovers orphaned runs.
  recovery: {
    durableAgents: process.env.MASTRA_WORKERS === 'false' ? 'off' : 'auto',
  },

  // Tool-level background tasks use the same shared storage/PubSub boundary.
  backgroundTasks: {
    enabled: true,
    mode: process.env.MASTRA_WORKERS === 'false' ? 'producer' : 'full',
    globalConcurrency: 8,
    perAgentConcurrency: 4,
    backpressure: 'queue',
    defaultTimeoutMs: 15 * 60 * 1000,
    defaultRetries: { maxRetries: 2, retryDelayMs: 1_000 },
  },

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
      ...chatApiRoutes,
      workflowRoute({
        path: '/ai/workflow',
        workflow: 'approval-workflow',
        version: 'v7',
      }),
    ],
  },
});
