# Fly.io Deployment Guide 🚀

This guide explains how to deploy Hail-Mary to [fly.io](https://fly.io).

## Overview

Hail-Mary is a monorepo with three deployable services:
- **API** (`hail-mary-api`) - Backend REST API
- **Assistant** (`hail-mary-assistant`) - AI assistant service
- **PWA** (`hail-mary-pwa`) - Frontend web application

Each service has its own fly.io configuration file at the repo root.

## Prerequisites

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)
2. Log in to fly.io: `fly auth login`
3. Have a PostgreSQL database ready (can use Fly Postgres)

## Quick Start

### 1. Create a Postgres Database (Optional)

```bash
# Create a Fly Postgres cluster
fly postgres create --name hail-mary-db --region lhr

# Get the connection string
fly postgres connect -a hail-mary-db
```

### 2. Deploy the API

```bash
# Create the app (first time only)
fly apps create hail-mary-api

# Set required secrets
fly secrets set DATABASE_URL="postgres://..." JWT_SECRET="your-secret" -a hail-mary-api

# Optional: Set initial admin credentials
fly secrets set INITIAL_ADMIN_EMAIL="admin@example.com" INITIAL_ADMIN_PASSWORD="secure-password" -a hail-mary-api

# Deploy from repo root
fly deploy -c fly.api.toml
```

### 3. Deploy the Assistant

```bash
# Create the app (first time only)
fly apps create hail-mary-assistant

# Set required secrets
fly secrets set GEMINI_API_KEY="your-api-key" DATABASE_URL="postgres://..." API_BASE_URL="https://hail-mary-api.fly.dev" -a hail-mary-assistant

# Deploy from repo root
fly deploy -c fly.assistant.toml
```

### 4. Deploy the PWA

```bash
# Create the app (first time only)
fly apps create hail-mary-pwa

# Deploy from repo root
fly deploy -c fly.pwa.toml
```

## Configuration Files

| Service | Config File | Dockerfile |
|---------|------------|------------|
| API | `fly.api.toml` | `packages/api/Dockerfile` |
| Assistant | `fly.assistant.toml` | `packages/assistant/Dockerfile` |
| PWA | `fly.pwa.toml` | `packages/pwa/Dockerfile` |

## Environment Variables

### API Service

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT tokens | Yes |
| `PORT` | Server port (default: 3001) | No |
| `INITIAL_ADMIN_EMAIL` | First admin user email | No |
| `INITIAL_ADMIN_PASSWORD` | First admin user password | No |

### Assistant Service

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `API_BASE_URL` | URL of the API service | Yes |
| `ASSISTANT_PORT` | Server port (default: 3002) | No |

### PWA Service

The PWA is a static site served by nginx and doesn't require environment variables at runtime.

## Updating Deployments

To update a deployed service:

```bash
# Redeploy the API
fly deploy -c fly.api.toml

# Redeploy the Assistant
fly deploy -c fly.assistant.toml

# Redeploy the PWA
fly deploy -c fly.pwa.toml
```

## Monitoring

```bash
# View logs
fly logs -a hail-mary-api

# Check status
fly status -a hail-mary-api

# SSH into a running machine
fly ssh console -a hail-mary-api
```

## Database Migrations

After deploying the API, run migrations:

```bash
fly ssh console -a hail-mary-api
cd /app
npm run db:push -w packages/api
```

## Scaling

```bash
# Scale to 2 machines
fly scale count 2 -a hail-mary-api

# Increase memory
fly scale memory 1024 -a hail-mary-api
```

## Common Issues

### Build Fails with "npm ci" Error

The existing Dockerfiles are designed for the monorepo structure. If you see build errors:

1. Make sure you're deploying from the repository root
2. The `fly.*.toml` files reference the correct Dockerfiles
3. Don't use fly.io's auto-generated Dockerfile

### Connection Refused Between Services

Fly.io apps communicate over a private network. Use internal URLs:
- API internal: `hail-mary-api.internal:3001`
- Assistant internal: `hail-mary-assistant.internal:3002`

### PWA Can't Connect to API

Update the PWA's API URL configuration or use fly.io's routing features to set up proper proxying.

## CI/CD with GitHub Actions

You can automate deployments by adding a GitHub Actions workflow. See the existing `docker-build.yml` for reference on building the Docker images.
