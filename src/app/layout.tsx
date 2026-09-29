import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mastra × AI SDK — Streaming Agent App',
  description: 'Streaming chat, tools, durable workflows, storage, evals, observability and Studio.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
