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
  // Node.js polyfills for Cloudflare Workers
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        fs: 'fs',
        path: 'path',
        stream: 'stream',
        util: 'util',
        crypto: 'crypto',
        os: 'os',
      })
    }
    return config
  },
}

module.exports = nextConfig
