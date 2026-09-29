import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { taskExecutorAgent } from '../agents/task-executor-agent';

const requestSchema = z.object({
  task: z.string().min(1),
  amount: z.number().nonnegative(),
});

const approvalOutputSchema = z.object({
  task: z.string(),
  amount: z.number(),
  approved: z.boolean(),
  approver: z.string(),
});

const approvalStep = createStep({
  id: 'human-approval',
  description: 'Suspends expensive tasks and waits for human approval.',
  inputSchema: requestSchema,
  outputSchema: approvalOutputSchema,
  suspendSchema: z.object({
    reason: z.string(),
    task: z.string(),
    amount: z.number(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    approver: z.string().default('demo-user'),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (inputData.amount >= 1000 && !resumeData) {
      return await suspend({
        reason: `金额 ¥${inputData.amount} 达到审批阈值（¥1000）`,
        task: inputData.task,
        amount: inputData.amount,
      });
    }

    return {
      task: inputData.task,
      amount: inputData.amount,
      approved: resumeData?.approved ?? true,
      approver: resumeData?.approver ?? 'auto-policy',
    };
  },
});

const executeStep = createStep({
  id: 'agent-execution',
  description: 'Calls a dedicated Agent after the durable approval checkpoint.',
  inputSchema: approvalOutputSchema,
  outputSchema: z.object({
    status: z.enum(['completed', 'rejected']),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.approved) {
      return {
        status: 'rejected' as const,
        message: `任务“${inputData.task}”已被 ${inputData.approver} 拒绝。`,
      };
    }

    const response = await taskExecutorAgent.generate(
      `工作流已获批准。请执行并简洁总结这个任务：${inputData.task}。预算/金额：¥${inputData.amount}。审批人：${inputData.approver}。`,
    );

    return {
      status: 'completed' as const,
      message: response.text,
    };
  },
});

export const approvalWorkflow = createWorkflow({
  id: 'approval-workflow',
  description:
    'Durable human-in-the-loop workflow with suspend/resume checkpoints.',
  inputSchema: requestSchema,
  outputSchema: z.object({
    status: z.enum(['completed', 'rejected']),
    message: z.string(),
  }),
})
  .then(approvalStep)
  .then(executeStep)
  .commit();
