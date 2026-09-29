import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const orders = {
  A1001: { status: '已发货', amount: 399, eta: '明天下午', item: '机械键盘' },
  A1002: { status: '处理中', amount: 1280, eta: '预计 2 个工作日', item: '显示器' },
  A1003: { status: '已完成', amount: 88, eta: '已签收', item: 'USB-C Hub' },
} as const;

export const orderLookupTool = createTool({
  id: 'order-lookup',
  description: 'Look up a demo order by order id. Supported ids: A1001, A1002, A1003.',
  inputSchema: z.object({
    orderId: z.string().describe('Order id such as A1001'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    orderId: z.string(),
    status: z.string().optional(),
    amount: z.number().optional(),
    eta: z.string().optional(),
    item: z.string().optional(),
  }),
  execute: async ({ orderId }) => {
    // Small delay makes the tool event visible in the streaming UI.
    await new Promise(resolve => setTimeout(resolve, 450));
    const order = orders[orderId.toUpperCase() as keyof typeof orders];
    if (!order) return { found: false, orderId };
    return { found: true, orderId: orderId.toUpperCase(), ...order };
  },
});
