## v2-spine local dev bootstrap (repeatable)

This repo is a monorepo. The goal is: **local Postgres + API dev server + PWA dev server** without fighting caching or Docker wiring.

### Prereqs

- **Node**: 20 LTS (18+ works)
- **Docker** + **Docker Compose**

### 1) Create the branch

```bash
git checkout main
git pull
git checkout -b v2-spine
```

### 2) Install dependencies (repo root)

```bash
npm install
```

### 3) Start local Postgres (Docker)

Important: the existing `docker-compose.yml` is production-oriented (it requires a root `.env` and does **not** expose Postgres on `localhost:5432`).

Use the included local-dev compose file (runs **only** Postgres and exposes `5432:5432`):

```bash
docker compose -f docker-compose.dev.yml up -d hailmary-postgres
```

Wait for readiness:

```bash
docker compose -f docker-compose.dev.yml logs -f hailmary-postgres
```

### 4) Local env files

#### API env (`packages/api/.env`)

Create `packages/api/.env` (do not commit it):

```bash
PORT=3001
DATABASE_URL=postgres://postgres@localhost:5432/hailmary
JWT_SECRET=dev-secret-change-me
BASE_URL=http://localhost:3000
NODE_ENV=development
```

#### PWA env (`packages/pwa/.env`)

Create `packages/pwa/.env` (optional depending on your setup):

```bash
VITE_API_BASE_URL=http://localhost:3001
```

### 5) Run migrations (repo root)

```bash
npm run db:migrate
```

If migrations fail, the most common cause is **`DATABASE_URL` not matching your running Postgres**.

### 6) Run dev servers (two terminals)

API:

```bash
npm run api:dev
```

PWA:

```bash
npm run pwa:dev
```

Open:

- **PWA**: `http://localhost:3000`
- **API**: `http://localhost:3001`

### 7) Dev stability: avoid “PWA caching pain”

- In dev, **do not register a service worker** (PROD-only).
- If you previously had one registered: Chrome DevTools → Application → Service Workers → Unregister (once).

