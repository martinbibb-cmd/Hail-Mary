# CPU Compatibility Guide

## Overview

Hail-Mary is built to run on a wide range of x86_64 CPUs, including older and low-power processors that **do not support AVX/AVX2 instructions**. This document explains why this matters and how we ensure compatibility.

## The Problem: SIGILL Errors on Non-AVX CPUs

### What is SIGILL?

`SIGILL` (Illegal Instruction) is a runtime error that occurs when a program tries to execute a CPU instruction that the processor doesn't support. Common examples include:

- **Intel Celeron N5105 (Jasper Lake)** - Supports SSE4.2 but NOT AVX/AVX2
- **Intel Atom processors**
- **Older AMD processors**
- **Low-power embedded CPUs**

### Root Cause

The issue typically comes from **prebuilt native binaries** in Node.js packages that were compiled on modern CPUs with AVX support. When npm installs these packages, it may download a prebuilt binary optimized for newer CPUs, causing crashes on older hardware.

Common culprits in Node.js ecosystems:
- **esbuild** - Native JavaScript bundler (used by Vite)
- **rollup** - Module bundler with optional native bindings
- **sharp** - Image processing library (if used)
- **bcrypt** - Password hashing (native version, not bcryptjs)
- **better-sqlite3** - Database library
- **argon2** - Password hashing

## Our Solution

### 1. Debian-based Images (glibc vs musl)

```dockerfile
FROM node:20-bookworm-slim
```

**Why not Alpine?**
- Alpine uses `musl` libc, which can be harder for native modules
- Debian uses standard `glibc`, which most native modules expect
- Better compatibility with existing prebuilt binaries during fallback scenarios

### 2. Force Building from Source

```dockerfile
ENV npm_config_build_from_source=true
ENV npm_config_prefer_binary=false
```

These environment variables tell npm to:
- **ALWAYS** compile native modules from source code
- **NEVER** download prebuilt binaries

This ensures binaries are built for the specific CPU where Docker runs.

### 3. Explicit CPU Compatibility Flags

```dockerfile
ENV CFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"
ENV CXXFLAGS="-O2 -pipe -march=x86-64 -mno-avx -mno-avx2"
```

**Flag explanations:**
- `-O2` - Optimize for performance while maintaining broad compatibility
- `-pipe` - Use pipes for compilation (faster builds, less disk I/O)
- `-march=x86-64` - Target the baseline x86-64 architecture (no modern extensions)
- `-mno-avx` - Explicitly disable AVX instructions
- `-mno-avx2` - Explicitly disable AVX2 instructions

### 4. Required Build Tools

```dockerfile
RUN apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    ca-certificates
```

These tools are required for `node-gyp` (Node.js's native addon build tool):
- **python3** - Required by node-gyp
- **make** - Build automation
- **g++** - C++ compiler
- **pkg-config** - Library configuration tool

## Affected Files

The following Dockerfiles have been updated with these compatibility fixes:

1. `/Dockerfile` - Main monorepo build
2. `/packages/api/Dockerfile` - API service
3. `/packages/assistant/Dockerfile` - Assistant service
4. `/packages/pwa/Dockerfile` - PWA build stage

## Docker Compose Changes

### Preventing Boot Loops

The `docker-compose.unraid-build.yml` file has been updated to prevent boot loops caused by the migrator service:

**Before:**
```yaml
depends_on:
  hailmary-postgres:
    condition: service_healthy
  hailmary-migrator:
    condition: service_completed_successfully  # This could cause boot loops
```

**After:**
```yaml
# Migrator runs independently
hailmary-migrator:
  restart: "no"  # One-off job, don't restart

# API starts when postgres is ready (not waiting for migrator)
hailmary-api:
  depends_on:
    hailmary-postgres:
      condition: service_healthy
    # NO migrator dependency
```

This change allows:
- The API to start as soon as PostgreSQL is ready
- Migrations to run independently
- No restart loops if migrations take time

## Verification

### How to Test CPU Compatibility

1. **Build the images locally:**
   ```bash
   docker-compose -f docker-compose.unraid-build.yml build --no-cache
   ```

2. **Check for prebuilt binaries:**
   ```bash
   # Look for downloaded binaries (should be minimal)
   docker-compose -f docker-compose.unraid-build.yml run --rm hailmary-api find /app -name "*.node"
   ```

3. **Verify CPU flags in binaries:**
   ```bash
   # Check if AVX instructions are present (should return nothing)
   docker run --rm hailmary-api strings /app/node_modules/esbuild/bin/esbuild 2>/dev/null | grep -i avx
   ```

4. **Run on target hardware:**
   - Deploy to your Intel Celeron N5105 or similar CPU
   - Check logs for SIGILL errors: `docker logs hailmary-api`
   - If running successfully, compatibility is confirmed

### Expected Build Behavior

With these changes:
- **Build time** will be longer (compiling vs downloading)
- **First run** may take 2-5 minutes for npm ci to compile all native modules
- **Subsequent runs** will be fast (cached layers)
- **No SIGILL errors** should occur on non-AVX CPUs

## Troubleshooting

### Issue: Build fails with "python: command not found"

**Solution:** The Dockerfile should install python3. Verify with:
```bash
docker-compose -f docker-compose.unraid-build.yml run --rm hailmary-api python3 --version
```

### Issue: Still getting SIGILL after changes

**Possible causes:**
1. **Cached layers** - Force rebuild: `docker-compose build --no-cache`
2. **Old images** - Remove old images: `docker image prune -a`
3. **Downloaded binaries** - Check if node_modules has prebuilts despite env vars

**Debug:**
```bash
# Check what's actually being used
docker run --rm hailmary-api sh -c 'cat /proc/cpuinfo | grep flags'
docker run --rm hailmary-api sh -c 'objdump -d /app/node_modules/esbuild/bin/esbuild | grep -i avx || echo "No AVX found"'
```

### Issue: Build takes too long

**This is expected.** Building from source is slower but necessary for CPU compatibility. You can:
1. Use Docker BuildKit for better caching: `DOCKER_BUILDKIT=1 docker-compose build`
2. Build once, push to registry, pull on target systems
3. Accept the one-time cost for compatibility

## Alternative: Pre-built Images

If you want to speed up deployment, you can:
1. Build images once on a compatible system
2. Push to a container registry (GitHub Container Registry, Docker Hub)
3. Pull on target systems

The images will work on non-AVX CPUs **only if built with these Dockerfiles**.

## References

- [Node.js native addons](https://nodejs.org/api/addons.html)
- [node-gyp documentation](https://github.com/nodejs/node-gyp)
- [GCC x86 Options](https://gcc.gnu.org/onlinedocs/gcc/x86-Options.html)
- [Intel Instruction Set Reference](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)

## Summary

By forcing native modules to compile from source with conservative CPU flags, we ensure Hail-Mary runs reliably on:
- ✅ Intel Celeron N5105 (Jasper Lake) - SSE4.2 only
- ✅ Intel Atom processors
- ✅ Older AMD processors
- ✅ Modern CPUs (with slight performance trade-off)

The changes add ~2-5 minutes to initial build time but eliminate runtime crashes on older hardware.
