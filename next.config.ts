import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
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
