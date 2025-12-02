# Dockerfile for hailmary-assistant
# Base image: Node 20
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json ./

# Copy all package.json files for workspace resolution
COPY packages/assistant/package.json ./packages/assistant/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/assistant ./packages/assistant

# Build shared package first, then assistant
WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/packages/assistant
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/assistant/package.json ./packages/assistant/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

# Start the application
CMD ["npm", "run", "start"]
