# Pre-Contract Sales & Survey Tool: 4-Week Rapid Build Plan

**Version:** 1.0  
**Date:** 2025-12-07  
**Status:** Build Plan - Ready for Implementation  
**Target Platform:** Next.js PWA (Progressive Web App)

---

## Executive Summary

This document outlines a focused 4-week rapid build plan for transforming Hail Mary into a **Pre-Contract Sales & Survey Tool**. 

### Key Pivot: "Surveyors Sell, Engineers Fit"

We are **NOT** building:
- ❌ A quoting engine
- ❌ Salesforce integration
- ❌ A corporate data entry system

We **ARE** building:
- ✅ A tool to help surveyors **win the job** on-site
- ✅ Voice-driven technical capture (hands-free)
- ✅ Visual presentation layer (show the customer what they're getting)
- ✅ Professional output (better than a WhatsApp message)

### Three Core Priorities

1. **Voice Input** - Capture technical details hands-free during the survey
2. **Visualization Layer** - Show customers a diagram/overlay of flue, boiler, and system
3. **Presentation Output** - Generate a clean, professional PDF pack to leave behind

---

## Table of Contents

1. [Week 1: Voice Input Foundation](#week-1-voice-input-foundation)
2. [Week 2: Visualization Layer](#week-2-visualization-layer)
3. [Week 3: Presentation Output (PDF Generation)](#week-3-presentation-output-pdf-generation)
4. [Week 4: Integration & Polish](#week-4-integration--polish)
5. [Technical Architecture](#technical-architecture)
6. [Success Criteria](#success-criteria)
7. [Post-Launch Roadmap](#post-launch-roadmap)

---

## Week 1: Voice Input Foundation

### Goal
Enable surveyors to capture technical details via voice during the site visit, hands-free.

### Core Features

#### 1.1 Voice Recording & Transcription
**User Story:** As a surveyor, I want to dictate my findings while walking around the property so I don't need to stop and type.

**Tasks:**
- [ ] Implement Web Speech API for real-time voice capture
- [ ] Add push-to-talk button (or always-on mode toggle)
- [ ] Display live transcription on screen as surveyor speaks
- [ ] Store transcript segments with timestamps

**Technical Implementation:**
```typescript
// /packages/pwa/src/modules/voice/VoiceRecorder.tsx
interface VoiceSegment {
  id: string;
  timestamp: Date;
  text: string;
  confidence: number;
  tags?: string[]; // e.g., ["boiler", "flue", "measurements"]
}

// Web Speech API integration
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-GB';
```

**Acceptance Criteria:**
- ✅ Surveyor can start/stop voice recording with one tap
- ✅ Transcription appears within 2 seconds
- ✅ Works offline (falls back to on-device recognition)
- ✅ Segments are automatically saved to session

---

#### 1.2 Smart Entity Recognition
**User Story:** As a surveyor, I want the system to understand when I'm talking about the boiler, flue, radiators, etc., and tag them automatically.

**Tasks:**
- [ ] Implement keyword detection for key entities:
  - Boiler (model, location, age, condition)
  - Flue (type, position, clearances)
  - Radiators (count, sizes, rooms)
  - Hot water cylinder (type, size, location)
  - Customer requirements (complaints, expectations)
- [ ] Auto-tag transcript segments with detected entities
- [ ] Add quick-edit UI to correct misidentified entities

**Example Recognition Patterns:**
```typescript
const ENTITY_PATTERNS = {
  boiler: {
    keywords: ['boiler', 'combi', 'system boiler', 'heat only'],
    modelPatterns: /(?:worcester|vaillant|ideal|baxi)\s+\w+/i,
    agePatterns: /(\d+)\s*(?:year|yr)s?\s*old/i,
  },
  flue: {
    keywords: ['flue', 'vertical flue', 'horizontal flue', 'plume'],
    clearances: /(\d+(?:\.\d+)?)\s*(?:mm|cm|m|metre|meter)s?\s*(?:from|to|clearance)/i,
  },
  radiators: {
    keywords: ['radiator', 'rad', 'emitter'],
    sizePatterns: /(\d+)(?:mm)?\s*(?:x|by)\s*(\d+)(?:mm)?/i,
  },
};
```

**Acceptance Criteria:**
- ✅ 80%+ accuracy on common boiler models
- ✅ Automatically extracts measurements (e.g., "600mm clearance from window")
- ✅ Tags visible in transcript UI with color coding

---

#### 1.3 Voice Command Shortcuts
**User Story:** As a surveyor, I want to use voice commands to trigger actions like "take photo" or "add room" without touching the screen.

**Tasks:**
- [ ] Implement voice command parser
- [ ] Add core commands:
  - "Take photo" → Opens camera
  - "Add radiator" → Creates new radiator entry
  - "New room [name]" → Creates room section
  - "Mark issue: [description]" → Adds flagged issue
- [ ] Provide audio feedback (beep or spoken confirmation)

**Commands List:**
```typescript
const VOICE_COMMANDS = [
  { trigger: 'take photo', action: 'openCamera' },
  { trigger: 'add radiator', action: 'createRadiator' },
  { trigger: 'new room', action: 'createRoom', parameter: 'roomName' },
  { trigger: 'mark issue', action: 'flagIssue', parameter: 'description' },
  { trigger: 'next section', action: 'advanceSection' },
  { trigger: 'save and continue', action: 'saveProgress' },
];
```

**Acceptance Criteria:**
- ✅ Commands work with 90%+ accuracy
- ✅ Audio confirmation within 0.5 seconds
- ✅ Fallback to manual UI if command not recognized

---

#### 1.4 Survey Session Management
**User Story:** As a surveyor, I want my voice notes to be automatically organized by property and date.

**Tasks:**
- [ ] Create session start flow (property address, customer name)
- [ ] Auto-save all voice segments to session
- [ ] Display session progress (rooms completed, issues flagged)
- [ ] Allow resume from interrupted sessions

**Data Model:**
```typescript
interface SurveySession {
  id: string;
  leadId: string;
  propertyAddress: string;
  customerName: string;
  startedAt: Date;
  updatedAt: Date;
  status: 'in_progress' | 'completed' | 'abandoned';
  
  // Voice data
  voiceSegments: VoiceSegment[];
  
  // Structured data extracted from voice
  extractedData: {
    boiler?: BoilerDetails;
    flue?: FlueDetails;
    radiators: RadiatorDetails[];
    rooms: RoomDetails[];
    customerRequirements: string[];
    issues: Issue[];
  };
  
  // Media
  photos: Photo[];
}
```

**Acceptance Criteria:**
- ✅ Session auto-saves every 30 seconds
- ✅ Can resume session from dashboard
- ✅ Session list shows completion percentage

---

### Week 1 Deliverables
- ✅ Voice recording with live transcription
- ✅ Entity recognition for boiler, flue, radiators
- ✅ Core voice commands (photo, add item, mark issue)
- ✅ Session management (start, pause, resume, save)
- ✅ Offline-first design (works without internet)

### Week 1 Success Metrics
- Surveyor can complete a basic survey without typing
- Voice transcription accuracy >85%
- Session can be paused and resumed without data loss

---

## Week 2: Visualization Layer

### Goal
Provide visual diagrams and overlays to show the customer exactly what they're getting (boiler position, flue route, system layout).

### Core Features

#### 2.1 Property Photo Annotation
**User Story:** As a surveyor, I want to take a photo of the wall and mark where the boiler and flue will go, so the customer can visualize it.

**Tasks:**
- [ ] Implement camera integration with photo capture
- [ ] Add annotation layer on top of photos:
  - Draw rectangles (boiler outline)
  - Draw arrows/lines (flue route)
  - Add text labels (dimensions, clearances)
  - Add icons (boiler, radiator, cylinder symbols)
- [ ] Auto-save annotated photos to session
- [ ] Generate "before/after" comparison view

**Technical Implementation:**
```typescript
// /packages/pwa/src/modules/visualization/PhotoAnnotator.tsx
interface Annotation {
  id: string;
  type: 'rectangle' | 'arrow' | 'line' | 'text' | 'icon';
  points: Point2D[];
  label?: string;
  color: string;
  thickness: number;
}

interface AnnotatedPhoto {
  id: string;
  photoUrl: string;
  annotations: Annotation[];
  caption: string;
  category: 'boiler_location' | 'flue_route' | 'radiator_wall' | 'general';
}
```

**Annotation Tools:**
- Rectangle tool (for boiler, cylinder, radiators)
- Arrow tool (for flue route, flow direction)
- Line tool (for measurements, clearances)
- Text tool (for labels and dimensions)
- Icon library (boiler, flue, radiator, cylinder symbols)

**Acceptance Criteria:**
- ✅ Surveyor can take photo and annotate in <2 minutes
- ✅ Annotations are touch-friendly (finger or stylus)
- ✅ Undo/redo support
- ✅ Annotations export with photo

---

#### 2.2 System Schematic Generator
**User Story:** As a surveyor, I want to show the customer a simple schematic diagram of their heating system (boiler, cylinder, radiators) so they understand the upgrade.

**Tasks:**
- [ ] Create schematic template library:
  - Combi boiler system (simple)
  - System boiler + cylinder (medium complexity)
  - Heat pump + cylinder + radiators (complex)
- [ ] Auto-generate schematic based on voice data
- [ ] Allow drag-and-drop editing of component positions
- [ ] Add labels with specifications (boiler model, cylinder size, etc.)

**Schematic Components:**
```typescript
interface SchematicComponent {
  id: string;
  type: 'boiler' | 'cylinder' | 'radiator' | 'pump' | 'valve' | 'pipe';
  position: Point2D;
  label: string;
  specs?: string; // e.g., "180L cylinder", "30kW boiler"
}

interface SystemSchematic {
  id: string;
  sessionId: string;
  systemType: 'combi' | 'system_boiler' | 'heat_pump';
  components: SchematicComponent[];
  connections: Connection[]; // Pipes between components
  generated: boolean; // Auto-generated vs manual
}
```

**Template Examples:**

**Combi Boiler Template:**
```
   [Mains Cold Water] ──────► [Combi Boiler] ──┬──► [Hot Taps]
                                    │          │
                                    │          └──► [Radiator Circuit]
                                    ▼
                               [Flue → Outside]
```

**System Boiler + Cylinder Template:**
```
   [Mains Cold Water] ──► [System Boiler] ──► [Hot Water Cylinder] ──► [Hot Taps]
                               │                      ▲
                               └──► [Radiator Circuit]
```

**Acceptance Criteria:**
- ✅ Schematic auto-generates from session data
- ✅ Customer-friendly (simple icons, clear labels)
- ✅ Can customize before showing to customer
- ✅ Exports as PNG or PDF

---

#### 2.3 Flue Route Visualization
**User Story:** As a surveyor, I want to show the customer exactly where the flue will exit the building and prove it meets clearance requirements.

**Tasks:**
- [ ] Create flue visualization overlay on property photo
- [ ] Add measurement lines showing clearances:
  - Distance to windows
  - Distance to doors
  - Distance to property boundary
  - Height above ground
- [ ] Color-code clearances (green = compliant, red = needs adjustment)
- [ ] Add building regulations reference notes

**Flue Clearance Rules (UK Building Regs):**
```typescript
const FLUE_CLEARANCES = {
  fromWindow: { min: 300, unit: 'mm', regulation: 'BS 5440-1' },
  fromDoor: { min: 300, unit: 'mm', regulation: 'BS 5440-1' },
  fromBoundary: { min: 600, unit: 'mm', regulation: 'BS 5440-1' },
  fromGround: { min: 2000, unit: 'mm', regulation: 'BS 5440-1' },
  fromSoffit: { min: 200, unit: 'mm', regulation: 'BS 5440-1' },
};

function checkFlueCompliance(flue: FlueDetails): ComplianceReport {
  const issues: string[] = [];
  
  if (flue.clearanceToWindow < FLUE_CLEARANCES.fromWindow.min) {
    issues.push(`Window clearance ${flue.clearanceToWindow}mm < ${FLUE_CLEARANCES.fromWindow.min}mm required`);
  }
  
  return {
    compliant: issues.length === 0,
    issues,
    recommendations: generateRecommendations(issues),
  };
}
```

**Acceptance Criteria:**
- ✅ Visual overlay shows flue terminal position
- ✅ Clearances auto-calculated and displayed
- ✅ Non-compliant clearances highlighted in red
- ✅ Suggestions provided for alternative positions

---

#### 2.4 3D Room Mockup (Stretch Goal)
**User Story:** As a surveyor, I want to show a 3D mockup of the boiler room with the new system installed (optional, if time permits).

**Tasks:**
- [ ] Integrate a simple 3D viewer (Three.js or Babylon.js)
- [ ] Create basic room model from voice measurements
- [ ] Place boiler, flue, and cylinder in 3D space
- [ ] Allow rotation and zoom

**Implementation Note:** This is a **stretch goal** for Week 2. If time is tight, defer to Week 4 or post-launch.

---

### Week 2 Deliverables
- ✅ Photo annotation tool (boiler/flue overlay)
- ✅ System schematic auto-generation
- ✅ Flue clearance visualization with compliance checking
- ✅ (Stretch) 3D room mockup

### Week 2 Success Metrics
- Customer can see exactly where boiler/flue will be installed
- Schematic diagram generated automatically from voice data
- Flue compliance visualized and validated

---

## Week 3: Presentation Output (PDF Generation)

### Goal
Generate a clean, professional PDF "pack" that the surveyor can leave with the customer or email after the visit.

### Core Features

#### 3.1 PDF Template Engine
**User Story:** As a surveyor, I want to generate a professional-looking PDF report with my company branding, property details, and survey findings.

**Tasks:**
- [ ] Implement PDF generation library (jsPDF or React-PDF)
- [ ] Create branded PDF templates:
  - Cover page (company logo, property address, date)
  - Executive summary (1-page overview)
  - Technical findings (detailed survey notes)
  - Visualizations (annotated photos, schematic)
  - Next steps (what happens after survey)
- [ ] Allow template customization (logo, colors, company name)

**Technical Implementation:**
```typescript
// /packages/pwa/src/modules/pdf/PdfGenerator.tsx
import { jsPDF } from 'jspdf';

interface PdfTemplate {
  id: string;
  name: string;
  sections: PdfSection[];
  branding: {
    logo?: string; // Base64 or URL
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
  };
}

interface PdfSection {
  type: 'cover' | 'summary' | 'technical' | 'visualizations' | 'next_steps';
  title: string;
  content: any; // Section-specific data
}

async function generateSurveyPdf(
  session: SurveySession,
  template: PdfTemplate
): Promise<Blob> {
  const pdf = new jsPDF();
  
  // Cover page
  addCoverPage(pdf, session, template.branding);
  
  // Executive summary
  pdf.addPage();
  addExecutiveSummary(pdf, session);
  
  // Technical findings
  pdf.addPage();
  addTechnicalFindings(pdf, session);
  
  // Visualizations (photos + schematics)
  pdf.addPage();
  addVisualizations(pdf, session);
  
  // Next steps
  pdf.addPage();
  addNextSteps(pdf, session);
  
  return pdf.output('blob');
}
```

**PDF Sections:**

1. **Cover Page:**
   - Company logo (top)
   - Report title: "Pre-Installation Survey Report"
   - Property address
   - Customer name
   - Survey date
   - Surveyor name

2. **Executive Summary (1 page):**
   - Current system overview
   - Proposed upgrade
   - Key benefits
   - Estimated timeline
   - Ballpark cost (optional)

3. **Technical Findings (2-3 pages):**
   - Property details (type, age, rooms)
   - Current heating system (boiler model, age, condition)
   - Hot water system (cylinder, size, condition)
   - Radiators (count, sizes, locations)
   - Customer requirements (transcribed from voice)
   - Issues identified (draughty windows, cold rooms, etc.)

4. **Visualizations (2-4 pages):**
   - Annotated photos (boiler location, flue route)
   - System schematic diagram
   - Flue clearance diagram
   - Before/after comparison

5. **Next Steps (1 page):**
   - Formal quote to follow within 48 hours
   - How to proceed (accept quote, schedule installation)
   - Contact details
   - FAQ section

**Acceptance Criteria:**
- ✅ PDF generated in <10 seconds
- ✅ All images embedded and displayed correctly
- ✅ Professional layout (no overlapping text, proper spacing)
- ✅ PDF size <5MB (for easy email)

---

#### 3.2 PDF Customization UI
**User Story:** As a surveyor, I want to review and edit the PDF before sending it to the customer.

**Tasks:**
- [ ] Add PDF preview screen
- [ ] Allow editing of:
  - Executive summary text
  - Section visibility (hide/show sections)
  - Photo selection (choose which photos to include)
  - Branding (swap logo, change colors)
- [ ] Save customized template for future surveys

**UI Flow:**
```
[Generate PDF] → [Preview Screen] → [Edit Sections] → [Finalize] → [Download/Email]
                       ↓
                 [Section Toggles]
                 [Text Editor]
                 [Photo Gallery]
                 [Branding Settings]
```

**Acceptance Criteria:**
- ✅ Surveyor can preview PDF before finalizing
- ✅ Can edit summary text inline
- ✅ Can toggle sections on/off
- ✅ Changes reflected in preview immediately

---

#### 3.3 Email Delivery
**User Story:** As a surveyor, I want to email the PDF directly to the customer from the app.

**Tasks:**
- [ ] Integrate email API (SendGrid, Mailgun, or SMTP)
- [ ] Create email template:
  - Subject: "Your Survey Report from [Company Name]"
  - Body: Professional message with PDF attached
  - Signature: Surveyor contact details
- [ ] Add email preview before sending
- [ ] Track email delivery status

**Email Template:**
```html
Subject: Your Heating System Survey Report from [Company Name]

Dear [Customer Name],

Thank you for allowing me to survey your property at [Address] today.

I've attached a detailed report covering:
- Current heating system assessment
- Proposed upgrade recommendations
- Visualizations of the new installation
- Next steps

I'll follow up with a formal quote within 48 hours.

If you have any questions in the meantime, please don't hesitate to contact me.

Best regards,
[Surveyor Name]
[Company Name]
[Phone Number]
[Email Address]
```

**Acceptance Criteria:**
- ✅ Email sent within 30 seconds
- ✅ PDF attached correctly
- ✅ Email preview shows before sending
- ✅ Delivery confirmation displayed

---

#### 3.4 WhatsApp Sharing (Stretch Goal)
**User Story:** As a surveyor, I want to send the PDF via WhatsApp since many customers prefer that.

**Tasks:**
- [ ] Implement WhatsApp sharing via Web Share API
- [ ] Optimize PDF for WhatsApp (reduce file size if >5MB)
- [ ] Add QR code option (customer scans to download PDF)

**Implementation:**
```typescript
async function shareViaWhatsApp(pdfBlob: Blob, customerPhone: string) {
  if (navigator.share) {
    const file = new File([pdfBlob], 'survey-report.pdf', { type: 'application/pdf' });
    await navigator.share({
      title: 'Survey Report',
      text: 'Here is your heating system survey report',
      files: [file],
    });
  } else {
    // Fallback: Generate download link
    const url = URL.createObjectURL(pdfBlob);
    window.open(`https://wa.me/${customerPhone}?text=Survey report: ${url}`);
  }
}
```

**Acceptance Criteria:**
- ✅ PDF shares via WhatsApp Web Share API
- ✅ File size optimized for mobile (<3MB preferred)
- ✅ Fallback to download link if sharing fails

---

### Week 3 Deliverables
- ✅ PDF generation with branded templates
- ✅ PDF preview and customization UI
- ✅ Email delivery with professional template
- ✅ (Stretch) WhatsApp sharing

### Week 3 Success Metrics
- PDF generated and looks professional
- Customer can receive PDF via email within minutes of survey
- PDF file size <5MB
- Surveyor can customize PDF before sending

---

## Week 4: Integration & Polish

### Goal
Connect all the pieces, add offline support, optimize performance, and prepare for real-world use.

### Core Features

#### 4.1 End-to-End Workflow Testing
**User Story:** As a surveyor, I want to complete a survey from start to finish without any hitches.

**Tasks:**
- [ ] Test complete workflow:
  1. Start new survey session
  2. Capture property details via voice
  3. Take and annotate photos
  4. Generate system schematic
  5. Review and edit findings
  6. Generate PDF
  7. Email to customer
- [ ] Identify and fix workflow bottlenecks
- [ ] Add progress indicators (surveyor knows where they are in process)
- [ ] Add "quick complete" flow for simple surveys

**Workflow States:**
```typescript
enum SurveyWorkflowState {
  NOT_STARTED = 'not_started',
  PROPERTY_DETAILS = 'property_details',
  VOICE_CAPTURE = 'voice_capture',
  PHOTO_ANNOTATION = 'photo_annotation',
  REVIEW_FINDINGS = 'review_findings',
  GENERATE_PDF = 'generate_pdf',
  DELIVERY = 'delivery',
  COMPLETED = 'completed',
}
```

**Acceptance Criteria:**
- ✅ Complete survey workflow works without errors
- ✅ Progress bar shows completion percentage
- ✅ Can skip optional steps (e.g., photos if not needed)
- ✅ Can save and resume at any step

---

#### 4.2 Offline Support
**User Story:** As a surveyor, I want the app to work in properties with poor mobile signal.

**Tasks:**
- [ ] Implement Service Worker for offline caching
- [ ] Cache static assets (icons, templates, UI)
- [ ] Store survey sessions in IndexedDB
- [ ] Queue PDFs and emails for sending when back online
- [ ] Add offline indicator in UI

**Offline Strategy:**
```typescript
// /packages/pwa/src/service-worker.ts
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('hail-mary-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/bundle.js',
        '/icons/boiler.svg',
        '/icons/flue.svg',
        '/templates/pdf-template.json',
      ]);
    })
  );
});

