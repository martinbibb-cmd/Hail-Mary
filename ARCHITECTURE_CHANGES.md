# Architecture Changes Summary

This document provides a visual overview of the architectural improvements made in this PR.

## 1. Profile Navigation Fix

### Before (Broken)
```
Mobile Device
┌──────────────────────────┐
│ Main Content             │
│                          │
│                          │
└──────────────────────────┘
┌──────────────────────────┐
│ [Home] [Profile] [Files] │ ← Bottom Nav
└──────────────────────────┘
         ↓ Click Profile
         ↓
    Opens Apps Menu (Wrong!)
    Opens global drawer
```

### After (Fixed)
```
Mobile Device
┌──────────────────────────┐
│ Main Content             │
│                          │
│                          │
└──────────────────────────┘
┌──────────────────────────┐
│ [Home] [Profile] [Files] │ ← Bottom Nav
└──────────────────────────┘
         ↓ Click Profile
         ↓
    Navigate to /profile route
    React Router handles it
    ✓ Proper navigation!
```

**Key Changes:**
- Added routes: `/profile` and `/files` in `App.tsx`
- StackWorkspace now uses `navigate()` instead of `openWindow()`
- Bottom nav is persistent and route-based

## 2. AI Gateway Architecture

### Before (Direct Browser Calls)
```
┌─────────┐
│ Browser │
│  (PWA)  │
└─────────┘
     │
     │ Direct HTTPS call
     │ ❌ CORS issues
     │ ❌ No Cloudflare logs
     │ ❌ Security concerns
     ↓
┌──────────────────┐
│ Cloudflare       │
│ Worker           │
│ (Rocky & Sarah)  │
└──────────────────┘
```

### After (Server-Side Proxy)
```
┌─────────┐
│ Browser │
│  (PWA)  │
└─────────┘
     │
     │ /api/ai/rocky
     │ /api/ai/sarah
     │ /api/ai/health
     ↓
┌──────────────────┐
│ Hail-Mary API    │
│ (Express)        │  ✓ Logs all requests
│                  │  ✓ No CORS issues
│ AI Gateway       │  ✓ Centralized auth
│ Routes           │  ✓ Error handling
└──────────────────┘
     │
     │ HTTPS Proxy
     │ With timeout
     │ With retries
     ↓
┌──────────────────┐
│ Cloudflare       │
│ Worker           │  ✓ Logs show traffic!
│ (Rocky & Sarah)  │
└──────────────────┘
```

**Key Changes:**
- Created `/api/ai/*` routes in API
- Rocky/Sarah tools use `aiService` client
- All requests go through API server
- Health monitoring with status indicators

## 3. AI Service Client Architecture

### Component Diagram
```
┌────────────────────────────────────────────────┐
│ Rocky Tool / Sarah Tool                        │
│                                                │
│ - User enters transcript/data                  │
│ - Click process button                         │
│ - Shows Worker status indicator               │
└────────────────────────────────────────────────┘
                    │
                    │ Calls
                    ↓
┌────────────────────────────────────────────────┐
│ aiService (Singleton)                          │
│                                                │
│ - checkHealth()      → GET /api/ai/health     │
│ - callRocky(data)    → POST /api/ai/rocky     │
│ - callSarah(data)    → POST /api/ai/sarah     │
│ - getCachedHealth()  → Returns cached status  │
│                                                │
│ Health cache: 60 seconds                       │
│ Auto-updates on requests                       │
└────────────────────────────────────────────────┘
                    │
                    │ HTTP
                    ↓
┌────────────────────────────────────────────────┐
│ /api/ai/* routes                               │
│                                                │
│ - Validates auth                               │
│ - Logs request (method, path, start time)      │
│ - Proxies to Worker                            │
│ - Logs response (status, duration)             │
│ - Returns result                               │
└────────────────────────────────────────────────┘
```

