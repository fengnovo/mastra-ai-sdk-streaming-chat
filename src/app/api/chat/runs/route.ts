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

export async function GET(request: Request) {
  try {
    const threadId = new URL(request.url).searchParams.get('threadId');
    if (!threadId) {
      return Response.json({ error: 'threadId is required' }, { status: 400 });
    }
    return await proxyToMastra(
      request,
      `/ai/chat/runs?threadId=${encodeURIComponent(threadId)}`,
    );
  } catch (error) {
    return mastraProxyError(error);
  }
}
