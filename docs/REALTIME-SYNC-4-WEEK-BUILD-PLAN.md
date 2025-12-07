# Real-Time Sync Heating Surveyor App: 4-Week Rapid Build Plan

**Version:** 1.0  
**Date:** 2025-12-07  
**Status:** Implementation Ready  
**Architecture:** Two-Device Real-Time Sync System  
**Tech Stack:** Next.js + Supabase (or Firebase)

---

## Executive Summary

This document outlines a focused **4-week rapid build plan** for creating a **Real-Time Sync** system for the Heating Surveyor App. The workflow uses two devices that synchronize data instantly through the cloud:

- **Device A (Smartphone)**: The "Input Device" for voice and camera capture
- **Device B (Samsung Tablet)**: The "Presentation Station" for real-time display and PDF printing

### The Hardware Workflow

```
DEVICE A: SMARTPHONE (INPUT DEVICE)
┌──────────────────────────────────────────┐
│  📱 Smartphone (Roaming)                 │
│  • External Hollyland Mic (Voice Input)  │
│  • Camera for Photos                     │
│  • Instant Cloud Upload                  │
│  • Offline Queue (if signal lost)        │
└──────────────────────────────────────────┘
              ↓ ↑
        [CLOUD DATABASE]
        (Supabase/Firebase)
        • Real-time Sync
        • Image Storage Buckets
        • Offline Persistence
              ↓ ↑
DEVICE B: SAMSUNG TABLET (PRESENTATION)
┌──────────────────────────────────────────┐
│  🖥️ Samsung Tablet (Stationary)          │
│  • Sits on table                         │
│  • Listens to Cloud Database             │
│  • Real-time Updates (photos/diagrams)   │
│  • Connected to Portable Printer         │
└──────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Cloud Backend:** Supabase (PostgreSQL + Real-time + Storage) or Firebase (Firestore + Storage)
2. **Frontend:** Next.js 14+ with App Router
3. **Real-time Protocol:** WebSocket subscriptions via Supabase Realtime or Firebase Firestore listeners
4. **Offline Strategy:** Service Workers + IndexedDB queue on Phone + Automatic retry when connection returns
5. **Image Storage:** Supabase Storage Buckets or Firebase Cloud Storage with CDN URLs

---

## Table of Contents

1. [Week 1: Cloud Backend (Supabase Setup)](#week-1-cloud-backend-supabase-setup)
2. [Week 2: Input Interface (Phone View)](#week-2-input-interface-phone-view)
3. [Week 3: Presentation Interface (Tablet View)](#week-3-presentation-interface-tablet-view)
4. [Week 4: Output (PDF Generation & Printing)](#week-4-output-pdf-generation--printing)
5. [Tech Stack Details](#tech-stack-details)
6. [Offline Mode Strategy](#offline-mode-strategy)
7. [Success Criteria](#success-criteria)

---

## Week 1: Cloud Backend (Supabase Setup)

### Goal
Set up the cloud infrastructure with real-time database, storage buckets, and authentication.

---

### 1.1 Supabase Project Setup

**Step 1: Create Supabase Project**

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Note down:
   - Project URL: `https://[project-ref].supabase.co`
   - Anon/Public Key: `eyJ...`
   - Service Role Key: `eyJ...` (keep secret!)

**Step 2: Install Dependencies**

```bash
npm install @supabase/supabase-js idb
```

> **Note:** `idb` is a wrapper for IndexedDB, used for the offline queue system in Week 2.

**Step 3: Environment Variables**

Create `.env.local` in your Next.js project:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Service role key for server-side operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

### 1.2 Database Schema Design

**Core Tables:**

