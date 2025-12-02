# Dockerfile for hailmary-api
# Base image: Node 20
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json ./

# Copy all package.json files for workspace resolution
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Build shared package first, then api
WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/packages/api
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

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
