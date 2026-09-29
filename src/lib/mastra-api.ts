const mastraApiUrl = (
  process.env.MASTRA_API_URL ?? 'http://127.0.0.1:4111'
).replace(/\/$/, '');

export async function proxyToMastra(
  request: Request,
  path: string,
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const method = request.method.toUpperCase();
  // `path` is a Mastra custom API route. Unlike Mastra's built-in resources
  // (`/api/agents`, `/api/workflows`, ...), custom routes are mounted at the
  // server root, e.g. `/ai/chat`.
  const response = await fetch(`${mastraApiUrl}${path}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
    cache: 'no-store',
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export function mastraProxyError(error: unknown) {
  console.error('[next->mastra] proxy failed', error);
  return Response.json(
    {
      error:
        'Mastra API is unavailable. Start it with `pnpm studio` or `pnpm mastra:api`.',
    },
    { status: 503 },
  );
}
