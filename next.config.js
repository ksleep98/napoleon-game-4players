/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Configure for Cloudflare Pages deployment
  images: {
    unoptimized: true,
  },
  experimental: {
    dynamicIO: false,
  },
}

module.exports = nextConfig
