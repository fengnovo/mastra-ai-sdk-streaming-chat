import { aiConfig, isAIConfigured } from '@/lib/model';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    ok: true,
    aiConfigured: isAIConfigured,
    webSearchConfigured: Boolean(process.env.TAVILY_API_KEY),
    providerBaseURL: aiConfig.baseURL,
    model: aiConfig.model,
    storage: process.env.DATABASE_URL ? 'postgresql' : (process.env.MASTRA_DB_URL ?? 'file:./data/mastra.db'),
    workspace: process.env.AGENT_WORKSPACE_ROOT ?? './workspace',
    editor: true,
    mcp: 'local stdio',
    subAgents: ['research-agent', 'coding-agent'],
    runtime: process.version,
  });
}
