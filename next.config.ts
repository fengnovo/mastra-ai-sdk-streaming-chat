import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    '@mastra/core',
    '@mastra/editor',
    '@mastra/libsql',
    '@mastra/mcp',
    '@mastra/memory',
    '@mastra/observability',
  ],
};

export default nextConfig;