```sql
-- Survey Sessions
CREATE TABLE survey_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  surveyor_id UUID REFERENCES auth.users(id),
  customer_name TEXT NOT NULL,
  property_address TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress', -- in_progress, completed, archived
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Survey Items (Voice Recordings, Notes)
CREATE TABLE survey_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES survey_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  item_type TEXT NOT NULL, -- voice_note, text_note, measurement
  content TEXT,
  audio_url TEXT,
  transcription TEXT,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Photos
CREATE TABLE survey_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES survey_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  caption TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Diagrams (Generated Visual Plans)
CREATE TABLE survey_diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES survey_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  diagram_type TEXT NOT NULL, -- flue_plan, system_schematic, floor_plan
  svg_data TEXT,
  storage_path TEXT,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Create indexes for real-time queries
CREATE INDEX idx_survey_items_session ON survey_items(session_id, created_at DESC);
CREATE INDEX idx_survey_photos_session ON survey_photos(session_id, created_at DESC);
CREATE INDEX idx_survey_diagrams_session ON survey_diagrams(session_id);

-- Enable Row Level Security
ALTER TABLE survey_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_diagrams ENABLE ROW LEVEL SECURITY;

-- Policies: Allow authenticated users to access their own surveys
CREATE POLICY "Users can view own surveys" ON survey_sessions
  FOR SELECT USING (auth.uid() = surveyor_id);

CREATE POLICY "Users can insert own surveys" ON survey_sessions
  FOR INSERT WITH CHECK (auth.uid() = surveyor_id);

CREATE POLICY "Users can update own surveys" ON survey_sessions
  FOR UPDATE USING (auth.uid() = surveyor_id);

-- Apply similar policies to other tables
-- (Full policy definitions would be added here)

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE survey_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE survey_items;
ALTER PUBLICATION supabase_realtime ADD TABLE survey_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE survey_diagrams;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_survey_sessions_updated_at BEFORE UPDATE ON survey_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Run the migration:**

Execute this SQL in the Supabase Dashboard > SQL Editor.

---

### 1.3 Storage Buckets Setup

**Step 1: Create Storage Buckets**

In Supabase Dashboard > Storage:

1. Create bucket: `survey-photos` (Public)
2. Create bucket: `survey-audio` (Public or Private based on requirements)
3. Create bucket: `survey-pdfs` (Private)

**Step 2: Set Bucket Policies**

```sql
-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'survey-photos' AND
  -- Validate path format: sessionId/filename
  array_length(storage.foldername(name), 1) >= 1 AND
  -- Verify user owns the session (add session ownership check in production)
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Note: In production, add additional validation:
-- 1. Verify sessionId format (UUID)
-- 2. Check user owns the session via JOIN with survey_sessions table
-- 3. Limit file sizes and types

-- Allow public read access to photos
CREATE POLICY "Public can view photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'survey-photos');

-- Similar policies for other buckets
```

---

### 1.4 Supabase Client Configuration

**Create Supabase Client (Singleton)**

```typescript
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10, // Throttle real-time events
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

**Type Definitions**

```typescript
// lib/supabase/types.ts
export interface SurveySession {
  id: string;
  created_at: string;
  updated_at: string;
  surveyor_id: string;
  customer_name: string;
  property_address: string;
  status: 'in_progress' | 'completed' | 'archived';
  metadata: Record<string, any>;
}

export interface SurveyItem {
  id: string;
  session_id: string;
  created_at: string;
  item_type: 'voice_note' | 'text_note' | 'measurement';
  content?: string;
  audio_url?: string;
  transcription?: string;
  metadata: Record<string, any>;
}

export interface SurveyPhoto {
  id: string;
  session_id: string;
  created_at: string;
  uploaded_at?: string;
  storage_path: string;
  public_url?: string;
  caption?: string;
  tags?: string[];
  metadata: Record<string, any>;
}

export interface SurveyDiagram {
  id: string;
  session_id: string;
  created_at: string;
  diagram_type: 'flue_plan' | 'system_schematic' | 'floor_plan';
  svg_data?: string;
  storage_path?: string;
  metadata: Record<string, any>;
}
```

---

### 1.5 Real-Time Subscription Setup

**Create Real-time Hook**

```typescript
// hooks/useRealtimeSession.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { SurveySession, SurveyItem, SurveyPhoto } from '@/lib/supabase/types';

export function useRealtimeSession(sessionId: string) {
  const [session, setSession] = useState<SurveySession | null>(null);
  const [items, setItems] = useState<SurveyItem[]>([]);
  const [photos, setPhotos] = useState<SurveyPhoto[]>([]);

  useEffect(() => {
    // Initial fetch
    fetchSessionData();

    // Subscribe to real-time updates
    const sessionChannel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'survey_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setSession(payload.new as SurveySession);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'survey_items',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setItems((prev) => [...prev, payload.new as SurveyItem]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'survey_photos',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setPhotos((prev) => [...prev, payload.new as SurveyPhoto]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, [sessionId]);

  async function fetchSessionData() {
    const [sessionRes, itemsRes, photosRes] = await Promise.all([
      supabase.from('survey_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('survey_items').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
      supabase.from('survey_photos').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
    ]);

    if (sessionRes.data) setSession(sessionRes.data);
    if (itemsRes.data) setItems(itemsRes.data);
    if (photosRes.data) setPhotos(photosRes.data);
  }

  return { session, items, photos, refetch: fetchSessionData };
}
```

