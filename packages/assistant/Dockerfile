# Dockerfile for hailmary-assistant
# Base image: Node 20 Bookworm Slim
# CPU Compatibility: Optimized for non-AVX x86_64 CPUs (SSE4.2 only)
# Compatible with Intel Celeron N5105 (Jasper Lake) and similar CPUs
# Uses Debian-based image (glibc) for better native module compatibility vs Alpine (musl)
FROM node:20-bookworm-slim AS builder

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
COPY packages/assistant/package.json ./packages/assistant/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
# Note: Optional deps are required for Rollup 4.x native bindings
# No native CPU optimizations (no -march=native flags)
RUN npm ci

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/assistant ./packages/assistant

# Build shared package first, then assistant (using workspace commands from root)
WORKDIR /app
RUN npm run build -w packages/shared
RUN npm run build -w packages/assistant

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
COPY packages/assistant/package.json ./packages/assistant/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/assistant/dist ./packages/assistant/dist

# Set working directory to assistant
WORKDIR /app/packages/assistant

# Expose port
EXPOSE 3002

# Environment variables (set at runtime)
ENV ASSISTANT_PORT=3002
ENV NODE_ENV=production

# Health check using Node.js built-in http module (no wget dependency)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "run", "start"]
