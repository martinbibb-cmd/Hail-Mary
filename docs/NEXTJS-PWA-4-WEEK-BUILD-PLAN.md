# Next.js PWA for Heating Surveyors: 4-Week Rapid Build Plan

**Version:** 2.0  
**Date:** 2025-12-07  
**Status:** Implementation Ready  
**Target Platform:** Next.js Progressive Web App (PWA)

---

## Executive Summary

This document outlines a focused **4-week rapid build plan** for creating a **Sales Enablement Pack** (physical + digital) for heating surveyors. The goal is to transform on-site surveys into professional visual presentations that help win contracts.

### The Core Workflow

```
1. SURVEYOR INPUT (Voice-to-Text)
   ↓
   Captures: Flue runs, boiler location, materials, labour hours
   
2. THE ENGINE (Processing)
   ↓
   Converts to structured JSON + generates visual diagrams
   
3. OUTPUT A (Print - Physical)
   ↓
   Professional A4 PDF brochure (portable printer ready)
   
4. OUTPUT B (Digital)
   ↓
   Unique customer microsite link (view on phone)
```

### Key Constraints

- **Framework:** Next.js (React)
- **PDF Engine:** `@react-pdf/renderer` (client-side, privacy-first)
- **Data Storage:** Local state + localStorage (offline-first)
- **Future-Proof:** JSON structure ready for pricing field additions

---

## Table of Contents