---

### Week 1 Deliverables

- ✅ Supabase project created and configured
- ✅ Database schema deployed with real-time enabled
- ✅ Storage buckets created with proper policies
- ✅ Supabase client configured in Next.js
- ✅ Real-time subscription hooks ready

**Testing:**

```bash
# Test database connection
npm run dev
# Navigate to http://localhost:3000/test-supabase
# Should see connection success message
```

---

## Week 2: Input Interface (Phone View)

### Goal
Build the smartphone interface for voice recording, camera capture, and instant cloud upload with offline fallback.

---

### 2.1 Voice Recording with External Mic

**Step 1: Audio Device Selection**

```typescript
// components/phone/AudioDeviceSelector.tsx
'use client';

import { useState, useEffect } from 'react';

export function AudioDeviceSelector({ onDeviceChange }: { onDeviceChange: (deviceId: string) => void }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  useEffect(() => {
    async function getDevices() {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = deviceList.filter((d) => d.kind === 'audioinput');
      setDevices(audioInputs);
      
      // Auto-select Hollyland if available (with multiple identifiers)
      const HOLLYLAND_IDENTIFIERS = ['hollyland', 'lark', 'wireless mic'];
      const hollyland = audioInputs.find((d) => 
        HOLLYLAND_IDENTIFIERS.some(id => d.label.toLowerCase().includes(id))
      );
      if (hollyland) {
        setSelectedDevice(hollyland.deviceId);
        onDeviceChange(hollyland.deviceId);
      }
    }

    getDevices();
  }, [onDeviceChange]);

  return (
    <div className="audio-device-selector">
      <label htmlFor="audio-input">Microphone:</label>
      <select
        id="audio-input"
        value={selectedDevice}
        onChange={(e) => {
          setSelectedDevice(e.target.value);
          onDeviceChange(e.target.value);
        }}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Microphone ${device.deviceId.substring(0, 8)}`}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Step 2: Voice Recording Component**

