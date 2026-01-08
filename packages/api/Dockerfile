# Dockerfile for hailmary-api
# Base image: Node 20 Bookworm Slim
# CPU Compatibility: Optimized for non-AVX x86_64 CPUs (SSE4.2 only)
# Compatible with Intel Celeron N5105 (Jasper Lake) and similar CPUs
# Uses Debian-based image (glibc) for better native module compatibility vs Alpine (musl)
FROM node:20-bookworm-slim AS builder

# Build arguments for fingerprinting
ARG GIT_SHA=unknown
ARG BUILD_TIME

# Set working directory
WORKDIR /app

# Install build dependencies for native modules
# python3, make, g++: Required for node-gyp to compile native addons
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
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/surveyor-engine/package.json ./packages/surveyor-engine/
COPY packages/vision-engine/package.json ./packages/vision-engine/
COPY packages/heating-engine/package.json ./packages/heating-engine/
COPY packages/assistant/package.json ./packages/assistant/
COPY packages/pwa/package.json ./packages/pwa/
COPY packages/worker/package.json ./packages/worker/

# Install dependencies
# Note: Optional deps are required for Rollup 4.x native bindings
# No native CPU optimizations (no -march=native flags)
RUN npm ci

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/heating-engine ./packages/heating-engine
COPY packages/api ./packages/api

# Build shared package first, then heating-engine, then api (using workspace commands from root)
WORKDIR /app
RUN npm run build -w packages/shared
RUN npm run build -w packages/heating-engine
RUN npm run build -w packages/api

# Production stage
FROM node:20-bookworm-slim AS production

WORKDIR /app

# Install runtime dependencies for native modules
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Configure npm to handle SSL certificate issues (needed for npm ci)
RUN npm config set strict-ssl false

# Force ALL native modules to compile from source (no prebuilt binaries)
ENV npm_config_build_from_source=true
ENV npm_config_prefer_binary=false

# Compiler flags to ensure compatibility with non-AVX x86_64 CPUs
ENV CFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"
ENV CXXFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"

# Copy package files
COPY package.json package-lock.json .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/heating-engine/package.json ./packages/heating-engine/
COPY packages/surveyor-engine/package.json ./packages/surveyor-engine/
COPY packages/vision-engine/package.json ./packages/vision-engine/
COPY packages/assistant/package.json ./packages/assistant/
COPY packages/pwa/package.json ./packages/pwa/
COPY packages/worker/package.json ./packages/worker/

# Install ALL dependencies including dev deps for drizzle-kit and ts-node
# These are required at runtime to run database migrations and seed scripts
# on container startup (see docker-compose.yml command)
RUN npm ci

# Copy built files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/heating-engine/dist ./packages/heating-engine/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Copy source files needed for migrations and seeding
COPY --from=builder /app/packages/api/src ./packages/api/src
COPY --from=builder /app/packages/api/drizzle.config.ts ./packages/api/
COPY --from=builder /app/packages/api/tsconfig.json ./packages/api/

# Copy drizzle migrations folder (contains SQL migrations)
COPY --from=builder /app/packages/api/drizzle ./packages/api/drizzle

# Stay in /app root directory for proper workspace module resolution
# npm workspace commands are run from root, node_modules are hoisted here
WORKDIR /app

# Expose port
EXPOSE 3001

# Environment variables (set at runtime)
ENV PORT=3001
ENV NODE_ENV=production

# Build metadata (passed from build args)
ARG GIT_SHA=unknown
ARG BUILD_TIME
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_TIME=${BUILD_TIME}

# Health check using Node.js built-in http module (no wget dependency)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Default command (can be overridden by docker-compose)
CMD ["npm", "run", "start", "-w", "packages/api"]
