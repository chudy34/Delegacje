/** @type {import('next').NextConfig} */

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let apiHostname = 'localhost:3001';
try {
  apiHostname = new URL(apiUrl).host;
} catch {
  // keep default
}

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', apiHostname],
    },
  },

  // API proxy – używany tylko w dev (npm run dev).
  // W produkcji nginx przechwytuje /api/ i kieruje bezpośrednio do backendu.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