// IndexedDB for session storage
const db = await openDB('hail-mary-sessions', 1, {
  upgrade(db) {
    db.createObjectStore('sessions', { keyPath: 'id' });
    db.createObjectStore('pending-emails', { keyPath: 'id' });
  },
});

async function saveSurveyOffline(session: SurveySession) {
  await db.put('sessions', session);
}

async function queueEmailForLater(email: EmailPayload) {
  await db.put('pending-emails', email);
}
```

**Acceptance Criteria:**
- ✅ App loads and functions without internet
- ✅ Voice transcription works offline (on-device recognition)
- ✅ Photos saved locally until sync
- ✅ PDFs generated offline
- ✅ Emails queued and sent when online

---

#### 4.3 Performance Optimization
**User Story:** As a surveyor, I want the app to be fast and responsive, even on older devices.

**Tasks:**
- [ ] Optimize bundle size (code splitting, lazy loading)
- [ ] Compress images before upload
- [ ] Minimize PDF generation time (<5 seconds)
- [ ] Add loading states for long operations
- [ ] Test on mid-range Android device (target: smooth 60fps)

**Performance Targets:**
- Initial load: <3 seconds
- Voice transcription delay: <2 seconds
- Photo annotation: 60fps
- PDF generation: <10 seconds
- Offline startup: <1 second

**Acceptance Criteria:**
- ✅ App loads in <3 seconds on 4G
- ✅ No UI lag when annotating photos
- ✅ PDF generated in <10 seconds
- ✅ Works smoothly on 2-year-old devices

---

#### 4.4 User Onboarding & Help
**User Story:** As a new surveyor using the app, I want quick tips to get started without reading a manual.

**Tasks:**
- [ ] Add first-time user tutorial (walkthrough)
- [ ] Create contextual help tooltips
- [ ] Add example survey (demo data)
- [ ] Create quick reference card (printable PDF)

**Tutorial Flow:**
```
1. Welcome screen: "Capture surveys with voice, photos, and professional PDFs"
2. Voice demo: "Try saying: 'Current boiler is a Worcester Bosch Greenstar'"
3. Photo demo: "Take a photo and annotate the boiler location"
4. PDF demo: "Generate a professional report in seconds"
5. Done: "You're ready to start your first survey!"
```

**Acceptance Criteria:**
- ✅ Tutorial shown on first launch
- ✅ Can skip tutorial if experienced
- ✅ Help tooltips visible on hover/tap
- ✅ Demo survey pre-loaded for testing

---

#### 4.5 Settings & Customization
**User Story:** As a surveyor, I want to customize the app with my company branding and preferences.

**Tasks:**
- [ ] Add Settings screen:
  - Company name and logo
  - PDF template colors
  - Email signature
  - Voice recognition language
  - Default measurements (metric/imperial)
  - Auto-save interval
- [ ] Save settings to local storage
- [ ] Sync settings across devices (optional)

**Settings Schema:**
```typescript
interface AppSettings {
  company: {
    name: string;
    logo?: string; // Base64 or URL
    phone: string;
    email: string;
    website?: string;
  };
  
