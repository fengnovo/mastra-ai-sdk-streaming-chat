import { createUIMessageStreamResponse } from 'ai';
import { handleChatStream } from '@mastra/ai-sdk';
import { mastra } from '@/mastra';
import { isAIConfigured } from '@/lib/model';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isAIConfigured) {
    return Response.json(
      {
        error: 'AI_API_KEY is missing. Copy .env.example to .env.local and configure your provider.',
      },
      { status: 500 },
    );
  }

  const params = await req.json();
  const stream = await handleChatStream({
    mastra,
    agentId: 'chat-agent',
    params,
    version: 'v7',
  });

  return createUIMessageStreamResponse({ stream });
}
