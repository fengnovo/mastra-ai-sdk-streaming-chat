import { LibSQLStore } from '@mastra/libsql';

/**
 * A single durable storage is shared by:
 * - Agent memory (threads/messages)
 * - Workflow snapshots (suspend/resume/recovery)
 * - Observability traces
 * - Scorer/eval results
 */
export const storage = new LibSQLStore({
  id: 'app-storage',
  url: process.env.MASTRA_DB_URL ?? 'file:./data/mastra.db',
});
