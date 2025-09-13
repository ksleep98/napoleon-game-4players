/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Configure for Cloudflare Pages deployment - SPA mode
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Configure for runtime rendering
  experimental: {
    dynamicIO: false,
  },
}

module.exports = nextConfig
