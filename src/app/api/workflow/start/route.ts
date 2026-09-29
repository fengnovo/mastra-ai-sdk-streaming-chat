import { z } from 'zod';
import { mastra } from '@/mastra';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  task: z.string().min(1),
  amount: z.number().nonnegative(),
});

export async function POST(req: Request) {
  try {
    const inputData = inputSchema.parse(await req.json());
    const workflow = mastra.getWorkflow('approval-workflow');
    const run = await workflow.createRun();
    const result = await run.start({ inputData });

    return Response.json({
      runId: run.runId,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow error';
    return Response.json({ error: message }, { status: 400 });
  }
}
