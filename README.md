# Mastra × AI SDK UI：Streaming Chat + Editor + Web + Files + Shell + MCP + Sub-Agent

这是上一版 `mastra-ai-sdk-streaming-chat` 的增强版，重点是让 Mastra Studio 里的 Agent 不再只是 `Memory + 2 Tools`，而是真正具备 **Tools、Editor、Workflows、Sub-agents**，并额外接入一条可实际验证的 **MCP stdio** 链路。

## 1. 现在有哪些真实能力

| 能力 | 实现 |
|---|---|
| AI SDK UI 流式 Chat | `useChat()` → Next `/api/chat` → `handleChatStream(version: 'v7')` |
| Mastra Agent Loop | `chat-agent`，最多 16 steps，可连续 Tool / Agent / Workflow 调用 |
| Editor | `@mastra/editor@0.15.3` + `new MastraEditor()`，Studio 可 Draft / Publish system prompt 等配置 |
| Web Search | `web-search` 调用真实 Tavily API，不返回 mock 数据 |
| Web Fetch | Mastra `webFetchTool` |
| 文件读写 | `list-files` / `read-file` / `write-file`，默认限制在 `./workspace` |
| run_command | `run-command` 在 workspace 内真实执行 shell，返回 stdout/stderr/exitCode |
| MCP | `MCPClient` → 本地 `MCPServer` → stdio，内置 `project-capabilities` / `mcp-echo` |
| Sub-Agent | `research-agent` + `coding-agent`，父 Agent 可直接委托 |
| Workflow | `approval-workflow` 挂到 `chat-agent.workflows`，可被父 Agent 当工具调用 |
| HITL / durability | 金额 >= 1000 时 `suspend()`；PostgreSQL snapshot 支持 resume |
| Memory | `@mastra/memory` + 独立 PostgreSQL 数据库 |
| Evals | `response-quality` scorer |
| Observability | Agent / Tool / MCP / Workflow traces 写入 Mastra storage |

Mastra 官方当前支持把 sub-agent 和 workflow 直接注册到 Agent 上，它们会自动变成 `agent-*` / `workflow-*` 工具；Editor 也能版本化 instructions、tools、sub-agents 和 workflows。

## 2. 版本是特意锁死的

为避免你刚才遇到的 `MastraEditor` / `IMastraEditor`、`MCPServerBase private idWasSet` 这种 **同一个 @mastra/core 被 pnpm 解析成多份 peer 实例**的问题，这版不再使用 `^`：

```text
@mastra/core   1.71.0
@mastra/editor 0.15.3
@mastra/mcp    2.1.0
ai             7.0.122
zod            4.6.5
```

并增加 `.npmrc`：

```ini
dedupe-peer-dependents=true
resolve-peers-from-workspace-root=true
auto-install-peers=true
strict-peer-dependencies=false
```

`package.json` 里还有 `pnpm.overrides`，强制核心的 `@mastra/core / ai / zod` 版本一致。

## 3. 第一次启动

要求 Node.js >= 22.13。

```bash
cp .env.example .env
```

至少配置模型：

```env
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=sk-xxx
AI_MODEL=deepseek-v4-flash
```

如果要验证**真实 Web Search**，再填：

```env
TAVILY_API_KEY=tvly-xxx
```

然后：

```bash
pnpm install
pnpm check
pnpm typecheck
```

确认 `/Users/keen/Desktop/code/projects/chat/infra/compose.yaml` 中现有的 PostgreSQL 和 Redis 已在运行。按 [本地后台任务运行说明](docs/background-runtime.md) 创建 `mastra_streaming_chat` 数据库；本项目使用 PostgreSQL `55433` 和 Redis 逻辑库 `15`（端口 `56379`）。一条命令启动项目（自动构建 Mastra API 和 Worker）：

```bash
pnpm dev
```

关闭本项目的 Next.js、Mastra Studio/API 和 Worker：

```bash
pnpm dev:close
```