### Health Monitoring Flow
```
1. Component Mount
   └─→ aiService.checkHealth()
       └─→ GET /api/ai/health
           └─→ Worker /health endpoint
               └─→ Returns: {status, responseTime}

2. Cached for 60s
   └─→ getCachedHealth() returns immediately
   
3. On Request (Rocky/Sarah)
   └─→ If success → Update status to 'available'
   └─→ If error   → Update status to 'degraded/unavailable'
   
4. UI Updates
   └─→ Status badge changes color:
       ✓ Available   → Green
       ⚠ Degraded    → Yellow
       ✗ Unavailable → Red
```

## 4. Knowledge Upload Flow

### Before (Limited)
```
Upload PDF (10MB max)
     │
     ↓
┌──────────┐
│ nginx    │ ← client_max_body_size 10m
└──────────┘
     │ ❌ 413 Error if > 10MB
     ↓
┌──────────┐
│ API      │
│ /upload  │
└──────────┘
     │ Generic error message
     ↓
┌──────────┐
│ UI       │ "Failed to upload"
└──────────┘
```

### After (Enhanced)
```
Upload PDF (50MB max)
     │
     ↓
┌──────────┐
│ nginx    │ ← client_max_body_size 50m
└──────────┘
     │ ✓ Allows larger files
     ↓
┌──────────┐
│ API      │
│ /upload  │ → Multipart handling
└──────────┘    PDF processing
     │
     │ Detailed error response
     │ {status, error, details}
     ↓
┌──────────┐
│ UI       │ "Upload failed (HTTP 413):
└──────────┘  File too large. Max 50MB."
```

**Key Changes:**
- nginx: `client_max_body_size 50m`
- UI: Catches parse errors, shows status codes
- UI: Displays first 500 chars of error details
- Specific handling for 413 errors

## 5. Request Flow Comparison

### Old Rocky Request
```
Browser
  └─→ POST /api/rocky/run
      └─→ Rocky Service (local processing)
          └─→ Returns structured facts
```

### New Rocky Request
```
Browser (RockyTool)
  └─→ aiService.callRocky({transcript})
      └─→ POST /api/ai/rocky
          │ Log: "🪨 Forwarding Rocky request..."
          └─→ Worker: https://...workers.dev/rocky
              │ Cloudflare logs: ✓ Captured
              └─→ Returns: {success, data}
          │ Log: "✅ Completed in 234ms - status: 200"
          └─→ Returns to browser
      └─→ Updates health status
      └─→ Displays result
```

## 6. Security & Monitoring Improvements

### Logging Enhancements
```
Before:
- No visibility into AI requests
- No performance metrics
- No error tracking

After:
API Logs:
  🔍 AI Gateway: Checking Worker health at https://...
  ✅ AI Gateway: Worker health check completed in 123ms - status: 200
  🪨 AI Gateway: Forwarding Rocky request to https://...
  ✅ AI Gateway: Rocky request completed in 456ms - status: 200
  ❌ AI Gateway: Sarah request failed after 789ms: timeout

Cloudflare Logs:
  [NOW VISIBLE]
  GET  /health          200  123ms
  POST /rocky           200  456ms
  POST /sarah           504  789ms
```

### Error Handling
```
Before:
- Generic "Failed" messages
- No status information
- No recovery guidance

After:
- HTTP status codes displayed
- Detailed error messages
- Specific error handling (413, 503, etc.)
- Visual status indicators
- Automatic degraded mode
```

## Summary of Benefits

✅ **Navigation**
- Proper route-based navigation
- Browser back/forward works correctly
- No more unexpected drawer opens

✅ **AI Integration**
- All requests visible in logs
- No CORS issues
- Centralized error handling
- Health monitoring built-in
- Automatic degraded mode

✅ **Knowledge Upload**
- 5x larger file support (50MB vs 10MB)
- Clear, actionable error messages
- Better user experience

✅ **Monitoring**
- Request/response timing
- Success/failure tracking
- Worker availability status
- Real-time UI indicators

✅ **Architecture**
- Server-side proxy pattern
- Singleton service client
- Cached health checks
- Separation of concerns
