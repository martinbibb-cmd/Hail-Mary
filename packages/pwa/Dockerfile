# Dockerfile for hailmary-pwa
# Multi-stage build: Node for building, nginx for serving

# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json .npmrc ./

# Copy all package.json files for workspace resolution
COPY packages/pwa/package.json ./packages/pwa/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies 
# --ignore-scripts: Skip native module compilation that may fail on Alpine
# Note: Optional deps are required for Rollup 4.x native bindings
RUN npm ci --ignore-scripts

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/pwa ./packages/pwa

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Build PWA
WORKDIR /app/packages/pwa
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY packages/pwa/nginx.conf /etc/nginx/nginx.conf

# Copy built PWA files from builder stage
COPY --from=builder /app/packages/pwa/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl --fail --silent http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
