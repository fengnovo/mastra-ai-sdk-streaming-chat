import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const calculatorTool = createTool({
  id: 'calculator',
  description: 'Perform deterministic arithmetic. Always use this tool for explicit calculations.',
  inputSchema: z.object({
    a: z.number().describe('Left operand'),
    b: z.number().describe('Right operand'),
    operation: z.enum(['add', 'subtract', 'multiply', 'divide', 'power']),
  }),
  outputSchema: z.object({
    expression: z.string(),
    result: z.number(),
  }),
  execute: async ({ a, b, operation }) => {
    if (operation === 'divide' && b === 0) {
      throw new Error('Division by zero is not allowed.');
    }

    const operators = {
      add: '+',
      subtract: '-',
      multiply: '×',
      divide: '÷',
      power: '^',
    } as const;

    const result =
      operation === 'add'
        ? a + b
        : operation === 'subtract'
          ? a - b
          : operation === 'multiply'
            ? a * b
            : operation === 'divide'
              ? a / b
              : a ** b;

    return {
      expression: `${a} ${operators[operation]} ${b}`,
      result,
    };
  },
});
