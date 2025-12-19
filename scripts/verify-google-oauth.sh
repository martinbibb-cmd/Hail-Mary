#!/bin/bash
# Google OAuth Configuration Verification Script
# This script helps verify that Google OAuth is properly configured

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Google OAuth Configuration Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found"
    echo ""
    echo "📋 To fix this:"
    echo "   1. Copy .env.example to .env:"
    echo "      cp .env.example .env"
    echo ""
    echo "   2. Edit .env and set GOOGLE_CLIENT_SECRET"
    echo ""
    exit 1
fi

echo "✅ .env file found"
echo ""

# Load environment variables from .env
set -a
source .env
set +a

# Check GOOGLE_AUTH_ENABLED
echo "Checking GOOGLE_AUTH_ENABLED..."
if [ "$GOOGLE_AUTH_ENABLED" = "true" ]; then
    echo "✅ GOOGLE_AUTH_ENABLED=true"
else
    echo "⚠️  GOOGLE_AUTH_ENABLED is not set to 'true'"
    echo "   Current value: ${GOOGLE_AUTH_ENABLED:-<not set>}"
    echo ""
    echo "📋 To enable Google OAuth, set in .env:"
    echo "   GOOGLE_AUTH_ENABLED=true"
    echo ""
fi

# Check GOOGLE_CLIENT_ID
echo ""
echo "Checking GOOGLE_CLIENT_ID..."
if [ -n "$GOOGLE_CLIENT_ID" ]; then
    if [ "$GOOGLE_CLIENT_ID" = "1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc.apps.googleusercontent.com" ]; then
        echo "✅ GOOGLE_CLIENT_ID is correctly set"
    else
        echo "⚠️  GOOGLE_CLIENT_ID is set but doesn't match expected value"
        echo "   Expected: 1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc.apps.googleusercontent.com"
        echo "   Current:  $GOOGLE_CLIENT_ID"
    fi
else
    echo "❌ GOOGLE_CLIENT_ID is not set"
    echo ""
    echo "📋 Set in .env:"
    echo "   GOOGLE_CLIENT_ID=1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc.apps.googleusercontent.com"
    echo ""
fi

# Check GOOGLE_CLIENT_SECRET
echo ""
echo "Checking GOOGLE_CLIENT_SECRET..."
if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    if [ "$GOOGLE_CLIENT_SECRET" = "your-client-secret-here" ] || [ "$GOOGLE_CLIENT_SECRET" = "your-actual-client-secret-here" ]; then
        echo "❌ GOOGLE_CLIENT_SECRET is set to placeholder value"
        echo ""
        echo "📋 To fix this:"
        echo "   1. Go to: https://console.cloud.google.com/apis/credentials"
        echo "   2. Find OAuth 2.0 Client: 1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc"
        echo "   3. Copy the Client Secret"
        echo "   4. Set it in .env: GOOGLE_CLIENT_SECRET=<your-secret>"
        echo ""
    else
        echo "✅ GOOGLE_CLIENT_SECRET is set (length: ${#GOOGLE_CLIENT_SECRET} chars)"
    fi
else
    echo "❌ GOOGLE_CLIENT_SECRET is not set"
    echo ""
    echo "📋 To fix this:"
    echo "   1. Go to: https://console.cloud.google.com/apis/credentials"
    echo "   2. Find OAuth 2.0 Client: 1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc"
    echo "   3. Copy the Client Secret"
    echo "   4. Set it in .env: GOOGLE_CLIENT_SECRET=<your-secret>"
    echo ""
fi

# Check BASE_URL
echo ""
echo "Checking BASE_URL..."
if [ -n "$BASE_URL" ]; then
    echo "✅ BASE_URL is set: $BASE_URL"
    echo ""
    echo "📋 Ensure this redirect URI is configured in Google Cloud Console:"
    echo "   ${BASE_URL}/api/auth/google/callback"
else
    echo "⚠️  BASE_URL is not set (will default to https://hail_mary.cloudbibb.uk)"
    echo ""
    echo "📋 For production, set BASE_URL in .env to your domain:"
    echo "   BASE_URL=https://your-domain.com"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Count issues
issues=0

if [ "$GOOGLE_AUTH_ENABLED" != "true" ]; then
    issues=$((issues + 1))
fi

if [ -z "$GOOGLE_CLIENT_ID" ] || [ "$GOOGLE_CLIENT_ID" != "1010895939308-oa69f1h1brjjdfpkum66fqhcouvcqrqc.apps.googleusercontent.com" ]; then
    issues=$((issues + 1))
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ] || [ "$GOOGLE_CLIENT_SECRET" = "your-client-secret-here" ] || [ "$GOOGLE_CLIENT_SECRET" = "your-actual-client-secret-here" ]; then
    issues=$((issues + 1))
fi

if [ $issues -eq 0 ]; then
    echo "✅ All checks passed! Google OAuth should be working."
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Restart your application"
    echo "   2. Visit the login page"
    echo "   3. Click 'Sign in with Google'"
    echo ""
    echo "📚 Troubleshooting: See docs/GOOGLE-OAUTH-SETUP.md"
else
    echo "⚠️  Found $issues issue(s) that need attention"
    echo ""
    echo "📚 For detailed setup instructions:"
    echo "   - Quick Start: GOOGLE-OAUTH-QUICKSTART.md"
    echo "   - Complete Guide: docs/GOOGLE-OAUTH-SETUP.md"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
