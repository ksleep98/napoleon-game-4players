import { createRequire } from 'node:module'

// Create require for CommonJS compatibility
const require = createRequire(import.meta.url)

// Import the Next.js standalone server
const server = require('./.next/standalone/server.js')

// Export default handler for ES Module format
export default {
  async fetch(request, env, ctx) {
    return server(request, env, ctx)
  },
}
