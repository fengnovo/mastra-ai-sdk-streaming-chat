import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { toAISdkStream } from '@mastra/ai-sdk';
import { registerApiRoute, type ApiRoute } from '@mastra/core/server';
import type { EventedAgent } from '@mastra/core/agent/durable';
import type { Mastra } from '@mastra/core/mastra';
import type { UIMessage } from 'ai';

type ChatRequest = {
  id?: string;
  messages: UIMessage[];
  memory?: {
    thread: string;
    resource?: string;
  };
  runId?: string;
  resumeData?: unknown;
  trigger?: 'submit-message' | 'regenerate-message';
  [key: string]: unknown;
};

type ApprovalResponse = {
  runId: string;
  toolCallId: string;
  resumeData: { approved: boolean; approver: string; reason?: string };
};

function getChatAgent(mastra: Mastra): EventedAgent {
  return mastra.getAgentById('chat-agent') as unknown as EventedAgent;
}

function createAgentUIStream(
  result: Awaited<ReturnType<EventedAgent['stream']>>,
  originalMessages: UIMessage[],
) {
  return createUIMessageStream({
    originalMessages,
    execute: async ({ writer }) => {
      writer.write({
        type: 'data-chat-run',
        data: {
          runId: result.runId,
          threadId: result.threadId,
          resourceId: result.resourceId,
        },
        transient: true,
      } as never);

      const sdkStream = toAISdkStream(result as never, {
        from: 'agent',
        version: 'v7',
      });
      const reader = sdkStream.getReader();
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        const value = next.value as {
          type?: string;
          data?: {
            runId?: string;
            toolCallId?: string;
          };
        };
        writer.write(next.value as never);

        // Mastra exposes durable suspend/approval checkpoints as data parts.
        // Also emit the AI SDK tool approval part so useChat can turn the
        // user's decision into a normal assistant-message POST. Keeping the
        // data part above lets the UI display the actual suspend payload.
        if (
          (value.type === 'data-tool-call-suspended' ||
            value.type === 'data-tool-call-approval') &&
          value.data?.runId &&
          value.data.toolCallId
        ) {
          writer.write({
            type: 'tool-approval-request',
            approvalId: `${value.data.runId}::${value.data.toolCallId}`,
            toolCallId: value.data.toolCallId,
          } as never);
        }
      }
    },
  });
}

function extractApprovalResponses(messages: UIMessage[]): ApprovalResponse[] {
  const responses = new Map<string, ApprovalResponse>();

  for (const message of messages) {
    if (message.role !== 'assistant') continue;

    for (const part of message.parts as Array<Record<string, any>>) {
      if (part.state !== 'approval-responded' || !part.approval?.id) continue;

      const separator = part.approval.id.lastIndexOf('::');
      if (separator <= 0) continue;

      const runId = part.approval.id.slice(0, separator);
      const toolCallId = part.approval.id.slice(separator + 2);
      if (!runId || !toolCallId || part.toolCallId !== toolCallId) continue;

      responses.set(`${runId}::${toolCallId}`, {
        runId,
        toolCallId,
        resumeData: {
          approved: part.approval.approved === true,
          approver: 'demo-user',
          ...(part.approval.reason ? { reason: part.approval.reason } : {}),
        },
      });
    }
  }

  return [...responses.values()];
}

async function startChatRun(mastra: Mastra, params: ChatRequest) {
  const { id: _id, messages, runId, resumeData, ...options } = params;
  const agent = getChatAgent(mastra);

  const approvalResponses =
    runId || resumeData !== undefined ? [] : extractApprovalResponses(messages);

  if (approvalResponses.length > 0) {
    const [approval] = approvalResponses;
    const result = await agent.resume(
      approval.runId,
      approval.resumeData,
      { ...options, toolCallId: approval.toolCallId } as never,
    );
    return {
      result,
      stream: createAgentUIStream(result, messages),
    };
  }

  if (runId && resumeData !== undefined) {
    const result = await agent.resume(runId, resumeData, options as never);
    return {
      result,
      stream: createAgentUIStream(result, messages),
    };
  }

  const result = await agent.stream(messages, options as never);
  return {
    result,
    stream: createAgentUIStream(result, messages),
  };
}

