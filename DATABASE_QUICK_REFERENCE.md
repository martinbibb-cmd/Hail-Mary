# Database Quick Reference Card

## 🔍 Quick Diagnosis Commands

```bash
# ✅ List all tables (use 'hailmary' user, not 'postgres')
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\dt"

# ✅ Check leads table structure (should have assigned_user_id column)
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d leads"

# ✅ Check if addresses table exists
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d addresses"

# ✅ Check migration history
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

## 🔧 Fix Schema Mismatch

### Method 1: Run Migrations (Recommended)

```bash
# Enter API container
docker exec -it hailmary-api sh

# Inside container:
cd /app
npm run db:migrate
exit
```

### Method 2: From Host (if you have the repo locally)

```bash
# From repository root
npm run db:migrate
```

### Method 3: Fresh Reset (⚠️ DELETES ALL DATA)

```bash
docker compose down
docker volume rm hailmary-postgres-data
docker compose up -d
docker compose logs -f hailmary-migrator
```

## 🏥 Health Check Commands

```bash
# ✅ Correct health endpoints (via nginx proxy)
curl http://localhost:3000/health/api
curl http://localhost:3000/health/assistant

# Direct container health checks
docker exec -it hailmary-api curl http://localhost:3001/health
docker exec -it hailmary-assistant curl http://localhost:3002/health

# ❌ NOT health endpoints
# /health.json - This routes to transcript handler!
```

## 📋 Check Available Scripts

```bash
# List database management scripts
docker exec -it hailmary-api sh -c "cd /app && cat package.json | grep -A 10 '\"scripts\"'"

# Or from repository root
cat packages/api/package.json | grep -A 10 '"scripts"'
```

## 🐛 Common Error Messages

### Error: `role "postgres" does not exist`
**Fix**: Use `-U hailmary` instead of `-U postgres`

### Error: `relation "addresses" does not exist`
**Fix**: Run migrations (Method 1 above)

### Error: `column "assigned_user_id" does not exist`
**Fix**: Run migrations (Method 1 above)

### Error: `{"success":false,"error":"Invalid transcript ID"}` on `/health.json`
**Fix**: Use `/health/api` or `/health/assistant` instead

## 📊 Verify After Fix

```bash
# 1. Check migrator completed
docker compose logs hailmary-migrator

# 2. Check API logs for errors
docker compose logs hailmary-api | tail -50

# 3. Verify tables exist
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\dt"

# 4. Test health
curl http://localhost:3000/health/api

# 5. Test database connection
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "SELECT COUNT(*) FROM users;"
```

## 🎯 One-Liner Diagnostic

**Note**: Requires `jq` for JSON formatting. If `jq` is not installed, remove `| jq .` from the curl commands.

```bash
# Copy/paste this to get a complete diagnostic report
echo "=== Tables ===" && \
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\dt" && \
echo -e "\n=== Leads Structure ===" && \
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d leads" && \
echo -e "\n=== Addresses Structure ===" && \
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d addresses" && \
echo -e "\n=== Migration History ===" && \
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5;" && \
echo -e "\n=== API Health ===" && \
curl -s http://localhost:3000/health/api && \
echo -e "\n=== Assistant Health ===" && \
curl -s http://localhost:3000/health/assistant
```

**With jq (for formatted JSON output):**
```bash
curl -s http://localhost:3000/health/api | jq .
curl -s http://localhost:3000/health/assistant | jq .
```

## 📚 Full Guide

For detailed explanations, see: [DATABASE_SCHEMA_TROUBLESHOOTING.md](./DATABASE_SCHEMA_TROUBLESHOOTING.md)
