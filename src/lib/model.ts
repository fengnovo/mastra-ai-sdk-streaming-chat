import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/**
 * One model adapter for OpenAI, Bailian/DashScope, OpenRouter, vLLM, etc.
 * Keep provider configuration in env so the rest of the Mastra code stays unchanged.
 */
export const aiConfig = {
  baseURL: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  apiKey: process.env.AI_API_KEY ?? 'missing-api-key',
  model: process.env.AI_MODEL ?? 'gpt-5-mini',
};

const provider = createOpenAICompatible({
  name: 'app-provider',
  baseURL: aiConfig.baseURL,
  apiKey: aiConfig.apiKey,
});

export const chatModel = provider.chatModel(aiConfig.model);
export const isAIConfigured = Boolean(process.env.AI_API_KEY);
