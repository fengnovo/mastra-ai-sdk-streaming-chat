# 本地后台任务运行方式

聊天任务由 Mastra 的 Evented Agent 和独立 Worker 执行。切换会话、刷新浏览器或 Next.js 请求断开后，Worker 仍可继续处理；再次进入会话会根据 `runId` 恢复事件流。人工审核的任务会暂停，等待批准或拒绝后继续。

```text
浏览器 → Next.js :3031 → Mastra API / Studio :4111
                              │
                              ├─ PostgreSQL :55433 / mastra_streaming_chat
                              ├─ Redis :56379 / DB 15
                              └─ Mastra Worker :4112（仅本机健康检查）
```

本项目只运行本机 Node.js 进程。PostgreSQL 和 Redis 来自 `/Users/keen/Desktop/code/projects/chat/infra/compose.yaml` 中已经启动的容器。`55433` 对应其中的 `postgres-test` 实例；本项目在该实例中使用独立的 `mastra_streaming_chat` 数据库，不使用它的 `agent_test` 库。Redis 使用独立逻辑库 15，并为事件和缓存设置 `mastra-streaming-chat:` 前缀。

## 首次准备

1. 确认外部 PostgreSQL `127.0.0.1:55433`、Redis `127.0.0.1:56379` 已运行。
2. 在现有 PostgreSQL 实例中创建一次数据库（若已经存在则跳过）：

   ```bash
   docker exec chat-agent-postgres-test-1 psql -U agent -d agent_test -c 'CREATE DATABASE mastra_streaming_chat OWNER agent'
   ```

3. 把 `.env.example` 复制为 `.env`，填好 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`。`DATABASE_URL` 和 `REDIS_URL` 默认已指向本机现有服务；本地覆盖值可放在 `.env.local`。
4. 安装依赖：

   ```bash
   pnpm install
   ```

## 日常启动

一个命令构建 Worker 并启动三个本机进程：

```bash
pnpm dev
```

关闭这三个进程：

```bash
pnpm dev:close
```

脚本将 PID 和日志放在 `.local-runtime/`；关闭时停止整组子进程，包括 Next.js 服务器和 Worker。它只管理自己启动的进程，不会关闭共用的 PostgreSQL、Redis 容器。如果 3031、4111 或 4112 已被手动启动的进程占用，先停止它们再执行 `pnpm dev`。

`pnpm studio` 在 4111 启动 Mastra API 和管理界面，配置为只提交任务；`pnpm mastra:worker` 消费编排与后台工具任务，并在 4112 提供健康检查；`pnpm dev:1` 在 3031 单独启动聊天页面。通常只需运行 `pnpm dev` 一次启动全部服务。Worker 构建产物保存在独立的 `.mastra-worker` 目录，避免 Studio 启动或热更新时清理 `.mastra` 导致 Worker 退出。Worker 启动脚本会先加载 `.env.local` 和 `.env`。修改 Mastra Agent 或 Workflow 源码后，执行 `pnpm dev:close` 和 `pnpm dev` 即可重新构建并启动。

## 验证

打开 `http://localhost:3031` 和 `http://localhost:4111`。在聊天页面发送一个会调用工具的任务，切换到另一会话，再切回来观察结果；在工作流面板以金额 1800 启动一次任务，可检查 `suspended` 和批准/拒绝后的恢复。Worker 关闭时，API 可接收任务，但不会执行编排，所以三个进程都需要运行。

启动前请确保 `.env` 或 `.env.local` 提供同一组 `DATABASE_URL`、`REDIS_URL`，并让 Mastra API 和 Worker 从同一项目目录运行。API/Worker 模式缺少其中任一值会直接报错，避免任务被写入仅当前进程可见的存储。Redis DB 15 的隔离以其他项目不使用该逻辑库为前提；不要对该 DB 执行 `FLUSHDB`，否则会丢失本项目的事件缓存。
