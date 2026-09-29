import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RELATIVE_FILE_URL = /^file:\.{1,2}\//;

/** Resolve local SQLite files consistently in Next.js and Mastra's child process. */
export function resolveDatabaseUrl(
  databaseUrl: string,
  projectRoot = process.env.MASTRA_PROJECT_ROOT ?? process.cwd(),
) {
  if (!RELATIVE_FILE_URL.test(databaseUrl)) return databaseUrl;

  const relativePath = databaseUrl.slice('file:'.length);
  const resolvedRoot = path.resolve(projectRoot);
  const appRoot = path.basename(resolvedRoot) === '.mastra' ? path.dirname(resolvedRoot) : resolvedRoot;

  return pathToFileURL(path.resolve(appRoot, relativePath)).href;
}
