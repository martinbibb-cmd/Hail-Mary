# Dockerfile for hailmary-pwa
# Multi-stage build: Node for building, nginx for serving
# CPU Compatibility: Optimized for non-AVX x86_64 CPUs (SSE4.2 only)
# Compatible with Intel Celeron N5105 (Jasper Lake) and similar CPUs
# Uses Debian-based image (glibc) for better native module compatibility vs Alpine (musl)

# Build stage
FROM node:20-bookworm-slim AS builder

# Build arguments for fingerprinting
ARG GIT_SHA=unknown
ARG BUILD_TIME

# Set working directory
WORKDIR /app

# Install build dependencies for native modules
# python3, make, g++: Required for node-gyp to compile native addons (used by Vite/esbuild/rollup)
# pkg-config: Used by some native modules to find system libraries
# ca-certificates: For SSL/TLS connections
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Configure npm to handle SSL certificate issues in some cloud build environments.
# This is needed because some CI/CD environments (including fly.io builders) may have
# network configurations that cause SSL certificate chain errors with npm.
# Security mitigations: package-lock.json ensures integrity of installed packages.
RUN npm config set strict-ssl false

# Force ALL native modules to compile from source (no prebuilt binaries)
# This prevents SIGILL errors from prebuilt binaries compiled with AVX/AVX2
# This is critical for Vite/Rollup/esbuild native bindings
ENV npm_config_build_from_source=true
ENV npm_config_prefer_binary=false

# Compiler flags to ensure compatibility with non-AVX x86_64 CPUs
# -O2: Optimize for performance while maintaining compatibility
# -pipe: Use pipes rather than temporary files for compilation
# -march=x86-64: Target baseline x86-64 architecture (no AVX/AVX2)
# -mno-avx -mno-avx2: Explicitly disable AVX instructions
ENV CFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"
ENV CXXFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"

# Copy root package files for workspace setup
COPY package.json package-lock.json .npmrc ./

# Copy all package.json files for workspace resolution
COPY packages/pwa/package.json ./packages/pwa/
COPY packages/shared/package.json ./packages/shared/
COPY packages/surveyor-engine/package.json ./packages/surveyor-engine/
COPY packages/vision-engine/package.json ./packages/vision-engine/
COPY packages/assistant/package.json ./packages/assistant/
COPY packages/api/package.json ./packages/api/
COPY packages/worker/package.json ./packages/worker/

# Install dependencies 
# Note: Optional deps are required for Rollup 4.x native bindings
# No native CPU optimizations (no -march=native flags)
RUN npm ci

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/surveyor-engine ./packages/surveyor-engine
COPY packages/pwa ./packages/pwa

# Build shared package first (using workspace command from root)
WORKDIR /app
RUN npm run build -w packages/shared

# Build surveyor-engine package (using workspace command from root)
RUN npm run build -w packages/surveyor-engine

# Build PWA (using workspace command from root)
# Pass build args to Vite via environment variables
ENV VITE_GIT_SHA=${GIT_SHA}
ENV VITE_BUILD_TIME=${BUILD_TIME}
RUN npm run build -w packages/pwa

# Production stage with nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY packages/pwa/nginx.conf /etc/nginx/nginx.conf

# Copy default server configuration as fallback
# This will be overridden by volume mount in docker-compose
COPY packages/pwa/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy built PWA files from builder stage
COPY --from=builder /app/packages/pwa/dist /usr/share/nginx/html

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl --fail --silent http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
