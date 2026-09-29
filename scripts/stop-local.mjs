import { readState, stopServices } from './local-services.mjs';

async function main() {
  const state = await readState();
  if (!state) {
    console.log('没有由 pnpm dev 启动的项目进程。');
    return;
  }
  await stopServices(state);
  console.log('已关闭 Next.js、Mastra Studio/API 和 Worker。');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
