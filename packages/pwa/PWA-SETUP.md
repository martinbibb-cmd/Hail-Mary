# PWA (Progressive Web App) Setup

The Hail-Mary application is now installable as a Progressive Web App, allowing users to install it on their devices for a native app-like experience.

## Features

✅ **Installable** - Users can install the app on their home screen
✅ **Offline Support** - Service worker caches assets for offline use
✅ **Auto-updates** - Automatically updates when new versions are deployed
✅ **App Icons** - Multiple icon sizes for different devices (72px to 512px)
✅ **Standalone Mode** - Opens in full-screen without browser UI
✅ **iOS Support** - Includes Apple touch icons and meta tags

## Technical Details

### Configuration

The PWA is configured using `vite-plugin-pwa` in `vite.config.ts` with:

- **Manifest**: App metadata (name, description, theme colors, icons)
- **Service Worker**: Workbox-powered caching with:
  - Static asset precaching
  - Google Fonts caching
  - API request caching (NetworkFirst strategy)
  - Automatic cleanup of outdated caches

### Files

- **`public/manifest.webmanifest`** - Web app manifest
- **`public/icon-*.png`** - PWA icons (72x72 to 512x512)
- **`public/apple-touch-icon.png`** - iOS home screen icon
- **`dist/sw.js`** - Generated service worker (build time)

### Installation

The app will automatically prompt users to install when:
1. The site is served over HTTPS
2. The manifest meets requirements
3. The service worker is registered successfully
4. User engagement criteria are met (browser-specific)

### Testing PWA Installation

#### Desktop (Chrome/Edge)
1. Build the app: `npm run build`
2. Serve the build: `npm run preview`
3. Open in browser
4. Look for the install icon in the address bar
5. Click to install

#### Mobile (iOS Safari)
1. Open the app in Safari
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Confirm to add

#### Mobile (Android Chrome)
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen" or "Install App"
4. Confirm to add

### Development

Service worker is **disabled in development mode** to avoid caching issues. It only runs in production builds.

To test PWA features during development:
```bash
npm run build
npm run preview
```

### Offline Behavior

The service worker caches:
- All static assets (JS, CSS, HTML, images)
- Google Fonts
- API responses (for 5 minutes)

When offline:
- Static pages and assets load from cache
- API requests fall back to cached responses
- User sees last loaded data

### Updating

The app uses `autoUpdate` strategy, which:
1. Checks for updates automatically
2. Downloads new service worker in background
3. Activates new version when ready
4. Refreshes the page to show updates

### Debugging

To debug PWA features:
1. Build and serve: `npm run build && npm run preview`
2. Open DevTools → Application tab
3. Check:
   - Manifest section (verify all properties)
   - Service Workers section (verify registration)
   - Cache Storage (verify cached assets)

### Resources

- [Vite PWA Plugin Documentation](https://vite-pwa-org.netlify.app/)
- [Web App Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
