# Hail Mary - Stability & Build Issues Investigation Report

**Date:** 2025-12-05
**Investigator:** Claude
**Session:** Deep dive into NAS restart loops and hosting build failures

---

## Executive Summary

This investigation uncovered **multiple critical issues** causing constant restarts on NAS deployments and build failures on hosting platforms. The root causes span database initialization, authentication flow, build configuration, and error handling.

### Key Findings

1. **Database Migration Interactive Prompts** - Fixed but residual risk remains
2. **Authentication Flow Issues** - NAS auth workaround creates security concerns
3. **SSL Certificate Handling** - Disabling SSL validation in builds is a security risk
4. **Build Dependency Bloat** - Production images include unnecessary dev dependencies
5. **Error Handling Gaps** - Silent failures and improper exit codes
6. **Health Check Race Conditions** - Services starting before dependencies ready

---

## 1. NAS Restart Loop Issues

### 1.1 Database Migration Interactive Prompt (FIXED)

**Issue:** The API container was entering infinite restart loops because `drizzle-kit push` would wait for interactive confirmation when detecting schema changes.

**Evidence:**
- Git commit `f689c78`: "Fix API container restart loop by adding --force flag to db:push"
- File: `packages/api/package.json:15`
```json
"db:push": "drizzle-kit push --force"
```

**Root Cause:**
- In Docker environments, stdin is not available
- Interactive prompts cause the process to hang
- Health checks fail → Docker restarts container
- Restart triggers same migration → infinite loop

**Current Fix:**
- Added `--force` flag to skip prompts
- Updated entrypoint script to handle migration failures gracefully

**Residual Risk:** ⚠️ MEDIUM
- `--force` can overwrite schema changes without validation
- No rollback mechanism if migration fails mid-way
- Could cause data loss in production

**Recommendation:**
```bash
# In docker-entrypoint.sh, add validation:
echo "📦 Validating schema before migration..."
npm run db:generate -w packages/api --dry-run
if [ $? -ne 0 ]; then
  echo "❌ Schema validation failed. Manual intervention required."
  exit 1
fi
```

### 1.2 Database Connection Retry Logic

**Issue:** Startup script waits max 60 seconds (30 retries × 2s) for database.

**Location:** `packages/api/scripts/docker-entrypoint.sh:15-34`

**Problem Scenarios:**
- On slow NAS hardware, PostgreSQL can take >60s to start
- On first boot with large data volumes, initialization takes longer
- Network issues in Docker bridge can cause timeouts

**Current Behavior:**
```bash
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  # Try connection
  sleep 2
done
# After 30 failures: exits with code 1 → Docker restarts → loop
```

**Impact:**
- Container exits after 60s
- Docker restart policy triggers
- Appears as "constantly restarting" in logs

**Recommendation:**
```bash
# Increase timeout for NAS deployments
MAX_RETRIES=60  # 2 minutes instead of 1
# OR: Use exponential backoff
# OR: Use Docker depends_on with condition: service_healthy
```

### 1.3 Seed Script Error Handling

**Issue:** Seed script can cause container exit on errors despite "idempotent" design.

**Location:** `packages/api/src/db/seed.ts:111-115`

```typescript
main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);  // ⚠️ This exits the container!
});
```

**Problem:**
- Any unhandled error in seed → exit code 1
- Docker interprets as failure → restarts container
- Common errors:
  - Password hash failure
  - Duplicate key violations (race conditions)
  - Connection pool exhaustion

**Recommendation:**
```typescript
main().catch(async (err) => {
  console.error('[SEED ERROR]', err);
  console.warn('Seed failed but continuing startup...');
  await pool.end();
  // Don't exit - let app start anyway
});
```

### 1.4 Health Check Dependency Issues

**Issue:** Services can start before dependencies are actually ready.

**Evidence:**
- `docker-compose.unraid.yml:56` uses `depends_on` with healthcheck
- But health check is database only
- No validation that migrations completed

**Race Condition Sequence:**
1. PostgreSQL becomes healthy (can accept connections)
2. API container starts
3. Migrations/seed running...
4. PWA container starts and tries to call API
5. API returns 500 (migrations not done)
6. PWA shows errors to user

**Impact:**
- First 10-30 seconds after deployment shows errors
- Users think system is broken
- NAS users report "doesn't work"

