import { mastra } from '@/mastra';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { runId } = await params;
    const workflow = mastra.getWorkflow('approval-workflow');
    const state = await workflow.getWorkflowRunById(runId);

    if (!state) {
      return Response.json({ error: 'Workflow run not found.' }, { status: 404 });
    }

    return Response.json({ runId, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow error';
    return Response.json({ error: message }, { status: 400 });
  }
}
