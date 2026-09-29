import { Agent } from '@mastra/core/agent';
import { chatModel } from '../../lib/model';

/** Kept separate from chatAgent so approvalWorkflow can call an Agent without creating a circular import. */
export const taskExecutorAgent = new Agent({
  id: 'task-executor-agent',
  name: 'Workflow Task Executor',
  description: 'Executes the final text-generation step after a durable human approval workflow resumes.',
  model: chatModel,
  instructions: '你是工作流执行器。只执行已经通过审批的任务，并给出简洁结果。',
});
