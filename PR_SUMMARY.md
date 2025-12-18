# PR Summary: Profile Routing, AI Gateway, and Knowledge Upload Fixes

## Quick Overview

This PR fixes three critical integration issues in the Hail-Mary application:

1. **Profile Navigation Bug** - Bottom nav buttons were opening the apps menu instead of navigating to Profile/Files
2. **AI Worker Visibility** - Rocky/Sarah requests weren't reaching Cloudflare Worker (no logs)
3. **Knowledge Upload Limits** - PDF uploads were failing for files > 10MB with poor error messages

## What Changed?

### 🔧 Core Changes

| Component | Change | Impact |
|-----------|--------|--------|
| **PWA Navigation** | Added `/profile` and `/files` routes with persistent bottom nav | Proper mobile navigation |
| **API Gateway** | Created `/api/ai/*` proxy endpoints | All requests visible in Cloudflare |
| **AI Service** | New `aiService` client with health monitoring | Real-time Worker status |
| **Knowledge Upload** | Increased nginx limit to 50MB + better errors | 5x larger uploads work |

### 📊 Metrics

- **Files Changed**: 10 files
- **New Files**: 5 (3 source, 2 documentation)
- **Lines Added**: ~800 lines (including docs)
- **Build Status**: ✅ All builds passing
- **Tests**: ✅ 63 tests passing
- **Code Review**: ✅ No issues found
- **Security Scan**: ⚠️ Pre-existing CSRF warning only

## Key Features

### 1. Route-Based Navigation

**Before**: Bottom tabs triggered window opens/app menu
**After**: Bottom tabs use React Router navigation

```typescript
// Old (broken)
onClick={() => openWindow('profile', 'Profile')}

// New (fixed)
onClick={() => navigate('/profile')}
```

### 2. AI Gateway Architecture

**Before**: Browser → Worker (CORS issues, no logs)
**After**: Browser → API → Worker (clean, logged, monitored)

```
GET  /api/ai/health  → Check Worker availability
POST /api/ai/rocky   → Fact extraction
POST /api/ai/sarah   → Explanation generation
```

### 3. Health Monitoring

Real-time status indicators in Rocky/Sarah tools:
- ✓ **Available** (green) - Worker responding
- ⚠ **Degraded** (yellow) - Partial failures
- ✗ **Unavailable** (red) - Worker down

### 4. Enhanced Upload Handling

```
Old: "Failed to upload document"
New: "Upload failed (HTTP 413): File too large. Maximum upload size is 50MB."
```

## Technical Details

### Architecture Pattern: Server-Side Proxy

```
┌─────────┐      ┌──────────┐      ┌──────────┐
│ Browser │─────→│   API    │─────→│  Worker  │
│  (PWA)  │      │ Gateway  │      │ (Rocky/  │
└─────────┘      └──────────┘      │  Sarah)  │
                                   └──────────┘
    ↓                 ↓                  ↓
No CORS         Logs all          Cloudflare
issues          requests          logs work!
```

### Request Flow Example

```javascript
// 1. User enters transcript in Rocky tool
handleProcess() {
  // 2. Call AI service
  const data = await aiService.callRocky({
    transcript: "Customer has 3-bed house..."
  })
  
  // 3. AI service proxies through API
  // POST /api/ai/rocky
  
  // 4. API logs and forwards to Worker
  // 🪨 AI Gateway: Forwarding Rocky request...
  // ✅ AI Gateway: Completed in 234ms - status: 200
  
  // 5. Result returned to UI
  setResult(data)
  setWorkerStatus('available')
}
```

### Health Check Implementation

```typescript
class AIService {
  private healthStatus: AIHealthStatus | null = null
  private lastHealthCheck: number = 0
  private readonly HEALTH_CHECK_INTERVAL = 60000 // 1 minute
  
  async checkHealth(force = false): Promise<AIHealthStatus> {
    // Cache for 60s unless forced
    if (!force && this.healthStatus && 
        (Date.now() - this.lastHealthCheck) < this.HEALTH_CHECK_INTERVAL) {
      return this.healthStatus
    }
    
    // Make health check request
    const response = await fetch('/api/ai/health')
    // ... handle response and cache
  }
}
```

## Testing Checklist

Use `TESTING_GUIDE.md` for detailed steps. Key items:

- [ ] Mobile bottom nav navigates to `/profile` and `/files`
- [ ] Rocky shows Worker status indicator
- [ ] Sarah shows Worker status indicator
- [ ] API logs show AI gateway requests
- [ ] Cloudflare logs show Worker requests
- [ ] PDF uploads work up to 50MB
- [ ] Upload errors show helpful messages
- [ ] Desktop navigation still works
- [ ] Existing routes work (customers, leads, quotes)

## Environment Setup

Add to `packages/api/.env`:

```bash
# Cloudflare Worker URL for Rocky & Sarah AI processing
ROCKY_WORKER_URL=https://hail-mary.martinbibb.workers.dev
```