**Recommendation:**
```yaml
# In docker-compose.unraid.yml
hailmary-api:
  healthcheck:
    test: ["CMD", "wget", "--spider", "http://localhost:3001/health"]
    interval: 5s
    timeout: 3s
    retries: 10
    start_period: 30s  # ⚠️ Add this!

hailmary-pwa:
  depends_on:
    hailmary-api:
      condition: service_healthy  # ✅ Wait for API healthy, not just started
```

---

## 2. Authentication & Login Issues

### 2.1 NAS Auth Mode Security Concerns

**Issue:** NAS auth mode allows passwordless login, creating security vulnerability.

**Location:** `packages/api/src/services/auth.service.ts:558-603`

**How It Works:**
```typescript
export async function nasQuickLogin(userId: number): Promise<{ user: UserPayload; token: string }> {
  // Check if NAS mode is enabled
  if (process.env.NAS_AUTH_MODE !== 'true') {
    throw new AuthError('unauthorized', 'NAS quick login is not enabled', 403);
  }
  // ... generates JWT for any userId without password check
}
```

**Security Risks:** 🔴 HIGH
1. **No password required** - anyone with network access can login as any user
2. **User enumeration** - can list all users via `listUsersForNasLogin()`
3. **No rate limiting** on NAS auth endpoints
4. **No IP restriction** - works from any IP unless firewall configured
5. **Tokens valid 24h** - long-lived tokens increase exposure window

**Evidence of Concern:**
- Comment in code: "⚠️ WARNING: This should only be enabled on trusted local networks!"
- Added in commit `ba7f301`: "improve NAS auth logging"
- Still active in production config

**Why This Exists:**
- Workaround for users who lost passwords
- NAS deployments don't have email for password reset
- Quick access for single-user home deployments

**Recommendation:** 🔧 CRITICAL FIX NEEDED

1. **Short-term:** Add IP restrictions
```typescript
// In nasQuickLogin()
const ALLOWED_NETWORKS = ['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8'];
if (!isIpInRange(clientIp, ALLOWED_NETWORKS)) {
  throw new AuthError('forbidden', 'NAS auth only available from local network', 403);
}
```

2. **Medium-term:** Replace with PIN/passphrase
```typescript
// Add PIN to NAS login
export async function nasQuickLogin(userId: number, pin: string) {
  const NAS_PIN = process.env.NAS_AUTH_PIN || '000000';
  if (pin !== NAS_PIN) {
    // Rate limit this!
    throw new AuthError('invalid_pin', 'Invalid PIN', 401);
  }
  // ... generate token
}
```

3. **Long-term:** Implement proper local auth
- TOTP/2FA for local deployments
- Biometric auth for mobile
- Hardware key support (YubiKey)

### 2.2 JWT Secret Default Value

**Issue:** Production deployments may use default JWT secret.

**Evidence:**
- `packages/api/src/services/auth.service.ts:47`
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
```

**Risk:** 🔴 CRITICAL
- Anyone knowing the default can forge valid tokens
- Can impersonate any user
- Can gain admin access

**How to Exploit:**
```javascript
// Attacker code
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { id: 1, email: 'admin@hailmary.local', role: 'admin' },
  'development-secret-change-in-production'
);
// Now has valid admin token!
```

**Current Mitigations:**
- `.env.example` warns to change it
- Docker compose files show it needs setting
- BUT: No validation that it was actually changed

**Recommendation:**
```typescript
// In auth.service.ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'development-secret-change-in-production') {
  throw new Error('FATAL: JWT_SECRET must be set and not use default value!');
}
```

### 2.3 Login Flow Race Conditions

**Issue:** First login after deployment can fail due to migrations not completed.

**Sequence:**
1. User navigates to `/login`
2. PWA loads
3. User submits credentials
4. API receives request
5. Database still running migrations
6. Query fails with "relation users does not exist"
7. Returns 500 error
8. User sees "Something went wrong"

**Current Error Handling:**
- `auth.service.ts:210-212` catches database errors
- Returns generic "database error" message
- No retry logic in frontend

**Recommendation:**
```typescript
// In frontend auth context
const MAX_LOGIN_RETRIES = 3;
let retryCount = 0;

