# Google OAuth Setup Guide

This guide walks you through enabling Google OAuth authentication in Hail-Mary.

## Overview

Hail-Mary supports Google OAuth 2.0 authentication, allowing users to sign in with their Google accounts. This provides a seamless login experience and eliminates the need for users to remember additional passwords.

## Prerequisites

- Access to [Google Cloud Console](https://console.cloud.google.com)
- Admin access to your Google Cloud project
- Your Hail-Mary deployment URL

## OAuth Client Configuration

Your OAuth 2.0 Client has already been created:

- **Client ID**: `1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc.apps.googleusercontent.com`
- **Client Secret**: Available in Google Cloud Console (see steps below)

## Step 1: Obtain Client Secret

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)

2. Find your OAuth 2.0 Client ID:
   - Look for: `1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc`
   - It should be listed under "OAuth 2.0 Client IDs"

3. Click on the Client ID name to open details

4. Copy the **Client Secret** value
   - ⚠️ **IMPORTANT**: Keep this secret secure! Never commit it to version control

## Step 2: Configure Authorized Redirect URIs

In the same OAuth client details page:

1. Scroll to **Authorized redirect URIs** section

2. Add your callback URL(s):
   ```
   Production: https://your-domain.com/api/auth/google/callback
   Local Dev:  http://localhost:3001/api/auth/google/callback
   ```

3. Click **Save** at the bottom of the page

**Common deployment URLs:**
- Production: `https://hail-mary.cloudbibb.uk/api/auth/google/callback`
- Unraid NAS: `http://your-nas-ip:3000/api/auth/google/callback`
- Local: `http://localhost:3001/api/auth/google/callback`

## Step 3: Configure Environment Variables

Create or update your `.env` file with:

```env
# Enable Google OAuth
GOOGLE_AUTH_ENABLED=true

# Google OAuth Client ID (already configured)
GOOGLE_CLIENT_ID=1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc.apps.googleusercontent.com

# Google OAuth Client Secret (from Step 1)
GOOGLE_CLIENT_SECRET=your-actual-client-secret-here

# Base URL for your deployment (used to construct callback URL)
BASE_URL=https://your-domain.com
```

### For Docker Deployments

Add to your `docker-compose.yml` or `docker-compose.prod.yml`:

```yaml
services:
  api:
    environment:
      - GOOGLE_AUTH_ENABLED=true
      - GOOGLE_CLIENT_ID=1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc.apps.googleusercontent.com
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - BASE_URL=https://your-domain.com
```

Then set `GOOGLE_CLIENT_SECRET` in your `.env` file (which Docker Compose will read).

## Step 4: Restart Application

### Docker
```bash
docker-compose down
docker-compose up -d
```

### Local Development
```bash
npm run api:dev
```

## Step 5: Verify Setup

1. Navigate to your application login page

2. You should see a "Sign in with Google" button

3. Click the button and verify:
   - Redirects to Google's authentication page
   - After successful authentication, redirects back to your application
   - You are logged in automatically

## Troubleshooting

### Error: "redirect_uri_mismatch"

**Cause**: The callback URL doesn't match what's configured in Google Cloud Console

**Solution**:
1. Check your `BASE_URL` environment variable
2. Ensure the redirect URI in Google Cloud Console matches exactly: `{BASE_URL}/api/auth/google/callback`
3. Remember: `http` vs `https` and trailing slashes matter!

### Error: "Google OAuth is not enabled"

**Cause**: Environment variables not set correctly

**Solution**:
1. Verify `GOOGLE_AUTH_ENABLED=true` is set
2. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set
3. Restart your application after setting environment variables

### Button doesn't appear

**Cause**: Google OAuth is disabled on the backend

**Solution**:
1. Check server logs for: `🔐 Google OAuth is ENABLED`
2. If you see `📋 Google OAuth is DISABLED`, verify environment variables
3. Ensure you restart the server after changing environment variables

### Error: "Failed to authenticate with Google"

**Cause**: Invalid Client Secret or API not enabled

**Solution**:
1. Verify your Client Secret is correct (copy/paste from Google Cloud Console)
2. Ensure Google+ API or People API is enabled in Google Cloud Console
3. Check server logs for detailed error messages

## Security Best Practices

1. **Never commit Client Secret to git**
   - Add `.env` to `.gitignore` (already done)
   - Use environment variables or secrets management

2. **Restrict Authorized Redirect URIs**
   - Only add URIs you actually use
   - Be specific (don't use wildcards if possible)

3. **Monitor OAuth Usage**
   - Check Google Cloud Console for usage statistics
   - Review OAuth consent screen settings

4. **Rotate Secrets Regularly**
   - Generate new Client Secret periodically
   - Update in all deployments

## User Experience

### First Time Google Login

When a user signs in with Google for the first time:
1. A new user account is automatically created
2. Email and name are imported from Google profile
3. User is logged in immediately
4. No password is required or stored

### Existing Users

If a user account exists with the same email:
1. The account is automatically linked to Google OAuth
2. User can log in with either Google or their existing password
3. `authProvider` is updated to `'google'` in the database

### Account Linking

- Users who registered with email/password can link their Google account by:
  1. Signing in with Google using the same email address
  2. The system automatically links the accounts
  3. Both login methods remain available

## API Endpoints

When Google OAuth is enabled, these endpoints become available:

- `GET /api/auth/google` - Initiates Google OAuth flow
- `GET /api/auth/google/callback` - Handles Google's redirect after authentication

## Database Schema

Users authenticated via Google have:
- `authProvider: 'google'`
- `externalId: <Google ID>`
- `passwordHash: null` (no password needed)
- Email and name imported from Google profile

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Review this guide's troubleshooting section
3. Verify environment variables are set correctly
4. Ensure Google Cloud Console configuration matches your deployment

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) - For testing
