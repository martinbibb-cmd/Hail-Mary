# Build Badge Visual Guide

## Overview

The BuildBadge component appears in the bottom-right corner of every page in the Hail-Mary PWA. It provides instant visibility into what code version is running.

## Visual Layout

### Collapsed State (Default)

```
┌─────────────────────────────────┐
│                                 │
│         Your App Content        │
│                                 │
│                                 │
│                        ┌────────┴──────┐
│                        │ Build: abc123  │
│                        │ • 2h ago       │
└────────────────────────┴───────────────┘
                         └─ Bottom-right corner
```

**Properties:**
- Background: `rgba(0, 0, 0, 0.75)` with `blur(8px)`
- Padding: `6px 10px`
- Font: `ui-monospace, Menlo, Monaco` at `11px`
- Z-index: `9999`
- Border radius: `8px`
- Shadow: `0 2px 8px rgba(0, 0, 0, 0.3)`

**Content:**
```
Build: abc123d • 2h ago
```

### Expanded State (After Click)

```
┌─────────────────────────────────┐
│                                 │
│         Your App Content        │
│                                 │
│                  ┌──────────────┴─────────────┐
│                  │ BUILD INFO                 │
│                  │ SHA: abc123d               │
│                  │ Built: 1/3/2026, 7:53 AM   │
│                  │ Env: production            │
│                  │ Version: 0.2.0             │
└──────────────────┴────────────────────────────┘
                   └─ Expands to show details
```

**Properties:**
- Same styling as collapsed
- Padding: `10px 12px` (slightly larger)
- Font: `12px` (slightly larger)
- Min-width: `200px`

**Content:**
```
BUILD INFO
SHA: abc123d
Built: 1/3/2026, 7:53:51 AM
Env: production
Version: 0.2.0
```

## Color Indicators

### Environment Badge
The environment name is color-coded:

- **Production**: `#10b981` (green)
- **Development**: `#f59e0b` (orange)

Example:
```
Env: production  (green text)
Env: development (orange text)
```

## Time Formatting Examples

The badge shows relative time in a human-readable format:

| Actual Time Difference | Displayed As |
|------------------------|--------------|
| < 1 minute             | `just now`   |
| 5 minutes              | `5m ago`     |
| 45 minutes             | `45m ago`    |
| 2 hours                | `2h ago`     |
| 1 day                  | `1d ago`     |
| 5 days                 | `5d ago`     |
| 2 weeks                | `1/3/2026`   |

## Interaction

### Click Behavior
1. **Collapsed → Expanded**: Click shows full details
2. **Expanded → Collapsed**: Click hides details
3. **Cursor**: Changes to pointer on hover
4. **Title**: Hover shows tooltip "Click to expand build details"

### Accessibility
- User select disabled (prevents accidental text selection)
- Pointer events enabled
- Click target size follows mobile best practices
- Readable contrast ratios for all text

## Positioning

### Desktop
```
┌───────────────────────────────────┐
│ Header/Nav                        │
├───────────────────────────────────┤
│                                   │
│                                   │
│      Main Content Area            │
│                                   │
│                                   │
│                          ┌────────┤
│                          │ Badge  │
└──────────────────────────┴────────┘
                           └─ 16px from bottom
                           └─ 16px from right
```

### Mobile/Tablet
```
┌─────────────────────┐
│ Header              │
├─────────────────────┤
│                     │
│   Content           │
│                     │
│            ┌────────┤
│            │ Badge  │
└────────────┴────────┘
             └─ Same positioning
```

The badge maintains its position even when:
- Bottom dock/navigation is visible
- Keyboard is open (mobile)
- Content is scrolling

## Z-Index Stack

The badge is positioned in the UI z-index hierarchy:

```
10000+ : Modals, alerts, critical overlays
9999   : Build Badge ← Here
9000   : Toasts, notifications
1000   : Dropdowns, tooltips
100    : Fixed headers/footers
1      : Regular content
```

