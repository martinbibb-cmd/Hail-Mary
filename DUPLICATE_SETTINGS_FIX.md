# Duplicate Settings Menu Issue & Fix

## Problem

There are duplicate/confusing menu entries for Settings/Profile across different parts of the app:

1. **Bottom Dock** (`BottomDock.tsx`): Has "Settings" icon that routes to `/profile`
2. **OS Dock** (`Dock.tsx`): Has both "Profile" and "Settings" apps
3. **More Drawer** (`MoreDrawer.tsx`): Has both "Profile" and "Settings" entries

This creates confusion for users - they don't know which one to use, and the naming is inconsistent.

## Current State

### BottomDock.tsx (Mobile/Tablet Bottom Nav)
```typescript
{ id: 'profile', label: 'Settings', icon: '⚙️', path: '/profile' }
```

### Dock.tsx (Desktop OS Dock)
```typescript
{ id: 'profile', name: 'Profile', icon: '👤' },     // Line 15
{ id: 'settings', name: 'Settings', icon: '⚙️' },  // Line 30
```

### MoreDrawer.tsx (Side Drawer Menu)
```typescript
{ id: 'profile', label: 'Profile', icon: '👤', ... },      // Line 117
{ id: 'settings', label: 'Settings', icon: '⚙️', ... },   // Line 124
```

## Recommended Fix

**Consolidate to a single "Settings" concept** since the SettingsApp.tsx already handles all user profile info, preferences, and app configuration.

### Changes Needed:

#### 1. Remove "Profile" from MoreDrawer.tsx
Delete the profile entry (lines 117-122):
```typescript
// DELETE THIS:
{
  id: 'profile',
  label: 'Profile',
  icon: '👤',
  description: 'Account & preferences',
  action: { kind: 'route', target: '/profile' },
},
```

Keep only the Settings entry (lines 124-129).

#### 2. Remove "Profile" from Dock.tsx
Delete the profile entry (line 15):
```typescript
// DELETE THIS:
{ id: 'profile', name: 'Profile', icon: '👤' },
```

Keep only the Settings entry (line 30).

#### 3. Update BottomDock.tsx
The bottom dock is correct - it uses "Settings" label with `/profile` route, which is fine since the SettingsApp renders at that route.

## Alternative Fix (If Profile Should Be Separate)

If you want Profile and Settings to be truly separate:

1. **Profile** = User account info, logout only
2. **Settings** = App preferences, wallpaper, dock customization, etc.

In this case:
- Split SettingsApp.tsx into two components
- Profile gets the account section only
- Settings gets appearance, dock, cognitive profiles, etc.
- Update routes to have `/profile` and `/settings` as separate pages

## Recommended: Option 1 (Single Settings)

Having one unified Settings page is cleaner and follows modern app patterns (iOS, Android both use single Settings apps that include user profile at the top).
