# Hail-Mary 🔥

**Pre-Contract Sales & Survey Tool for Heating Professionals**

A voice-driven survey tool that helps surveyors win jobs on-site with professional visualizations and instant PDF reports. Built specifically for heating engineers, plumbers, and HVAC professionals.

> **"Surveyors sell, engineers fit."** - This tool helps you win the job before you leave the property.

## 🏗️ Architecture

```
📱 Pre-Contract Sales & Survey Tool
         ↓
   ┌─────────────────┬─────────────────┬──────────────────┐
   │  Voice Input    │  Visualization  │  PDF Output      │
   │  (Hands-free)   │  (Show Customer)│  (Leave Behind)  │
   └─────────────────┴─────────────────┴──────────────────┘
         ↓
🏛️ Core App (API + Database)
```

This is a **monorepo** containing:

- `packages/api` - Backend API with Express/TypeScript + PostgreSQL (Drizzle ORM)
- `packages/pwa` - Frontend PWA with React/TypeScript + Vite
- `packages/shared` - Shared types and utilities

## 📋 Build Plans

We have four comprehensive build plans available:

- **[Real-Time Sync Build Plan →](docs/REALTIME-SYNC-4-WEEK-BUILD-PLAN.md)** ⭐ NEWEST - Two-device workflow with real-time sync
- **[Single-Device Workflow →](docs/SINGLE-DEVICE-WORKFLOW-4-WEEK-BUILD-PLAN.md)** - Tablet + wireless mic optimized
- **[Next.js PWA →](docs/NEXTJS-PWA-4-WEEK-BUILD-PLAN.md)** - Modern Next.js implementation
- **[Pre-Contract Sales Survey Tool →](docs/PRE-CONTRACT-SALES-SURVEY-TOOL-4-WEEK-BUILD-PLAN.md)** - Original comprehensive plan

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for deployment)

### Local Development

```bash
# Install all dependencies
npm install

# Start development servers
npm run api:dev   # API on http://localhost:3001
npm run pwa:dev   # PWA on http://localhost:3000
```

### Docker Deployment (Recommended)

All services run in Docker containers with persistent PostgreSQL database:

```bash
# Build and run all services
docker-compose up -d --build

# View logs
docker-compose logs -f
```

The deployment uses an **init container pattern** for bulletproof database setup:
1. PostgreSQL starts and becomes healthy
2. Migrator container runs migrations and seeds data (including admin user)
3. API starts and serves requests
4. PWA starts and proxies to API

This architecture ensures "nuke and pave" readiness - you can delete everything and rebuild from scratch.

## 🐳 Production Deployment

| Platform | Best For | Database | Setup Time | Guide |
|----------|----------|----------|------------|-------|
| **Unraid NAS** | Self-hosted, complete control | PostgreSQL on NAS storage | 5 min | [Guide](docs/DEPLOYMENT-unRAID.md) |
| **Railway** | Fastest cloud deployment | Managed PostgreSQL | 10 min | [Guide](docs/DEPLOYMENT-RAILWAY.md) |
| **Google Cloud** | Enterprise production | Cloud SQL PostgreSQL | 30 min | [Guide](docs/DEPLOYMENT-GCP.md) |
| **Fly.io** | Global edge deployment | Managed PostgreSQL | 15 min | [Guide](docs/DEPLOYMENT-FLY.md) |

**📖 [Complete Deployment Guide & Platform Comparison →](docs/DEPLOYMENT.md)**

### Quick Install: Unraid NAS

One-line installation with auto-updates:

```bash
wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash
```

Database persists to `/mnt/user/appdata/hailmary/postgres` on your NAS.

**Enable automatic updates** (pulls new versions when you push to GitHub):

```bash
curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/enable-autoupdate.sh | bash
```

## 🔐 Authentication

### Login Options

1. **Email/Password** - Standard authentication with email and password
2. **Google OAuth** - Sign in with your Google account (when enabled)
3. **Admin User** - Full access to all features
4. **Regular User** - Access to all features for their account
5. **Guest User** - Read-only demo access (no customer/lead data)
6. **NAS Quick Login** - Password-free login on trusted networks (optional)

