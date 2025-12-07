# Single-Device Next.js PWA: 4-Week Rapid Build Plan

**Version:** 1.0  
**Date:** 2025-12-07  
**Status:** Implementation Ready  
**Hardware Setup:** Samsung Android Tablet + Hollyland Wireless Microphones

---

## Executive Summary

This document outlines a focused **4-week rapid build plan** for creating a Next.js Progressive Web App optimized for a **Single-Device workflow**. The surveyor uses a Samsung Android Tablet as the "Command Center" while roaming the property with Hollyland wireless microphones.

### The Single-Device Workflow

```
HARDWARE SETUP:
┌─────────────────────────────────────────────────┐
│  📱 Samsung Android Tablet (Command Center)     │
│  • Sits stationary on table                     │
│  • Runs Next.js PWA                              │
│  • Screen stays AWAKE during recording          │
│  • Connected to Hollyland wireless mics         │
└─────────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────────┐
│  🎤 Hollyland Wireless Microphones              │
│  • Surveyor wears while roaming                 │
│  • USB/Bluetooth connection to tablet           │
│  • Primary audio input device                   │
└─────────────────────────────────────────────────┘
```

### Critical Technical Requirements

1. **Screen Wake Lock API** - Prevents screen sleep during recording phase
2. **Audio Input Selection** - Allows selecting Hollyland mics as default input
3. **Local Processing** - IndexedDB for offline-first data storage
4. **PDF Generation** - `@react-pdf/renderer` for client-side PDF creation

---

## Important Notes

### Code Examples & TypeScript

The code examples in this document are designed for **clarity and readability** in a planning document. When implementing:

- **Replace `any` types** with proper TypeScript interfaces and types
- **Add type declarations** for browser APIs (Web Speech API, Wake Lock API, etc.)
- **Use proper error handling** with type guards (`err instanceof Error`)
- **Define interfaces** for all data structures (SurveyData, AudioDevice, etc.)
- **Add type augmentation** for window object extensions

**Example TypeScript improvements:**
```typescript
// Instead of: const recognitionRef = useRef<any>(null);
// Use: const recognitionRef = useRef<SpeechRecognition | null>(null);

// Instead of: catch (err) { setError(err.message); }
// Use: catch (err) { 
//   setError(err instanceof Error ? err.message : String(err)); 
// }

// Define proper types for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  // ... other properties
}
```

For production implementation, use `@types/dom-speech-recognition` or create proper type declarations.

---

## Table of Contents

