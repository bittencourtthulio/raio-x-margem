import type { NextConfig } from 'next';
const publicArtifacts = [{ key: 'Access-Control-Allow-Origin', value: '*' }, { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }, { key: 'X-Content-Type-Options', value: 'nosniff' }];
const nextConfig: NextConfig = {
  async redirects() { return [{ source: '/:alias(LLM|llm).txt', destination: '/llms.txt', permanent: true }]; },
  async headers() {
    return [
      { source: '/docs/api/:path*', headers: publicArtifacts },
      { source: '/downloads/:path*', headers: publicArtifacts },
      { source: '/docs/api/:path*.md', headers: [{ key: 'Content-Type', value: 'text/markdown; charset=utf-8' }] },
    ];
  },
};
export default nextConfig;
