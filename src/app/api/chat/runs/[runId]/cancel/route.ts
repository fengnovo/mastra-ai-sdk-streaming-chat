import { mastraProxyError, proxyToMastra } from '@/lib/mastra-api';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    return await proxyToMastra(
      request,
      `/ai/chat/runs/${encodeURIComponent(runId)}/cancel`,
    );
  } catch (error) {
    return mastraProxyError(error);
  }
}