async function login(email, password) {
  try {
    return await api.post('/auth/login', { email, password });
  } catch (err) {
    if (err.code === 'database_error' && retryCount < MAX_LOGIN_RETRIES) {
      retryCount++;
      await sleep(2000 * retryCount); // Exponential backoff
      return login(email, password);
    }
    throw err;
  }
}
```

---

## 3. Hosting Platform Build Failures

### 3.1 SSL Certificate Validation Disabled

**Issue:** All Dockerfiles disable SSL certificate validation during builds.

**Evidence:**
- `packages/api/Dockerfile:12`
- `packages/pwa/Dockerfile:14`
- `packages/assistant/Dockerfile:12`

```dockerfile
# Configure npm to handle SSL certificate issues in some cloud build environments.
RUN npm config set strict-ssl false
```

**Why This Exists:**
- Fly.io build servers have certificate chain issues
- Some CI/CD environments have proxy/firewall SSL interception
- Workaround to make builds succeed

**Security Implications:** 🔴 HIGH

1. **Man-in-the-Middle Risk:**
   - npm could download packages from malicious source
   - No validation that packages are authentic
   - Compromised dependencies could enter codebase

2. **Supply Chain Attack Vector:**
   - Attacker intercepts npm registry traffic
   - Serves malicious package with same name
   - Gets included in production build

3. **Compliance Issues:**
   - Violates security best practices
   - May fail audit requirements
   - Could breach SOC2/ISO27001 standards

**Mitigation Currently in Place:**
- `package-lock.json` validates integrity hashes
- BUT: Doesn't prevent all attacks (e.g., registry compromise)

**Recommendation:** 🔧 URGENT FIX

1. **Identify root cause:**
```bash
# In GitHub Actions / Fly.io build
npm config get ca
npm config get cafile
# Check if custom CA needed
```

2. **Use proper CA certificates:**
```dockerfile
# Instead of disabling SSL
RUN apt-get update && apt-get install -y ca-certificates
RUN update-ca-certificates

# If behind corporate proxy, inject CA cert:
COPY corporate-ca-cert.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates
```

3. **Use npm Enterprise or private registry:**
```bash
npm config set registry https://your-registry.com/
npm config set strict-ssl true  # Re-enable!
```

### 3.2 Build Dependency Bloat

**Issue:** Production images include dev dependencies, bloating image size.

**Evidence:**
- `packages/api/Dockerfile:48-50`
```dockerfile
# Install ALL dependencies including dev deps for drizzle-kit and ts-node
# These are required at runtime to run database migrations and seed scripts
RUN npm ci
```

**Impact:**
- API image: ~800MB (should be ~300MB)
- Includes typescript, jest, drizzle-kit, etc.
- Slow deployments
- More attack surface

**Why It Exists:**
- Migrations run at container start (not build time)
- Needs `drizzle-kit` and `ts-node` at runtime
- Seed script uses TypeScript

**Recommendation:** Split into two stages

```dockerfile
# Builder stage - has dev deps
FROM node:20-alpine AS builder
RUN npm ci
RUN npm run build

# Migrations stage - only migration deps
FROM node:20-alpine AS migrator
RUN npm ci --production
RUN npm install drizzle-kit ts-node  # Only what's needed for migrations

# Runtime stage - only prod deps
FROM node:20-alpine AS production
COPY --from=builder /app/dist ./dist
RUN npm ci --production --ignore-scripts
```

### 3.3 Build Order Dependencies

**Issue:** Workspace builds fail if `shared` package not built first.

**Evidence:**
- All package.json files depend on `@hail-mary/shared`
- Build scripts assume shared is already built
- No explicit build order in Dockerfiles

**Failure Scenario:**
```bash
# If building PWA in isolation:
npm run build -w packages/pwa
# Error: Cannot find module '@hail-mary/shared/types'
```

**Current Workaround:**
- Dockerfiles manually run `npm run build -w packages/shared` first
- Works but fragile

**Recommendation:**
```json
// In root package.json
"scripts": {
  "build": "npm run build:shared && npm run build:packages",
  "build:shared": "npm run build -w packages/shared",
  "build:packages": "npm run build -w packages/api -w packages/pwa -w packages/assistant"
}
```

---

## 4. Error Logging & Observability Gaps

### 4.1 Silent Failure Modes

**Issue:** Many failures logged but don't trigger alerts.

**Examples:**
- Seed script errors logged but container continues
- Migration warnings logged but no validation
- Database connection failures retry silently

**Impact:**
- Issues discovered too late
- No monitoring/alerting
- Hard to diagnose in production

**Recommendation:**
1. Structured logging:
```typescript
import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