async function handleRunResume(c: any) {
  const runId = c.req.param('runId');
  if (!runId) return Response.json({ error: 'runId is required' }, { status: 400 });

  try {
    const body = (await c.req.json()) as {
      resumeData?: unknown;
      messages?: UIMessage[];
      toolCallId?: string;
      [key: string]: unknown;
    };
    if (body.resumeData === undefined) {
      return Response.json({ error: 'resumeData is required' }, { status: 400 });
    }

    const agent = getChatAgent(c.get('mastra'));
    const { resumeData, messages = [], toolCallId, ...options } = body;
    const result = await agent.resume(
      runId,
      resumeData,
      { ...options, ...(toolCallId ? { toolCallId } : {}) } as never,
    );
    return createUIMessageStreamResponse({
      stream: createAgentUIStream(result, messages),
    });
  } catch (error) {
    console.error('[chat-api] failed to resume run', runId, error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to resume chat run' },
      { status: 400 },
    );
  }
}

async function handleChatPost(c: any) {
  try {
    const params = (await c.req.json()) as ChatRequest;
    if (!Array.isArray(params.messages)) {
      return Response.json({ error: 'messages must be an array' }, { status: 400 });
    }

    const { stream } = await startChatRun(c.get('mastra'), params);
    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('[chat-api] failed to start run', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to start chat run' },
      { status: 500 },
    );
  }
}

async function handleRunStream(c: any) {
  const runId = c.req.param('runId');
  if (!runId) return Response.json({ error: 'runId is required' }, { status: 400 });

  try {
    const agent = getChatAgent(c.get('mastra'));
    const result = await agent.observe(runId, {
      idleTimeoutMs: 15 * 60 * 1000,
    });
    const stream = createAgentUIStream(result, []);
    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('[chat-api] failed to observe run', runId, error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Run is no longer observable' },
      { status: 404 },
    );
  }
}

async function handleRunStatus(c: any) {
  const runId = c.req.param('runId');
  if (!runId) return Response.json({ error: 'runId is required' }, { status: 400 });

  try {
    const agent = getChatAgent(c.get('mastra'));
    const { runs } = await agent.listActiveRuns();
    const run = runs.find((candidate) => candidate.runId === runId);
    return Response.json({
      runId,
      status: run?.status ?? 'completed',
      threadId: run?.threadId,
      resourceId: run?.resourceId,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to read run status' },
      { status: 500 },
    );
  }
}

async function handleRunCancel(c: any) {
  const runId = c.req.param('runId');
  if (!runId) return Response.json({ error: 'runId is required' }, { status: 400 });

  try {
    const agent = getChatAgent(c.get('mastra'));
    const accepted = agent.abortRunStream(runId);
    return Response.json({ runId, accepted, status: accepted ? 'cancelling' : 'completed' });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel run' },
      { status: 500 },
    );
  }
}

async function handleThreadMessages(c: any) {
  const threadId = c.req.param('threadId');
  const resourceId = c.req.query('resourceId') ?? 'browser-demo-user';
  if (!threadId) return Response.json({ error: 'threadId is required' }, { status: 400 });

  try {
    const agent = getChatAgent(c.get('mastra'));
    const memory = await agent.getMemory();
    if (!memory) return Response.json({ messages: [] });

    const recalled = await memory.recall({
      threadId,
      resourceId,
      perPage: false,
    });

    const messages: UIMessage[] = recalled.messages
      .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'system')
      .map((message) => ({
        id: message.id,
        role: message.role,
        parts: message.content.parts ?? [
          { type: 'text', text: message.content.content ?? '' },
        ],
      } as UIMessage));

    return Response.json({ messages });
  } catch (error) {
    console.error('[chat-api] failed to read thread', threadId, error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to read chat history' },
      { status: 500 },
    );
  }
}

export const chatApiRoutes: ApiRoute[] = [
  registerApiRoute('/ai/chat', {
    method: 'POST',
    requiresAuth: false,
    handler: handleChatPost,
  }),
  registerApiRoute('/ai/chat/runs/:runId/stream', {
    method: 'GET',
    requiresAuth: false,
    handler: handleRunStream,
  }),
  registerApiRoute('/ai/chat/runs/:runId', {
    method: 'GET',
    requiresAuth: false,
    handler: handleRunStatus,
  }),
  registerApiRoute('/ai/chat/runs/:runId/cancel', {
    method: 'POST',
    requiresAuth: false,
    handler: handleRunCancel,
  }),
  registerApiRoute('/ai/chat/runs/:runId/resume', {
    method: 'POST',
    requiresAuth: false,
    handler: handleRunResume,
  }),
  registerApiRoute('/ai/chat/threads/:threadId/messages', {
    method: 'GET',
    requiresAuth: false,
    handler: handleThreadMessages,
  }),
];