```typescript
// components/phone/VoiceRecorder.tsx
'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { offlineQueue } from '@/lib/offline-queue';

interface VoiceRecorderProps {
  sessionId: string;
  audioDeviceId?: string;
}

export function VoiceRecorder({ sessionId, audioDeviceId }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioDeviceId ? { deviceId: audioDeviceId } : true,
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await uploadRecording();
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function uploadRecording() {
    setIsUploading(true);
    
    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      chunksRef.current = [];

      const fileName = `${sessionId}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('survey-audio')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('survey-audio')
        .getPublicUrl(fileName);

      // Save to database
      await supabase.from('survey_items').insert({
        session_id: sessionId,
        item_type: 'voice_note',
        audio_url: urlData.publicUrl,
      });

      console.log('Recording uploaded successfully');
    } catch (error) {
      console.error('Failed to upload recording:', error);
      // Queue for offline retry (implemented in section 2.3)
      await offlineQueue.add({
        type: 'audio',
        sessionId,
        data: audioBlob,
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="voice-recorder">
      {!isRecording ? (
        <button onClick={startRecording} className="btn-record">
          🎤 Start Recording
        </button>
      ) : (
        <button onClick={stopRecording} className="btn-stop">
          ⏹️ Stop Recording
        </button>
      )}
      {isUploading && <p>Uploading...</p>}
    </div>
  );
}
```

---

### 2.2 Camera Capture and Upload

**Camera Component**

```typescript
// components/phone/CameraCapture.tsx
'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { offlineQueue } from '@/lib/offline-queue';

interface CameraCaptureProps {
  sessionId: string;
}

export function CameraCapture({ sessionId }: CameraCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCapture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);
    setPreview(URL.createObjectURL(file));

    await uploadPhoto(file);
    setIsCapturing(false);
  }

  async function uploadPhoto(file: File) {
    setIsUploading(true);

    try {
      const fileName = `${sessionId}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('survey-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('survey-photos')
        .getPublicUrl(fileName);

      // Save to database
      await supabase.from('survey_photos').insert({
        session_id: sessionId,
        storage_path: fileName,
        public_url: urlData.publicUrl,
        uploaded_at: new Date().toISOString(),
      });

      console.log('Photo uploaded successfully');
      setPreview(null);
    } catch (error) {
      console.error('Failed to upload photo:', error);
      // Queue for offline retry (implemented in section 2.3)
      await offlineQueue.add({
        type: 'photo',
        sessionId,
        data: file,
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="camera-capture">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        style={{ display: 'none' }}
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isCapturing || isUploading}
        className="btn-camera"
      >
        📷 Take Photo
      </button>

      {isUploading && <p>Uploading photo...</p>}
      {preview && (
        <div className="preview">
          <img src={preview} alt="Preview" />
        </div>
      )}
    </div>
  );
}
```

---

### 2.3 Offline Mode with Queue System

**Offline Queue Service**

```typescript
// lib/offline-queue.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface QueueItem {
  id: string;
  type: 'photo' | 'audio' | 'data';
  sessionId: string;
  data: Blob | object;
  timestamp: number;
  retryCount: number;
}

interface OfflineQueueDB extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: { 'by-session': string };
  };
}

class OfflineQueue {
  private db: IDBPDatabase<OfflineQueueDB> | null = null;

  async init() {
    this.db = await openDB<OfflineQueueDB>('offline-queue', 1, {
      upgrade(db) {
        const store = db.createObjectStore('queue', { keyPath: 'id' });
        store.createIndex('by-session', 'sessionId');
      },
    });
  }

  async add(item: Omit<QueueItem, 'id' | 'timestamp' | 'retryCount'>) {
    if (!this.db) await this.init();
    
    const queueItem: QueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    await this.db!.add('queue', queueItem);
    return queueItem.id;
  }

  async getAll(): Promise<QueueItem[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('queue');
  }

  async remove(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('queue', id);
  }

  async incrementRetry(id: string) {
    if (!this.db) await this.init();
    const item = await this.db!.get('queue', id);
    if (item) {
      item.retryCount++;
      await this.db!.put('queue', item);
    }
  }
}

export const offlineQueue = new OfflineQueue();
```

**Offline Upload Service**

```typescript
// lib/offline-upload.ts
import { supabase } from './supabase/client';
import { offlineQueue } from './offline-queue';

// Configuration
const MAX_RETRY_ATTEMPTS = 5; // Configurable retry limit
const RETRY_DELAY_MS = 2000; // Delay between retries

export async function processOfflineQueue() {
  const items = await offlineQueue.getAll();
  
  for (const item of items) {
    try {
      if (item.type === 'photo') {
        await uploadQueuedPhoto(item);
      } else if (item.type === 'audio') {
        await uploadQueuedAudio(item);
      }
      
      await offlineQueue.remove(item.id);
    } catch (error) {
      console.error(`Failed to upload queued item ${item.id}:`, error);
      await offlineQueue.incrementRetry(item.id);
      
      // Remove after max retry attempts
      if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
        console.warn(`Removing item ${item.id} after ${MAX_RETRY_ATTEMPTS} failed attempts`);
        await offlineQueue.remove(item.id);
      }
    }
  }
}

async function uploadQueuedPhoto(item: any) {
  const fileName = `${item.sessionId}/${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from('survey-photos')
    .upload(fileName, item.data);
  
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('survey-photos')
    .getPublicUrl(fileName);

  await supabase.from('survey_photos').insert({
    session_id: item.sessionId,
    storage_path: fileName,
    public_url: urlData.publicUrl,
    uploaded_at: new Date().toISOString(),
  });
}

async function uploadQueuedAudio(item: any) {
  const fileName = `${item.sessionId}/${Date.now()}.webm`;
  const { data, error } = await supabase.storage
    .from('survey-audio')
    .upload(fileName, item.data);
  
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('survey-audio')
    .getPublicUrl(fileName);

  await supabase.from('survey_items').insert({
    session_id: item.sessionId,
    item_type: 'voice_note',
    audio_url: urlData.publicUrl,
  });
}

// Monitor connection and process queue
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Connection restored. Processing offline queue...');
    processOfflineQueue();
  });
}
```

---

### 2.4 Phone Interface Page

**Main Phone View**

```typescript
// app/phone/[sessionId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { VoiceRecorder } from '@/components/phone/VoiceRecorder';
import { CameraCapture } from '@/components/phone/CameraCapture';
import { AudioDeviceSelector } from '@/components/phone/AudioDeviceSelector';
import { processOfflineQueue } from '@/lib/offline-upload';

