# Napoleon Game - Development Dockerfile
# This creates a complete development environment for running pnpm dev

FROM node:22-alpine

# Install essential tools
RUN apk add --no-cache \
    git \
    bash \
    curl

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Expose Next.js development server port
EXPOSE 3000

# Default command (can be overridden)
CMD ["pnpm", "dev"]
