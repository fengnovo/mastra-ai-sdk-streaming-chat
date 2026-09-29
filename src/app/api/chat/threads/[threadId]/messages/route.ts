import { mastraProxyError, proxyToMastra } from '@/lib/mastra-api';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await params;
    const query = new URL(request.url).search;
    return await proxyToMastra(
      request,
      `/ai/chat/threads/${encodeURIComponent(threadId)}/messages${query}`,
    );
  } catch (error) {
    return mastraProxyError(error);
  }
}
