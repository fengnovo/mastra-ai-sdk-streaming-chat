import { mastraProxyError, proxyToMastra } from '@/lib/mastra-api';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Compatibility entry point for clients that explicitly start a run. */
export async function POST(request: Request) {
  try {
    return await proxyToMastra(request, '/ai/chat');
  } catch (error) {
    return mastraProxyError(error);
  }
}
