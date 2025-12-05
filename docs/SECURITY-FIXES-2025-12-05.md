# Security Fixes Applied - December 5, 2025

## Overview

This document describes critical security fixes applied to the Hail Mary system to address vulnerabilities identified in the stability investigation.

**Date Applied:** 2025-12-05
**Applied By:** Claude (Security Hotfix Session)
**Branch:** `claude/visual-surveyor-architecture-019ftsYgAdxmojRQTgbK5F32`

---

## Critical Fixes Applied

### 1. JWT Secret Validation (🔴 CRITICAL)

**Vulnerability:** Application allowed default/insecure JWT_SECRET value
- Default value: `development-secret-change-in-production`
- Risk: Attackers could forge valid authentication tokens
- Impact: Complete authentication bypass, admin access possible

**Fix Applied:**
- Added validation on module load in `packages/api/src/services/auth.service.ts`
- Application now **refuses to start** if JWT_SECRET is not set or uses default value
- Clear error message with instructions on how to generate secure secret

**Code Changes:**
```typescript
// Line 49-75 in auth.service.ts
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET === 'development-secret-change-in-production') {
  console.error('🔴 FATAL SECURITY ERROR: JWT_SECRET is not configured correctly!');
  // ... detailed error message ...
  throw new Error('FATAL: JWT_SECRET must be set and not use default value.');
}
```

**Files Modified:**
- `packages/api/src/services/auth.service.ts` - Added validation logic
- `.env.example` - Updated with security warnings and instructions
- `docker-compose.unraid.yml` - Removed default fallback, added comments
- `docker-compose.prod.yml` - Removed default fallback, added comments

**Impact:** ✅ **BLOCKING** - Application will not start without secure JWT_SECRET

---

### 2. NAS Auth IP Restrictions (🔴 HIGH)

**Vulnerability:** NAS quick login allowed from any IP address
- No password required for NAS auth mode
- Could be accessed from internet if port exposed
- User enumeration via `/api/auth/nas/users` endpoint

**Fix Applied:**
- Added IP range validation for NAS auth endpoints
- Default: Only RFC1918 private networks + localhost allowed
  - `127.0.0.0/8` (localhost)
  - `10.0.0.0/8` (Private A)
  - `172.16.0.0/12` (Private B)
  - `192.168.0.0/16` (Private C)
- Configurable via `NAS_ALLOWED_IPS` environment variable

**Code Changes:**

```typescript
// New IP validation functions (lines 540-590 in auth.service.ts)
function isIPAllowedForNasAuth(clientIp: string): boolean {
  const allowedRanges: IPRange[] = [
    { network: '127.0.0.0', cidr: 8 },
    { network: '10.0.0.0', cidr: 8 },
    { network: '172.16.0.0', cidr: 12 },
    { network: '192.168.0.0', cidr: 16 },
  ];
  // ... IP validation logic ...
}

// Updated function signatures
export async function listUsersForNasLogin(clientIp: string) // Line 599
export async function nasQuickLogin(userId: number, clientIp: string) // Line 662
```

```typescript
// Routes updated to pass client IP (packages/api/src/routes/auth.ts)
const clientIp = getClientIp(req);
const users = await listUsersForNasLogin(clientIp); // Line 386
const { user, token } = await nasQuickLogin(userId, clientIp); // Line 435
```

**Files Modified:**
- `packages/api/src/services/auth.service.ts` - Added IP validation logic
- `packages/api/src/routes/auth.ts` - Extract and pass client IP to auth functions
- `.env.example` - Documented `NAS_ALLOWED_IPS` configuration
- `docker-compose.unraid.yml` - Added NAS_ALLOWED_IPS environment variable
- `docker-compose.prod.yml` - Added NAS_ALLOWED_IPS environment variable

**Impact:** ✅ **BLOCKING** - NAS auth requests from non-local IPs are now rejected with 403 Forbidden

**Security Logging:**
```
[NAS Auth] SECURITY: Login attempt blocked from non-local IP: 203.0.113.42 for userId: 1
[NAS Auth] Quick login attempt for userId: 1 from allowed IP: 192.168.1.100
```

---

## Configuration Requirements

### Required for Production

**1. Generate Secure JWT Secret**

```bash
# Generate a 64-character hex string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**2. Add to .env File**

```bash
# Example (use your own generated value!)
JWT_SECRET=a1b2c3d4e5f6789...your-generated-secret-here
```

**3. For NAS Deployments (Optional)**

```bash
# Enable NAS auth mode
NAS_AUTH_MODE=true

# Optional: Restrict to specific subnet
NAS_ALLOWED_IPS=192.168.1.0/24