  branding: {
    primaryColor: string; // Hex color
    secondaryColor: string;
    fontFamily: string;
  };
  
  preferences: {
    voiceLang: 'en-GB' | 'en-US';
    measurements: 'metric' | 'imperial';
    autoSaveInterval: number; // seconds
    offlineMode: boolean;
  };
  
  email: {
    signature: string;
    defaultSubject: string;
  };
}
```

**Acceptance Criteria:**
- ✅ Settings persist after app restart
- ✅ Logo uploaded and displayed in PDFs
- ✅ Email signature auto-filled
- ✅ Settings export/import for team consistency

---

#### 4.6 Bug Fixes & Edge Cases
**Tasks:**
- [ ] Test with incomplete voice data (missing boiler model, etc.)
- [ ] Test with poor quality photos (low light, blurry)
- [ ] Test with very long surveys (100+ voice segments)
- [ ] Test PDF generation with missing images
- [ ] Test email delivery failures (retry logic)
- [ ] Fix any UI glitches on iOS Safari and Android Chrome

**Edge Cases to Handle:**
- Voice recognition fails → Fallback to manual text entry
- Photo annotation crashes → Auto-save annotations periodically
- PDF generation fails → Show error, allow retry
- Email send fails → Queue for retry, notify surveyor
- Session corrupted → Recover from last auto-save

**Acceptance Criteria:**
- ✅ App handles errors gracefully (no crashes)
- ✅ User notified of issues with actionable messages
- ✅ Data recovery possible from auto-saves
- ✅ Works on iOS Safari, Android Chrome, desktop Chrome

---

### Week 4 Deliverables
- ✅ End-to-end workflow tested and polished
- ✅ Offline support with Service Worker and IndexedDB
- ✅ Performance optimized (<3s load, <10s PDF generation)
- ✅ User onboarding tutorial and help system
- ✅ Settings and customization UI
- ✅ Bug fixes and edge case handling

### Week 4 Success Metrics
- Complete survey workflow takes <15 minutes
- App works offline in properties with no signal
- Zero crashes during testing
- Surveyor can customize branding without developer help

---

## Technical Architecture

### Tech Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend** | Next.js 14 (App Router) | React framework with SSR, optimized for PWAs |
| **UI Framework** | React 18 | Component-based, hooks for state management |
| **Styling** | Tailwind CSS | Utility-first, fast styling, mobile-first |
| **State Management** | Zustand | Lightweight, simple API, minimal boilerplate |
| **Voice** | Web Speech API | Native browser support, no external API needed |
| **PDF Generation** | jsPDF or React-PDF | Client-side PDF generation, no server needed |
| **Offline** | Service Worker + IndexedDB | PWA standard, works across browsers |
| **Email** | SendGrid API or SMTP | Reliable delivery, tracking, templates |
| **Hosting** | Vercel or Railway | Easy deployment, edge network, auto-scaling |

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                      SURVEYOR                            │
│                    (on-site visit)                       │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                 VOICE INPUT LAYER                        │
│  • Web Speech API (transcription)                        │
│  • Entity recognition (boiler, flue, radiators)          │
│  • Voice commands (photo, add item, mark issue)          │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              SURVEY SESSION (State)                      │
│  • Property details                                       │
│  • Voice segments (timestamped)                          │
│  • Extracted entities (boiler, flue, radiators)          │
│  • Photos (annotated)                                    │
│  • Issues flagged                                        │
└────────────┬────────────────────────────────────────────┘
             │
             ├──────────────────┬──────────────────────────┐
             ▼                  ▼                          ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ VISUALIZATION   │  │  PDF GENERATOR   │  │  EMAIL SENDER    │
│  • Photo        │  │  • Template      │  │  • SendGrid API  │
│    annotation   │  │  • Branding      │  │  • Attachment    │
│  • Schematic    │  │  • Content       │  │  • Tracking      │
│  • Flue overlay │  │  • Export        │  │                  │
└─────────────────┘  └──────────────────┘  └──────────────────┘
             │                  │                          │
             └──────────────────┴──────────────────────────┘
                                │
                                ▼
                      ┌─────────────────┐
                      │    CUSTOMER     │
                      │  (receives PDF) │
                      └─────────────────┘
```

