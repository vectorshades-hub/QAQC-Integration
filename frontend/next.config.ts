import type { NextConfig } from 'next';

// The browser only ever talks to Next.js. Every /api/* request is proxied to the
// Express backend, so the session cookie stays same-origin and no CORS is needed.
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001';

const nextConfig: NextConfig = {
  // Allows several dev servers side by side (testing): NEXT_DIST_DIR=.next-alt next dev -p 3101
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false, // hide the Next.js dev-mode "N" badge
  reactStrictMode: false, // pages fire real POST/DELETE side effects; avoid double-invoked effects in dev
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
  experimental: {
    proxyTimeout: 300000,
    proxyClientMaxBodySize: '2gb',
  },
};

export default nextConfig;
