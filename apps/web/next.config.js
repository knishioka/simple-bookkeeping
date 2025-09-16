const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

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
    removeConsole: process.env.NODE_ENV === 'production',
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