export default function PhonePage({ params }: { params: { sessionId: string } }) {
  const [audioDeviceId, setAudioDeviceId] = useState<string>();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      processOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="phone-interface">
      <header>
        <h1>Survey Input</h1>
        {!isOnline && (
          <div className="offline-banner">
            ⚠️ Offline Mode - Data will sync when connection returns
          </div>
        )}
      </header>

      <main>
        <section>
          <h2>Audio Setup</h2>
          <AudioDeviceSelector onDeviceChange={setAudioDeviceId} />
        </section>

        <section>
          <h2>Voice Recording</h2>
          <VoiceRecorder 
            sessionId={params.sessionId} 
            audioDeviceId={audioDeviceId} 
          />
        </section>

        <section>
          <h2>Photo Capture</h2>
          <CameraCapture sessionId={params.sessionId} />
        </section>
      </main>
    </div>
  );
}
```

---

### Week 2 Deliverables

- ✅ Voice recording with external mic selection
- ✅ Camera capture and instant upload
- ✅ Offline queue system with IndexedDB
- ✅ Automatic retry on connection restore
- ✅ Phone interface with online/offline status

**Testing:**

```bash
# Test voice recording
# 1. Open phone view
# 2. Select Hollyland mic
# 3. Record audio
# 4. Verify upload to Supabase Storage

# Test offline mode
# 1. Disable network in DevTools
# 2. Capture photo/audio
# 3. Re-enable network
# 4. Verify automatic upload
```

---

## Week 3: Presentation Interface (Tablet View)

### Goal
Build the tablet interface that listens to the cloud database and displays real-time updates with diagrams and photos.

---

### 3.1 Real-Time Tablet Dashboard

**Tablet Page Component**

```typescript
// app/tablet/[sessionId]/page.tsx
'use client';

import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { PhotoGallery } from '@/components/tablet/PhotoGallery';
import { DiagramDisplay } from '@/components/tablet/DiagramDisplay';
import { VoiceNotesList } from '@/components/tablet/VoiceNotesList';

export default function TabletPage({ params }: { params: { sessionId: string } }) {
  const { session, items, photos } = useRealtimeSession(params.sessionId);

  if (!session) {
    return <div className="loading">Loading session...</div>;
  }

  return (
    <div className="tablet-interface">
      <header className="tablet-header">
        <h1>{session.customer_name}</h1>
        <p>{session.property_address}</p>
      </header>

      <div className="tablet-grid">
        <section className="photos-section">
          <h2>Photos ({photos.length})</h2>
          <PhotoGallery photos={photos} />
        </section>

        <section className="diagrams-section">
          <h2>Diagrams</h2>
          <DiagramDisplay sessionId={params.sessionId} />
        </section>

        <section className="notes-section">
          <h2>Voice Notes ({items.length})</h2>
          <VoiceNotesList items={items} />
        </section>
      </div>
    </div>
  );
}
```

---

### 3.2 Photo Gallery with Real-Time Updates

**Photo Gallery Component**

```typescript
// components/tablet/PhotoGallery.tsx
'use client';

import { SurveyPhoto } from '@/lib/supabase/types';
import Image from 'next/image';

interface PhotoGalleryProps {
  photos: SurveyPhoto[];
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  if (photos.length === 0) {
    return <div className="empty-state">No photos yet...</div>;
  }