### Default Credentials

When you first deploy Hail-Mary, these users are automatically created:

| User Type | Email | Password | Access |
|-----------|-------|----------|--------|
| **Admin** | `admin@hailmary.local` | `HailMary2024!` | Full access |
| **Guest** | `guest@hailmary.local` | `guestpass` | Demo access only |

> ⚠️ **Security Warning**: Change admin credentials immediately after first login by setting `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in your `.env` file.

### Guest Login

Guest users can:
- ✅ View products and product management features
- ✅ Access survey tools and forms
- ✅ Test system functionality
- ❌ View customer data (customers, leads, quotes, appointments)

Perfect for demos and testing without exposing sensitive customer information.

### Admin Tools

```bash
# Reset user password (via Docker)
docker exec -it hailmary-api npm run admin:reset-password -- user@example.com newpassword123

# List all users
docker exec -it hailmary-api npm run admin:list-users

# Create new admin user
docker exec -it hailmary-api npm run admin:create -- admin@example.com password123 "Admin Name"
```

### Custom Initial Users

Set these environment variables before first run:

```env
# Admin user (required for first login)
INITIAL_ADMIN_EMAIL=admin@yourcompany.com
INITIAL_ADMIN_PASSWORD=YourSecurePassword123!
INITIAL_ADMIN_NAME=Admin

# Guest user (optional, for demos)
GUEST_EMAIL=guest@yourcompany.com
GUEST_PASSWORD=guest123
GUEST_NAME=Guest User
```

### Google OAuth Authentication

Hail-Mary supports Google OAuth for seamless authentication. Users can sign in with their Google accounts.

#### Setup Google OAuth

1. **Obtain Client Secret** from Google Cloud Console:
   - Visit [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
   - Find OAuth 2.0 Client ID: `1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc`
   - Click on it and copy the **Client Secret**

2. **Configure Environment Variables** in your `.env` file:
   ```env
   # Enable Google OAuth
   GOOGLE_AUTH_ENABLED=true
   
   # Google OAuth Client ID (already configured)
   GOOGLE_CLIENT_ID=1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc.apps.googleusercontent.com
   
   # Google OAuth Client Secret (REQUIRED - obtain from Google Cloud Console)
   GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
   ```

3. **Configure Authorized Redirect URIs** in Google Cloud Console:
   - Add your callback URL: `https://your-domain.com/api/auth/google/callback`
   - For local development: `http://localhost:3001/api/auth/google/callback`

4. **Verify Configuration** (optional):
   ```bash
   bash scripts/verify-google-oauth.sh
   ```

5. **Restart the Application** to apply changes

#### How It Works

- When enabled, a "Sign in with Google" button appears on the login page
- Users are redirected to Google's authentication page
- After successful authentication, users are automatically logged in
- First-time users are automatically created in the database
- Existing users with matching email addresses are linked to their Google accounts

#### Security Notes

- ⚠️ Never commit `GOOGLE_CLIENT_SECRET` to version control
- 🔒 Client Secret must be kept secure and private
- 🌐 Callback URLs must match exactly what's configured in Google Cloud Console
- 🔐 Users authenticated via Google don't need to set passwords

## 📦 Core Features

### ✅ Foundation (Complete)

- **Database** - Structured storage for customers, leads, products, quotes, appointments, surveys, documents
- **CRUD API** - RESTful endpoints for all entities
- **PWA Skeleton** - Dashboard, customer management, lead tracking
- **Authentication** - User login with JWT, role-based access control, guest access
- **Bulletproof Deployment** - Init container pattern for reliable database setup
- **Rocky & Sarah Architecture** - Deterministic fact extraction (Rocky) with human-readable explanations (Sarah) for voice notes **[→ Architecture Docs](docs/ROCKY-SARAH-ARCHITECTURE.md)**

### 🚧 In Progress (4-Week Build)

- Voice recording with live transcription
- Smart entity recognition (boiler, flue, radiators)
- Photo annotation and system schematics
- Flue clearance visualization with compliance checking
- Professional PDF generation with branding
- Email and WhatsApp sharing

