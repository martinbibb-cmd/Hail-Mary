# 🚀 Quick Start Guide - Login Issue Resolution

## Problem

You're seeing a login screen but can't login because:
1. No `.env` file exists
2. Docker containers aren't running
3. No admin user has been created yet

## Solution - Get Started in 3 Steps

### Step 1: Create `.env` File

Create a `.env` file in the project root with these **required** settings:

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` and set these **CRITICAL** values:

```env
# ======================
# DATABASE (REQUIRED)
# ======================
POSTGRES_USER=hailmary
POSTGRES_PASSWORD=ChangeMeToSecurePassword123!
POSTGRES_DB=hailmary
DATABASE_URL=postgres://hailmary:ChangeMeToSecurePassword123!@hailmary-postgres:5432/hailmary

# ======================
# SECURITY (CRITICAL!)
# ======================
# Generate this with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_generated_secret_here_min_32_chars_required

# ======================
# INITIAL ADMIN USER
# ======================
# The API will automatically create this admin user on first startup
INITIAL_ADMIN_EMAIL=admin@hailmary.local
INITIAL_ADMIN_PASSWORD=HailMary2024!
INITIAL_ADMIN_NAME=Admin User

# ======================
# OPTIONAL - NAS Mode
# ======================
# Uncomment to enable NAS quick login (local networks only!)
# NAS_AUTH_MODE=true
# NAS_ALLOWED_IPS=192.168.1.0/24
```

**⚠️ IMPORTANT**: Replace `ChangeMeToSecurePassword123!` with a secure password.

### Step 2: Generate JWT Secret

Run this command to generate a secure JWT_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it into your `.env` file as `JWT_SECRET`.

### Step 3: Start Docker Containers

Choose your deployment type:

#### Option A: Standard Deployment
```bash
# Start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Access the app
http://localhost:3000
```

#### Option B: Production Deployment
```bash
# Start with production config
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Access the app
http://localhost:8080
```

## What Happens on First Startup

1. **PostgreSQL Database** starts and initializes
2. **API Service** starts and runs migrations
3. **Database Seed** runs automatically:
   - Creates "Test Account"
   - Creates sample lead
   - Creates sample boiler products
   - **Creates admin user** from `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`
4. **PWA/Frontend** starts on port 3000 (or 8080 for production)

## Default Login Credentials

After the containers start, login with:

```
Email:    admin@hailmary.local
Password: HailMary2024!
```

**⚠️ SECURITY WARNING**: Change these credentials immediately after first login!

## Verifying Everything Works

### Check Container Status
```bash
# View running containers
docker ps

# Should show:
# - hailmary-postgres
# - hailmary-api
# - hailmary-assistant
# - hailmary-pwa
```

### Check Logs for Admin User Creation
```bash
# Check API logs for seed message
docker logs hailmary-api | grep -i "admin"

# Should see:
# ✅ Created initial admin user: admin@hailmary.local (id: 1)
```

### Check Database
```bash
# Connect to database
docker exec -it hailmary-postgres psql -U hailmary -d hailmary

# List users
SELECT id, email, name, role FROM users;

# Should see your admin user
# Exit with: \q
```

### Access the Application
Open your browser to:
- **Development**: http://localhost:3000
- **Production**: http://localhost:8080

You should see the Hail-Mary login screen.

## Troubleshooting

### Issue: "JWT_SECRET must be set"

**Cause**: Missing or empty JWT_SECRET in .env

**Fix**:
```bash
# Generate secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
JWT_SECRET=<generated_secret>

# Restart
docker-compose restart hailmary-api
```

### Issue: "Database connection failed"

**Cause**: DATABASE_URL doesn't match POSTGRES_* variables

**Fix**: Ensure the password in DATABASE_URL matches POSTGRES_PASSWORD:
```env
POSTGRES_PASSWORD=MyPassword123
DATABASE_URL=postgres://hailmary:MyPassword123@hailmary-postgres:5432/hailmary
#                              ^^^^^^^^^^^^^^ Must match!
```

### Issue: "No admin user found"

**Cause**: INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD not set

**Fix**:
```bash
# Stop containers
docker-compose down

# Edit .env and set:
INITIAL_ADMIN_EMAIL=your@email.com
INITIAL_ADMIN_PASSWORD=YourSecurePassword123!

# Start containers (seed will run again)
docker-compose up -d

# Check logs
docker logs hailmary-api | grep "Created initial admin"
```

### Issue: "Invalid credentials" when logging in

**Possible causes**:
1. Using wrong credentials
2. Admin user wasn't created (check logs)
3. Password less than 8 characters

**Fix**:
```bash
# Check if user exists
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "SELECT email, role FROM users;"

# If no user, check .env has INITIAL_ADMIN_* set, then restart:
docker-compose restart hailmary-api
```

### Issue: "Cannot connect to http://localhost:3000"

**Cause**: Containers not running or port conflict

**Fix**:
```bash
# Check container status
docker ps | grep hailmary

# If not running, check logs:
docker-compose logs

# If port conflict, change PWA_PORT in .env:
PWA_PORT=3001
```

## Enable NAS Quick Login (Optional)

For **trusted local networks only**:

1. Edit `.env`:
```env
NAS_AUTH_MODE=true
NAS_ALLOWED_IPS=192.168.1.0/24  # Your local subnet
```

2. Restart:
```bash
docker-compose restart hailmary-api
```

3. You'll now see "NAS Quick Login" button on login screen

4. Select your user from the list (no password needed!)

**⚠️ WARNING**: Only use this on private, trusted networks!

## Next Steps

After successful login:

1. **Change default password**: Go to Profile app
2. **Create additional users**: Admin panel → Users
3. **Explore the apps**: Diary, Visit, Leads, Quotes
4. **Read the docs**: See `DOCKER_COMPOSE_SETUP.md` for advanced configuration

## Still Having Issues?

1. **Check all logs**:
```bash
docker-compose logs -f
```

2. **Verify .env is correct**:
```bash
cat .env | grep -E "^(POSTGRES_|DATABASE_URL|JWT_SECRET|INITIAL_ADMIN_)"
```

3. **Fresh restart**:
```bash
docker-compose down
docker-compose up -d
docker-compose logs -f
```

4. **Nuclear option** (destroys all data!):
```bash
docker-compose down -v  # Removes volumes
docker-compose up -d
```

## Summary

To fix your login issue:

```bash
# 1. Create .env with required values
cp .env.example .env
nano .env  # Set POSTGRES_PASSWORD, JWT_SECRET, INITIAL_ADMIN_*

# 2. Start containers
docker-compose up -d

# 3. Watch for success
docker-compose logs -f hailmary-api

# 4. Login
# Open http://localhost:3000
# Email: admin@hailmary.local
# Password: HailMary2024! (or whatever you set)
```

That's it! 🎉
