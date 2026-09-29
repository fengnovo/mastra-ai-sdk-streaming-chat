import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';
import { resolveDatabaseUrl } from './database-url';

/**
 * A single durable storage is shared by:
 * - Agent memory (threads/messages)
 * - Workflow snapshots (suspend/resume/recovery)
 * - Observability traces
 * - Scorer/eval results
 */
const databaseUrl = process.env.DATABASE_URL;

export const storage = databaseUrl
  ? new PostgresStore({
      id: 'app-storage',
      connectionString: databaseUrl,
    })
  : new LibSQLStore({
      id: 'app-storage',
      url: resolveDatabaseUrl(process.env.MASTRA_DB_URL ?? 'file:./data/mastra.db'),
    });
