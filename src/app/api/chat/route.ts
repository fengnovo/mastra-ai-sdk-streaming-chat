import { isAIConfigured } from '@/lib/model';
import { mastraProxyError, proxyToMastra } from '@/lib/mastra-api';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isAIConfigured) {
    return Response.json(
      {
        error: 'AI_API_KEY is missing. Copy .env.example to .env.local and configure your provider.',
      },
      { status: 500 },
    );
  }

  try {
    return await proxyToMastra(req, '/ai/chat');
  } catch (error) {
    return mastraProxyError(error);
  }
}