This ensures the badge is:
- ✅ Always visible above regular content
- ✅ Always visible above dropdowns
- ✅ Below critical modals (doesn't interfere)

## Real-World Examples

### Development Build
```
┌──────────────────────┐
│ Build: f2a9c3b       │
│ • just now           │
└──────────────────────┘
```

### Production Build (Recent)
```
┌──────────────────────┐
│ Build: a7b8c9d       │
│ • 3h ago             │
└──────────────────────┘
```

### Production Build (Old)
```
┌──────────────────────┐
│ Build: 1234567       │
│ • 12/25/2025         │
└──────────────────────┘
```

### Expanded View
```
┌─────────────────────────────┐
│ BUILD INFO                  │
│ SHA: a7b8c9d                │
│ Built: 1/3/2026, 4:32 PM    │
│ Env: production             │
│ Version: 0.2.0              │
└─────────────────────────────┘
```

## Bug Report Context

When a bug report is submitted, the build badge information is automatically included:

```javascript
{
  "buildMetadata": {
    "gitSha": "a7b8c9d",
    "buildTime": "2026-01-03T16:32:00.000Z",
    "version": "0.2.0",
    "env": "production"
  }
}
```

This appears in the bug report submission alongside:
- URL
- User agent
- Screen resolution
- Viewport
- Timestamp

## Backend Endpoint Response

The companion backend endpoint provides similar information:

```bash
$ curl https://api.example.com/api/meta/build

{
  "success": true,
  "data": {
    "gitSha": "a7b8c9d",
    "buildTime": "2026-01-03T16:32:00.000Z",
    "env": "production",
    "version": "0.2.0",
    "hostname": "hailmary-api-5f9d8c",
    "containerId": "abc123def456",
    "nodeVersion": "v20.19.6"
  }
}
```

## Responsive Behavior

### Large Screens (> 1200px)
- Badge: 16px from edges
- Font: 11px collapsed, 12px expanded
- Fully visible, no overlap concerns

### Tablets (768px - 1200px)
- Badge: 16px from edges
- Font: 11px collapsed, 12px expanded
- May overlap with bottom dock on some layouts

### Mobile (< 768px)
- Badge: 16px from edges
- Font: 11px collapsed, 12px expanded
- Positioned above bottom navigation if present

## Integration Points

The BuildBadge is imported in `App.tsx` and rendered globally:

```typescript
import { BuildBadge } from './components/BuildBadge'

function App() {
  return (
    <>
      {/* Main app content */}
      <Routes>...</Routes>
      
      {/* Build fingerprint badge (globally visible) */}
      <BuildBadge />
    </>
  )
}
```

This ensures it appears on every page without duplication.

## Testing the Badge

### Visual Verification Checklist

1. ✅ Badge visible on all pages
2. ✅ Badge stays in bottom-right corner when scrolling
3. ✅ Click toggles between collapsed/expanded
4. ✅ SHA matches current git commit
5. ✅ Time updates appropriately
6. ✅ Environment shows correct value
7. ✅ Badge doesn't block important UI
8. ✅ Badge readable on all backgrounds
9. ✅ Badge doesn't interfere with forms/inputs
10. ✅ Badge works on touch devices

### Cross-Device Verification

Test on:
- ✅ Mac (Chrome, Safari, Firefox)
- ✅ iPad (Safari, Chrome)
- ✅ iPhone (Safari, Chrome)
- ✅ Android tablet (Chrome)
- ✅ Android phone (Chrome)

All devices should show **identical SHA** after deployment.

## Troubleshooting

### Badge Not Visible
- Check browser console for errors
- Verify BuildBadge component is imported
- Check if z-index is being overridden
- Verify build constants are defined

### Wrong SHA Displayed
- Check if PWA was rebuilt with new code
- Verify Docker build received GIT_SHA arg
- Check if service worker cached old version
- Try hard refresh (Cmd+Shift+R)

### Time Shows "just now" for Old Build
- System clock may be incorrect
- Build time may not have been set correctly
- Check BUILD_TIME environment variable

### Badge Overlaps UI Elements
- Adjust positioning in BuildBadge.tsx
- Consider z-index hierarchy
- May need to move badge on specific pages

## Future Enhancements

Potential improvements:
1. Draggable badge (user can reposition)
2. Minimize/hide option (persistent preference)
3. Copy SHA to clipboard on click
4. Show update available indicator
5. Link to commit in GitHub
6. Show deployment time vs build time
7. Display backend SHA alongside frontend SHA
