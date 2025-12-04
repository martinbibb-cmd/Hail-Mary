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

- `packages/api` - Backend API with Express/TypeScript + SQLite
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
| Database | SQLite (better-sqlite3) |
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
```

The database file is stored at `packages/api/data/hailmary.db`.

## 🐳 Docker & Deployment

### Local Docker Development

```bash
# Build and run all services
docker-compose up -d --build

# View logs
docker-compose logs -f
```

### NAS Deployment

Deploy to a NAS with automatic sync from GitHub. See **[NAS Deployment Guide](docs/NAS_DEPLOYMENT.md)** for:

- CI/CD pipeline with GitHub Actions
- Pre-built images from GitHub Container Registry
- Automatic updates via scheduled pulls or webhooks
- Step-by-step setup instructions

### unRAID Deployment (Recommended for Home Servers)

**Quick Install with Auto-Updates:**

```bash
wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash
```

This one-liner will:
- Install Hail-Mary to `/mnt/user/appdata/hailmary`
- Pull pre-built Docker images from GitHub Container Registry
- Start all services on port 8080
- Optionally configure automatic updates when you push code

**Enable auto-updates after installation:**

```bash
cd /mnt/user/appdata/hailmary
./scripts/setup-unraid-autoupdate.sh
```

Now whenever you push changes to GitHub, your unRAID server will automatically:
1. Pull new Docker images
2. Update containers
3. Send you a notification

See **[unRAID Deployment Guide](docs/DEPLOYMENT-unRAID.md)** for detailed instructions and manual installation.

### Fly.io Deployment

Deploy to fly.io using the provided configuration files:

```bash
# Deploy API
fly deploy -c fly.api.toml

# Deploy Assistant
fly deploy -c fly.assistant.toml

# Deploy PWA
fly deploy -c fly.pwa.toml
```

See **[Fly.io Deployment Guide](docs/DEPLOYMENT-FLY.md)** for detailed instructions.

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
