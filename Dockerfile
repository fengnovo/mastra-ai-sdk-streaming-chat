FROM node:22-slim AS deps
WORKDIR /app
RUN npm i -g pnpm@10.17.1
COPY package.json .npmrc ./
RUN pnpm install --frozen-lockfile=false

FROM node:22-slim AS builder
WORKDIR /app
RUN npm i -g pnpm@10.17.1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN mkdir -p /app/data /app/workspace
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# The local MCP server is spawned as a separate Node process at runtime, so copy it explicitly.
COPY --from=builder /app/mcp ./mcp
COPY --from=builder /app/workspace ./workspace
EXPOSE 3000
CMD ["node", "server.js"]
