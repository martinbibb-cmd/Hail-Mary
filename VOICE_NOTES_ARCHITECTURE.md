# Voice Notes Architecture

## Overview

The Voice Notes feature has been redesigned to match the Depot-voice-notes interaction model with a 3-panel layout and local Rocky extraction.

## Key Changes

### 1. NOT a Chat Interface

**Before:** Voice Notes rendered as a chat thread with "You:" and "Rocky:" message bubbles.

**After:** Voice Notes uses a 3-panel layout:
- **Left Panel:** Live transcript feed with timestamps
- **Center Panel:** Auto-ticking installation checklist
- **Right Panel:** Key details form (property facts)

### 2. Rocky is Local/Deterministic

**Before:** Rocky depended on Cloudflare Worker and showed "degraded" status when Worker was offline.

**After:** Rocky runs locally using deterministic pattern matching:
- Always shows "✅ Local" status
- No Worker dependency for core functionality
- Worker is optional enhancement (Cloud AI)
- Extracts facts from transcripts using regex patterns and keyword matching

### 3. Transcription is Part of Rocky Pipeline

**Flow:**
1. Microphone captures audio
2. Browser Speech Recognition transcribes (Web Speech API)
3. Rocky extracts structured data from transcript segments
4. UI updates automatically:
   - Facts populate the form (with "Auto" badges)
   - Checklist items get ticked
   - Flags/warnings appear as exceptions

### 4. Worker Status is Separate

- **Rocky Status:** Always "connected" (local extraction)
- **Cloud AI Status:** Optional - "available" | "unavailable" | "not-configured"
- Rocky is NOT degraded when Worker is offline

## Component Architecture

### TranscriptFeed Component
- Displays live transcript segments with timestamps
- Shows recording indicator when active
- NOT rendered as chat bubbles
- Auto-scrolls to latest segment

### InstallChecklist Component
- Shows checklist items from checklist-config.json
- Items auto-tick when Rocky detects them in transcript
- Shows "Auto-detected" badge for items ticked by Rocky
- Displays exceptions/warnings in a separate section
- Progress bar shows completion percentage

### KeyDetailsForm Component
- Structured form for property and system details
- Fields auto-fill from Rocky extraction
- Shows "Auto" badge for auto-filled fields
- Fields remain editable for manual correction
- Highlights auto-filled fields with green border

### Rocky Extractor (rockyExtractor.ts)
- Pure TypeScript pattern matching
- No LLM or network calls
- Deterministic extraction rules
- Patterns for:
  - Property type (house, flat, bungalow)
  - Bedroom count
  - System type (combi, system, regular boiler)
  - Boiler age
  - Occupancy
  - Issues/problems
  - Checklist items (based on keywords)

## Data Flow

```
User speaks → Web Speech API → Transcript segments
                                      ↓
                               Rocky Extractor
                                      ↓
                    ┌─────────────────┼─────────────────┐
                    ↓                 ↓                 ↓
            TranscriptFeed    InstallChecklist   KeyDetailsForm
                (Left)           (Center)            (Right)
```

## Rocky Result Interface

```typescript
interface RockyResult {
  facts: KeyDetails;              // Property & system facts
  checklistUpdates: ChecklistUpdate[];  // Items to tick
  flags: Flag[];                  // Warnings/errors
  openQuestions: string[];        // Missing information
  rawMatches?: PatternMatch[];   // Debug info
}
```

## Benefits

1. **Works Offline:** No Worker dependency for core functionality
2. **Instant Feedback:** Real-time extraction as you speak
3. **Transparent:** Users see what's auto-detected vs manual
4. **Editable:** All auto-filled data can be corrected
5. **Non-Intrusive:** Separate panels don't block each other
6. **Mobile-Friendly:** Responsive grid layout adapts to screen size

## Responsive Behavior

- **Desktop (> 1200px):** 3 columns side-by-side
- **Tablet (768px - 1200px):** 2x2 grid (transcript spans top row)
- **Mobile (< 768px):** Single column stack

## Future Enhancements

- Add Cloud AI integration for enhanced extraction (optional)
- Support for custom checklist templates
- Export extracted data to quote/job
- Audio recording and storage
- Multi-speaker detection