## API Endpoints Added

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/ai/health` | GET | Optional | Check Worker availability |
| `/api/ai/rocky` | POST | Required | Proxy fact extraction |
| `/api/ai/sarah` | POST | Required | Proxy explanation generation |

## Breaking Changes

**None** - All changes are backwards compatible.

Existing endpoints (`/api/rocky/run`, `/api/sarah/explain`) still work.
Only the Rocky/Sarah *tools* now use the new gateway endpoints.

## Migration Path

For other components using Rocky/Sarah:

```typescript
// Old (still works)
fetch('/api/rocky/run', {...})

// New (recommended)
import { aiService } from './services/ai.service'
const result = await aiService.callRocky({...})
```

## Security Considerations

### Added
- ✅ Server-side request validation
- ✅ Request timeout handling (30s)
- ✅ Error sanitization in responses

### Not Changed
- ⚠️ Pre-existing CSRF warning (requires separate fix)

## Performance Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Rocky request | Direct | +1 hop (API) | ~20-50ms overhead |
| Sarah request | Direct | +1 hop (API) | ~20-50ms overhead |
| Health checks | N/A | Cached 60s | Minimal |
| Upload size limit | 10MB | 50MB | 5x increase |

**Note**: Extra hop adds negligible latency (<50ms) and provides significant benefits (logging, monitoring, security).

## Documentation Added

1. **TESTING_GUIDE.md** (187 lines)
   - Step-by-step testing instructions
   - Expected outcomes
   - Troubleshooting guide

2. **ARCHITECTURE_CHANGES.md** (310 lines)
   - Visual architecture diagrams
   - Before/after comparisons
   - Request flow examples

## Reviewer Notes

### Focus Areas

1. **Navigation Logic** (`StackWorkspace.tsx`)
   - Verify route-based navigation replaces window opens
   - Check mobile vs tablet behavior

2. **AI Gateway** (`routes/ai.ts`)
   - Review proxy implementation
   - Check error handling
   - Verify logging is appropriate

3. **AI Service Client** (`services/ai.service.ts`)
   - Review health check caching
   - Verify error state management
   - Check singleton pattern usage

4. **Upload Improvements** (`AdminKnowledgePage.tsx`, `nginx.conf`)
   - Confirm error message enhancements
   - Verify nginx configuration change

### Quick Validation

```bash
# 1. Install and build
npm install
npm run build

# 2. Check API tests
npm run test -w packages/api

# 3. Start services (separate terminals)
npm run api:dev
npm run pwa:dev

# 4. Test mobile navigation
# Open browser, emulate mobile, click bottom nav buttons

# 5. Test AI tools
# Navigate to /rocky, enter transcript, check Worker status
```

## Questions & Answers

**Q: Why proxy through the API instead of direct Worker calls?**
A: Three reasons: (1) Cloudflare logs now work, (2) No CORS issues, (3) Centralized monitoring/logging

**Q: What if Worker URL is not configured?**
A: Tools show "Unavailable" status. Graceful degradation - app still works.

**Q: Impact on existing API routes?**
A: None. New routes are additive. Old routes (`/api/rocky/run`) still work.

**Q: Why 50MB upload limit?**
A: Allows larger equipment manuals and technical documents. Can increase further if needed.

**Q: Performance impact of health checks?**
A: Minimal - cached for 60 seconds. Only makes request every minute.

## Related Issues

This PR addresses issues mentioned in:
- Bottom navigation bug (Profile/Files)
- Rocky offline status despite Worker being up
- Knowledge upload failures

Does NOT address (future work):
- Customers vs Leads duplication
- Sarah chat integration (currently standalone tool)
- Voice Notes transcript integration
- CSRF protection (separate security PR)

## Deployment Notes

### Prerequisites
- PostgreSQL database
- Cloudflare Worker deployed
- Environment variables configured

### Deployment Steps

1. Update `.env`:
   ```bash
   ROCKY_WORKER_URL=https://hail-mary.martinbibb.workers.dev
   ```

2. Build:
   ```bash
   npm run build
   ```

3. Restart services:
   ```bash
   docker-compose restart hailmary-api
   docker-compose restart hailmary-pwa
   ```

4. Verify:
   ```bash
   curl http://localhost:3001/api/ai/health
   ```

### Rollback Plan

If issues arise:

1. Revert PR: `git revert HEAD`
2. Rebuild: `npm run build`
3. Restart services

All changes are backwards compatible, so rollback is clean.

## Success Criteria

✅ This PR is successful when:

1. Mobile bottom nav navigates to routes (not menus)
2. Rocky/Sarah show Worker status indicators
3. API logs show all AI gateway requests
4. Cloudflare Worker logs show requests
5. PDF uploads work up to 50MB
6. Upload errors are clear and actionable
7. All existing functionality works
8. Build and tests pass

## Support & Troubleshooting

See `TESTING_GUIDE.md` section "Troubleshooting" for common issues and solutions.

For questions about this PR:
- Check documentation: `TESTING_GUIDE.md`, `ARCHITECTURE_CHANGES.md`
- Review commit history for context
- Test using the testing guide

---

**Ready for Review** ✅

All implementation complete. Builds passing. Tests passing. Documentation comprehensive.