脚本只管理由 `pnpm dev` 启动的进程，不会关闭共用的 PostgreSQL、Redis。日志保存在 `.local-runtime/`。

打开：

```text
http://localhost:3031
```

## 4. Mastra Studio

`pnpm studio` 同时提供 Mastra API 和管理界面。打开：

```text
http://localhost:4111
```

进入：

```text
Agents → Mastra Streaming Assistant
```

这一版 `chat-agent` 的核心配置就是：

```ts
tools: async () => ({
  calculator,
  orderLookup,
  webSearch,
  webFetch,
  listFiles,
  readFile,
  writeFile,
  runCommand,
  ...mcpTools,
}),
agents: {
  research: researchAgent,
  coding: codingAgent,
},
workflows: {
  approval: approvalWorkflow,
},
```

因此 Studio 里应能看到：

```text
Memory       On
Editor       Enabled / 可编辑
Tools        多个
Workflows    1
Sub-agents   2
```

System Prompt 不再需要回代码里改；在 Editor 中修改后可以按 Draft → Test → Publish 的方式生效。

## 5. 一条一条验收

### A. Tools + 多步 Agent Loop

```text
查询订单 A1001，然后计算订单金额加 10% 服务费，一步一步调用工具。
```

预期：

```text
order-lookup → calculator → final answer
```

### B. Research Sub-Agent + Web Search

确保 `.env.local` 有 `TAVILY_API_KEY`：

```text
请委托 research 子代理搜索 Mastra 最近一个版本有什么新能力，并给我来源。
```

真实链路：

```text
chat-agent
  → agent-research
      → web-search
          → Tavily HTTP API
      → research result
  → final answer
```

没有 Tavily key 时不会 mock，会明确返回“未配置”。

### C. Coding Sub-Agent + 文件读写 + run_command

```text
请委托 coding 子代理：在 workspace 里创建 hello.ts，内容打印 hello mastra，然后执行 node --version 和 ls -la 验证。
```

你可以直接在本机看：

```bash
ls -la workspace
cat workspace/hello.ts
```

所有文件工具都做了路径越界检查，默认不能访问 `workspace` 外部。

`run-command` 也把 cwd 固定到这个 workspace。明显危险的 host 命令默认拦截；只有你显式设置：

```env
ALLOW_UNSAFE_COMMANDS=true
```

才会放开这层 Demo guard。生产环境建议把 shell 放进真正的 container/VM sandbox，不要直接跑宿主机。

### D. MCP 真链路

这版没有用假的 `mcpTool()` 包一层名字，而是：

```text
Mastra chat-agent
      ↓
@mastra/mcp MCPClient
      ↓ stdio
node mcp/local-server.mjs
      ↓
@mastra/mcp MCPServer
      ↓
project-capabilities / mcp-echo
```

直接测试：

```text
请调用本地 MCP 的 project-capabilities 工具，告诉我这条链路是否真的走了 MCP。
```

也可以单独启动 server（它会等待 MCP client 的 stdio 请求，所以终端看起来“卡住”是正常的）：

```bash
pnpm mcp:local
```

在 Studio 的 Trace 里，MCP 工具调用会有独立的 MCP tool span。

### E. Workflow 挂到 Agent

`chat-agent` 现在显式配置：

```ts
workflows: {
  approval: approvalWorkflow,
}
```

所以它不是只有左侧 Workflows 页面里“孤立存在”，而是父 Agent 真能把 workflow 当能力调用。

可以在 Chat 中要求：

```text
把“生成一份采购说明”作为金额 1800 的审批任务，走 approval workflow。
```

也可以继续用页面右侧的 Durable Workflow 面板验证 suspend/resume。

### F. durability / 快速恢复

右侧金额填 `1800` → 启动 workflow → suspend 后停掉 Node → 重启 → 使用同一个 runId resume。

状态存储在：

```text
data/mastra.db
```

不是 React state 模拟。

## 6. 关键目录