### Progressive Web App (PWA) Features

**Installability:**
- Add to home screen on iOS and Android
- Standalone mode (no browser chrome)
- Custom splash screen with company branding

**Offline Support:**
- Service Worker caches all static assets
- IndexedDB stores survey sessions locally
- Background sync for email delivery

**Performance:**
- Code splitting (load only what's needed)
- Image optimization (WebP, lazy loading)
- Minimal JavaScript bundle (<200KB gzipped)

**Manifest:**
```json
{
  "name": "Hail Mary Survey Tool",
  "short_name": "Survey",
  "description": "Pre-Contract Sales & Survey Tool for Heating Engineers",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ff6600",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Success Criteria

### Week 1 Success
- ✅ Surveyor completes first voice-only survey
- ✅ Voice transcription accuracy >85%
- ✅ Session auto-saves and can be resumed

### Week 2 Success
- ✅ Customer sees annotated photo showing boiler/flue location
- ✅ System schematic auto-generates from voice data
- ✅ Flue clearances calculated and visualized

### Week 3 Success
- ✅ Professional PDF generated in <10 seconds
- ✅ PDF emailed to customer within 2 minutes of survey completion
- ✅ PDF looks better than competitors' offerings

### Week 4 Success
- ✅ Complete survey workflow tested end-to-end
- ✅ App works offline in properties with no signal
- ✅ Surveyor can customize branding without developer help
- ✅ Zero critical bugs found during testing

### Overall Launch Success
- ✅ Surveyor can complete a survey in 15-20 minutes (vs 45+ minutes manual)
- ✅ Customer receives professional PDF immediately (vs waiting days)
- ✅ Surveyor wins more jobs by showing professionalism on-site
- ✅ Tool works reliably without internet connection

---

## Post-Launch Roadmap

### Month 2 (After 4-Week Build)
**Focus:** Collect feedback and iterate

**Features:**
- Customer feedback form (in PDF or follow-up email)
- Analytics dashboard (surveys completed, PDFs sent, conversion rate)
- Template library (pre-built templates for common scenarios)
- Multi-language support (Welsh, Polish for UK market)

### Month 3-6 (Enhancement Phase)
**Focus:** Advanced features

**Features:**
- Quote generation (convert survey to formal quote)
- Integration with accounting software (Xero, QuickBooks)
- Team collaboration (share surveys, review each other's work)
- Advanced visualizations (3D room models, AR overlays)
- Customer portal (customer views their survey online)

### Month 6-12 (Scale Phase)
**Focus:** Market expansion

**Features:**
- White-label version (sell to other heating companies)
- Mobile app (native iOS/Android for better camera/voice)
- LiDAR integration (iPhone 12 Pro+ for precise measurements)
- Thermal imaging (FLIR camera for heat loss detection)
- Integration with Visual Surveyor (full ecosystem)

---

## Dependencies & Prerequisites

### Required
- Next.js 14 installed and configured
- Tailwind CSS set up
- Zustand for state management
- Web Speech API (browser support check)
- jsPDF or React-PDF library
- SendGrid account (for email delivery)

### Optional (for full feature set)
- Google Cloud Platform (for advanced voice recognition fallback)
- AWS S3 or similar (for photo/PDF storage)
- Thermal camera SDK (for heat loss detection)
- LiDAR SDK (for 3D room scanning)

### Browser Support
- **Required:** Chrome/Edge (Chromium) on desktop and Android
- **Required:** Safari on iOS (for mobile surveyors)
- **Nice to have:** Firefox (partial support, voice may be limited)

---

## Risk Mitigation

### Risk 1: Voice recognition accuracy
**Mitigation:**
- Start with UK English (easier to recognize than some accents)
- Allow manual correction of transcriptions
- Provide voice commands cheat sheet
- Fall back to text input if voice fails repeatedly

### Risk 2: Offline email delivery
**Mitigation:**
- Queue emails in IndexedDB when offline
- Retry automatically when connection restored
- Show clear status (queued, sending, sent, failed)
- Provide manual retry button

### Risk 3: PDF file size too large
**Mitigation:**
- Compress images before embedding (max 1920px width)
- Use JPEG instead of PNG for photos
- Limit PDF to 10 pages max
- Provide "minimal" template option (text-only, no photos)

### Risk 4: Poor adoption by surveyors
**Mitigation:**
- Make onboarding super simple (5-minute tutorial)
- Provide phone/email support during first 2 weeks
- Create video tutorials showing real surveys
- Incentivize early adopters (discount, recognition)

---

## Conclusion

This 4-week plan focuses relentlessly on the **three core priorities**:

1. ✅ **Voice Input** - Hands-free capture during survey (Week 1)
2. ✅ **Visualization Layer** - Show customer what they're getting (Week 2)
3. ✅ **Presentation Output** - Professional PDF pack (Week 3)

Week 4 ties everything together and prepares for real-world use.

**Key Principle:** "Surveyors sell, engineers fit."

This tool helps the surveyor **win the job on-site** by:
- Capturing technical details effortlessly (voice)
- Showing the customer a clear vision (diagrams, photos)
- Leaving a professional impression (branded PDF)

The goal is **not** to replace their corporate CRM or quoting system. The goal is to **help them win** before they even get back to the office.

---

**Next Steps:**
1. Review this plan with stakeholders
2. Confirm technology choices (Next.js, jsPDF, SendGrid)
3. Set up development environment
4. Begin Week 1: Voice Input Foundation

**Questions?** Contact the development team or refer to:
- `docs/VISUAL-SURVEYOR-ARCHITECTURE.md` (for sensor integration later)
- `docs/EXECUTIVE-SUMMARY-DEC-2025.md` (for overall system context)

---

**End of 4-Week Build Plan**

*This is a living document. Update weekly as implementation progresses.*
