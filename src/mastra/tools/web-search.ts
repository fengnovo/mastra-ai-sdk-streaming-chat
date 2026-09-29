import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

type TavilyResponse = {
  answer?: string;
  results?: TavilyResult[];
};

/**
 * Provider-independent real web search.
 *
 * Why not use a mocked search result?
 * - This calls Tavily's real HTTP API.
 * - It works even when AI_BASE_URL points at an OpenAI-compatible model that has no native web-search tool.
 * - If no TAVILY_API_KEY is configured, the tool returns an explicit configuration error instead of faking data.
 */
export const webSearchTool = createTool({
  id: 'web-search',
  description:
    'Search the public web for fresh information. Use this when the user asks for latest/current information or facts that should be verified online.',
  inputSchema: z.object({
    query: z.string().min(2).describe('Search query'),
    maxResults: z.number().int().min(1).max(8).default(5),
  }),
  outputSchema: z.object({
    configured: z.boolean(),
    query: z.string(),
    answer: z.string().optional(),
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
        score: z.number().optional(),
      }),
    ),
    error: z.string().optional(),
  }),
  execute: async ({ query, maxResults }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        configured: false,
        query,
        results: [],
        error: 'TAVILY_API_KEY 未配置。请在 .env.local 中配置后再进行真实 Web Search。',
      };
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        configured: true,
        query,
        results: [],
        error: `Tavily HTTP ${response.status}: ${body.slice(0, 500)}`,
      };
    }

    const data = (await response.json()) as TavilyResponse;
    return {
      configured: true,
      query,
      answer: data.answer,
      results: (data.results ?? []).map(item => ({
        title: item.title ?? '(untitled)',
        url: item.url ?? '',
        snippet: item.content ?? '',
        score: item.score,
      })),
    };
  },
});
