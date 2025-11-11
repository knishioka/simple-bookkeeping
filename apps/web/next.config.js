const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/**
 * Content Security Policy configuration
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' *.supabase.co *.supabase.in;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
  block-all-mixed-content;
  connect-src 'self' *.supabase.co *.supabase.in wss://*.supabase.co wss://*.supabase.in https://api.github.com;
`
  .replace(/\s{2,}/g, ' ')
  .trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@simple-bookkeeping/database', '@simple-bookkeeping/shared'],
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  compiler: {
    // Temporarily disable console removal for debugging authentication issues
    // TODO: Re-enable after fixing authentication redirect loop
    // removeConsole: process.env.NODE_ENV === 'production',
    removeConsole: false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },

  /**
   * Security headers configuration
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
  // Webpack configuration to optimize file watching
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Exclude test files and E2E tests from file watching in dev mode
      config.watchOptions = {
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/e2e/**',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/playwright/**',
          '**/playwright.config.ts',
          '**/__tests__/**',
          '**/coverage/**',
          '**/test-results/**',
          '**/.git/**',
        ],
      };
    }
    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
