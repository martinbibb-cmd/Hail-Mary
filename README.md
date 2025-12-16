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

1. **Admin User** - Full access to all features
2. **Regular User** - Access to all features for their account
3. **Guest User** - Read-only demo access (no customer/lead data)
4. **NAS Quick Login** - Password-free login on trusted networks (optional)

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

## 📦 Core Features

### ✅ Foundation (Complete)

- **Database** - Structured storage for customers, leads, products, quotes, appointments, surveys, documents
- **CRUD API** - RESTful endpoints for all entities
- **PWA Skeleton** - Dashboard, customer management, lead tracking
- **Authentication** - User login with JWT, role-based access control, guest access
- **Bulletproof Deployment** - Init container pattern for reliable database setup

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
npm run db:migrate  # Run database migrations
npm run db:seed     # Seed database with test data
npm run db:init     # Run both migrations and seed (used by init container)
```

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

## 🎯 Design Principles

1. **"Surveyors sell, engineers fit"** - Win the job on-site with professional presentation
2. **Voice-first** - Hands-free capture while working
3. **Visual communication** - Show customers what they're getting
4. **Instant gratification** - Professional PDFs in seconds
5. **Offline-capable** - Works in properties with poor signal
6. **Bulletproof deployment** - "Nuke and pave" ready with init container pattern

## 📄 License

ISC