1. [Week 1: Audio Logic (External Mic + Wake Lock + Voice-to-Text)](#week-1-audio-logic)
2. [Week 2: The Visualization Layer](#week-2-the-visualization-layer)
3. [Week 3: The PDF Brochure Generator](#week-3-the-pdf-brochure-generator)
4. [Week 4: UI Polish & Print Testing](#week-4-ui-polish--print-testing)
5. [Tech Stack Details](#tech-stack-details)
6. [Single-Device Optimizations](#single-device-optimizations)
7. [Success Criteria](#success-criteria)

---

## Week 1: Audio Logic

### Goal
Build robust audio infrastructure supporting external wireless microphones with Wake Lock API to prevent system sleep during recording.

---

### 1.1 Screen Wake Lock API Implementation

**Purpose:** Prevent the tablet screen from sleeping during active recording sessions, ensuring the app doesn't get killed by the OS.

**Browser Support:**
- Chrome/Edge 84+ ✅
- Safari 16.4+ ✅
- Firefox 126+ (requires `dom.screenwakelock.enabled` flag in about:config) ⚠️
- Android Chrome 84+ ✅ (Critical for our Samsung Tablet - built-in support)

**Note:** Since our target platform is Samsung Android Tablet running Chrome, Wake Lock API is fully supported without any configuration.

**Implementation:**

```typescript
// /app/hooks/useWakeLock.ts
import { useEffect, useRef, useState } from 'react';

interface WakeLockAPI {
  isSupported: boolean;
  isActive: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
  error: string | null;
}

export function useWakeLock(): WakeLockAPI {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const isSupported = 'wakeLock' in navigator;

  const request = async () => {
    if (!isSupported) {
      setError('Wake Lock API not supported in this browser');
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      setError(null);

      // Listen for wake lock release (e.g., tab loses visibility)
      wakeLockRef.current.addEventListener('release', () => {
        console.log('Wake Lock released');
        setIsActive(false);
      });

      console.log('Wake Lock activated');
    } catch (err) {
      setError(`Wake Lock error: ${err.message}`);
      setIsActive(false);
    }
  };

  const release = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        console.log('Wake Lock released manually');
      } catch (err) {
        setError(`Wake Lock release error: ${err.message}`);
      }
    }
  };

  // Auto-request wake lock when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLockRef.current) {
        await request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, [isActive]);

  return { isSupported, isActive, request, release, error };
}
```

**Usage in Recording Component:**

```typescript
// /app/components/RecordingSession.tsx
'use client';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useEffect } from 'react';

export function RecordingSession() {
  const wakeLock = useWakeLock();
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    // Request wake lock before starting recording
    await wakeLock.request();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    setIsRecording(false);
    // Release wake lock when done
    await wakeLock.release();
  };

  return (
    <div>
      {!wakeLock.isSupported && (
        <div className="warning">
          ⚠️ Wake Lock not supported - screen may sleep during recording
        </div>
      )}
      
      {wakeLock.isActive && (
        <div className="status">
          ✅ Screen will stay awake during recording
        </div>
      )}

      <button onClick={startRecording} disabled={isRecording}>
        Start Recording
      </button>
      <button onClick={stopRecording} disabled={!isRecording}>
        Stop Recording
      </button>
    </div>
  );
}
```

**Tasks:**
- [ ] Implement useWakeLock hook with request/release methods
- [ ] Add visibility change listener for auto-reacquire
- [ ] Build UI indicator for wake lock status
- [ ] Add error handling and fallback messaging
- [ ] Test on Samsung Android Tablet (Chrome)
- [ ] Add user notification when wake lock is active

**Acceptance Criteria:**
- ✅ Wake lock activates when recording starts
- ✅ Screen stays on for duration of 30+ minute recording session
- ✅ Wake lock reacquires automatically if tab loses/regains focus
- ✅ Clean release when recording stops
- ✅ Works on Samsung Android Tablet with Chrome

---

### 1.2 External Microphone Selection

**Purpose:** Allow surveyor to select and use Hollyland wireless microphones (USB or Bluetooth) as the primary audio input device.

**Web Audio API + MediaDevices:**

```typescript
// /app/hooks/useAudioDevices.ts
import { useState, useEffect } from 'react';

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface AudioDeviceManager {
  devices: AudioDevice[];
  selectedDeviceId: string | null;
  setSelectedDevice: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
  isLoading: boolean;
}

export function useAudioDevices(): AudioDeviceManager {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDevices = async () => {
    setIsLoading(true);
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Enumerate all audio input devices
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
          kind: device.kind,
        }));

      setDevices(audioInputs);

      // Auto-select Hollyland mic if detected
      const hollylandDevice = audioInputs.find(
        device => device.label.toLowerCase().includes('hollyland')
      );

      if (hollylandDevice) {
        setSelectedDeviceId(hollylandDevice.deviceId);
        console.log('Auto-selected Hollyland microphone:', hollylandDevice.label);
      } else if (audioInputs.length > 0 && !selectedDeviceId) {
        // Default to first device if no selection
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error enumerating audio devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshDevices();

    // Listen for device changes (plug/unplug)
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, []);

  const setSelectedDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    // Persist selection to localStorage
    localStorage.setItem('preferredAudioDevice', deviceId);
  };

  // Load preferred device on mount
  useEffect(() => {
    const preferred = localStorage.getItem('preferredAudioDevice');
    if (preferred && devices.some(d => d.deviceId === preferred)) {
      setSelectedDeviceId(preferred);
    }
  }, [devices]);

  return {
    devices,
    selectedDeviceId,
    setSelectedDevice,
    refreshDevices,
    isLoading,
  };
}
```

**Audio Input Selector Component:**

```typescript
// /app/components/AudioInputSelector.tsx
'use client';
import { useAudioDevices } from '@/hooks/useAudioDevices';

export function AudioInputSelector() {
  const { devices, selectedDeviceId, setSelectedDevice, refreshDevices, isLoading } = useAudioDevices();

  return (
    <div className="audio-selector">
      <label htmlFor="audio-device">Microphone:</label>
      <select
        id="audio-device"
        value={selectedDeviceId || ''}
        onChange={(e) => setSelectedDevice(e.target.value)}
        disabled={isLoading}
      >
        {devices.map(device => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
            {device.label.toLowerCase().includes('hollyland') && ' 🎤 (Wireless)'}
          </option>
        ))}
      </select>
      <button onClick={refreshDevices} disabled={isLoading}>
        🔄 Refresh Devices
      </button>
      
      {devices.length === 0 && !isLoading && (
        <div className="warning">
          ⚠️ No microphones detected. Please connect your Hollyland wireless mic.
        </div>
      )}
    </div>
  );
}
```

**Tasks:**
- [ ] Implement useAudioDevices hook for device enumeration
- [ ] Build audio input selector UI component
- [ ] Add auto-detection for Hollyland microphones
- [ ] Persist selected device to localStorage
- [ ] Add device change listener (plug/unplug detection)
- [ ] Test with Hollyland wireless mics (USB and Bluetooth)
- [ ] Add visual indicator for active microphone

**Acceptance Criteria:**
- ✅ Lists all available audio input devices
- ✅ Auto-detects and selects Hollyland microphones
- ✅ Persists microphone selection across sessions
- ✅ Detects when Hollyland mic is connected/disconnected
- ✅ Works with both USB and Bluetooth Hollyland connections

---

### 1.3 Voice-to-Text with Selected Microphone

**Purpose:** Capture voice input from the selected external microphone and convert to text in real-time.

**Integration with Web Speech API:**

```typescript
// /app/hooks/useVoiceCapture.ts
import { useState, useEffect, useRef } from 'react';
import { useAudioDevices } from './useAudioDevices';

interface VoiceCapture {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  error: string | null;
  isBrowserSupported: boolean;
}

export function useVoiceCapture(): VoiceCapture {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { selectedDeviceId } = useAudioDevices();
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const isBrowserSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const startListening = async () => {
    if (!isBrowserSupported) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    try {
      // Get audio stream from selected device
      if (selectedDeviceId) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: selectedDeviceId } }
        });
      }

      // Initialize speech recognition
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      // Language can be configured: 'en-GB', 'en-US', 'en-AU', etc.
      recognitionRef.current.lang = 'en-GB'; // TODO: Make configurable via settings
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setError(null);
        console.log('Voice recognition started');
      };

      recognitionRef.current.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript + ' ';
          } else {
            interim += result[0].transcript;
          }
        }

        if (final) {
          setTranscript(prev => prev + final);
        }
        setInterimTranscript(interim);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError(`Recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        console.log('Voice recognition ended');
        setIsListening(false);
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      recognitionRef.current.start();
    } catch (err) {
      setError(`Failed to start recording: ${err.message}`);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const resetTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isBrowserSupported,
  };
}
```

**Recording UI Component:**

```typescript
// /app/components/VoiceRecorder.tsx
'use client';
import { useVoiceCapture } from '@/hooks/useVoiceCapture';
import { useWakeLock } from '@/hooks/useWakeLock';
import { AudioInputSelector } from './AudioInputSelector';

export function VoiceRecorder() {
  const voice = useVoiceCapture();
  const wakeLock = useWakeLock();

  const handleStart = async () => {
    await wakeLock.request();
    await voice.startListening();
  };

  const handleStop = async () => {
    voice.stopListening();
    await wakeLock.release();
  };

  return (
    <div className="voice-recorder">
      <h2>Voice Recording Session</h2>
      
      <AudioInputSelector />
      
      <div className="status-indicators">
        {wakeLock.isActive && (
          <div className="badge success">🔓 Screen Unlocked</div>
        )}
        {voice.isListening && (
          <div className="badge recording">🎤 Recording...</div>
        )}
      </div>

      <div className="controls">
        <button 
          onClick={handleStart} 
          disabled={voice.isListening}
          className="btn-primary"
        >
          ▶️ Start Recording
        </button>
        <button 
          onClick={handleStop} 
          disabled={!voice.isListening}
          className="btn-secondary"
        >
          ⏹️ Stop Recording
        </button>
        <button 
          onClick={voice.resetTranscript}
          className="btn-outline"
        >
          🗑️ Clear
        </button>
      </div>

      <div className="transcript-container">
        <h3>Transcript</h3>
        <div className="transcript">
          {voice.transcript}
          {voice.interimTranscript && (
            <span className="interim">{voice.interimTranscript}</span>
          )}
        </div>
      </div>

      {voice.error && (
        <div className="error">⚠️ {voice.error}</div>
      )}
    </div>
  );
}
```

**Tasks:**
- [ ] Implement useVoiceCapture hook with device selection
- [ ] Build recording UI with start/stop controls
- [ ] Add real-time transcript display
- [ ] Show interim results (gray text)
- [ ] Integrate with Wake Lock API
- [ ] Add error handling and user feedback
- [ ] Test with Hollyland wireless mics
- [ ] Add audio level visualization (optional)

**Acceptance Criteria:**
- ✅ Captures audio from selected Hollyland microphone
- ✅ Real-time transcription with <1 second latency
- ✅ Interim results visible during speech
- ✅ Wake lock prevents screen sleep during recording
- ✅ Works for 30+ minute sessions without interruption
- ✅ Clean start/stop with no audio artifacts

---

### 1.4 IndexedDB Data Persistence

**Purpose:** Store survey data locally using IndexedDB for offline-first operation on the tablet.

**IndexedDB Wrapper:**

```typescript
// /app/lib/indexeddb.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SurveyDB extends DBSchema {
  surveys: {
    key: string;
    value: {
      id: string;
      createdAt: string;
      updatedAt: string;
      customer: {
        name: string;
        address: string;
        phone?: string;
        email?: string;
      };
      voiceTranscript: string;
      diagrams?: Blob[];
      pdfData?: Blob;
      status: 'draft' | 'completed' | 'exported';
    };
    indexes: { 'by-date': string; 'by-status': string };
  };
  voiceNotes: {
    key: string;
    value: {
      id: string;
      surveyId: string;
      timestamp: string;
      text: string;
      audioBlob?: Blob;
    };
    indexes: { 'by-survey': string };
  };
}

class SurveyDatabase {
  private db: IDBPDatabase<SurveyDB> | null = null;

  async init() {
    this.db = await openDB<SurveyDB>('hail-mary-surveys', 1, {
      upgrade(db) {
        // Create surveys object store
        const surveyStore = db.createObjectStore('surveys', { keyPath: 'id' });
        surveyStore.createIndex('by-date', 'createdAt');
        surveyStore.createIndex('by-status', 'status');

        // Create voice notes object store
        const notesStore = db.createObjectStore('voiceNotes', { keyPath: 'id' });
        notesStore.createIndex('by-survey', 'surveyId');
      },
    });
  }

  async saveSurvey(survey: SurveyDB['surveys']['value']) {
    if (!this.db) await this.init();
    await this.db!.put('surveys', survey);
  }

  async getSurvey(id: string) {
    if (!this.db) await this.init();
    return await this.db!.get('surveys', id);
  }

  async getAllSurveys() {
    if (!this.db) await this.init();
    return await this.db!.getAll('surveys');
  }

  async deleteSurvey(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('surveys', id);
    
    // Delete associated voice notes
    const notes = await this.db!.getAllFromIndex('voiceNotes', 'by-survey', id);
    for (const note of notes) {
      await this.db!.delete('voiceNotes', note.id);
    }
  }

  async saveVoiceNote(note: SurveyDB['voiceNotes']['value']) {
    if (!this.db) await this.init();
    await this.db!.put('voiceNotes', note);
  }

  async getVoiceNotes(surveyId: string) {
    if (!this.db) await this.init();
    return await this.db!.getAllFromIndex('voiceNotes', 'by-survey', surveyId);
  }
}

export const surveyDB = new SurveyDatabase();
```

**React Hook for IndexedDB:**

```typescript
// /app/hooks/useSurveyDB.ts
import { useState, useEffect } from 'react';
import { surveyDB } from '@/lib/indexeddb';

export function useSurveyDB() {
  const [surveys, setSurveys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    setIsLoading(true);
    const allSurveys = await surveyDB.getAllSurveys();
    setSurveys(allSurveys);
    setIsLoading(false);
  };

  const saveSurvey = async (survey: any) => {
    await surveyDB.saveSurvey(survey);
    await loadSurveys();
  };

  const deleteSurvey = async (id: string) => {
    await surveyDB.deleteSurvey(id);
    await loadSurveys();
  };

  return {
    surveys,
    isLoading,
    saveSurvey,
    deleteSurvey,
    refreshSurveys: loadSurveys,
  };
}
```

**Installation:**

```bash
npm install idb@^8.0.0
```

**Note:** Using idb v8.x for TypeScript support and IndexedDB schema validation.

**Tasks:**
- [ ] Install `idb` package (IndexedDB wrapper)
- [ ] Create IndexedDB schema for surveys and voice notes
- [ ] Implement database wrapper class
- [ ] Build React hooks for CRUD operations
- [ ] Add auto-save functionality (every 30 seconds)
- [ ] Implement export to JSON
- [ ] Add database size monitoring
- [ ] Test with large datasets (100+ surveys)

**Acceptance Criteria:**
- ✅ Surveys persist in IndexedDB
- ✅ Data survives browser refresh and app restart
- ✅ Can store 100+ surveys without performance issues
- ✅ Auto-save works seamlessly in background
- ✅ Can export individual surveys or full database
- ✅ Works offline on Samsung Tablet

---

### Week 1 Deliverables

- ✅ Screen Wake Lock API implemented and tested
- ✅ External microphone selection (Hollyland support)
- ✅ Voice-to-text capture with selected device
- ✅ IndexedDB persistence layer
- ✅ Recording session UI with status indicators
- ✅ Auto-save functionality
- ✅ Offline-first architecture

### Week 1 Success Metrics

- Tablet stays awake during 30+ minute recording session
- Hollyland wireless mic auto-detected and selected
- Voice transcription works with <1 second latency
- All data persists to IndexedDB automatically
- App works completely offline

---

## Week 2: The Visualization Layer

### Goal
Create professional visual diagrams showing property layout, boiler placement, and flue routing - all optimized for tablet display and touch interaction.

### 2.1 Touch-Optimized Canvas Drawing

**Library:** `react-konva` (touch-friendly canvas for React)

**Installation:**
```bash
npm install react-konva@^18.2.0 konva@^9.3.0
```

**Note:** react-konva v18.x provides full React 18 support with touch event handling optimized for tablets.

**Implementation:**

```typescript
// /app/components/FloorPlanCanvas.tsx
'use client';
import { Stage, Layer, Line, Circle, Rect, Text } from 'react-konva';
import { useState, useRef } from 'react';

export function FloorPlanCanvas() {
  const [tool, setTool] = useState<'pen' | 'boiler' | 'radiator'>('pen');
  const [lines, setLines] = useState<any[]>([]);
  const [elements, setElements] = useState<any[]>([]);
  const isDrawing = useRef(false);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();

    if (tool === 'pen') {
      setLines([...lines, { points: [pos.x, pos.y] }]);
    } else {
      // Add boiler or radiator icon
      setElements([...elements, {
        type: tool,
        x: pos.x,
        y: pos.y,
        id: Date.now().toString(),
      }]);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || tool !== 'pen') return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];
    
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  return (
    <div className="canvas-container">
      <div className="toolbar">
        <button onClick={() => setTool('pen')} className={tool === 'pen' ? 'active' : ''}>
          ✏️ Draw
        </button>
        <button onClick={() => setTool('boiler')} className={tool === 'boiler' ? 'active' : ''}>
          🔥 Boiler
        </button>
        <button onClick={() => setTool('radiator')} className={tool === 'radiator' ? 'active' : ''}>
          📻 Radiator
        </button>
        <button onClick={() => { setLines([]); setElements([]); }}>
          🗑️ Clear
        </button>
      </div>

      <Stage
        width={800}
        height={600}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer>
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke="#000"
              strokeWidth={2}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          ))}

          {elements.map((el) => (
            <React.Fragment key={el.id}>
              {el.type === 'boiler' && (
                <Rect
                  x={el.x}
                  y={el.y}
                  width={40}
                  height={60}
                  fill="red"
                  draggable
                />
              )}
              {el.type === 'radiator' && (
                <Rect
                  x={el.x}
                  y={el.y}
                  width={50}
                  height={30}
                  fill="blue"
                  draggable
                />
              )}
            </React.Fragment>
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
```

**Tasks:**
- [ ] Install react-konva
- [ ] Build touch-optimized canvas component
- [ ] Add drawing tools (pen, shapes, text)
- [ ] Implement drag-and-drop for boiler/radiator icons
- [ ] Add undo/redo functionality
- [ ] Export canvas as PNG/base64
- [ ] Add zoom and pan gestures
- [ ] Test on Samsung Tablet with touch

**Acceptance Criteria:**
- ✅ Smooth drawing with touch/stylus
- ✅ Drag-and-drop works on tablet
- ✅ Canvas exports to high-res PNG
- ✅ Supports pinch-to-zoom
- ✅ No lag during drawing

---

### 2.2 Diagram Templates

**Pre-built templates for common scenarios:**

```typescript
// /app/lib/diagram-templates.ts

export const templates = {
  combiBoilerFloorPlan: {
    name: 'Combi Boiler - Kitchen Install',
    elements: [
      { type: 'boiler', x: 50, y: 100, label: 'Combi Boiler' },
      { type: 'flue', points: [50, 100, 200, 100, 200, 50], label: '2m flue run' },
      { type: 'radiator', x: 300, y: 150, label: 'Kitchen Rad' },
    ],
  },
  systemBoilerFloorPlan: {
    name: 'System Boiler - Utility Room',
    elements: [
      { type: 'boiler', x: 50, y: 100, label: 'System Boiler' },
      { type: 'cylinder', x: 150, y: 100, label: 'Hot Water Cylinder' },
      { type: 'flue', points: [50, 100, 50, 50], label: 'Vertical flue' },
    ],
  },
};
```

**Tasks:**
- [ ] Create 5-10 common diagram templates
- [ ] Build template selector UI
- [ ] Allow customization after template selection
- [ ] Save custom templates
- [ ] Export template library

**Acceptance Criteria:**
- ✅ Templates load in <1 second
- ✅ Easy to customize after loading
- ✅ Saves 5+ minutes per diagram

---

### Week 2 Deliverables

- ✅ Touch-optimized floor plan canvas
- ✅ Boiler and radiator placement tools
- ✅ Flue route drawing
- ✅ Diagram templates library
- ✅ Export diagrams as PNG/base64
- ✅ Optimized for Samsung Tablet

### Week 2 Success Metrics

- Create professional diagram in <5 minutes
- Touch interaction feels natural on tablet
- Diagrams export at print quality (300 DPI)
- Templates cover 80% of common scenarios

---

## Week 3: The PDF Brochure Generator

### Goal
Generate professional A4 PDFs using `@react-pdf/renderer` that can be printed directly from the tablet or saved for later.

### 3.1 PDF Template with @react-pdf/renderer

**Installation:**
```bash
npm install @react-pdf/renderer@^3.1.0
```

**Note:** Using v3.1+ for React 18 compatibility and improved performance. API is stable from v3.0 onwards.

**Implementation:**

```typescript
// /app/components/SurveyPDF.tsx
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    color: '#2563eb',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 10,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  text: {
    marginBottom: 5,
    lineHeight: 1.5,
  },
  diagram: {
    width: '100%',
    maxHeight: 400,
    objectFit: 'contain',
    marginVertical: 10,
  },
});

export function SurveyPDF({ surveyData, diagramBase64 }: any) {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Heating System Survey</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <Text style={styles.text}>Name: {surveyData.customer.name}</Text>
          <Text style={styles.text}>Address: {surveyData.customer.address}</Text>
          <Text style={styles.text}>Date: {new Date(surveyData.createdAt).toLocaleDateString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Survey Notes</Text>
          <Text style={styles.text}>{surveyData.voiceTranscript}</Text>
        </View>
      </Page>

      {/* Diagram Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>System Diagram</Text>
        {diagramBase64 && (
          <Image src={diagramBase64} style={styles.diagram} />
        )}
      </Page>

      {/* Materials Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Materials & Equipment</Text>
        <View style={styles.section}>
          <Text style={styles.text}>• Combi Boiler</Text>
          <Text style={styles.text}>• Flue Kit (2m)</Text>
          <Text style={styles.text}>• Radiator Valves</Text>
          <Text style={styles.text}>• Pipework</Text>
        </View>
      </Page>
    </Document>
  );
}
```

**PDF Download Component:**

```typescript
// /app/components/PDFDownloadButton.tsx
'use client';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { SurveyPDF } from './SurveyPDF';

export function PDFDownloadButton({ surveyData, diagramBase64 }: any) {
  return (
    <PDFDownloadLink
      document={<SurveyPDF surveyData={surveyData} diagramBase64={diagramBase64} />}
      fileName={`survey-${surveyData.customer.name}-${Date.now()}.pdf`}
    >
      {({ blob, url, loading, error }) => (
        <button 
          className="btn-primary"
          disabled={loading}
        >
          {loading ? '⏳ Generating PDF...' : '📄 Download PDF'}
        </button>
      )}
    </PDFDownloadLink>
  );
}
```

**Tasks:**
- [ ] Install @react-pdf/renderer
- [ ] Create 3-page PDF template
- [ ] Add company branding (logo, colors)
- [ ] Embed diagrams as base64 images
- [ ] Implement download functionality
- [ ] Add print button (native print dialog)
- [ ] Test on Samsung Tablet (print to portable printer)
- [ ] Optimize file size (<3MB)

**Acceptance Criteria:**
- ✅ PDF generates in <5 seconds
- ✅ Professional brochure appearance
- ✅ Diagrams embedded at high quality
- ✅ Prints correctly on A4 paper
- ✅ File size <3MB for easy sharing
- ✅ Works on Samsung Tablet

---

### 3.2 Branding Customization

**Settings stored in IndexedDB:**

```typescript
// /app/lib/branding.ts
interface BrandingSettings {
  companyName: string;
  logo: string; // base64
  primaryColor: string;
  secondaryColor: string;
  phone: string;
  email: string;
  website?: string;
}

export async function saveBranding(settings: BrandingSettings) {
  localStorage.setItem('branding', JSON.stringify(settings));
}

export async function loadBranding(): Promise<BrandingSettings> {
  const stored = localStorage.getItem('branding');
  return stored ? JSON.parse(stored) : getDefaultBranding();
}

function getDefaultBranding(): BrandingSettings {
  return {
    companyName: 'Your Heating Company',
    logo: '',
    primaryColor: '#2563eb',
    secondaryColor: '#10b981',
    phone: '',
    email: '',
  };
}
```

**Tasks:**
- [ ] Build branding settings page
- [ ] Add logo upload (with crop/resize)
- [ ] Implement color picker
- [ ] Add preview of PDF with branding
- [ ] Save to IndexedDB
- [ ] Apply branding to all PDFs

**Acceptance Criteria:**
- ✅ Logo uploads and displays correctly
- ✅ Colors apply to PDF headers/footers
- ✅ Branding persists across sessions
- ✅ Preview updates in real-time

---

### Week 3 Deliverables

- ✅ Professional 3-page PDF template
- ✅ Client-side PDF generation (@react-pdf/renderer)
- ✅ Branding customization UI
- ✅ Download and print functionality
- ✅ Optimized for portable printers
- ✅ Works offline on tablet

### Week 3 Success Metrics

- PDF generates in <5 seconds
- Professional appearance (customer-ready)
- Prints perfectly on portable printer
- File size <3MB
- No internet required for generation

---

## Week 4: UI Polish & Print Testing

### Goal
Refine the user experience, optimize for tablet use, and ensure reliable printing from the Samsung Tablet.

### 4.1 Tablet-Optimized UI

**Responsive Design for 10-12" Tablets:**

```typescript
// /app/styles/tablet-optimized.css

/* Optimized for Samsung Galaxy Tab (10.4" - 12.4") */
@media (min-width: 768px) and (max-width: 1280px) {
  .app-container {
    max-width: 100%;
    padding: 20px;
  }

  /* Large touch targets (minimum 44x44px) */
  button, .touch-target {
    min-width: 60px;
    min-height: 60px;
    font-size: 18px;
    padding: 15px 25px;
  }

  /* Readable text sizes */
  body {
    font-size: 16px;
    line-height: 1.6;
  }

  h1 { font-size: 32px; }
  h2 { font-size: 24px; }
  h3 { font-size: 20px; }

  /* Landscape mode optimization */
  @media (orientation: landscape) {
    .main-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
  }
}
```

**Tasks:**
- [ ] Optimize all UI for tablet screen sizes
- [ ] Increase touch target sizes (60x60px minimum)
- [ ] Add landscape mode layout
- [ ] Optimize font sizes for readability
- [ ] Remove hover-dependent interactions
- [ ] Add haptic feedback (if available)
- [ ] Test on Samsung Tablet in both orientations

**Acceptance Criteria:**
- ✅ All buttons easily tappable with finger
- ✅ Text readable from 2 feet away
- ✅ Layout works in portrait and landscape
- ✅ No horizontal scrolling
- ✅ Fast response to touch (<100ms)

---

### 4.2 Print Testing & Optimization

**Native Print Dialog Integration:**

```typescript
// /app/components/PrintButton.tsx
'use client';
import { pdf } from '@react-pdf/renderer';
import { SurveyPDF } from './SurveyPDF';

export function PrintButton({ surveyData, diagramBase64 }: any) {
  const handlePrint = async () => {
    // Generate PDF blob
    const doc = <SurveyPDF surveyData={surveyData} diagramBase64={diagramBase64} />;
    const blob = await pdf(doc).toBlob();
    
    // Create object URL
    const url = URL.createObjectURL(blob);
    
    // Open in new window and trigger print
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <button onClick={handlePrint} className="btn-primary">
      🖨️ Print Survey
    </button>
  );
}
```

**Tasks:**
- [ ] Test with portable printer (Bluetooth/USB)
- [ ] Verify A4 paper size output
- [ ] Test print quality (text, diagrams)
- [ ] Add print preview functionality
- [ ] Handle printer errors gracefully
- [ ] Test wireless printing from tablet
- [ ] Document printer setup process

**Acceptance Criteria:**
- ✅ Prints correctly on portable printer
- ✅ A4 layout fits perfectly on paper
- ✅ Text is sharp and readable
- ✅ Diagrams print at good quality
- ✅ No layout issues or cut-off content
- ✅ Works with both USB and Bluetooth printers

---

### 4.3 Performance Optimization

**Key Areas:**

1. **Voice Recognition Performance**
   - Throttle transcript updates
   - Use web workers for processing
   - Batch IndexedDB writes

2. **Canvas Performance**
   - Limit redraw frequency
   - Use layer optimization
   - Debounce touch events

3. **PDF Generation**
   - Generate in background
   - Show progress indicator
   - Cache generated PDFs

**Tasks:**
- [ ] Profile app performance on tablet
- [ ] Optimize wake lock battery usage
- [ ] Reduce memory footprint
- [ ] Implement lazy loading
- [ ] Add loading states
- [ ] Test 60+ minute recording sessions
- [ ] Monitor battery drain

**Acceptance Criteria:**
- ✅ App uses <500MB RAM
- ✅ Battery lasts for 4+ hours of use
- ✅ No lag during voice recording
- ✅ Canvas drawing is smooth (60 FPS)
- ✅ PDF generation doesn't freeze UI

---

### 4.4 Offline PWA Configuration

**Installation:**

```bash
npm install next-pwa@^5.6.0
```

**Next.js Configuration:**

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
});

module.exports = withPWA({
  // Your Next.js config
});
```

**PWA Manifest:**

```json
// /public/manifest.json
{
  "name": "Hail Mary - Heating Survey Tool",
  "short_name": "Hail Mary",
  "description": "Voice-driven heating survey tool",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "landscape",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Tasks:**
- [ ] Install next-pwa package
- [ ] Configure PWA manifest
- [ ] Set up service worker via next-pwa
- [ ] Cache critical assets
- [ ] Enable offline functionality
- [ ] Add install prompt
- [ ] Test offline mode
- [ ] Add sync when online

**Acceptance Criteria:**
- ✅ Works completely offline
- ✅ Can install as app on tablet
- ✅ Boots in <2 seconds
- ✅ All features work without internet

---

### Week 4 Deliverables

- ✅ Tablet-optimized UI (large touch targets)
- ✅ Native print functionality tested
- ✅ Performance optimizations
- ✅ Offline PWA configuration
- ✅ Complete user documentation
- ✅ Training materials

### Week 4 Success Metrics

- App feels native on Samsung Tablet
- Printing works reliably
- Battery lasts 4+ hours of continuous use
- All features work offline
- Ready for production deployment

---

## Tech Stack Details

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14+ | React framework with App Router |
| **React** | 18+ | UI library |
| **TypeScript** | 5+ | Type safety |
| **Tailwind CSS** | 3+ | Styling |

### Critical APIs & Libraries

#### Week 1: Audio & Wake Lock
- **Screen Wake Lock API** (native browser API)
- **MediaDevices API** (audio device selection)
- **Web Speech API** (voice-to-text)
- **idb** (IndexedDB wrapper)

#### Week 2: Visualization
- **react-konva** - Touch-optimized canvas
- **konva** - HTML5 canvas library

#### Week 3: PDF Generation
- **@react-pdf/renderer** - Client-side PDF creation

#### Week 4: PWA
- **next-pwa** - PWA plugin for Next.js
- Service Worker API

---

## Single-Device Optimizations

### Command Center Setup

**Samsung Tablet Configuration:**
1. Chrome browser (latest version)
2. Stay awake while charging (Developer Options)
3. Disable notifications during recording
4. Airplane mode recommended (offline operation)

### Hollyland Microphone Setup

**USB Connection:**
1. USB-C adapter (if needed)
2. Auto-permission grant for microphone
3. Test audio levels before each session

**Bluetooth Connection:**
1. Pair mic in Android settings
2. Select in app's audio device picker
3. Verify latency (<100ms)

### Battery Optimization

**Power Management:**
- Screen brightness: 70% recommended
- Wake Lock only during recording
- Background app killing: disabled for PWA
- Expected battery life: 4-6 hours continuous use

---

## Success Criteria

### Overall MVP Success

- ✅ Tablet stays awake during 60+ minute sessions
- ✅ Hollyland wireless mic works seamlessly
- ✅ Voice transcription <1 second latency
- ✅ All data stored in IndexedDB (offline-first)
- ✅ Professional PDF generated in <5 seconds
- ✅ PDF prints correctly on portable printer
- ✅ App works completely offline
- ✅ Battery lasts 4+ hours of continuous use

### User Experience Goals

- **Setup Time:** <5 minutes (connect mic, start recording)
- **Recording Session:** 30-60 minutes hands-free
- **Diagram Creation:** <5 minutes
- **PDF Generation:** <5 seconds
- **Print Time:** <2 minutes

### Hardware Compatibility

- ✅ Samsung Galaxy Tab A7/A8/S8 (10.4" - 12.4")
- ✅ Android 10+
- ✅ Chrome 84+
- ✅ Hollyland Lark 150/M1/M2 wireless mics
- ✅ Portable Bluetooth/USB printers

---

## Implementation Checklist

### Pre-Development
- [ ] Acquire Samsung Android Tablet
- [ ] Purchase Hollyland wireless microphone set
- [ ] Install Chrome browser (latest)
- [ ] Enable developer options on tablet
- [ ] Configure portable printer

### Week 1: Audio Logic
- [ ] Screen Wake Lock API implementation
- [ ] Audio device enumeration
- [ ] Hollyland mic auto-detection
- [ ] Voice-to-text integration
- [ ] IndexedDB setup
- [ ] Auto-save functionality
- [ ] Test 30+ minute recording sessions

### Week 2: Visualization
- [ ] react-konva setup
- [ ] Touch-optimized canvas
- [ ] Diagram templates
- [ ] Export to base64/PNG
- [ ] Test on tablet with touch/stylus

### Week 3: PDF Generation
- [ ] @react-pdf/renderer setup
- [ ] 3-page PDF template
- [ ] Branding customization
- [ ] Download functionality
- [ ] Print integration
- [ ] Test with portable printer

### Week 4: Polish & Testing
- [ ] UI optimization for tablet
- [ ] Performance testing
- [ ] Battery life testing
- [ ] Offline mode verification
- [ ] Print quality testing
- [ ] User documentation
- [ ] Training materials

---

## Conclusion

This 4-week plan delivers a complete **Single-Device Surveying Solution** optimized for Samsung Tablets and Hollyland wireless microphones:

**Week 1:** Hands-free voice capture with external mic support and wake lock
**Week 2:** Touch-friendly diagrams for visual communication
**Week 3:** Professional PDF generation for on-site delivery
**Week 4:** Production-ready polish with print testing

**The Result:** A surveyor can complete an entire survey using just a tablet and wireless mic, with professional output ready to print on-site.

**Offline-First:** Everything works without internet using IndexedDB.

**Battery Conscious:** Wake Lock only active during recording for 4+ hours battery life.

**Hardware Optimized:** Built specifically for Samsung Tablets and Hollyland wireless mics.

---

**End of 4-Week Build Plan**

*Ready for implementation on Samsung Android Tablet with Hollyland wireless microphones.*
