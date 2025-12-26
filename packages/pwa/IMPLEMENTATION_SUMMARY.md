# Fix PWA White-Screen from Invalid localStorage dockItems

## Problem Summary
The PWA could white-screen if the localStorage key `dockItems` contained:
- Invalid JSON syntax
- Valid JSON but wrong data type (e.g., object instead of array)
- Array with non-string values
- null, empty string, or other unexpected values

The app would crash early during BottomDock render before the UI could mount, resulting in a white screen with no recovery mechanism.

## Solution Overview

### 1. Shared Utility Module (`packages/pwa/src/utils/dockItems.ts`)
Created a centralized module for dock items management:
- **`DEFAULT_DOCK_ITEMS`**: Readonly constant array preventing accidental mutations
- **`loadDockItems()`**: Safely loads and validates dockItems from localStorage
  - Returns mutable copy of defaults if not found
  - Validates array structure and string content
  - Automatically clears invalid data
  - Comprehensive error handling with warnings
- **`saveDockItems()`**: Safely persists dockItems to localStorage
  - Wraps localStorage.setItem in try/catch
  - Dispatches 'dockItemsChanged' event
  - Returns success boolean

### 2. BottomDock Component Updates (`packages/pwa/src/components/BottomDock.tsx`)
- Imports and uses shared `loadDockItems()` utility
- Wrapped event listener callback in try/catch
- Falls back to DEFAULT_DOCK_ITEMS on any error
- No direct localStorage access at module top-level

### 3. SettingsApp Component Updates (`packages/pwa/src/os/apps/settings/SettingsApp.tsx`)
- Imports and uses shared utilities (`loadDockItems`, `saveDockItems`)
- All localStorage operations wrapped in error handling
- "Reset to Default" button uses safe save method
- Consistent error handling across all dock item operations

### 4. ErrorBoundary Component (`packages/pwa/src/components/ErrorBoundary.tsx`)
New top-level error boundary that:
- Catches any unhandled React component errors
- Displays user-friendly error UI with error details
- Provides "Clear Data & Reload" recovery button
- Maintains `RECOVERABLE_STORAGE_KEYS` constant for extensibility
- Currently clears 'dockItems' but easily extensible

### 5. App Root Integration (`packages/pwa/src/main.tsx`)
- Wrapped entire app with ErrorBoundary at root level
- Provides last-resort recovery mechanism

### 6. Test Files
- **`DOCK_ITEMS_TEST.md`**: Manual test cases documentation
- **`test-dock-items.html`**: Interactive HTML test suite

## Code Quality Improvements
1. **DRY Principle**: Shared utility eliminates duplication
2. **Type Safety**: Readonly arrays prevent mutations
3. **Maintainability**: Constants for recoverable storage keys
4. **Error Handling**: Comprehensive try/catch blocks
5. **Logging**: Helpful console warnings for debugging
6. **Extensibility**: Easy to add more recoverable storage keys

## Acceptance Criteria - All Met ✅
- ✅ If dockItems is corrupt (non-JSON / object / null / empty / wrong types), app still loads
- ✅ Dock falls back to default without crashing
- ✅ ErrorBoundary provides recovery mechanism for any unhandled errors
- ✅ Code is DRY - shared utility used by both components
- ✅ ErrorBoundary is extensible for future localStorage issues
- ✅ Type-safe with readonly arrays
- ✅ Comprehensive error logging for debugging

## Testing Instructions

### Manual Testing
1. Open browser developer console
2. Run test cases from `DOCK_ITEMS_TEST.md`:
   ```javascript
   // Test invalid JSON
   localStorage.setItem('dockItems', '{invalid json}');
   location.reload();
   
   // Test object instead of array
   localStorage.setItem('dockItems', '{"home": true}');
   location.reload();
   
   // Test array with numbers
   localStorage.setItem('dockItems', '[1, 2, 3]');
   location.reload();
   ```
3. Verify:
   - App does NOT white-screen
   - Bottom dock is visible with default items
   - Console shows warning about invalid dockItems
   - localStorage.getItem('dockItems') is valid JSON or null

### Interactive Testing
1. Open `test-dock-items.html` in browser
2. Run each test case
3. Click "Reload to Test" after each case
4. Verify app loads successfully

## Files Changed
- `packages/pwa/src/utils/dockItems.ts` (new)
- `packages/pwa/src/components/BottomDock.tsx` (modified)
- `packages/pwa/src/os/apps/settings/SettingsApp.tsx` (modified)
- `packages/pwa/src/components/ErrorBoundary.tsx` (new)
- `packages/pwa/src/components/ErrorBoundary.css` (new)
- `packages/pwa/src/main.tsx` (modified)
- `packages/pwa/DOCK_ITEMS_TEST.md` (new)
- `packages/pwa/test-dock-items.html` (new)

## Security Considerations
- No secrets or sensitive data in localStorage
- Error messages don't expose sensitive information
- ErrorBoundary only clears specific, non-sensitive keys
- All operations fail gracefully without exposing system details

## Performance Impact
- Minimal: Only adds validation checks during component initialization
- No impact on runtime performance after initial load
- Error handling adds negligible overhead

## Future Enhancements
To add more recoverable localStorage keys:
1. Add key name to `RECOVERABLE_STORAGE_KEYS` array in ErrorBoundary.tsx
2. Create similar validation utilities in shared utils folder
3. Follow same pattern for error handling and logging