  return (
    <div className="photo-gallery">
      {photos.map((photo) => (
        <div key={photo.id} className="photo-item">
          {photo.public_url && (
            <Image
              src={photo.public_url}
              alt={photo.caption || 'Survey photo'}
              width={300}
              height={200}
              className="photo-img"
            />
          )}
          {photo.caption && <p className="photo-caption">{photo.caption}</p>}
          <span className="photo-time">
            {new Date(photo.created_at).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

### 3.3 Diagram Generation Service

**Diagram Generator (Simple SVG Example)**

```typescript
// lib/diagram-generator.ts
export function generateFloorPlan(sessionId: string): string {
  // This is a simplified example
  // In production, use data from survey items to generate diagram
  
  return `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#f5f5f5" stroke="#333" stroke-width="2"/>
      <text x="200" y="30" text-anchor="middle" font-size="16" fill="#333">
        Floor Plan
      </text>
      <rect x="50" y="50" width="120" height="80" fill="white" stroke="#666"/>
      <text x="110" y="95" text-anchor="middle" font-size="12">Boiler Room</text>
      <rect x="230" y="50" width="120" height="80" fill="white" stroke="#666"/>
      <text x="290" y="95" text-anchor="middle" font-size="12">Kitchen</text>
    </svg>
  `;
}
```

**Diagram Display Component**

```typescript
// components/tablet/DiagramDisplay.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { SurveyDiagram } from '@/lib/supabase/types';

interface DiagramDisplayProps {
  sessionId: string;
}

/**
 * Sanitize SVG content to prevent XSS attacks
 * In production, use a library like DOMPurify for robust sanitization
 */
function sanitizeSVG(svg: string): string {
  // Basic sanitization - remove script tags and event handlers
  return svg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

export function DiagramDisplay({ sessionId }: DiagramDisplayProps) {
  const [diagrams, setDiagrams] = useState<SurveyDiagram[]>([]);

  useEffect(() => {
    fetchDiagrams();

    // Subscribe to diagram updates
    const channel = supabase
      .channel(`diagrams:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'survey_diagrams',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setDiagrams((prev) => [...prev, payload.new as SurveyDiagram]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  async function fetchDiagrams() {
    const { data } = await supabase
      .from('survey_diagrams')
      .select('*')
      .eq('session_id', sessionId);

    if (data) setDiagrams(data);
  }

  if (diagrams.length === 0) {
    return <div className="empty-state">No diagrams generated yet...</div>;
  }

  return (
    <div className="diagrams-grid">
      {diagrams.map((diagram) => (
        <div key={diagram.id} className="diagram-item">
          <h3>{diagram.diagram_type.replace('_', ' ')}</h3>
          {diagram.svg_data && (
            <div dangerouslySetInnerHTML={{ __html: sanitizeSVG(diagram.svg_data) }} />
          )}
          {/* Production recommendation: Use DOMPurify for better sanitization
              npm install dompurify @types/dompurify
              import DOMPurify from 'dompurify';
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(diagram.svg_data) }}
          */}
        </div>
      ))}
    </div>
  );
}
```

---

### 3.4 Portable Printer Integration

**Print Service**

```typescript
// lib/print-service.ts
export async function printPDF(pdfUrl: string) {
  // Open print dialog
  const printWindow = window.open(pdfUrl, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

// Alternative: Use Web Print API (if supported)
export async function printWithWebPrint(pdfBlob: Blob) {
  if ('print' in window) {
    const blobUrl = URL.createObjectURL(pdfBlob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    
    iframe.onload = () => {
      const contentWindow = iframe.contentWindow;
      if (contentWindow) {
        contentWindow.print();
        
        // Use afterprint event for reliable cleanup
        contentWindow.addEventListener('afterprint', () => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        });
        
        // Fallback timeout in case afterprint doesn't fire (e.g., user cancels)
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          }
        }, 5000);
      }
    };
    };
  }
}
```

---

### Week 3 Deliverables

- ✅ Tablet dashboard with real-time updates
- ✅ Photo gallery with instant sync
- ✅ Diagram display component
- ✅ Voice notes list
- ✅ Printer integration ready

**Testing:**

```bash
# Test real-time sync
# 1. Open phone view in one browser
# 2. Open tablet view in another browser
# 3. Capture photo on phone
# 4. Verify it appears on tablet within 1 second
```

---

## Week 4: Output (PDF Generation & Printing)

### Goal
Generate professional PDFs from survey data and enable printing on portable printers.

---

### 4.1 PDF Generation with @react-pdf/renderer

**Install Dependencies**

```bash
npm install @react-pdf/renderer
```

**PDF Template Component**

```typescript
// components/pdf/SurveyPDF.tsx
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { SurveySession, SurveyPhoto } from '@/lib/supabase/types';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photo: {
    width: '48%',
    marginBottom: 10,
  },
  photoImage: {
    width: '100%',
    height: 150,
    objectFit: 'cover',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 9,
    color: '#666',
  },
});

interface SurveyPDFProps {
  session: SurveySession;
  photos: SurveyPhoto[];
}

export function SurveyPDF({ session, photos }: SurveyPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Heating Survey Report</Text>
          <Text>{session.customer_name}</Text>
          <Text>{session.property_address}</Text>
          <Text>Date: {new Date(session.created_at).toLocaleDateString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Photos</Text>
          <View style={styles.photoGrid}>
            {photos.slice(0, 4).map((photo) => (
              <View key={photo.id} style={styles.photo}>
                {photo.public_url && (
                  <Image src={photo.public_url} style={styles.photoImage} />
                )}
                {photo.caption && <Text>{photo.caption}</Text>}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Generated by Hail-Mary Heating Surveyor App</Text>
        </View>
      </Page>
    </Document>
  );
}
```

---

### 4.2 PDF Generation API Route

**Server Action for PDF Generation**

```typescript
// app/api/generate-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { supabase } from '@/lib/supabase/client';
import { SurveyPDF } from '@/components/pdf/SurveyPDF';

export async function POST(request: NextRequest) {
  const { sessionId } = await request.json();

  // Fetch session data
  const [sessionRes, photosRes] = await Promise.all([
    supabase.from('survey_sessions').select('*').eq('id', sessionId).single(),
    supabase.from('survey_photos').select('*').eq('session_id', sessionId),
  ]);

  if (!sessionRes.data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Generate PDF
  const pdfBuffer = await renderToBuffer(
    <SurveyPDF session={sessionRes.data} photos={photosRes.data || []} />
  );

  // Upload to Supabase Storage
  const fileName = `${sessionId}/report-${Date.now()}.pdf`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('survey-pdfs')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from('survey-pdfs')
    .getPublicUrl(fileName);

  return NextResponse.json({
    success: true,
    pdfUrl: urlData.publicUrl,
  });
}
```

---

### 4.3 PDF Preview and Print Component

**PDF Preview Component**

```typescript
// components/tablet/PDFPreview.tsx
'use client';

import { useState } from 'react';
import { printPDF } from '@/lib/print-service';

interface PDFPreviewProps {
  sessionId: string;
}

export function PDFPreview({ sessionId }: PDFPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function generatePDF() {
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();
      if (data.success) {
        setPdfUrl(data.pdfUrl);
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePrint() {
    if (pdfUrl) {
      await printPDF(pdfUrl);
    }
  }

  return (
    <div className="pdf-preview">
      {!pdfUrl ? (
        <button
          onClick={generatePDF}
          disabled={isGenerating}
          className="btn-generate"
        >
          {isGenerating ? 'Generating PDF...' : '📄 Generate PDF'}
        </button>
      ) : (
        <div className="pdf-actions">
          <iframe src={pdfUrl} className="pdf-iframe" />
          <button onClick={handlePrint} className="btn-print">
            🖨️ Print PDF
          </button>
          <a href={pdfUrl} download className="btn-download">
            ⬇️ Download PDF
          </a>
        </div>
      )}
    </div>
  );
}
```

---

### 4.4 Complete Tablet View with PDF

**Updated Tablet Page**

```typescript
// app/tablet/[sessionId]/page.tsx
'use client';

import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { PhotoGallery } from '@/components/tablet/PhotoGallery';
import { DiagramDisplay } from '@/components/tablet/DiagramDisplay';
import { VoiceNotesList } from '@/components/tablet/VoiceNotesList';
import { PDFPreview } from '@/components/tablet/PDFPreview';

export default function TabletPage({ params }: { params: { sessionId: string } }) {
  const { session, items, photos } = useRealtimeSession(params.sessionId);

  if (!session) {
    return <div className="loading">Loading session...</div>;
  }

  return (
    <div className="tablet-interface">
      <header className="tablet-header">
        <h1>{session.customer_name}</h1>
        <p>{session.property_address}</p>
        <span className="status">{session.status}</span>
      </header>

      <div className="tablet-grid">
        <section className="photos-section">
          <h2>Photos ({photos.length})</h2>
          <PhotoGallery photos={photos} />
        </section>

        <section className="diagrams-section">
          <h2>Diagrams</h2>
          <DiagramDisplay sessionId={params.sessionId} />
        </section>

        <section className="notes-section">
          <h2>Voice Notes ({items.length})</h2>
          <VoiceNotesList items={items} />
        </section>

        <section className="pdf-section">
          <h2>PDF Report</h2>
          <PDFPreview sessionId={params.sessionId} />
        </section>
      </div>
    </div>
  );
}
```

---

### Week 4 Deliverables

- ✅ PDF generation with @react-pdf/renderer
- ✅ PDF upload to Supabase Storage
- ✅ PDF preview component
- ✅ Print integration for portable printers
- ✅ Complete end-to-end workflow

**Testing:**

```bash
# Test PDF generation
# 1. Complete a survey on phone
# 2. Open tablet view
# 3. Click "Generate PDF"
# 4. Verify PDF preview shows
# 5. Click "Print" and check portable printer

# Test offline recovery
# 1. Disable network during survey
# 2. Capture 3 photos
# 3. Re-enable network
# 4. Verify all 3 photos upload and appear on tablet
```

---

## Tech Stack Details

### Frontend

| Technology | Purpose |
|------------|---------|
| **Next.js 14+** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **@supabase/supabase-js** | Real-time database client |
| **@react-pdf/renderer** | PDF generation |
| **idb** | IndexedDB wrapper for offline queue |

### Backend (Supabase)

| Service | Purpose |
|---------|---------|
| **PostgreSQL** | Relational database |
| **Realtime** | WebSocket subscriptions |
| **Storage** | Image and PDF storage |
| **Auth** | User authentication (optional) |

### Alternative: Firebase

If using Firebase instead of Supabase:

```typescript
// Firebase equivalents:
// - Database: Firestore
// - Storage: Firebase Storage
// - Real-time: Firestore onSnapshot()

import { initializeApp } from 'firebase/app';
import { getFirestore, onSnapshot, collection } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Similar patterns apply with Firebase SDK
```

---

## Offline Mode Strategy

### Offline Detection

```typescript
// hooks/useOnlineStatus.ts
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### Offline Queue Processing Strategy

1. **When offline detected:**
   - All uploads queue to IndexedDB
   - UI shows "Queued for upload" indicator

2. **When online detected:**
   - Trigger `processOfflineQueue()`
   - Upload items in order with retry logic
   - Remove from queue on success

3. **Signal loss in loft scenario:**
   - Phone queues all captures
   - When surveyor returns to ground floor (signal restored)
   - Automatic background upload begins
   - Tablet receives real-time updates as items upload

---

## Success Criteria

### Performance Metrics

- ✅ **Photo upload time:** < 3 seconds (on 4G)
- ✅ **Real-time sync latency:** < 1 second
- ✅ **Offline recovery time:** < 10 seconds (for 10 queued items)
- ✅ **PDF generation time:** < 5 seconds

### User Experience

- ✅ Surveyor can capture photos in loft without signal
- ✅ Tablet updates automatically when phone regains signal
- ✅ Professional PDF ready to print in < 1 minute
- ✅ No data loss during offline periods

### Technical Requirements

- ✅ TypeScript strict mode enabled
- ✅ Error handling for all async operations
- ✅ Responsive design for phone and tablet
- ✅ Accessibility (WCAG 2.1 AA)

---

## Deployment Checklist

### Environment Setup

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Build & Deploy

```bash
# Build for production
npm run build

# Deploy to Vercel (recommended for Next.js)
vercel deploy

# Or deploy to your platform of choice
```

### Post-Deployment Verification

1. ✅ Test phone view on actual smartphone
2. ✅ Test tablet view on actual Samsung tablet
3. ✅ Connect Hollyland mic and verify audio selection
4. ✅ Test portable printer connection
5. ✅ Verify offline mode in real loft scenario
6. ✅ Load test with 50+ photos

---

## Maintenance & Monitoring

### Monitoring

```typescript
// Add error tracking (e.g., Sentry)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

### Backup Strategy

- Supabase automatic backups (daily)
- Manual export via Supabase Dashboard
- Client-side export feature (optional)

---

## Appendix: Alternative Architectures

### Option 1: Firebase Instead of Supabase

**Pros:**
- Excellent offline support (built-in)
- Auto-sync when online
- Simpler setup for beginners

**Cons:**
- Less SQL flexibility
- Pricing can scale higher

### Option 2: Local-First with Sync

**Tech:** [Electric SQL](https://electric-sql.com/) or [PowerSync](https://www.powersync.com/)

**Pros:**
- True local-first architecture
- Instant UI updates
- Better offline support

**Cons:**
- More complex setup
- Newer technology

---

## Conclusion

This 4-week plan delivers a complete **Real-Time Sync** system for heating surveyors with:

1. **Week 1:** Cloud infrastructure (Supabase/Firebase)
2. **Week 2:** Phone input with offline resilience
3. **Week 3:** Tablet presentation with real-time sync
4. **Week 4:** Professional PDF output with printing

**Key Features:**
- ✅ Two-device workflow (Phone + Tablet)
- ✅ Real-time synchronization (< 1 second latency)
- ✅ Offline mode with automatic recovery
- ✅ Professional PDF generation
- ✅ Portable printer support

**Next Steps:**
1. Set up Supabase project
2. Follow week-by-week implementation
3. Test thoroughly with actual hardware
4. Deploy to production

**Status:** Ready for implementation 🚀

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-07  
**Author:** Hail-Mary Development Team
