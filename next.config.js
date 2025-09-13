/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Configure for Cloudflare Workers deployment with SSR
  output: 'standalone',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Configure for Cloudflare Workers edge runtime
  experimental: {
    dynamicIO: false,
  },
}

module.exports = nextConfig
