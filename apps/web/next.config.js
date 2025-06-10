/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@simple-bookkeeping/database', '@simple-bookkeeping/shared'],
};

module.exports = nextConfig;
