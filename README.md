# Hail-Mary 🔥

**Universal Quote Tool for Heating Professionals**

A rock-solid boiler CRM + quoting engine that AI and voice can plug into. Built specifically for heating engineers, plumbers, and HVAC professionals.

## 🏗️ Architecture

```
📱 PWA / iOS / LiDAR app (Frontend)
         ↑
         │
🧠 AI & Voice Assistant (Coming Soon)
         ↑
         │
🏛️ Core App (API + Database)
```

This is a **monorepo** containing:

- `packages/api` - Backend API with Express/TypeScript + PostgreSQL (Drizzle ORM)
- `packages/pwa` - Frontend PWA with React/TypeScript + Vite
- `packages/shared` - Shared types and utilities

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 8+

### Installation

```bash
# Install all dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development servers
npm run api:dev   # API on http://localhost:3001
npm run pwa:dev   # PWA on http://localhost:3000
```

## 📦 Core Features

### ✅ STEP 1 — Database (Complete)

Structured storage for:
- **Customers** - Contact details, addresses, notes
- **Leads** - Inquiry tracking, source, status
- **Products** - Boilers, cylinders, parts with specifications
- **Quotes** - Multi-line quotes with automatic totals
- **Appointments** - Survey, installation, service scheduling
- **Surveys** - Property assessments, photos, measurements
- **Documents** - PDFs, proposals, handover packs

### ✅ STEP 2 — CRUD API (Complete)

RESTful API endpoints:
- `GET/POST/PUT/DELETE /api/customers`
- `GET/POST/PUT/DELETE /api/products`
- `GET/POST/PUT/DELETE /api/quotes`
- `GET/POST/PUT/DELETE /api/leads`
- `GET/POST/PUT/DELETE /api/appointments`

### ✅ STEP 3 — PWA Skeleton (Complete)

- Dashboard with stats
- Customer list and creation form
- Quote list view
- Lead list and creation form
- Responsive design for mobile/tablet/desktop

### 🔜 Coming Soon

- **STEP 4** — PDF Generator (quotes, proposals)
- **STEP 5** — AI Assistant (text-based workflows)
- **STEP 6** — Voice Interface
- **STEP 7** — Technical Manual Search (RAG)
- **STEP 8** — Native iOS + LiDAR

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Database | PostgreSQL 17 + Drizzle ORM |
| API | Express.js + TypeScript |
| Frontend | React 18 + Vite |
| Styling | CSS (custom) |
| Types | Shared TypeScript definitions |

## 📁 Project Structure

```
/
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── db/           # Database schema & migrations
│   │   │   ├── routes/       # API route handlers
│   │   │   └── index.ts      # Express server
│   │   └── package.json
│   ├── pwa/
│   │   ├── src/
│   │   │   ├── App.tsx       # Main React app
│   │   │   ├── main.tsx      # Entry point
│   │   │   └── index.css     # Styles
│   │   └── package.json
│   └── shared/
│       ├── src/
│       │   └── types.ts      # Shared type definitions
│       └── package.json
├── package.json              # Root workspace config
└── README.md
```

## 🔧 Development

### API Development

```bash
cd packages/api
npm run dev     # Start with hot-reload
npm run build   # Build for production
npm run test    # Run tests
```

### PWA Development

```bash
cd packages/pwa
npm run dev     # Start Vite dev server
npm run build   # Build for production
npm run preview # Preview production build
```

### Database

```bash
npm run db:migrate  # Initialize/update database schema
npm run db:push     # Push schema changes directly (development)
npm run db:seed     # Seed the database with initial data
```

The database runs in PostgreSQL (via Docker) and uses Drizzle ORM for schema management.

- Schema definitions: `packages/api/src/db/drizzle-schema.ts`
- Migrations: `packages/api/drizzle/`
- Database connection: `packages/api/src/db/drizzle-client.ts`

## 🐳 Docker & Deployment

### Local Docker Development

```bash
# Build and run all services
docker-compose up -d --build

# View logs
docker-compose logs -f
```

### Production Deployment Options

Hail-Mary supports multiple deployment platforms with **fully persistent PostgreSQL databases**:

| Platform | Best For | Database | Setup Time | Guide |
|----------|----------|----------|------------|-------|
| **Unraid NAS** | Self-hosted, complete control | PostgreSQL on NAS storage | 5 min | [Guide](docs/DEPLOYMENT-unRAID.md) |
| **Railway** | Fastest cloud deployment | Managed PostgreSQL | 10 min | [Guide](docs/DEPLOYMENT-RAILWAY.md) |
| **Google Cloud** | Enterprise production | Cloud SQL PostgreSQL | 30 min | [Guide](docs/DEPLOYMENT-GCP.md) |
| **Fly.io** | Global edge deployment | Managed PostgreSQL | 15 min | [Guide](docs/DEPLOYMENT-FLY.md) |

**📖 [Complete Deployment Guide & Platform Comparison →](docs/DEPLOYMENT.md)**

### Quick Start: Unraid NAS (Self-Hosted)

**One-line installation with auto-updates:**

```bash
wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash
```

Database persists to `/mnt/user/appdata/hailmary/postgres` on your NAS array.

### Quick Start: Railway (Managed Cloud)

```bash
npm install -g @railway/cli
railway login
railway init
railway add --database postgresql
railway up
```

Managed PostgreSQL with automatic daily backups included.

### Quick Start: Google Cloud (Enterprise)

```bash
# Create Cloud SQL PostgreSQL instance
gcloud sql instances create hail-mary-db --database-version=POSTGRES_17

# Deploy all services
gcloud builds submit --config cloudbuild.yaml
```

Cloud SQL provides automatic backups, high availability, and scaling.

## 🔐 Authentication & Admin Tools

### Default Login Credentials

When you first deploy Hail-Mary, an admin user is automatically created with these credentials:

| Field | Value |
|-------|-------|
| **Email** | `admin@hailmary.local` |
| **Password** | `HailMary2024!` |

> ⚠️ **Security Warning**: Change these credentials immediately after first login by updating the `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` environment variables in your `.env` file, then restarting the containers.

### Password Reset

If you need to manually reset a user's password (useful for NAS deployments):

```bash
# Via Docker
docker exec -it hailmary-api npm run admin:reset-password -- user@example.com newpassword123

# Local development
npm run admin:reset-password -w packages/api -- user@example.com newpassword123
```

### List Users

To see all registered users:

```bash
docker exec -it hailmary-api npm run admin:list-users
```

### Custom Initial Admin User

To use custom credentials instead of the defaults, set these environment variables before first run:
- `INITIAL_ADMIN_EMAIL`: Email for the admin user
- `INITIAL_ADMIN_PASSWORD`: Password (minimum 8 characters)

## 🎯 Design Principles

1. **Core app never depends on AI** - AI is a helper, not a controller
2. **Structured + Unstructured data** - Tables for specs, search for manuals
3. **Future-proof architecture** - Ready for LiDAR, 3D scanning, voice
4. **Modular and replaceable** - Swap out any component without breaking others

## 📄 License

ISC
