/** @type {import('next').NextConfig} */
// apps/web/next.config.js — Phase 9 update
// output: 'standalone' is REQUIRED for Electron bundling.
// The standalone build produces a self-contained server.js that
// Electron spawns as a child process in production (see main.js).
//
// Replace the Phase 2 next.config.js with this file.

const nextConfig = {
  // Standalone output bundles all node_modules into .next/standalone/
  // so Electron can run the server without a separate node_modules folder.
  output: 'standalone',

  // In development, proxy /api/* to the NestJS server
  // In production, the desktop app reaches NestJS at localhost:3001
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/api/:path*',
            destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/:path*`,
          },
        ]
      : [];
  },

  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [],
  },

  reactStrictMode: true,

  // Suppress hydration warnings caused by Electron injecting window.electron
  // before React hydrates
  compiler: {
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig;