logger.error({ err, userId, action: 'login' }, 'Login failed');
```

2. Error tracking:
```typescript
// Add Sentry or similar
import * as Sentry from '@sentry/node';
Sentry.captureException(error);
```

3. Health metrics:
```typescript
// Prometheus metrics
app.get('/metrics', (req, res) => {
  res.send(register.metrics());
});
```

### 4.2 No Request Tracing

**Issue:** Can't trace request through API → Assistant → Database.

**Impact:**
- Hard to diagnose slow queries
- Can't identify bottlenecks
- No visibility into error propagation

**Recommendation:**
```typescript
// Add correlation IDs
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuid();
  res.setHeader('x-request-id', req.id);
  next();
});

// Log with request ID
logger.info({ requestId: req.id, path: req.path }, 'Request started');
```

---

## 5. Recommended Fixes Priority

### 🔴 CRITICAL (Fix Immediately)

1. **JWT Secret Validation** - Enforce non-default secret
2. **NAS Auth IP Restrictions** - Limit to local network
3. **SSL Certificate Validation** - Remove `strict-ssl false`

### 🟠 HIGH (Fix This Sprint)

4. **Database Connection Timeout** - Increase retry limit
5. **Health Check Dependencies** - Add `start_period` to healthchecks
6. **Seed Script Error Handling** - Don't exit on seed errors
7. **Production Dependency Bloat** - Split Docker stages

### 🟡 MEDIUM (Fix Next Month)

8. **NAS Auth Replacement** - Implement PIN/passphrase
9. **Error Logging** - Add structured logging
10. **Request Tracing** - Add correlation IDs
11. **Build Order** - Explicit dependency resolution

### 🟢 LOW (Technical Debt)

12. **Monitoring** - Add Prometheus metrics
13. **Alerting** - Set up error notifications
14. **Documentation** - Update deployment guides

---

## 6. Testing Recommendations

### 6.1 Integration Tests for Startup Sequence

```typescript
describe('Container startup', () => {
  it('should handle database not ready', async () => {
    // Start API before database
    // Should retry and succeed
  });

  it('should run migrations before accepting requests', async () => {
    // API should return 503 until migrations done
  });

  it('should not crash on seed errors', async () => {
    // Even if seed fails, container should start
  });
});
```

### 6.2 Load Testing for NAS

```bash
# Simulate slow NAS disk I/O
docker run --cpus=0.5 --memory=512m hailmary
# Should still start within reasonable time
```

### 6.3 Security Testing

```bash
# Try to exploit default JWT secret
# Try to access NAS auth from external IP
# Try to enumerate users
```

---

## 7. Deployment Checklist

Before deploying to NAS or hosting platform:

- [ ] Change `JWT_SECRET` to random value
- [ ] Set `NAS_AUTH_MODE=false` for public deployments
- [ ] Configure `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`
- [ ] Verify database has enough disk space for migrations
- [ ] Set up backup strategy for PostgreSQL data
- [ ] Configure firewall rules (if NAS auth enabled)
- [ ] Test startup sequence with cold database
- [ ] Verify health checks return success before routing traffic
- [ ] Set up log aggregation/monitoring
- [ ] Document recovery procedures

---

## 8. Conclusion

The restart loops and build failures stem from **multiple interconnected issues**:

1. **Interactive processes in non-interactive environment** (migrations)
2. **Inadequate error handling** (seed script exits)
3. **Security workarounds** (NAS auth, SSL disabled)
4. **Timing issues** (race conditions between services)
5. **Insufficient observability** (silent failures)

**The good news:** Most issues have been identified and can be fixed incrementally.

**The bad news:** Some issues (NAS auth, SSL) are security risks that need immediate attention.

**Next Steps:**
1. Implement critical fixes (JWT, NAS auth, SSL)
2. Add monitoring and alerting
3. Create test suite for deployment scenarios
4. Update documentation with troubleshooting guides

---

*Report generated: 2025-12-05*
*For questions or updates, reference git commits: `f689c78`, `ba7f301`, `dee199f`*
