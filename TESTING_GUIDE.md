# Testing Guide for PR: Profile Routing, AI Gateway, and Knowledge Upload Fixes

This guide provides steps to manually validate the changes made in this PR.

## Prerequisites

1. Set up the environment variables:
   ```bash
   # In packages/api/.env
   ROCKY_WORKER_URL=https://hail-mary.martinbibb.workers.dev
   ```

2. Ensure PostgreSQL is running (via Docker or locally)

3. Build all packages:
   ```bash
   npm install
   npm run build
   ```

## Testing Instructions

### 1. Profile Tab Navigation (Mobile/Tablet)

**Purpose**: Verify that Profile and Files tabs navigate to proper routes instead of opening the global apps menu.

**Steps**:
1. Start the PWA in development mode:
   ```bash
   npm run pwa:dev
   ```

2. Open the app in a mobile browser or use browser dev tools to emulate a mobile device (e.g., iPhone SE)

3. Navigate to the bottom navigation bar

4. Click the "Profile" button
   - ✅ Expected: Should navigate to `/profile` route and display the Profile page
   - ❌ Incorrect: Opens a drawer or apps menu

5. Click the "Files" button
   - ✅ Expected: Should navigate to `/files` route and display the Files app
   - ❌ Incorrect: Opens a drawer or apps menu

6. Use the browser back button
   - ✅ Expected: Should navigate back through the route history
   - ❌ Incorrect: Back button doesn't work or breaks navigation

### 2. AI Gateway Integration

**Purpose**: Verify that Rocky and Sarah use the server-side AI gateway and display Worker status correctly.

**Steps**:
1. Start both API and PWA:
   ```bash
   # Terminal 1
   npm run api:dev
   
   # Terminal 2
   npm run pwa:dev
   ```

2. Check API logs for startup message:
   - ✅ Should see: "AI Gateway routes registered"

3. Test Worker Health Check:
   ```bash
   curl -X GET http://localhost:3001/api/ai/health -H "Cookie: session=<your-session-cookie>"
   ```
   - ✅ Expected response: `{"success": true, "status": "available", "worker": {...}, "responseTime": <ms>}`
   - ⚠️ If `ROCKY_WORKER_URL` is not set: `{"success": false, "error": "AI Worker URL not configured"}`

4. Navigate to Rocky tool (`/rocky`):
   - ✅ Should see status indicator: "✓ Worker Available" (green)
   - ⚠️ If Worker is down: "✗ Unavailable" (red)

5. Enter sample transcript in Rocky:
   ```
   Customer has a 3-bedroom house. Existing boiler is a Worcester 30i, about 12 years old.
   Main fuse is 100A. Some radiators are cold at the top.
   ```

6. Click "Run Rocky"
   - ✅ Expected: Results display with completeness scores and extracted facts
   - ✅ Check API logs: Should see "🪨 AI Gateway: Forwarding Rocky request to..." and "✅ AI Gateway: Rocky request completed in Xms"
   - ✅ Check Cloudflare Worker logs: Should show the request (if Worker URL is configured)
   - ❌ If fails: Check error message and status indicator

7. Navigate to Sarah tool (`/sarah`):
   - ✅ Should see status indicator matching Rocky status

8. Copy Rocky output JSON and paste into Sarah
   - Select audience: "Customer"
   - Select tone: "Professional"

9. Click "Generate Explanation"
   - ✅ Expected: Explanation displays with sections
   - ✅ Check API logs: Should see "🧠 AI Gateway: Forwarding Sarah request to..." and "✅ AI Gateway: Sarah request completed in Xms"

### 3. Knowledge Upload Improvements

**Purpose**: Verify that PDF uploads work with large files and display helpful error messages.

**Steps**:
1. Log in as an admin user

2. Navigate to Admin → Knowledge Management (`/admin/knowledge`)

3. Test small PDF upload (< 1MB):
   - Upload a small PDF document
   - ✅ Expected: Upload succeeds, document appears in list
   - ✅ Check progress message during upload

4. Test large PDF upload (20-40MB):
   - Upload a larger PDF document (e.g., equipment manual)
   - ✅ Expected: Upload succeeds (nginx now allows up to 50MB)
   - ❌ Previous behavior: Would fail with generic error

5. Test error handling:
   - Try uploading a non-PDF file
   - ✅ Expected: Clear error message: "Only PDF files are allowed"
   
   - Try uploading without selecting a file
   - ✅ Expected: Upload button disabled
   
   - Simulate server error by stopping the API
   - ✅ Expected: Error message includes HTTP status and details

### 4. Regression Testing

**Purpose**: Ensure existing functionality still works.

**Steps**:
1. Test existing routes:
   - Navigate to `/` (Dashboard) - ✅ Should work
   - Navigate to `/customers` - ✅ Should work
   - Navigate to `/leads` - ✅ Should work
   - Navigate to `/quotes` - ✅ Should work

2. Test desktop navigation:
   - Open app on desktop browser
   - ✅ Verify sidebar navigation still works
   - ✅ Verify dock apps open in windows

3. Test authentication:
   - Log out and log back in
   - ✅ Should redirect to login
   - ✅ Should redirect back to previous page after login

## Expected Outcomes

### Success Criteria

- ✅ Mobile bottom navigation navigates to routes, not opening menus
- ✅ Rocky and Sarah display Worker status indicator
- ✅ Rocky and Sarah successfully call AI endpoints via gateway
- ✅ API logs show all AI gateway requests with timing
- ✅ Cloudflare Worker logs show requests (when Worker URL is configured)
- ✅ Knowledge upload works with files up to 50MB
- ✅ Upload errors display HTTP status and detailed messages
- ✅ All existing routes and functionality still work

### Known Limitations

- Sarah is currently a standalone tool, not integrated into chat (future enhancement)
- CSRF protection warning in CodeQL (pre-existing, not related to this PR)

## Troubleshooting

### Issue: Worker status shows "Unavailable"
**Solution**: Check that `ROCKY_WORKER_URL` is set correctly in `packages/api/.env`

### Issue: Upload fails with 413 error
**Solution**: Ensure nginx.conf has been updated with `client_max_body_size 50m` and nginx has been restarted

### Issue: Bottom navigation doesn't appear
**Solution**: Verify you're using a mobile viewport (width < 768px) or tablet layout

### Issue: API logs don't show AI gateway requests
**Solution**: Check that routes are registered correctly in `packages/api/src/index.ts`

## Additional Notes

- The AI gateway ensures all requests go through the API server, not directly from the browser to the Worker
- This architecture eliminates CORS issues and ensures Cloudflare logs capture all traffic
- Health checks are cached for 60 seconds to reduce overhead
- Rocky and Sarah tools automatically update Worker status based on request results
