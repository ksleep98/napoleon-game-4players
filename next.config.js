/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Configure for runtime rendering
  experimental: {
    dynamicIO: false,
  },
}

module.exports = nextConfig
