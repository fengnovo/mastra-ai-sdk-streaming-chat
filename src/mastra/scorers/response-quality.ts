import { createScorer } from '@mastra/core/evals';

/**
 * Zero-extra-token deterministic live eval.
 * It is intentionally simple: the point is to make the official Mastra scorer path visible
 * in Studio without paying for a second judge-model call.
 */
export const responseQualityScorer = createScorer({
  id: 'response-quality',
  name: 'Response Quality (demo)',
  description: 'Checks that the response is non-trivial and contains enough useful content.',
  type: 'agent',
}).generateScore(({ run }) => {
  const serialized =
    typeof run.output === 'string' ? run.output : JSON.stringify(run.output ?? '');
  const length = serialized.trim().length;
  if (length >= 180) return 1;
  if (length >= 80) return 0.75;
  if (length >= 30) return 0.5;
  return 0.25;
});
