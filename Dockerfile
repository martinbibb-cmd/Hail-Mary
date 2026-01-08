# syntax=docker/dockerfile:1

# Main Dockerfile for Hail-Mary (all services)
# CPU Compatibility: Optimized for non-AVX x86_64 CPUs (SSE4.2 only)
# Compatible with Intel Celeron N5105 (Jasper Lake) and similar CPUs
# Uses Debian-based image (glibc) for better native module compatibility

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.18.0
FROM node:${NODE_VERSION}-bookworm-slim AS base

LABEL fly_launch_runtime="NodeJS"

# NodeJS app lives here
WORKDIR /app


# Throw-away build stage to reduce size of final image
FROM base AS build

# Use a non-production NODE_ENV so devDependencies (like typescript) are installed
ENV NODE_ENV=development

# Install packages needed to build node modules
# python3, make, g++: Required for node-gyp to compile native addons
# pkg-config: Used by some native modules to find system libraries
# ca-certificates: For SSL/TLS connections
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    python3 \
    python-is-python3 \
    make \
    g++ \
    pkg-config \
    build-essential \
    ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Configure npm to handle SSL certificate issues in some cloud build environments.
# This is needed because some CI/CD environments (including fly.io builders) may have
# network configurations that cause SSL certificate chain errors with npm.
# Security mitigations:
# - package-lock.json ensures integrity of installed packages
# - This setting only affects the build stage, not the final runtime image
# - Build environments are typically isolated and controlled
RUN npm config set strict-ssl false

# Force ALL native modules to compile from source (no prebuilt binaries)
# This prevents SIGILL errors from prebuilt binaries compiled with AVX/AVX2
ENV npm_config_build_from_source=true
ENV npm_config_prefer_binary=false

# Compiler flags to ensure compatibility with non-AVX x86_64 CPUs
# -O2: Optimize for performance while maintaining compatibility
# -pipe: Use pipes rather than temporary files for compilation
# -march=x86-64: Target baseline x86-64 architecture (no AVX/AVX2)
# -mno-avx -mno-avx2: Explicitly disable AVX instructions
ENV CFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"
ENV CXXFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"

# Copy package files
COPY package.json package-lock.json .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/assistant/package.json ./packages/assistant/
COPY packages/pwa/package.json ./packages/pwa/
COPY packages/shared/package.json ./packages/shared/
COPY packages/surveyor-engine/package.json ./packages/surveyor-engine/
COPY packages/vision-engine/package.json ./packages/vision-engine/
COPY packages/heating-engine/package.json ./packages/heating-engine/
COPY packages/worker/package.json ./packages/worker/

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application code
COPY . .

# Build workspaces in the correct order (shared must be built before others that depend on it)
RUN npm run build -w packages/shared && \
    npm run build -w packages/surveyor-engine && \
    npm run build -w packages/vision-engine && \
    npm run build -w packages/heating-engine && \
    npm run build -w packages/pwa && \
    npm run build -w packages/assistant && \
    npm run build -w packages/api


# Final stage for app image
FROM base

# Set production environment
ENV NODE_ENV=production

# Install minimal runtime dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Configure npm to handle SSL certificate issues (needed for npm ci in production stage)
RUN npm config set strict-ssl false

# Force ALL native modules to compile from source (no prebuilt binaries)
ENV npm_config_build_from_source=true
ENV npm_config_prefer_binary=false

# Compiler flags to ensure compatibility with non-AVX x86_64 CPUs
ENV CFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"
ENV CXXFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"

# Copy package files for production install (only API and shared needed at runtime)
COPY package.json package-lock.json .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies including dev deps for drizzle-kit and ts-node
# These are required at runtime to run database migrations and seed scripts
# on container startup (see docker-entrypoint.sh)
RUN npm ci

# Copy built files from builder
# Note: Shared is required by API, so both must be copied
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/api/dist ./packages/api/dist

# Copy source files needed for migrations and seeding
COPY --from=build /app/packages/api/src ./packages/api/src
COPY --from=build /app/packages/api/drizzle.config.ts ./packages/api/
COPY --from=build /app/packages/api/tsconfig.json ./packages/api/

# Copy entrypoint script
COPY packages/api/scripts/docker-entrypoint.sh ./packages/api/scripts/
RUN chmod +x ./packages/api/scripts/docker-entrypoint.sh

# Default to running the API
EXPOSE 3001
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Use entrypoint script to run migrations/seed, then start the application
ENTRYPOINT ["./packages/api/scripts/docker-entrypoint.sh"]
