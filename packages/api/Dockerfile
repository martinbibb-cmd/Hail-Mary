# Dockerfile for hailmary-api
# Base image: Node 20
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json .npmrc ./

# Copy all package.json files for workspace resolution
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
# Note: Optional deps are required for Rollup 4.x native bindings
RUN npm ci

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Build shared package first, then api (using workspace commands from root)
WORKDIR /app
RUN npm run build -w packages/shared
RUN npm run build -w packages/api

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies including dev deps for drizzle-kit and ts-node
# These are required at runtime to run database migrations and seed scripts
# on container startup (see docker-compose.yml command)
RUN npm ci

# Copy built files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Copy source files needed for migrations and seeding
COPY --from=builder /app/packages/api/src ./packages/api/src
COPY --from=builder /app/packages/api/drizzle.config.ts ./packages/api/
COPY --from=builder /app/packages/api/tsconfig.json ./packages/api/

# Set working directory to api
WORKDIR /app/packages/api

# Expose port
EXPOSE 3001

# Environment variables (set at runtime)
ENV PORT=3001
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application
CMD ["npm", "run", "start"]