```text
src/mastra/
├─ index.ts
├─ storage.ts
├─ agents/
│  ├─ chat-agent.ts              # Supervisor
│  ├─ research-agent.ts          # Web research sub-agent
│  ├─ coding-agent.ts            # file/shell/MCP sub-agent
│  └─ task-executor-agent.ts     # workflow 内部执行器，避免循环 import
├─ tools/
│  ├─ calculator.ts
│  ├─ order-lookup.ts
│  ├─ web-search.ts              # Tavily real API
│  ├─ file-tools.ts              # list/read/write
│  └─ run-command.ts             # real shell execution
├─ mcp/
│  └─ client.ts                  # Mastra MCPClient
├─ workflows/
│  └─ approval-workflow.ts
└─ scorers/
   └─ response-quality.ts

mcp/
└─ local-server.mjs              # 真正独立的 stdio MCPServer

workspace/                       # Agent 文件/命令沙箱根目录
```

## 7. Editor 相关代码

`src/mastra/index.ts`：

```ts
import { MastraEditor } from '@mastra/editor';

export const mastra = new Mastra({
  // agents/tools/workflows/storage...
  editor: new MastraEditor(),
});
```

PostgreSQL 同时提供 agents、promptBlocks、mcpClients、workflows 等 Editor 所需 storage domains，本项目统一使用 `mastra_streaming_chat` 数据库。

## 8. MCP 为什么做成本地 server

目的是让 ZIP 解压后**不依赖 GitHub/Sentry/第三方账号就能验证 MCP 协议本身**。之后你要接真实第三方 MCP，只需要在 `src/mastra/mcp/client.ts` 增加一个 server：

```ts
const client = new MCPClient({
  servers: {
    localProject: { ... },
    yourRemoteMcp: {
      url: new URL(process.env.YOUR_MCP_URL!),
    },
  },
});
```

Agent 其他代码不用改。

## 9. 本地基础设施

本项目不提供自己的容器部署配置。Next.js、Mastra API 和 Worker 均在本机运行，复用已启动的 PostgreSQL、Redis。启动顺序和数据库初始化见 [本地后台任务运行说明](docs/background-runtime.md)。

## 10. 建议先执行的故障定位命令

如果 `editor: new MastraEditor()` 再出现 private `idWasSet`：

```bash
pnpm list @mastra/core @mastra/editor @mastra/mcp ai zod --depth 10
find node_modules/.pnpm -maxdepth 1 -type d -name '@mastra+core@1.71.0*'
```

正常目标是核心 peer 环境只解析成一套。不要用 `as any` 把问题藏掉。

## 11: 实时执行过程 UI

聊天页面现在把 AI SDK 的 `message.parts` 组织成三层，而不是把工具卡片散落在正文里：

```text
Reasoning Summary（可核验执行摘要，不是原始隐藏思维链）
  ↓
Execution Trace
  Planning
  → Tool / MCP / Sub-Agent / Workflow
  → 每一步真实 input / output / error
  ↓
Final Answer
```

`useChat` 在流式接收到 tool part 状态变化时会触发重新渲染，因此时间线会从“执行中”更新为“完成/失败”。Mastra 的 `handleChatStream(..., version: 'v7')` 继续负责把 Agent 流转换成 AI SDK v7 UI Message Stream。

建议用下面几条验证：

```text
查询订单 A1001，然后计算订单金额加 10% 服务费，一步一步调用工具。

请委托 coding 子代理：在 workspace 创建 demo.ts，再执行 ls -la 验证。

请调用本地 MCP 的 project-capabilities 工具验证 MCP 链路。

请委托 research 子代理搜索 Mastra 最近的更新。（需要 TAVILY_API_KEY）
```

说明：前端不展示模型内部原始隐藏 chain-of-thought。Reasoning Summary 只描述从真实 Agent/Tool/MCP/Workflow 事件可以核验的执行状态；具体工具输入输出可在每个步骤中展开查看。