**[Full build plan details →](docs/PRE-CONTRACT-SALES-SURVEY-TOOL-4-WEEK-BUILD-PLAN.md)**

### 🔜 Future Enhancements

- Quote generation from surveys
- Advanced 3D visualizations and AR overlays
- LiDAR integration (iPhone 12 Pro+)
- Thermal imaging (FLIR camera)
- Complete visual surveyor ecosystem

**[Visual Surveyor Architecture →](docs/VISUAL-SURVEYOR-ARCHITECTURE.md)**

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Database | PostgreSQL 17 + Drizzle ORM |
| API | Express.js + TypeScript |
| Frontend | React 18 + Vite |
| Styling | CSS (custom) |
| Types | Shared TypeScript definitions |
| Deployment | Docker + Docker Compose |

## 📁 Project Structure

```
/
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── db/           # Database schema & migrations
│   │   │   ├── routes/       # API route handlers
│   │   │   ├── middleware/   # Auth & other middleware
│   │   │   └── index.ts      # Express server
│   │   └── package.json
│   ├── pwa/
│   │   ├── src/
│   │   │   ├── App.tsx       # Main React app
│   │   │   └── main.tsx      # Entry point
│   │   └── package.json
│   └── shared/
│       ├── src/
│       │   └── types.ts      # Shared type definitions
│       └── package.json
├── docker-compose.yml        # Local/dev deployment
├── docker-compose.prod.yml   # Production with pre-built images
└── package.json              # Root workspace config
```

## 🔧 Development

### Database Commands

```bash
npm run db:migrate  # Run database migrations (applies SQL files from drizzle/ folder)
npm run db:seed     # Seed database with test data
npm run db:push     # Push schema changes directly (development only, not recommended for production)
npm run db:generate # Generate new migration files from schema changes
```

**Note**: The migrator service now uses `db:migrate` + `db:seed` instead of `db:init` for more reliable production deployments.

### Build Commands

```bash
# Build API
npm run build -w packages/api

# Build PWA
npm run build -w packages/pwa

# Build all packages
npm run build --workspaces
```

### Testing

```bash
# Run API tests
npm run test -w packages/api

# Lint code
npm run lint -w packages/api
```

## 🩺 Troubleshooting

### Database Schema Issues

If you see errors like:
- `relation "addresses" does not exist`
- `column "assigned_user_id" does not exist`
- Features appearing broken or missing in the UI
- Empty lists or silent failures

**These indicate schema drift** (migrations not applied / DB volume out of date), not database connectivity failure.

**📖 See comprehensive guides:**
- **[DATABASE_SCHEMA_TROUBLESHOOTING.md](./DATABASE_SCHEMA_TROUBLESHOOTING.md)** - Complete diagnostic and fix guide
- **[DATABASE_QUICK_REFERENCE.md](./DATABASE_QUICK_REFERENCE.md)** - Quick reference with copy/paste commands

**Quick fix:**
```bash
# Run migrations to sync database schema
docker exec -it hailmary-api sh -c "cd /app && npm run db:migrate"

# Or from repository root (if developing locally)
npm run db:migrate
```

### Health Check Endpoints

**✅ Use these endpoints:**
```bash
curl http://localhost:3000/health/api
curl http://localhost:3000/health/assistant
```

**❌ Do NOT use:**
- `/health.json` - This is not a health endpoint. It falls through to SPA routing and gets handled by a catch-all API route (e.g., transcript handler), returning `{"success":false,"error":"Invalid transcript ID"}`

### Checking Database Connection

**⚠️ Important: Use 'hailmary' user, not 'postgres'**

The `postgres` role does not exist in this deployment. Manual diagnostics must use the `hailmary` role:

```bash
# List all tables
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\dt"

# Check specific table structure
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d addresses"
```

## 🎯 Design Principles

1. **"Surveyors sell, engineers fit"** - Win the job on-site with professional presentation
2. **Voice-first** - Hands-free capture while working
3. **Visual communication** - Show customers what they're getting
4. **Instant gratification** - Professional PDFs in seconds
5. **Offline-capable** - Works in properties with poor signal
6. **Bulletproof deployment** - "Nuke and pave" ready with init container pattern

## 📄 License

ISC
