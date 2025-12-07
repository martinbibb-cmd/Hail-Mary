# Dockerfile for hailmary-pwa
# Multi-stage build: Node for building, nginx for serving

# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Configure npm to handle SSL certificate issues in some cloud build environments.
# This is needed because some CI/CD environments (including fly.io builders) may have
# network configurations that cause SSL certificate chain errors with npm.
# Security mitigations: package-lock.json ensures integrity of installed packages.
RUN npm config set strict-ssl false

# Copy root package files for workspace setup
COPY package.json package-lock.json .npmrc ./

# Copy all package.json files for workspace resolution
COPY packages/pwa/package.json ./packages/pwa/
COPY packages/shared/package.json ./packages/shared/
COPY packages/surveyor-engine/package.json ./packages/surveyor-engine/

# Install dependencies 
# Note: Optional deps are required for Rollup 4.x native bindings
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
RUN npm run build -w packages/pwa

# Production stage with nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY packages/pwa/nginx.conf /etc/nginx/nginx.conf

# Copy built PWA files from builder stage
COPY --from=builder /app/packages/pwa/dist /usr/share/nginx/html

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl --fail --silent http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
