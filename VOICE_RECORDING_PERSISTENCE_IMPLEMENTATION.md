# Voice Recording Persistence Implementation Summary

## Problem Statement
Voice recording would stop when navigating between pages/modules within the app. The recording was tied to the VisitApp component lifecycle, so when the component unmounted (during navigation), the recording would stop.

## Solution Overview
Created a global singleton service (`voiceRecordingService`) that manages voice recording independently of React component lifecycles. This ensures recording continues even when navigating between pages.

## Key Changes

### 1. New File: `voiceRecordingService.ts`
- **Location:** `/packages/pwa/src/services/voiceRecordingService.ts`
- **Purpose:** Global singleton service for managing voice recording
- **Features:**
  - Manages browser Speech Recognition API
  - Manages Whisper audio recording (MediaRecorder)
  - Provides callbacks for transcript updates
  - Auto-restarts recognition if browser stops it unexpectedly
  - Survives React component unmounts

**Key Methods:**
```typescript
// Check support
isSpeechRecognitionSupported(): boolean

// Recording status
getIsRecording(): boolean
getCurrentProvider(): RecordingProvider | null

// Callbacks
setCallbacks(callbacks: TranscriptCallback): void

// Browser mode
startBrowserRecording(): Promise<void>
stopBrowserRecording(): void

// Whisper mode
startWhisperRecording(): Promise<void>
stopWhisperRecording(): Promise<{ blob: Blob; mimeType: string }>
```

### 2. Updated: `VisitApp.tsx`
**Changes:**
- Removed local speech recognition refs (`recognitionRef`, `mediaRecorderRef`, etc.)
- Removed Speech Recognition type declarations (moved to service)
- Import and use `voiceRecordingService` instead of local management
- Setup callbacks in `useEffect` that run on mount
- Sync recording state from service on component mount
- Callbacks persist across navigation (not cleared on unmount)

**Before:**
```typescript
// Local management - stopped when component unmounted
const recognitionRef = useRef<SpeechRecognition | null>(null)

useEffect(() => {
  recognitionRef.current = new SpeechRecognition()
  return () => {
    recognitionRef.current?.abort() // Recording stops here!
  }
}, [])
```

**After:**
```typescript
// Global service - survives component unmount
import { voiceRecordingService } from '../../../services/voiceRecordingService'

useEffect(() => {
  voiceRecordingService.setCallbacks({
    onFinalTranscript: (text) => { /* handle */ },
    onInterimTranscript: (text) => { /* handle */ },
    onError: (error) => { /* handle */ }
  })
  
  // Sync state from service
  if (voiceRecordingService.getIsRecording()) {
    setIsListening(true)
    startRecordingInStore(voiceRecordingService.getCurrentProvider())
  }
  
  return () => {
    // Callbacks remain active - recording continues!
  }
}, [dependencies])
```

### 3. Updated: `VOICE_NOTES_ARCHITECTURE.md`
Added section documenting the recording persistence feature.

### 4. New File: `VOICE_RECORDING_PERSISTENCE_TEST.md`
Comprehensive manual test plan with multiple scenarios and edge cases.

## Technical Details

### Auto-Restart Logic
The service includes auto-restart logic for browser speech recognition:
```typescript
this.recognition.onend = () => {
  if (this.isRecording && this.currentProvider === 'browser') {
    console.log('Speech recognition ended unexpectedly, restarting...')
    try {
      this.recognition?.start()
    } catch (error) {
      console.error('Failed to restart recognition:', error)
      this.isRecording = false
    }
  }
}
```

This handles cases where the browser automatically stops recognition (common in Chrome after ~60 seconds of silence).

### State Synchronization
When VisitApp remounts after navigation:
1. Callbacks are updated with current closures
2. Recording state is synced from service to local state
3. Visit store is updated with recording status
4. UI reflects the current recording state

### Both Recording Modes Supported
- **Browser Mode:** Real-time Speech Recognition API (continuous transcription)
- **Whisper Mode:** Audio recording with batch transcription via API

Both modes use the same service architecture and persist across navigation.

## Benefits

1. **Uninterrupted Recording:** Users can navigate freely without losing their recording
2. **Better UX:** Recording indicator (VisitSessionBanner) shows status across all pages
3. **Data Safety:** No transcript loss during navigation
4. **Consistent Architecture:** Single source of truth for recording state
5. **Memory Safe:** Callbacks are updated on each mount to prevent stale closures

## Limitations (Expected Behavior)

1. **App/Browser Close:** Recording stops when the app is closed or browser is refreshed
2. **Network Errors:** Whisper mode requires API connection for transcription
3. **Browser Limits:** Some browsers may impose time/size limits on continuous recording
4. **Permissions:** Microphone permissions must be granted by user

## Testing

See `VOICE_RECORDING_PERSISTENCE_TEST.md` for comprehensive test scenarios.

**Key Test Points:**
- Recording continues during navigation
- State syncs correctly after navigation
- Both Browser and Whisper modes work
- No memory leaks or stale closures
- Error handling works properly

## Files Modified

1. `/packages/pwa/src/services/voiceRecordingService.ts` (NEW)
2. `/packages/pwa/src/os/apps/visit/VisitApp.tsx` (UPDATED)
3. `/VOICE_NOTES_ARCHITECTURE.md` (UPDATED)
4. `/VOICE_RECORDING_PERSISTENCE_TEST.md` (NEW)

## Backwards Compatibility

✅ Fully backwards compatible:
- No API changes
- No database schema changes
- Existing recordings/transcripts unaffected
- UI/UX unchanged (except recording now persists)
