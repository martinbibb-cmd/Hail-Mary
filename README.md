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
- `packages/pwa` - Frontend PWA with React/TypeScript + Vite (Next.js migration planned)
- `packages/shared` - Shared types and utilities

## 📋 4-Week Build Plans

We have four comprehensive build plans available:

### **[Real-Time Sync Build Plan →](docs/REALTIME-SYNC-4-WEEK-BUILD-PLAN.md)** ⭐ NEWEST

A focused 4-week plan for **Two-Device Real-Time Sync** workflow using Next.js + Supabase/Firebase:
- **Device A (Smartphone)** - Input device with voice recording & camera
- **Device B (Tablet)** - Presentation station with real-time updates & printing
- **Real-time Sync** - WebSocket subscriptions (< 1 second latency)
- **Offline Mode** - Queue system with automatic retry when signal returns
- **Cloud Storage** - Supabase/Firebase for images and data

**Weekly Breakdown:**
1. **Week 1:** Cloud Backend (Supabase Setup - Real-time database & storage buckets)
2. **Week 2:** Input Interface (Phone View - Voice recording & camera uploads)
3. **Week 3:** Presentation Interface (Tablet View - Real-time display & diagrams)
4. **Week 4:** Output (PDF Generation & Printing)

### [Single-Device Workflow Build Plan →](docs/SINGLE-DEVICE-WORKFLOW-4-WEEK-BUILD-PLAN.md)

A focused 4-week plan optimized for **Single-Device workflow** using Samsung Tablet + Hollyland wireless mics:
- **Screen Wake Lock API** - Prevents sleep during recording
- **External Mic Selection** - Hollyland wireless mic support
- **IndexedDB** - Local-first data storage
- **@react-pdf/renderer** - Client-side PDF generation
- **Tablet-Optimized UI** - Touch-friendly interface

**Weekly Breakdown:**
1. **Week 1:** Audio Logic (External Mic + Wake Lock API + Voice-to-Text)
2. **Week 2:** Visualization Layer (Touch-optimized diagrams)
3. **Week 3:** PDF Brochure Generator (Portable printer ready)
4. **Week 4:** UI Polish & Print Testing

### [Next.js PWA Build Plan →](docs/NEXTJS-PWA-4-WEEK-BUILD-PLAN.md)

A focused 4-week plan to build a **Sales Enablement Pack** (physical + digital) using:
- **Next.js** with App Router
- **Voice-to-Text** for hands-free data capture
- **@react-pdf/renderer** for client-side PDF generation
- **Customer Microsite** with QR codes
- **Offline-first** with localStorage

**Weekly Breakdown:**
1. **Week 1:** Voice Logic & Future-Proof Data Structure
2. **Week 2:** Visualization Layer (Diagrams & Floor Plans)
3. **Week 3:** PDF Generator (Brochure-Style A4 Output)
4. **Week 4:** Customer Microsite (Shareable Links & QR Codes)

### [Alternative: Pre-Contract Sales Survey Tool Build Plan →](docs/PRE-CONTRACT-SALES-SURVEY-TOOL-4-WEEK-BUILD-PLAN.md)

The original build plan focusing on voice input, visualization, and presentation output with broader feature set.

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

### Current Status

The foundation is in place with database and CRUD operations. The **4-week build plan** will transform this into a Pre-Contract Sales & Survey Tool.

### ✅ Foundation (Complete)

- **Database** - Structured storage for customers, leads, products, quotes, appointments, surveys, documents
- **CRUD API** - RESTful endpoints for all entities
- **PWA Skeleton** - Dashboard, customer management, lead tracking
- **Authentication** - User login and session management

### 🚧 In Progress (4-Week Build)

#### Week 1: Voice Input Foundation
- Voice recording with live transcription
- Smart entity recognition (boiler, flue, radiators)
- Voice command shortcuts
- Survey session management

#### Week 2: Visualization Layer
- Photo annotation (mark boiler/flue positions)
- System schematic auto-generation
- Flue clearance visualization with compliance checking
- Before/after comparisons

#### Week 3: Presentation Output
- Professional PDF generation with branding
- Email delivery to customers
- WhatsApp sharing (stretch goal)
- Customizable templates

#### Week 4: Integration & Polish
- End-to-end workflow testing
- Offline support (Service Worker + IndexedDB)
- Performance optimization
- User onboarding and help system

**[Full build plan details →](docs/PRE-CONTRACT-SALES-SURVEY-TOOL-4-WEEK-BUILD-PLAN.md)**

### 🔜 Future Enhancements

- **Quote Generation** - Convert surveys to formal quotes
- **Advanced Visualizations** - 3D room models, AR overlays
- **LiDAR Integration** - iPhone 12 Pro+ for precise measurements
- **Thermal Imaging** - FLIR camera for heat loss detection
- **Visual Surveyor** - Complete sensor integration ecosystem

**[Visual Surveyor Architecture →](docs/VISUAL-SURVEYOR-ARCHITECTURE.md)**

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

**Enable automatic updates** (pulls new versions when you push to GitHub):

```bash
curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/enable-autoupdate.sh | bash
```

This sets up a cron job that checks for updates every 5 minutes. **[Auto-Update Guide →](docs/ENABLE-AUTO-UPDATES.md)**

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

1. **"Surveyors sell, engineers fit"** - Win the job on-site with professional presentation
2. **Voice-first** - Hands-free capture while working
3. **Visual communication** - Show customers what they're getting with diagrams and photos
4. **Instant gratification** - Generate professional PDFs in seconds, not days
5. **Offline-capable** - Works in properties with poor mobile signal
6. **Future-proof architecture** - Ready for LiDAR, 3D scanning, thermal imaging

## 📄 License

ISC
