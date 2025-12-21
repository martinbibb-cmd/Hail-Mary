# Tablet Navigation Stability Implementation

## Problem Statement
The previous implementation used `useDeviceLayout()` hook which could cause flickering on tablets, particularly with the hamburger menu. This occurred when the window size hovered near the mobile/tablet threshold (900px), causing rapid switching between mobile and tablet layouts.

## Solution Implemented

### 1. Created `useLayoutMode()` Hook
Replaced `useDeviceLayout` with a new `useLayoutMode` hook that includes two key stability mechanisms:

#### Debouncing (150ms)
- Resize events are debounced to prevent rapid recalculations
- When a user resizes the window or rotates the device, the layout doesn't change until after 150ms of stability
- This smooths out the transition and prevents flickering during active resizing

#### Hysteresis (50px dead zone)
- Different thresholds for transitioning between mobile and tablet:
  - Mobile → Tablet: triggers at 900px (upper threshold)
  - Tablet → Mobile: triggers at 850px (lower threshold)
- This creates a 50px "dead zone" where the layout stays stable
- Example: If you're in tablet mode at 895px width, you stay in tablet mode. You only switch to mobile when you drop below 850px. Conversely, if you're in mobile mode at 870px, you stay in mobile mode until you reach 900px.

### 2. Updated All Consumers
- `App.tsx`: Updated to use `useLayoutMode()`
- `StackWorkspace.tsx`: Updated type from `DeviceLayout` to `LayoutMode`
- `HomePage.tsx`: Updated type from `DeviceLayout` to `LayoutMode`
- Removed old `useDeviceLayout.ts` file

## Technical Details

### Layout Detection Logic
1. **Desktop**: Detected by pointer type (`pointer: fine` = mouse/trackpad)
   - This is stable and doesn't change during resize
2. **Tablet**: Touch device (`pointer: coarse`) with width ≥ 900px
   - Uses tabs navigation at the top
3. **Mobile**: Touch device (`pointer: coarse`) with width < 900px
   - Uses bottom navigation bar

### Stability Mechanisms in Action

```typescript
// Without hysteresis (old behavior):
// At 899px → Mobile
// At 900px → Tablet (flicker!)
// At 899px → Mobile (flicker!)

// With hysteresis (new behavior):
// At 899px in tablet mode → Tablet (stays stable)
// At 870px in tablet mode → Tablet (stays stable)
// At 849px in tablet mode → Mobile (transitions once)
// At 870px in mobile mode → Mobile (stays stable)
// At 900px in mobile mode → Tablet (transitions once)
```

## Files Changed

1. **Created**: `packages/pwa/src/hooks/useLayoutMode.ts`
   - New hook with stability features
   - Comprehensive documentation
   
2. **Modified**: `packages/pwa/src/App.tsx`
   - Import `useLayoutMode` instead of `useDeviceLayout`
   - Call `useLayoutMode()` instead of `useDeviceLayout()`

3. **Modified**: `packages/pwa/src/os/workspace/StackWorkspace.tsx`
   - Import `LayoutMode` type instead of `DeviceLayout`
   - Update interface to use `LayoutMode`

4. **Modified**: `packages/pwa/src/pages/HomePage.tsx`
   - Import `LayoutMode` type instead of `DeviceLayout`
   - Update interface to use `LayoutMode`

5. **Deleted**: `packages/pwa/src/hooks/useDeviceLayout.ts`
   - Old hook no longer needed

## Benefits

1. **No More Flickering**: Tablet navigation is now stable near the threshold
2. **Smooth Transitions**: Debouncing prevents jarring layout changes
3. **Better UX**: Users won't see the hamburger menu appear/disappear unexpectedly
4. **Well Documented**: Clear explanation of how the stability mechanisms work
5. **Type Safety**: Consistent `LayoutMode` type used throughout the app

## Testing Recommendations

1. **Tablet Testing**:
   - Test on actual iPad or Android tablet
   - Slowly resize browser window between 840px and 910px
   - Rotate device between portrait and landscape
   - Verify no flickering occurs

2. **Desktop Testing**:
   - Verify desktop layout works with mouse/trackpad
   - Check that layout stays desktop regardless of window size

3. **Mobile Testing**:
   - Test on actual phone
   - Verify bottom navigation appears correctly
   - Check that hamburger menu behavior is stable
