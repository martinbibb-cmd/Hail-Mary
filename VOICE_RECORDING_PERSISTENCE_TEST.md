# Voice Recording Persistence - Manual Test Plan

## Objective
Verify that voice recording continues uninterrupted when navigating between pages/modules within the app.

## Prerequisites
- PWA application running
- Browser with Web Speech API support (Chrome, Edge, or Safari)
- Valid customer/lead data in the system

## Test Scenarios

### Scenario 1: Browser Speech Recognition Mode
1. Navigate to Visit app
2. Select a customer to start a visit
3. Click "Start Recording" button
4. Verify recording indicator appears (red pulse/dot)
5. Speak a test phrase (e.g., "This is a test")
6. Verify transcript appears in the left panel
7. **Navigate to another app** (e.g., Settings, Photos, or any other module)
8. **Expected Result:** Recording indicator should still be visible in the VisitSessionBanner at the top
9. Speak another test phrase
10. **Navigate back to Visit app**
11. **Expected Result:** 
    - Both transcript segments should be visible
    - Recording should still be active
    - No interruption in recording state
12. Click "Stop Recording"
13. **Expected Result:** Recording stops completely

### Scenario 2: Whisper Mode
1. Go to Settings and change STT provider to "Whisper"
2. Navigate to Visit app
3. Select a customer to start a visit
4. Click "Start Recording (Whisper)" button
5. Verify recording indicator appears
6. Speak continuously for ~5 seconds
7. **Navigate to another app** (e.g., Photos)
8. **Expected Result:** Recording indicator should still be active
9. Continue speaking for a few more seconds
10. **Navigate back to Visit app**
11. Click "Stop Recording"
12. **Expected Result:** 
    - Recording stops
    - Audio is transcribed
    - Transcript appears in the feed
    - No data loss from navigation

### Scenario 3: Multiple Page Switches During Recording
1. Start recording in Visit app (Browser mode)
2. Speak: "First segment"
3. Navigate to Settings
4. Wait 2 seconds
5. Navigate to Photos
6. Wait 2 seconds
7. Navigate back to Visit
8. Speak: "Second segment"
9. Stop recording
10. **Expected Result:**
    - Both segments appear in transcript
    - Recording remained active throughout all navigation
    - No gaps or lost audio

### Scenario 4: Recording State Survives Component Unmount
1. Start recording in Visit app
2. Click browser back button (if applicable)
3. Navigate to a different route that unmounts VisitApp component
4. Navigate back to Visit app
5. **Expected Result:**
    - Recording is still active
    - UI correctly shows recording state
    - Can continue recording or stop

## Edge Cases to Test

### Edge Case 1: App Refresh (SHOULD STOP)
1. Start recording
2. Refresh the browser page (F5)
3. **Expected Result:** Recording stops (this is expected behavior)

### Edge Case 2: Tab Switch
1. Start recording
2. Switch to another browser tab
3. Switch back
4. **Expected Result:** Recording continues (browser-dependent)

### Edge Case 3: Error During Navigation
1. Start recording
2. Simulate network error
3. Navigate to another page
4. **Expected Result:** 
    - Recording continues
    - Error is logged but doesn't crash app
    - User can still stop recording

## Success Criteria
- ✅ Recording persists across navigation within the app
- ✅ No transcript segments are lost during navigation
- ✅ UI state (recording indicator) syncs correctly after navigation
- ✅ Recording can be stopped from any page when VisitSessionBanner is visible
- ✅ No console errors during navigation with active recording
- ✅ Both Browser and Whisper modes work correctly

## Known Limitations
- Recording will stop if the app/browser is closed (expected)
- Recording will stop on page refresh (expected)
- Browser may impose time limits on continuous recording (browser-dependent)
