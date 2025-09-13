# Cloudflare Workers Setup Guide

This project is now configured for deployment on Cloudflare Workers.

## Configuration Files

### wrangler.toml

```toml
name = "napoleon-game-dev"
compatibility_date = "2024-12-01"

# Cloudflare Workers with Next.js SSR
main = ".next/standalone/server.js"

# Environment variables
[vars]
NODE_ENV = "production"

# Production environment
[env.production]
name = "napoleon-game"
vars = { NODE_ENV = "production" }

# Build command includes static file copying
[build]
command = "npm run build && cp -r .next/static .next/standalone/.next/"

# Next.js compatibility
compatibility_flags = ["nodejs_compat"]
```

### next.config.js

```javascript
const nextConfig = {
  // Workers deployment with SSR
  output: 'standalone',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    dynamicIO: false,
  },
};
```

## Deployment Process

1. **Build the project**:

   ```bash
   npm run build
   ```

2. **Deploy to Workers**:
   ```bash
   npx wrangler deploy
   ```

## Key Features

- **SSR Support**: Server Actions and dynamic rendering work correctly
- **Static Assets**: Automatically copied to standalone deployment
- **Environment Variables**: Configured for dev/production environments
- **Node.js Compatibility**: Uses `nodejs_compat` flag for Next.js

## Troubleshooting

- The build creates a standalone server at `.next/standalone/server.js`
- Static files are copied to `.next/standalone/.next/static/`
- Environment variables are set in wrangler.toml
- Dynamic routes like `/game/[gameId]` work with SSR

## Environment Variables

Set these in Cloudflare Workers dashboard or wrangler.toml:

```
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```
