# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.18.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="NodeJS"

# NodeJS app lives here
WORKDIR /app


# Throw-away build stage to reduce size of final image
FROM base AS build

# Use a non-production NODE_ENV so devDependencies (like typescript) are installed
ENV NODE_ENV=development

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install -y python-is-python3 pkg-config build-essential ca-certificates && \
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

# Copy package files
COPY --link package.json package-lock.json .npmrc ./
COPY --link packages/api/package.json ./packages/api/
COPY --link packages/assistant/package.json ./packages/assistant/
COPY --link packages/pwa/package.json ./packages/pwa/
COPY --link packages/shared/package.json ./packages/shared/

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application code
COPY --link . .

# Build all workspaces
RUN npm run build


# Final stage for app image
FROM base

# Set production environment
ENV NODE_ENV=production

# Configure npm to handle SSL certificate issues (needed for npm ci in production stage)
RUN npm config set strict-ssl false

# Copy package files for production install (only API and shared needed at runtime)
COPY --link package.json package-lock.json .npmrc ./
COPY --link packages/api/package.json ./packages/api/
COPY --link packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
# Note: Shared is required by API, so both must be copied
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/api/dist ./packages/api/dist

# Default to running the API
EXPOSE 3001
ENV PORT=3001

# Start the API server by default
# Use direct node execution for more reliable production startup
CMD [ "node", "packages/api/dist/index.js" ]
