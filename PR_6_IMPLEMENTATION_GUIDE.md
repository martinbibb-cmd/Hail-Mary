# PR 6 — Banner Session Strip Implementation

## Overview
This PR implements a persistent banner that displays Visit and Recording status with quick actions, as requested in the problem statement.

## Implementation Summary

### New Files Created
1. **`packages/pwa/src/components/VisitSessionBanner.tsx`**
   - React component that displays visit session status
   - Shows customer name, session ID, and recording state
   - Provides "End Visit" quick action button
   - Includes error handling with user feedback

2. **`packages/pwa/src/components/VisitSessionBanner.css`**
   - Styling for the visit session banner
   - Red/pink gradient theme (distinct from LeadContextBanner)
   - Responsive design for mobile/tablet/desktop
   - Animated recording indicator with pulsing dot

3. **`packages/pwa/src/stores/visitStore.ts`**
   - Zustand store for global visit session state
   - Tracks active session, customer, recording status, and metrics
   - Provides actions for managing visit lifecycle

### Modified Files
1. **`packages/pwa/src/App.tsx`**
   - Added VisitSessionBanner import and rendering
   - Banner appears below LeadContextBanner in the layout

2. **`packages/pwa/src/os/apps/visit/VisitApp.tsx`**
   - Integrated with visitStore to sync state
   - Updates store when visit starts/ends
   - Updates store when recording starts/stops
   - Tracks transcript segment count

## Features

### Visual Design
- **Red/Pink Gradient**: Visually distinct from the purple LeadContextBanner
- **Recording Indicator**: Pulsing red dot with live duration counter
- **Segment Counter**: Shows number of transcript segments captured
- **Status Chips**: Green "Visit Active" when not recording
- **Responsive**: Adapts to mobile, tablet, and desktop layouts

### Functionality
1. **Visibility**: Banner only appears when a visit session is active
2. **Real-time Status**: Shows live recording duration (updates every second)
3. **Click to Navigate**: Clicking banner navigates to Visit page
4. **End Visit Action**: 
   - Button to end the current visit
   - Disabled while recording is active
   - Proper error handling with user feedback
5. **State Management**: Global state via Zustand store

## Testing Guide

### Test Scenario 1: No Active Visit
**Steps:**
1. Open the application
2. Navigate to any page

**Expected:**
- VisitSessionBanner should NOT be visible
- Only LeadContextBanner should appear (if a lead is selected)

### Test Scenario 2: Start a Visit
**Steps:**
1. Navigate to `/visit` page
2. Select a customer and start a visit
3. Observe the banner

**Expected:**
- VisitSessionBanner should appear below LeadContextBanner
- Shows customer name (e.g., "John Smith")
- Shows session ID (e.g., "Visit Session #123")
- Shows green "Visit Active" status chip
- "End Visit" button is enabled

### Test Scenario 3: Start Recording
**Steps:**
1. While in an active visit, start recording (either browser STT or Whisper)
2. Observe the banner

**Expected:**
- Recording indicator appears with pulsing red dot
- Shows "Recording X:XX" with live timer
- Shows segment count: "(N segments)"
- Timer updates every second
- "End Visit" button is disabled (greyed out)

### Test Scenario 4: Stop Recording
**Steps:**
1. While recording, stop the recording in VisitApp
2. Observe the banner

**Expected:**
- Recording indicator disappears
- Green "Visit Active" chip returns
- Segment count reflects total captured segments
- "End Visit" button becomes enabled

### Test Scenario 5: End Visit (Success)
**Steps:**
1. With an active visit (not recording), click "End Visit" button
2. Observe the behavior

**Expected:**
- Banner disappears after successful API call
- User is navigated to `/visit` page
- Visit session is marked as completed in database

### Test Scenario 6: End Visit (Error)
**Steps:**
1. Simulate API failure (e.g., disconnect network)
2. Click "End Visit" button

**Expected:**
- Error message appears below banner: "Failed to end visit. Please try again from the Visit page."
- Banner remains visible
- Session state is not cleared

### Test Scenario 7: Click Banner Navigation
**Steps:**
1. With an active visit, click anywhere on the banner (not on buttons)
2. Observe navigation

**Expected:**
- User is navigated to `/visit` page
- Visit session remains active
- Recording state is preserved

### Test Scenario 8: Responsive Design
**Steps:**
1. Test on mobile viewport (< 768px)
2. Test on tablet viewport (769px - 1024px)
3. Test on desktop viewport (> 1024px)

**Expected:**
- Mobile: Banner stacks vertically, buttons at bottom
- Tablet: Slightly compressed layout
- Desktop: Full horizontal layout
- All elements remain visible and functional

## Code Quality

### TypeScript
- All components properly typed
- No implicit `any` types
- Proper interface definitions

### State Management
- Uses Zustand for global state (consistent with leadStore)
- Clean separation of concerns
- State updates are predictable and traceable

### Error Handling
- API errors are caught and displayed to user
- State remains consistent on errors
- Console logging for debugging

### Code Reviews
- All code review feedback addressed
- Removed unused CSS
- Improved customer name handling
- Added proper error feedback

## Architecture Decisions

### Why Zustand Store?
- Consistent with existing `leadStore` pattern
- Lightweight and simple to use
- Perfect for global UI state
- No prop drilling needed

### Why Not Control Recording from Banner?
- Avoids state synchronization issues with hardware (microphone, MediaRecorder)
- Recording controls remain in VisitApp where they belong
- Banner is primarily informational with safe quick actions

### Why Disable End Visit During Recording?
- Prevents premature termination of active recording
- Ensures data integrity (transcripts are saved)
- Clear user feedback about why it's disabled

## Browser Compatibility
- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge
- Requires JavaScript enabled
- CSS Grid and Flexbox support

## Performance
- Minimal re-renders (Zustand selectors)
- Timer updates only when recording
- No expensive computations
- Lightweight CSS animations

## Future Enhancements
1. **Visit Summary Preview**: Show brief summary in banner
2. **Time Tracking**: Show total visit duration
3. **Quick Actions**: Add more contextual actions
4. **Notifications**: Add toast notifications for state changes
5. **Keyboard Shortcuts**: Add hotkeys for common actions

## Conclusion
The VisitSessionBanner is fully implemented and ready for production use. It provides clear visual feedback about visit and recording status while maintaining clean architecture and proper error handling.
