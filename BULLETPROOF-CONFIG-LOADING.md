# Bulletproof Config Loading Implementation

This document describes the resilient configuration loading system implemented to prevent runtime crashes due to missing JSON configuration files.

## Problem Solved

Previously, the API would crash on startup if `depot-schema.json` or `checklist-config.json` were missing from `node_modules/@hail-mary/shared/src/core/`. This happened during Docker rebuilds or in certain deployment scenarios.

## Solution

Implemented a resilient configuration loader that:
1. Never crashes on missing files
2. Never crashes on invalid JSON
3. Tries multiple paths in priority order
4. Falls back to embedded defaults
5. Reports its status via health endpoint

## How It Works

### Loading Priority Order

The config loader tries paths in this order:

1. **Environment Variable Path** (highest priority)
   - `process.env.HAILMARY_CORE_PATH/<filename>`
   - Allows custom configs via mounted volumes (NAS deployments)
   
2. **Published Dist Path** (production preference)
   - `@hail-mary/shared/dist/core/<filename>`
   - Built and copied during `npm run build`
   
3. **Source Path** (development fallback)
   - `@hail-mary/shared/src/core/<filename>`
   - Available during development
   
4. **Embedded Defaults** (ultimate fallback)
   - Hardcoded in `depotTranscription.service.ts`
   - Ensures API always starts

### Files Involved

```
packages/api/src/utils/configLoader.ts        # Resilient loader utility
packages/api/src/services/depotTranscription.service.ts  # Uses loader
packages/shared/src/core/depot-schema.json    # Source config
packages/shared/src/core/checklist-config.json # Source config
packages/shared/dist/core/*.json              # Built configs (copied during build)
```

## Usage

### Normal Operation

No changes required. Configs load automatically from `dist/core/` in production and `src/core/` in development.

### Custom Configs (NAS/Advanced)

To use custom configuration files:

1. Create a directory with your custom JSON files:
   ```bash
   mkdir -p /mnt/user/appdata/hailmary/shared-core
   cp custom-depot-schema.json /mnt/user/appdata/hailmary/shared-core/depot-schema.json
   cp custom-checklist-config.json /mnt/user/appdata/hailmary/shared-core/checklist-config.json
   ```

2. Update `docker-compose.yml`:
   ```yaml
   hailmary-api:
     environment:
       HAILMARY_CORE_PATH: /app/config/core
     volumes:
       - /mnt/user/appdata/hailmary/shared-core:/app/config/core:ro
   ```

3. Restart the container:
   ```bash
   docker compose up -d --force-recreate hailmary-api
   ```

### Health Check

The `/health/detailed` endpoint now reports config loading status:

```bash
curl http://localhost:3001/health/detailed
```

Response includes:
```json
{
  "status": "ok",
  "coreConfig": {
    "depotSchemaLoadedFrom": "/app/packages/shared/dist/core/depot-schema.json",
    "depotSchemaUsedFallback": false,
    "checklistConfigLoadedFrom": "/app/packages/shared/dist/core/checklist-config.json",
    "checklistConfigUsedFallback": false
  }
}
```

If `usedFallback` is `true`, the API is using embedded defaults (check logs for warnings).

## Testing

### Unit Tests

```bash
cd packages/api
npm test -- configLoader.test.ts
```

Tests verify:
- ✅ Returns fallback when no files exist
- ✅ Loads from dist path in production
- ✅ Loads from src path in development
- ✅ Handles invalid JSON gracefully
- ✅ Prioritizes HAILMARY_CORE_PATH when set
- ✅ Never throws on missing files
- ✅ Never throws on invalid JSON

### Manual Testing

Test fallback behavior:
```bash
# Test embedded fallback
cd packages/api
node -e "
const service = require('./dist/services/depotTranscription.service');
const schema = service.depotTranscriptionService.getDepotSchema();
console.log('Sections loaded:', schema.sections.length);
"
```

Test custom config path:
```bash
# Create test config
mkdir -p /tmp/test-config
echo '{"sections":[{"key":"test","name":"Test","order":1,"required":true}]}' > /tmp/test-config/depot-schema.json
echo '{"checklist_items":[],"material_aliases":{}}' > /tmp/test-config/checklist-config.json

# Test loading
HAILMARY_CORE_PATH=/tmp/test-config node -e "
const service = require('./packages/api/dist/services/depotTranscription.service');
const schema = service.depotTranscriptionService.getDepotSchema();
console.log('Custom config loaded:', schema.sections[0].key === 'test');
"
```

## Build Process

The shared package build now copies JSON files to dist:

```json
// packages/shared/package.json
{
  "scripts": {
    "build": "tsc && npm run copy-json",
    "copy-json": "mkdir -p dist/core && cp src/core/*.json dist/core/"
  }
}
```

During Docker build:
```dockerfile
# Build stage
RUN npm run build -w packages/shared  # Builds TS and copies JSONs
RUN npm run build -w packages/api

# Production stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
# This includes dist/core/*.json files
```

## Acceptance Criteria ✅

1. ✅ **API starts without manual terminal patching**
   - Config loader never throws, always returns valid config
   - Service initialization never fails

2. ✅ **`/api/auth/me` returns 401 (not 502)**
   - API fully functional even with missing configs
   - Routes work correctly

3. ✅ **`/health/detailed` shows config status**
   - Reports where configs loaded from
   - Shows if fallback was used

## Troubleshooting

### Warning: Using embedded fallback

If logs show:
```
⚠️  Could not load depot-schema.json from any path. Using embedded fallback.
```

This means:
1. Configs not found in expected locations
2. API still works (using defaults)
3. Check if `npm run build` was run in shared package
4. Check if `dist/core/` directory exists

To fix:
```bash
cd packages/shared
npm run build  # Rebuilds and copies JSONs
```

### Custom configs not loading

If `HAILMARY_CORE_PATH` is set but configs not loading:

1. Check file permissions:
   ```bash
   ls -la $HAILMARY_CORE_PATH
   ```

2. Check file names (case-sensitive):
   - Must be exactly `depot-schema.json`
   - Must be exactly `checklist-config.json`

3. Verify JSON is valid:
   ```bash
   cat $HAILMARY_CORE_PATH/depot-schema.json | jq .
   ```

4. Check health endpoint:
   ```bash
   curl http://localhost:3001/health/detailed | jq .coreConfig
   ```

## Migration Notes

### For Existing Deployments

No migration required. The system is backward compatible:
- Existing configs in `src/core/` still work
- No breaking changes to API
- Health endpoint adds new fields (non-breaking)

### For New Deployments

Just ensure `npm run build` is run for the shared package (already in Dockerfile).

## Security Notes

- Config files are loaded at startup (cached)
- File system access is read-only
- No runtime modification of configs
- Custom config path is optional (secure by default)
- Fallback behavior prevents denial-of-service

## Performance

- Configs loaded once at startup
- Results cached in memory
- No runtime file system access
- Zero performance impact after initialization

## Future Enhancements

Potential improvements:
1. Config reload endpoint (without restart)
2. Config validation against schema
3. Config version management
4. Admin UI for config editing
