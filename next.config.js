/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Configure for Cloudflare Pages deployment - keeping Server Actions support
  images: {
    unoptimized: true,
  },
  experimental: {
    dynamicIO: false,
  },
  // Optimize bundle size for Cloudflare Pages
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Disable webpack cache to reduce file size
  webpack: (config) => {
    config.cache = false
    return config
  },
}

module.exports = nextConfig
