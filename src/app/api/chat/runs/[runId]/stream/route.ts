import { mastraProxyError, proxyToMastra } from '@/lib/mastra-api';

export const runtime = 'nodejs';
export const maxDuration = 900;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    return await proxyToMastra(
      request,
      `/ai/chat/runs/${encodeURIComponent(runId)}/stream`,
    );
  } catch (error) {
    return mastraProxyError(error);
  }
}
