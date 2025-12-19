# Google OAuth Quick Start 🚀

Enable Google authentication in 3 minutes!

## ✅ What's Already Done

- ✅ Google OAuth infrastructure is fully implemented
- ✅ Client ID is configured: `1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc`
- ✅ "Sign in with Google" button is ready on login page
- ✅ Backend routes and authentication flow are complete

## 🔑 What You Need to Do

### 1. Get Your Client Secret

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Find OAuth 2.0 Client: `1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc`
3. Click on it and copy the **Client Secret**

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and set:

```env
GOOGLE_AUTH_ENABLED=true
GOOGLE_CLIENT_ID=1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
```

### 3. Configure Redirect URIs

In Google Cloud Console, add your callback URL to "Authorized redirect URIs":

**Production:**
```
https://your-domain.com/api/auth/google/callback
```

**Local Development:**
```
http://localhost:3001/api/auth/google/callback
```

### 4. Restart and Test

**Docker:**
```bash
docker-compose down
docker-compose up -d
```

**Local Development:**
```bash
npm run api:dev
```

## ✨ That's It!

Visit your login page and click **"Sign in with Google"**!

## 📚 Need More Details?

See the complete guide: [docs/GOOGLE-OAUTH-SETUP.md](docs/GOOGLE-OAUTH-SETUP.md)

## ⚠️ Security Notes

- Never commit `GOOGLE_CLIENT_SECRET` to git
- The `.env` file is already in `.gitignore`
- Client Secret must match what's in Google Cloud Console

## 🐛 Troubleshooting

**"redirect_uri_mismatch" error?**
- Check that callback URL in Google Console matches exactly
- Format: `{BASE_URL}/api/auth/google/callback`

**Button doesn't show up?**
- Check server logs for: `🔐 Google OAuth is ENABLED`
- Verify all environment variables are set
- Restart the server after changing `.env`

**Authentication fails?**
- Verify Client Secret is correct
- Check that Google+ API is enabled in Google Cloud Console
- Review server logs for detailed error messages