1. [Week 1: Voice Logic & Data Structure](#week-1-voice-logic--data-structure)
2. [Week 2: The Visualization Layer](#week-2-the-visualization-layer)
3. [Week 3: The PDF Generator](#week-3-the-pdf-generator)
4. [Week 4: The Customer Microsite](#week-4-the-customer-microsite)
5. [Tech Stack Details](#tech-stack-details)
6. [Success Criteria](#success-criteria)

---

## Week 1: Voice Logic & Data Structure

### Goal
Build the foundation for voice-driven data capture with a robust, extensible JSON structure.

### Core Features

#### 1.1 Voice-to-Text Integration

**Libraries:**
- `react-speech-recognition` (wrapper around Web Speech API)
- `regenerator-runtime` (for async/await polyfill)

**Implementation:**
```typescript
// /app/hooks/useVoiceCapture.ts
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

interface VoiceCapture {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceCapture(): VoiceCapture {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  if (!browserSupportsSpeechRecognition) {
    throw new Error('Browser does not support speech recognition');
  }

  const startListening = () => {
    SpeechRecognition.startListening({ 
      continuous: true, 
      language: 'en-GB' 
    });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  return {
    transcript,
    isListening: listening,
    startListening,
    stopListening,
    resetTranscript
  };
}
```

**Tasks:**
- [ ] Install `react-speech-recognition` and dependencies
- [ ] Create voice capture hook with start/stop/pause
- [ ] Build UI component with push-to-talk button
- [ ] Add live transcription display
- [ ] Implement browser compatibility checks
- [ ] Add microphone permission handling

**Acceptance Criteria:**
- ✅ Voice recording starts/stops with single button press
- ✅ Live transcript appears with <1 second delay
- ✅ Works in Chrome, Safari, Edge (latest versions)
- ✅ Graceful fallback if browser doesn't support voice

---

#### 1.2 Data Structure Design (Future-Proof for Pricing)

**Core Principle:** Structure data so adding a `price` field later requires minimal changes.

**JSON Schema:**
```typescript
// /types/survey-data.ts

export interface SurveyData {
  id: string;
  createdAt: string;
  updatedAt: string;
  
  // Customer Info
  customer: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
  
  // Survey Details
  property: {
    type: 'house' | 'flat' | 'bungalow' | 'commercial';
    bedrooms?: number;
    floors?: number;
    notes?: string;
  };
  
  // Boiler Details
  boiler: {
    location: string;
    currentModel?: string;
    currentAge?: number;
    proposedModel?: string;
    // FUTURE: price?: number;
    // FUTURE: installationCost?: number;
    specifications?: string;
    notes?: string;
  };
  
  // Flue Details
  flue: {
    type: 'horizontal' | 'vertical' | 'plume-management';
    runLength?: number; // in meters
    exitPoint: string;
    clearances: {
      fromWindow?: number; // mm
      fromDoor?: number;   // mm
      fromGround?: number; // mm
    };
    materials: string[];
    // FUTURE: materialsCost?: number;
    notes?: string;
  };
  
  // Radiators
  radiators: Array<{
    id: string;
    room: string;
    size: string; // e.g., "600x800"
    type: 'single' | 'double' | 'k1' | 'k2' | 'k3';
    // FUTURE: price?: number;
    notes?: string;
  }>;
  
  // Labour
  labour: {
    estimatedHours?: number;
    // FUTURE: hourlyRate?: number;
    // FUTURE: totalLabourCost?: number;
    complexity: 'simple' | 'medium' | 'complex';
    notes?: string;
  };
  
  // Materials List
  materials: Array<{
    id: string;
    item: string;
    quantity: number;
    unit: string;
    category: 'pipework' | 'fittings' | 'controls' | 'other';
    // FUTURE: unitPrice?: number;
    // FUTURE: totalPrice?: number;
    notes?: string;
  }>;
  
  // Voice Transcripts (for reference)
  voiceNotes: Array<{
    id: string;
    timestamp: string;
    text: string;
    category?: 'boiler' | 'flue' | 'radiators' | 'materials' | 'general';
  }>;
  
  // FUTURE EXPANSION:
  // quote?: {
  //   subtotal: number;
  //   tax: number;
  //   discount?: number;
  //   total: number;
  //   validUntil: string;
  // };
}
```

**Why This Structure Works:**
- All items have optional `price` fields commented out
- When adding pricing, just uncomment and add values
- No structural changes needed - just field additions
- Maintains backwards compatibility

**Tasks:**
- [ ] Create TypeScript interfaces for all data types
- [ ] Build data validation schemas (using Zod)
- [ ] Implement localStorage persistence layer
- [ ] Add JSON import/export utilities
- [ ] Create sample/seed data for testing

**Acceptance Criteria:**
- ✅ All data persists to localStorage automatically
- ✅ Data survives browser refresh
- ✅ Can export survey as JSON file
- ✅ Can import previously exported surveys


---

#### 1.3 Intelligent Data Extraction from Voice

**Library:**
- Custom regex patterns + keyword matching
- Future: OpenAI API for advanced extraction (optional)

**Implementation:**
```typescript
// /utils/voice-parser.ts

interface ExtractedData {
  boilerModel?: string;
  flueLength?: number;
  materials?: string[];
  rooms?: string[];
}

export function extractDataFromTranscript(transcript: string): ExtractedData {
  const data: ExtractedData = {};
  
  // Extract boiler model
  // "Worcester Bosch Greenstar 30CDi"
  const boilerMatch = transcript.match(
    /(?:worcester|vaillant|ideal|baxi|viessmann)\s+(?:bosch\s+)?[\w\s-]+/i
  );
  if (boilerMatch) {
    data.boilerModel = boilerMatch[0];
  }
  
  // Extract flue run length
  // "flue run of 3 meters" or "3 metre flue"
  const flueMatch = transcript.match(
    /(\d+(?:\.\d+)?)\s*(?:meter|metre|m)\s*(?:flue|run)/i
  );
  if (flueMatch) {
    data.flueLength = parseFloat(flueMatch[1]);
  }
  
  // Extract materials
  const materials = [];
  if (/copper pipe/i.test(transcript)) materials.push('copper pipe');
  if (/pvc conduit/i.test(transcript)) materials.push('PVC conduit');
  if (/magnetic filter/i.test(transcript)) materials.push('magnetic filter');
  data.materials = materials;
  
  // Extract rooms mentioned
  const roomPattern = /(kitchen|bathroom|bedroom|living room|dining room|hall|utility)/gi;
  const rooms = transcript.match(roomPattern);
  if (rooms) {
    data.rooms = [...new Set(rooms.map(r => r.toLowerCase()))];
  }
  
  return data;
}
```

**Tasks:**
- [ ] Build pattern matching library for common terms
- [ ] Create entity extraction functions (boiler, flue, materials)
- [ ] Implement auto-population of form fields from voice
- [ ] Add confidence scoring for extractions
- [ ] Allow manual override/correction

**Acceptance Criteria:**
- ✅ 80%+ accuracy for boiler model extraction
- ✅ Measurements (meters, mm) extracted correctly
- ✅ Common materials recognized and added to list
- ✅ User can review and correct auto-populated data

---

#### 1.4 State Management

**Library:**
- `zustand` (lightweight, simple state management)

**Implementation:**
```typescript
// /store/survey-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SurveyStore {
  currentSurvey: SurveyData | null;
  surveys: SurveyData[];
  
  // Actions
  createSurvey: (customer: CustomerInfo) => void;
  updateSurvey: (updates: Partial<SurveyData>) => void;
  saveSurvey: () => void;
  loadSurvey: (id: string) => void;
  deleteSurvey: (id: string) => void;
  exportSurvey: (id: string) => string; // JSON string
  importSurvey: (json: string) => void;
}

export const useSurveyStore = create<SurveyStore>()(
  persist(
    (set, get) => ({
      currentSurvey: null,
      surveys: [],
      
      createSurvey: (customer) => {
        const newSurvey: SurveyData = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customer,
          property: { type: 'house' },
          boiler: { location: '' },
          flue: { type: 'horizontal', exitPoint: '', clearances: {}, materials: [] },
          radiators: [],
          labour: { complexity: 'medium' },
          materials: [],
          voiceNotes: [],
        };
        set({ currentSurvey: newSurvey });
      },
      
      updateSurvey: (updates) => {
        set((state) => ({
          currentSurvey: state.currentSurvey 
            ? { ...state.currentSurvey, ...updates, updatedAt: new Date().toISOString() }
            : null
        }));
      },
      
      saveSurvey: () => {
        const { currentSurvey, surveys } = get();
        if (!currentSurvey) return;
        
        const index = surveys.findIndex(s => s.id === currentSurvey.id);
        const updatedSurveys = index >= 0
          ? surveys.map(s => s.id === currentSurvey.id ? currentSurvey : s)
          : [...surveys, currentSurvey];
          
        set({ surveys: updatedSurveys });
      },
      
      loadSurvey: (id) => {
        const survey = get().surveys.find(s => s.id === id);
        if (survey) set({ currentSurvey: survey });
      },
      
      deleteSurvey: (id) => {
        set((state) => ({
          surveys: state.surveys.filter(s => s.id !== id),
          currentSurvey: state.currentSurvey?.id === id ? null : state.currentSurvey
        }));
      },
      
      exportSurvey: (id) => {
        const survey = get().surveys.find(s => s.id === id);
        return survey ? JSON.stringify(survey, null, 2) : '';
      },
      
      importSurvey: (json) => {
        try {
          const survey = JSON.parse(json) as SurveyData;
          set((state) => ({ surveys: [...state.surveys, survey] }));
        } catch (error) {
          console.error('Failed to import survey:', error);
        }
      },
    }),
    {
      name: 'survey-storage',
    }
  )
);
```

**Tasks:**
- [ ] Set up Zustand store with persistence
- [ ] Implement CRUD operations for surveys
- [ ] Add auto-save functionality (every 30s)
- [ ] Create hooks for accessing store data
- [ ] Build debugging tools (view/clear localStorage)

**Acceptance Criteria:**
- ✅ Data persists across browser sessions
- ✅ Auto-save works without user intervention
- ✅ Can manage multiple surveys simultaneously
- ✅ Export/import works reliably

---

### Week 1 Deliverables
- ✅ Voice-to-text capture working in browser
- ✅ Robust JSON data structure (future-proof for pricing)
- ✅ Intelligent extraction of key details from voice
- ✅ State management with localStorage persistence
- ✅ Basic survey creation and editing UI

### Week 1 Success Metrics
- Surveyor can create survey and speak details for 5 minutes
- All spoken data captured and structured in JSON
- Data persists after browser refresh
- Can export survey as JSON file


---

## Week 2: The Visualization Layer

### Goal
Transform structured data into professional visual diagrams showing boiler placement, flue routing, and system layout.

### Core Features

#### 2.1 Property Floor Plan Sketch Tool

**Library:**
- `react-konva` (canvas drawing library for React)
- `konva` (HTML5 canvas library)

**Installation:**
```bash
npm install react-konva konva
```

**Tasks:**
- [ ] Install react-konva and dependencies
- [ ] Build canvas component with drawing tools
- [ ] Add drag-and-drop for boiler, radiators, flue
- [ ] Implement zoom and pan controls
- [ ] Add measurement tools (distance, area)
- [ ] Create icon library (boiler, radiator symbols)
- [ ] Add undo/redo functionality
- [ ] Export canvas as PNG/SVG

**Acceptance Criteria:**
- ✅ Can draw simple floor plan in <5 minutes
- ✅ Boiler and radiator icons draggable
- ✅ Measurements displayed accurately
- ✅ Export diagram as high-res PNG

---

#### 2.2 Flue Route Diagram Generator

**Library:**
- `react-konva` (same as above)
- Custom path drawing logic

**Tasks:**
- [ ] Build flue path drawing component
- [ ] Auto-calculate route from survey data
- [ ] Add clearance indicators (windows, doors)
- [ ] Show measurements on diagram
- [ ] Color-code compliance (green/red)
- [ ] Add annotations (notes, warnings)

**Acceptance Criteria:**
- ✅ Flue route auto-generated from survey data
- ✅ Clearances calculated and displayed
- ✅ Non-compliant routes highlighted in red
- ✅ Diagram exports as PNG

---

#### 2.3 System Schematic (Boiler + Radiators)

**Library:**
- Custom React components
- SVG-based diagrams

**Tasks:**
- [ ] Build schematic component library
- [ ] Create templates for common system types
- [ ] Auto-populate from survey data
- [ ] Add labels and specifications
- [ ] Make diagram interactive (click to edit)
- [ ] Export as SVG/PNG

**Acceptance Criteria:**
- ✅ Schematic auto-generates from data
- ✅ Shows all radiators and connections
- ✅ Professional appearance (customer-ready)
- ✅ Exports for PDF inclusion

---

### Week 2 Deliverables
- ✅ Floor plan sketch tool (drag-drop boiler/radiators)
- ✅ Flue route diagram with clearances
- ✅ System schematic (boiler + radiators)
- ✅ All diagrams export as PNG/SVG
- ✅ Diagrams auto-populate from survey data

### Week 2 Success Metrics
- Complete visual diagram generated in <5 minutes
- Diagrams look professional (customer-ready)
- All measurements and clearances visible
- Diagrams export successfully

---

## Week 3: The PDF Generator

### Goal
Generate a professional, brochure-style A4 PDF using `@react-pdf/renderer` that looks amazing when printed on a portable printer.

### Core Features

#### 3.1 PDF Template with @react-pdf/renderer

**Library:**
- `@react-pdf/renderer` (client-side PDF generation)

**Installation:**
```bash
npm install @react-pdf/renderer
```

**Key Implementation Points:**
- 3-page brochure layout (Cover, Diagrams, Materials)
- Professional styling with company branding
- Embedded diagrams as base64 images
- Download functionality with PDFDownloadLink
- Print-optimized for A4 paper

**Tasks:**
- [ ] Install @react-pdf/renderer
- [ ] Create PDF template components
- [ ] Design professional brochure layout
- [ ] Add company branding (logo, colors)
- [ ] Embed diagrams as base64 images
- [ ] Add page numbers and headers/footers
- [ ] Implement download functionality
- [ ] Test print output on portable printer

**Acceptance Criteria:**
- ✅ PDF generates in <5 seconds
- ✅ Professional brochure appearance
- ✅ All diagrams embedded correctly
- ✅ Prints perfectly on A4 paper
- ✅ File size <3MB

---

#### 3.2 Branding & Customization

**Implementation:**
```typescript
// /store/branding-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BrandingSettings {
  companyName: string;
  logo?: string; // base64
  primaryColor: string;
  secondaryColor: string;
  phone: string;
  email: string;
  website?: string;
  footer: string;
}

interface BrandingStore {
  settings: BrandingSettings;
  updateSettings: (settings: Partial<BrandingSettings>) => void;
}

export const useBrandingStore = create<BrandingStore>()(
  persist(
    (set) => ({
      settings: {
        companyName: 'Your Company',
        primaryColor: '#FF6B6B',
        secondaryColor: '#4ECDC4',
        phone: '',
        email: '',
        footer: 'Professional heating solutions',
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        })),
    }),
    { name: 'branding-settings' }
  )
);
```

**Tasks:**
- [ ] Build branding settings UI
- [ ] Add logo upload functionality
- [ ] Implement color picker
- [ ] Allow custom footer text
- [ ] Preview branding in PDF
- [ ] Save branding to localStorage

**Acceptance Criteria:**
- ✅ Logo uploads and displays in PDF
- ✅ Colors customizable
- ✅ Branding persists across sessions
- ✅ Preview updates in real-time

---

### Week 3 Deliverables
- ✅ Professional PDF template using @react-pdf/renderer
- ✅ 3-page brochure (cover, diagrams, materials)
- ✅ Branding customization (logo, colors)
- ✅ Download PDF functionality
- ✅ Print-optimized for portable printers

### Week 3 Success Metrics
- PDF generates in <5 seconds
- Professional appearance (customer-wow factor)
- Prints perfectly on portable printer
- File size <3MB for easy sharing

---

## Week 4: The Customer Microsite

### Goal
Create a unique shareable link/QR code that customers can access on their phone to view survey details and visuals.

### Core Features

#### 4.1 Microsite URL Generation

**Library:**
- Next.js built-in dynamic routes
- `nanoid` for short unique IDs

**Installation:**
```bash
npm install nanoid
```

**Implementation:**
```typescript
// /utils/microsite.ts
import { nanoid } from 'nanoid';

export function generateMicrositeId(): string {
  // Generate short, URL-friendly ID (e.g., "k3Nx9Lp")
  return nanoid(7);
}

export function getMicrositeUrl(id: string): string {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://your-domain.com';
  return `${baseUrl}/view/${id}`;
}

// Store microsite data in localStorage
export function saveMicrositeData(id: string, survey: SurveyData, diagrams: any) {
  const data = {
    id,
    survey,
    diagrams,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  };
  
  localStorage.setItem(`microsite-${id}`, JSON.stringify(data));
  
  // Also keep index of all microsites
  const index = JSON.parse(localStorage.getItem('microsite-index') || '[]');
  index.push({ id, createdAt: data.createdAt, customer: survey.customer.name });
  localStorage.setItem('microsite-index', JSON.stringify(index));
  
  return data;
}

export function loadMicrositeData(id: string) {
  const data = localStorage.getItem(`microsite-${id}`);
  return data ? JSON.parse(data) : null;
}
```

**Next.js Dynamic Route:**
```typescript
// /app/view/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { loadMicrositeData } from '@/utils/microsite';

export default function MicrositePage({ params }: { params: { id: string } }) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const micrositeData = loadMicrositeData(params.id);
    setData(micrositeData);
  }, [params.id]);
  
  if (!data) {
    return <div>Survey not found or expired.</div>;
  }
  
  return <MicrositeView data={data} />;
}
```

**Tasks:**
- [ ] Implement microsite ID generation (nanoid)
- [ ] Create Next.js dynamic route `/view/[id]`
- [ ] Build microsite data storage (localStorage)
- [ ] Implement data retrieval on microsite page
- [ ] Add expiration handling (30 days)
- [ ] Create microsite index for management

**Acceptance Criteria:**
- ✅ Unique URL generated for each survey
- ✅ URL format: `/view/abc1234`
- ✅ Data persists in localStorage
- ✅ Expired microsites show error message

---

#### 4.2 QR Code Generation

**Library:**
- `qrcode.react` (React QR code component)

**Installation:**
```bash
npm install qrcode.react
```

**Implementation:**
```typescript
// /components/QRCodeDisplay.tsx
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  url: string;
  size?: number;
}

export function QRCodeDisplay({ url, size = 200 }: QRCodeDisplayProps) {
  return (
    <div className="qr-code-container">
      <QRCodeSVG
        value={url}
        size={size}
        level="H" // High error correction
        includeMargin={true}
      />
      <p className="qr-url">{url}</p>
      <button onClick={() => navigator.clipboard.writeText(url)}>
        Copy Link
      </button>
    </div>
  );
}
```

**Tasks:**
- [ ] Install qrcode.react
- [ ] Build QR code display component
- [ ] Convert QR code to base64 for PDF
- [ ] Add QR code to PDF footer/last page
- [ ] Add copy-to-clipboard functionality
- [ ] Test QR code scanning on mobile

**Acceptance Criteria:**
- ✅ QR code generates automatically
- ✅ Scanning QR opens microsite on phone
- ✅ QR code visible in PDF
- ✅ Copy link button works

---

#### 4.3 Mobile-Optimized Microsite View

**Implementation:**
Mobile-responsive layout with:
- Clean header with customer info
- Sections for boiler, flue, diagrams, radiators
- Touch-friendly image viewing
- Professional styling using Tailwind CSS

**Tasks:**
- [ ] Build mobile-responsive microsite layout
- [ ] Add touch-friendly image viewing
- [ ] Implement pinch-to-zoom for diagrams
- [ ] Add share button (native share API)
- [ ] Optimize images for mobile
- [ ] Test on iOS Safari and Android Chrome

**Acceptance Criteria:**
- ✅ Microsite loads in <2 seconds on 4G
- ✅ Fully responsive (phone, tablet, desktop)
- ✅ Images are touch-friendly
- ✅ Works on iOS Safari and Android Chrome

---

#### 4.4 Share & Distribution

**Implementation:**
```typescript
// /components/ShareMicrosite.tsx
export function ShareMicrosite({ url }: { url: string }) {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Your Heating Survey',
          text: 'View your heating system survey details',
          url: url,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent('Your Heating Survey');
    const body = encodeURIComponent(`View your survey online: ${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`View your heating survey: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="share-buttons">
      <button onClick={handleShare} className="btn-primary">
        Share Link
      </button>
      <button onClick={handleEmail} className="btn-secondary">
        Email Link
      </button>
      <button onClick={handleWhatsApp} className="btn-secondary">
        WhatsApp
      </button>
    </div>
  );
}
```

**Tasks:**
- [ ] Implement native share API
- [ ] Add email share functionality
- [ ] Add WhatsApp share option
- [ ] Add SMS share option
- [ ] Test sharing on mobile devices

**Acceptance Criteria:**
- ✅ Share button works on mobile
- ✅ Email/WhatsApp links open correctly
- ✅ Fallback to copy link if share unavailable

---

### Week 4 Deliverables
- ✅ Microsite URL generation with unique IDs
- ✅ QR code generation and PDF integration
- ✅ Mobile-optimized microsite view
- ✅ Share functionality (native, email, WhatsApp)
- ✅ Microsite data persistence (localStorage)

### Week 4 Success Metrics
- Unique microsite URL generated for every survey
- QR code scans and opens microsite on phone
- Microsite loads fast on mobile (<2 seconds)
- Customer can easily share link

---

## Tech Stack Details

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14+ | React framework with App Router |
| **React** | 18+ | UI library |
| **TypeScript** | 5+ | Type safety |
| **Tailwind CSS** | 3+ | Styling |
| **Zustand** | 4+ | State management |

### Week-Specific Libraries

#### Week 1: Voice & Data
- `react-speech-recognition` - Voice-to-text wrapper
- `regenerator-runtime` - Async/await polyfill
- `zod` - Data validation schemas

#### Week 2: Visualization
- `react-konva` - Canvas drawing
- `konva` - HTML5 canvas library

#### Week 3: PDF Generation
- `@react-pdf/renderer` - Client-side PDF generation

#### Week 4: Microsite
- `nanoid` - Short unique ID generation
- `qrcode.react` - QR code generation

---

## Success Criteria

### Overall MVP Success
- ✅ Surveyor captures full survey via voice in <10 minutes
- ✅ Visual diagrams auto-generate from voice data
- ✅ Professional PDF generated in <5 seconds
- ✅ PDF prints perfectly on portable printer
- ✅ Customer microsite accessible via QR code
- ✅ Entire workflow works offline (localStorage)
- ✅ Data structure ready for pricing additions

### User Experience Goals
- **Surveyor:** Faster surveys, more professional output
- **Customer:** Visual understanding, impressive presentation
- **Business:** Higher conversion rate, faster quote delivery

---

## Future Enhancements (Post-MVP)

### Phase 2: Pricing Integration
- Add pricing fields to JSON structure (uncomment price fields)
- Auto-calculate totals
- Generate formal quotes
- Tax calculations

### Phase 3: Cloud Sync
- Optional Firebase/Supabase backend
- Sync data across devices
- Team collaboration features
- Real-time updates

### Phase 4: Advanced Features
- Photo upload and annotation
- LiDAR room scanning (iOS)
- Integration with accounting software (Xero, QuickBooks)
- Customer portal with job tracking
- Digital signatures

---

## Implementation Checklist

### Project Setup
- [ ] Initialize Next.js 14 project with App Router
- [ ] Configure TypeScript
- [ ] Set up Tailwind CSS
- [ ] Install all required dependencies
- [ ] Configure PWA manifest
- [ ] Set up development environment

### Week 1: Voice & Data
- [ ] Voice capture working
- [ ] Data structure defined (TypeScript interfaces)
- [ ] State management implemented (Zustand)
- [ ] localStorage persistence
- [ ] Voice parsing logic
- [ ] Auto-save functionality

### Week 2: Visualization
- [ ] Floor plan tool functional
- [ ] Flue diagram generator
- [ ] System schematic renderer
- [ ] Diagram exports working (PNG/SVG)
- [ ] Canvas interactions (drag, zoom, pan)

### Week 3: PDF
- [ ] PDF template designed
- [ ] @react-pdf/renderer integrated
- [ ] Branding customization UI
- [ ] Download functionality
- [ ] Print testing completed

### Week 4: Microsite
- [ ] Microsite URL generation
- [ ] QR code integration
- [ ] Mobile-optimized view
- [ ] Share functionality
- [ ] Dynamic routing configured

---

## Conclusion

This 4-week plan delivers a complete **Sales Enablement Pack** solution:

1. ✅ **Week 1:** Voice input captures all survey details hands-free
2. ✅ **Week 2:** Visual diagrams show customer exactly what they're getting
3. ✅ **Week 3:** Professional PDF brochure ready to print and hand over
4. ✅ **Week 4:** Digital microsite link for customers to view on phone

**The Result:** Surveyors win more jobs by presenting professionally on-site, with both physical (PDF) and digital (microsite) outputs that impress customers.

**Data Structure:** Built to easily add pricing later - just uncomment the price fields and you're ready for Phase 2.

**Offline-First:** Everything works in localStorage - no internet required on-site.

**Privacy-First:** Client-side PDF generation means customer data never leaves the device.

---

**End of 4-Week Build Plan**

*Ready for implementation. Each week builds on the previous, creating a complete, professional surveyor tool.*