# Optional: Allow only single IP
NAS_ALLOWED_IPS=192.168.1.100/32
```

---

## Testing

### Test JWT Validation

**Expected Behavior:**

```bash
# Without JWT_SECRET set
docker-compose -f docker-compose.prod.yml up hailmary-api

# Should output:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 FATAL SECURITY ERROR: JWT_SECRET is not configured correctly!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...
Error: FATAL: JWT_SECRET must be set and not use default value.

# Container exits immediately
```

```bash
# With JWT_SECRET set
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
docker-compose -f docker-compose.prod.yml up hailmary-api

# Should start normally:
🚀 Hail-Mary API running on http://0.0.0.0:3001
```

### Test NAS IP Restrictions

**Test 1: From Local Network (Should Succeed)**

```bash
curl -X GET http://192.168.1.10:3001/api/auth/nas/users \
  -H "X-Forwarded-For: 192.168.1.100"

# Expected: 200 OK with user list
```

**Test 2: From External IP (Should Fail)**

```bash
curl -X GET http://your-domain.com/api/auth/nas/users \
  -H "X-Forwarded-For: 203.0.113.42"

# Expected: 403 Forbidden
{
  "success": false,
  "code": "forbidden",
  "error": "NAS authentication is only available from local network"
}
```

**Test 3: Login from Local Network (Should Succeed)**

```bash
curl -X POST http://192.168.1.10:3001/api/auth/nas/login \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.100" \
  -d '{"userId": 1}'

# Expected: 200 OK with JWT token
```

---

## Rollback Procedure

If these fixes cause issues, you can temporarily roll back:

**1. Revert JWT Validation (NOT RECOMMENDED)**

```typescript
// In packages/api/src/services/auth.service.ts line 49
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

// Comment out lines 53-75 (validation block)
```

**2. Disable NAS IP Restrictions (NOT RECOMMENDED)**

```typescript
// In packages/api/src/services/auth.service.ts
// Comment out IP check in listUsersForNasLogin (line 606-613)
// Comment out IP check in nasQuickLogin (line 669-676)
```

**⚠️ WARNING:** Rollback should only be temporary for debugging. These vulnerabilities are **critical** and must be fixed.

---

## Deployment Checklist

Before deploying:

- [ ] Generate secure JWT_SECRET using provided command
- [ ] Add JWT_SECRET to .env file
- [ ] Remove any `.env.example` or test secrets from production
- [ ] If using NAS auth:
  - [ ] Set `NAS_AUTH_MODE=true` only if needed
  - [ ] Configure `NAS_ALLOWED_IPS` if custom restrictions needed
  - [ ] Verify firewall rules block external access to NAS ports
- [ ] Test application startup (should succeed)
- [ ] Test authentication (login should work normally)
- [ ] If NAS auth enabled, test from local network (should work)
- [ ] If NAS auth enabled, test from external IP (should fail)
- [ ] Review logs for any security warnings

---

## Related Documentation

- **Investigation Report:** `docs/INVESTIGATION-STABILITY-ISSUES.md`
- **Security Section:** Lines 2.1-2.3 (pages 11-15)
- **Executive Summary:** `docs/EXECUTIVE-SUMMARY-DEC-2025.md`
- **Decision Required:** Section "Security Issues" (page 18)

---

## Additional Security Recommendations

These fixes address the **critical** vulnerabilities, but additional hardening is recommended:

### Short-term (Next Sprint)
1. ✅ Implement rate limiting on auth endpoints (already exists globally)
2. ⚠️ Add failed login attempt tracking and temporary IP blocking
3. ⚠️ Implement 2FA/TOTP for admin accounts
4. ⚠️ Add security headers (CSP, HSTS, X-Frame-Options)

### Medium-term
5. ⚠️ Replace NAS auth with PIN/passphrase system
6. ⚠️ Implement proper SSL certificate handling (remove `strict-ssl false`)
7. ⚠️ Add audit logging for all auth events
8. ⚠️ Implement session management (revoke tokens, active session list)

### Long-term
9. ⚠️ Add OAuth/SSO for enterprise deployments
10. ⚠️ Implement hardware key support (YubiKey)
11. ⚠️ Add anomaly detection (unusual login patterns)
12. ⚠️ Implement secrets rotation schedule

---

## Questions?

For technical details on these fixes:
- See git commit history on branch `claude/visual-surveyor-architecture-019ftsYgAdxmojRQTgbK5F32`
- Review code changes in `packages/api/src/services/auth.service.ts`
- Check updated environment configuration in `.env.example`

For security concerns or issues:
- Create GitHub issue with `security` label
- Include steps to reproduce
- Do NOT include actual secrets or tokens in issues

---

**End of Security Fixes Document**

*These fixes were applied in response to critical vulnerabilities discovered during the December 5, 2025 stability investigation. All production deployments should update immediately.*
