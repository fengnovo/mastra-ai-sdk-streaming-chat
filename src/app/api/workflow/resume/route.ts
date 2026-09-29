import { z } from 'zod';
import { mastra } from '@/mastra';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  runId: z.string().min(1),
  approved: z.boolean(),
  approver: z.string().min(1).default('demo-user'),
});

export async function POST(req: Request) {
  try {
    const { runId, approved, approver } = bodySchema.parse(await req.json());
    const workflow = mastra.getWorkflow('approval-workflow');

    // Re-bind to the persisted run id. This is the important recovery path:
    // the original Node process does not need to still be alive.
    const run = await workflow.createRun({ runId });
    const result = await run.resume({
      step: 'human-approval',
      resumeData: { approved, approver },
    });

    return Response.json({ runId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow error';
    return Response.json({ error: message }, { status: 400 });
  }
}
