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

### The Complete Workflow

1. **Surveyor Input**: Uses Voice-to-Text to capture technical details (flue runs, boiler location, materials)
2. **The Engine**: The app processes this into structured data and generates a visual diagram/plan
3. **Output A (Print)**: The app generates a professional, brochure-style A4 PDF. The surveyor prints this immediately on a portable printer
4. **Output B (Digital)**: The app creates a unique "Microsite" link for the customer to view the visuals on their phone

### Four Core Priorities

1. **Voice Input** - Capture technical details hands-free during the survey (Week 1)
2. **Visualization Layer** - Show customers a diagram/overlay of flue, boiler, and system (Week 2)
3. **PDF Generation** - Generate a clean, professional PDF pack to print immediately (Week 3)
4. **Customer Microsite** - Create shareable link for digital viewing (Week 4)

---

## Table of Contents

1. [Week 1: Voice Input Foundation](#week-1-voice-input-foundation)
2. [Week 2: Visualization Layer](#week-2-visualization-layer)
3. [Week 3: PDF Generation (Print Output)](#week-3-pdf-generation-print-output)
4. [Week 4: Customer Microsite (Digital Output)](#week-4-customer-microsite-digital-output)
5. [Technical Architecture](#technical-architecture)
6. [Success Criteria](#success-criteria)
7. [Post-Launch Roadmap](#post-launch-roadmap)

---

## Week 1: Voice Input Foundation

### Goal
Enable surveyors to capture technical details via voice during the site visit, hands-free.

### Libraries & Technologies
- **Web Speech API** - Native browser API for voice recognition (no external dependencies)
- **Zustand** - Lightweight state management for voice segments and session data
- **IndexedDB (via idb)** - Offline storage for voice transcripts
- **React Hooks** - `useState`, `useEffect`, `useRef` for voice recorder component

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

// Web Speech API integration with cross-browser support and feature detection
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  throw new Error('Speech recognition not supported in this browser');
}

const recognition = new SpeechRecognition();
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

### Libraries & Technologies
- **HTML5 Canvas API** - For photo annotation and drawing
- **Fabric.js** or **Konva.js** - Canvas manipulation library for easier annotation tools
- **React Flow** or **Reaflow** - For system schematic diagrams (node-based layouts)
- **D3.js** (optional) - For measurement visualizations and compliance diagrams
- **react-image-crop** - For photo cropping before annotation

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

## Week 3: PDF Generation (Print Output)

### Goal
Generate a clean, professional PDF "pack" that the surveyor can print immediately on a portable printer or email to the customer.

### Libraries & Technologies
- **@react-pdf/renderer** - React components for PDF generation (recommended for complex layouts)
  - OR **jsPDF** - Lower-level PDF generation library (simpler, smaller bundle)
- **html2canvas** (if using jsPDF) - Convert HTML to images for embedding in PDF
- **pdfmake** (alternative) - Declarative PDF generation with good table support
- **All generation happens CLIENT-SIDE** - No server processing required for privacy and speed

### Why Client-Side PDF Generation?
1. **Privacy** - Survey data never leaves the device until explicitly sent
2. **Speed** - No server round-trip, instant generation
3. **Offline** - Works without internet connection
4. **Cost** - No server processing costs

### Recommended Choice: @react-pdf/renderer
```bash
npm install @react-pdf/renderer
```

**Pros:**
- React component syntax (familiar to developers)
- Good documentation and active maintenance
- Built-in styling with CSS-like syntax
- Supports images, fonts, and complex layouts
- ~150KB gzipped

**Example:**
```typescript
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30 },
  header: { fontSize: 24, marginBottom: 20 },
  // ... more styles
});

const SurveyPDF = ({ session }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Survey Report</Text>
      {/* ... more content */}
    </Page>
  </Document>
);
```

### Core Features

#### 3.1 PDF Template Engine
**User Story:** As a surveyor, I want to generate a professional-looking PDF report with my company branding, property details, and survey findings - all processed locally on my device.

**Tasks:**
- [ ] Install and configure @react-pdf/renderer (or jsPDF as alternative)
- [ ] Create branded PDF templates:
  - Cover page (company logo, property address, date)
  - Executive summary (1-page overview)
  - Technical findings (detailed survey notes)
  - Visualizations (annotated photos, schematic)
  - Next steps (what happens after survey)
- [ ] Allow template customization (logo, colors, company name)
- [ ] Ensure all processing happens client-side (no server calls)

**Technical Implementation with @react-pdf/renderer:**
```typescript
// /packages/pwa/src/modules/pdf/PdfGenerator.tsx
import { 
  Document, 
  Page, 
  Text, 
  View, 
  Image, 
  StyleSheet,
  pdf 
} from '@react-pdf/renderer';

interface PdfTemplate {
  id: string;
  name: string;
  branding: {
    logo?: string; // Base64 encoded
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
  };
}

// Define styles
const createStyles = (branding: PdfTemplate['branding']) => StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 24,
    marginBottom: 10,
    color: branding.primaryColor,
  },
  section: {
    marginBottom: 15,
  },
  // ... more styles
});

// React component for PDF
const SurveyPDF = ({ session, template }: { session: SurveySession; template: PdfTemplate }) => {
  const styles = createStyles(template.branding);
  
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        {template.branding.logo && (
          <Image src={template.branding.logo} style={{ width: 150, marginBottom: 20 }} />
        )}
        <Text style={styles.header}>Pre-Installation Survey Report</Text>
        <Text>{session.propertyAddress}</Text>
        <Text>Survey Date: {new Date(session.startedAt).toLocaleDateString()}</Text>
      </Page>
      
      {/* Executive Summary */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Executive Summary</Text>
        <View style={styles.section}>
          <Text>Current System: {session.extractedData.boiler?.model || 'Unknown'}</Text>
          <Text>Proposed Upgrade: {/* ... */}</Text>
        </View>
      </Page>
      
      {/* ... more pages */}
    </Document>
  );
};

// Client-side PDF generation
async function generateSurveyPdf(
  session: SurveySession,
  template: PdfTemplate
): Promise<Blob> {
  const blob = await pdf(<SurveyPDF session={session} template={template} />).toBlob();
  return blob;
}

// Trigger download or print
async function downloadPdf(session: SurveySession, template: PdfTemplate) {
  const blob = await generateSurveyPdf(session, template);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `survey-${session.id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

// For printing
async function printPdf(session: SurveySession, template: PdfTemplate) {
  const blob = await generateSurveyPdf(session, template);
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.contentWindow?.print();
}
```

**Alternative: jsPDF for simpler cases**
```typescript
import { jsPDF } from 'jspdf';

async function generateSurveyPdfWithJsPDF(
  session: SurveySession,
  template: PdfTemplate
): Promise<Blob> {
  const pdf = new jsPDF();
  
  // Cover page
  pdf.setFontSize(24);
  pdf.text('Survey Report', 20, 30);
  pdf.setFontSize(12);
  pdf.text(session.propertyAddress, 20, 50);
  
  // Add images (annotated photos)
  if (session.photos.length > 0) {
    pdf.addPage();
    pdf.addImage(session.photos[0].photoUrl, 'JPEG', 20, 20, 170, 127);
  }
  
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
- [ ] Upload PDF to temporary cloud storage for sharing (if Web Share API not available)
- [ ] Add QR code option (customer scans to download PDF)

**Implementation:**
```typescript
async function shareViaWhatsApp(pdfBlob: Blob, customerPhone: string) {
  if (navigator.share && navigator.canShare({ files: [new File([pdfBlob], 'test.pdf')] })) {
    // Native Web Share API (works on mobile)
    const file = new File([pdfBlob], 'survey-report.pdf', { type: 'application/pdf' });
    await navigator.share({
      title: 'Survey Report',
      text: 'Here is your heating system survey report',
      files: [file],
    });
  } else {
    // Fallback: Upload PDF to cloud storage and share link
    const uploadUrl = await uploadPdfToCloudStorage(pdfBlob);
    const message = encodeURIComponent(`Your survey report is ready: ${uploadUrl}`);
    window.open(`https://wa.me/${customerPhone}?text=${message}`);
  }
}

async function uploadPdfToCloudStorage(pdfBlob: Blob): Promise<string> {
  // Upload to S3, Cloudinary, or similar
  // Return public URL with expiration (e.g., 7 days)
  const formData = new FormData();
  formData.append('file', pdfBlob);
  const response = await fetch('/api/upload/temp-pdf', {
    method: 'POST',
    body: formData,
  });
  const { url } = await response.json();
  return url;
}
```

**Acceptance Criteria:**
- ✅ PDF shares via WhatsApp Web Share API
- ✅ File size optimized for mobile (<3MB preferred)
- ✅ Fallback to download link if sharing fails

---

### Week 3 Deliverables
- ✅ Client-side PDF generation with @react-pdf/renderer or jsPDF
- ✅ Branded PDF templates (cover, summary, technical, visualizations, next steps)
- ✅ PDF preview and customization UI
- ✅ Download and print functionality
- ✅ Optional email delivery with professional template

### Week 3 Success Metrics
- PDF generated client-side in <10 seconds
- PDF looks professional and matches company branding
- PDF file size <5MB (optimized images)
- Surveyor can customize PDF before finalizing
- PDF can be printed immediately on portable printer
- No server processing required (privacy & speed)

---

## Week 4: Customer Microsite (Digital Output)

### Goal
Create a unique, shareable microsite link for each survey that customers can view on their phone to see all the visuals, diagrams, and survey details.

### Libraries & Technologies
- **Next.js Dynamic Routes** - `/survey/[id]` for unique survey pages
- **Next.js API Routes** - `/api/survey/[id]` for fetching survey data
- **QR Code Generation** - `qrcode.react` or `qrcode` library
- **Unique ID Generation** - `nanoid` or `uuid` for shareable links
- **Short URL Service** (optional) - `bitly-api` or custom URL shortener
- **Progressive Web App** - Allow customers to "Add to Home Screen"

### Why a Microsite Instead of Email?
1. **Mobile-First** - Customers can view on their phone anytime
2. **Always Updated** - Can update survey details after sending link
3. **Rich Media** - Better image quality and interactive diagrams
4. **Shareable** - Customer can forward to family/decision-makers
5. **Professional** - Branded experience on a custom domain

### Core Features

#### 4.1 Unique Survey Links
**User Story:** As a surveyor, I want to generate a unique link for each survey that I can text or email to the customer.

**Tasks:**
- [ ] Generate unique, short survey IDs (e.g., `abc123xyz`)
- [ ] Create Next.js dynamic route: `/survey/[surveyId]`
- [ ] Implement URL shortening (optional: `hail.to/abc123`)
- [ ] Add QR code generation for easy mobile access
- [ ] Store survey data in database with public access flag

**Technical Implementation:**
```typescript
// Generate unique survey ID
import { nanoid } from 'nanoid';

function createSurveyLink(sessionId: string): string {
  const shortId = nanoid(10); // e.g., "V1StGXR8_Z"
  
  // Save mapping in database
  await db.surveyLinks.create({
    shortId,
    sessionId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    viewCount: 0,
  });
  
  return `${process.env.NEXT_PUBLIC_BASE_URL}/survey/${shortId}`;
}

// /app/survey/[surveyId]/page.tsx
export default async function SurveyPage({ params }: { params: { surveyId: string } }) {
  const surveyLink = await db.surveyLinks.findOne({ shortId: params.surveyId });
  
  if (!surveyLink || new Date() > surveyLink.expiresAt) {
    return <SurveyExpired />;
  }
  
  const session = await db.sessions.findOne({ id: surveyLink.sessionId });
  
  // Increment view count
  await db.surveyLinks.update(
    { shortId: params.surveyId },
    { viewCount: surveyLink.viewCount + 1 }
  );
  
  return <SurveyMicrosite session={session} />;
}
```

**QR Code Generation:**
```typescript
import QRCode from 'qrcode';

async function generateSurveyQRCode(surveyUrl: string): Promise<string> {
  const qrCodeDataUrl = await QRCode.toDataURL(surveyUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
  return qrCodeDataUrl;
}

// Display QR code for surveyor to show customer
<img src={qrCodeDataUrl} alt="Scan to view survey" />
```

**Acceptance Criteria:**
- ✅ Each survey gets a unique, short link (e.g., `/survey/abc123`)
- ✅ QR code generated for easy mobile scanning
- ✅ Links expire after 30 days (configurable)
- ✅ View count tracked for analytics

---

#### 4.2 Customer-Facing Microsite UI
**User Story:** As a customer, I want to view my survey results on my phone with a clean, professional interface.

**Tasks:**
- [ ] Design mobile-first microsite layout
- [ ] Display survey information:
  - Property address
  - Survey date and surveyor name
  - Current system details
  - Proposed upgrade overview
  - Key benefits
- [ ] Show visualizations:
  - Annotated photos (swipeable gallery)
  - System schematic diagram
  - Flue clearance visualization
- [ ] Add interactive elements:
  - Zoom/pan on images
  - Expandable sections
  - "Request Quote" call-to-action button
- [ ] Company branding (logo, colors, contact info)

**Microsite Sections:**
```typescript
interface MicrositeContent {
  hero: {
    propertyAddress: string;
    surveyDate: Date;
    surveyorName: string;
    companyLogo: string;
  };
  
  currentSystem: {
    boilerModel: string;
    boilerAge: number;
    condition: string;
    issues: string[];
  };
  
  proposedUpgrade: {
    newBoilerModel: string;
    keyBenefits: string[];
    estimatedTimeline: string;
  };
  
  visualizations: {
    photos: AnnotatedPhoto[];
    schematic: SystemSchematic;
    flueVisualization: FlueVisualization;
  };
  
  callToAction: {
    primaryButton: 'Request Formal Quote';
    secondaryButton: 'Ask a Question';
    contactInfo: CompanyContact;
  };
}
```

**UI Component Structure:**
```tsx
// /app/survey/[surveyId]/components/SurveyMicrosite.tsx
export function SurveyMicrosite({ session }: { session: SurveySession }) {
  return (
    <div className="microsite">
      {/* Hero Section */}
      <HeroSection 
        address={session.propertyAddress}
        date={session.startedAt}
        surveyor={session.surveyorName}
      />
      
      {/* Current System */}
      <CurrentSystemSection data={session.extractedData} />
      
      {/* Proposed Upgrade */}
      <ProposedUpgradeSection data={session.extractedData} />
      
      {/* Photo Gallery */}
      <PhotoGallery photos={session.photos} />
      
      {/* System Schematic */}
      <SchematicSection schematic={session.schematic} />
      
      {/* Next Steps / CTA */}
      <CallToActionSection 
        onRequestQuote={() => window.location.href = 'mailto:...'}
      />
      
      {/* Footer */}
      <Footer companyInfo={session.companyInfo} />
    </div>
  );
}
```

**Acceptance Criteria:**
- ✅ Mobile-responsive design (optimized for phones)
- ✅ Fast loading (<2 seconds on 4G)
- ✅ All images optimized and lazy-loaded
- ✅ Professional appearance matching company branding
- ✅ Clear call-to-action for next steps

---

#### 4.3 Sharing & Notifications
**User Story:** As a surveyor, I want to easily send the microsite link to the customer via SMS, email, or WhatsApp.

**Tasks:**
- [ ] Implement multiple sharing methods:
  - SMS (using Twilio or similar)
  - Email (with link and QR code)
  - WhatsApp Web Share
  - Copy link to clipboard
- [ ] Send notification to customer when survey is ready
- [ ] Track when customer views the microsite
- [ ] Optional: Notify surveyor when customer requests quote

**Sharing Implementation:**
```typescript
// SMS via Twilio
import twilio from 'twilio';

async function sendSurveySMS(customerPhone: string, surveyUrl: string, surveyorName: string) {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  await client.messages.create({
    to: customerPhone,
    from: process.env.TWILIO_PHONE_NUMBER,
    body: `Hi! ${surveyorName} from [Company] here. Your heating survey is ready to view: ${surveyUrl}`,
  });
}

// Email with link + QR code
async function sendSurveyEmail(customerEmail: string, surveyUrl: string, qrCodeDataUrl: string) {
  const emailTemplate = `
    <h2>Your Heating Survey is Ready</h2>
    <p>Thank you for your time today. You can view your survey online:</p>
    <p><a href="${surveyUrl}">${surveyUrl}</a></p>
    <p>Or scan this QR code on your phone:</p>
    <img src="${qrCodeDataUrl}" alt="QR Code" />
  `;
  
  await sendEmail({
    to: customerEmail,
    subject: 'Your Heating Survey Results',
    html: emailTemplate,
  });
}

// WhatsApp Web Share
function shareViaWhatsApp(customerPhone: string, surveyUrl: string) {
  const message = encodeURIComponent(
    `Your heating survey is ready! View it here: ${surveyUrl}`
  );
  window.open(`https://wa.me/${customerPhone}?text=${message}`);
}

// Native Web Share API (mobile)
async function shareViaNative(surveyUrl: string) {
  if (navigator.share) {
    await navigator.share({
      title: 'Heating Survey Results',
      text: 'View your heating survey online',
      url: surveyUrl,
    });
  } else {
    // Fallback: Copy to clipboard
    await navigator.clipboard.writeText(surveyUrl);
    alert('Link copied to clipboard!');
  }
}
```

**Sharing UI:**
```tsx
function SharingOptions({ surveyUrl, customer }: { surveyUrl: string; customer: Customer }) {
  return (
    <div className="sharing-options">
      <h3>Send Survey to Customer</h3>
      
      <button onClick={() => sendSurveySMS(customer.phone, surveyUrl)}>
        📱 Send via SMS
      </button>
      
      <button onClick={() => sendSurveyEmail(customer.email, surveyUrl)}>
        📧 Send via Email
      </button>
      
      <button onClick={() => shareViaWhatsApp(customer.phone, surveyUrl)}>
        💬 Send via WhatsApp
      </button>
      
      <button onClick={() => shareViaNative(surveyUrl)}>
        🔗 Share Link
      </button>
      
      <div className="qr-code">
        <h4>Or show this QR code:</h4>
        <QRCodeDisplay url={surveyUrl} />
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- ✅ Multiple sharing options available (SMS, Email, WhatsApp)
- ✅ QR code can be shown to customer for instant scanning
- ✅ Surveyor receives notification when customer views microsite
- ✅ Link works immediately after generation

---

#### 4.4 Analytics & Tracking
**User Story:** As a surveyor, I want to know when the customer has viewed their survey so I can follow up at the right time.

**Tasks:**
- [ ] Track microsite views (timestamp, device, location)
- [ ] Track user interactions (photos viewed, CTA clicked)
- [ ] Dashboard showing:
  - Total surveys created
  - Total views
  - Conversion rate (views → quote requests)
  - Average time on microsite
- [ ] Notifications for surveyor (optional):
  - Customer viewed survey
  - Customer requested quote
  - Survey link expires soon

**Analytics Implementation:**
```typescript
// Track page view
async function trackMicrositeView(surveyId: string, metadata: ViewMetadata) {
  await db.analytics.create({
    surveyId,
    eventType: 'page_view',
    timestamp: new Date(),
    userAgent: metadata.userAgent,
    referrer: metadata.referrer,
    ipAddress: metadata.ipAddress, // For general location only
  });
}

// Track interactions
async function trackInteraction(surveyId: string, action: string, details?: any) {
  await db.analytics.create({
    surveyId,
    eventType: 'interaction',
    action, // 'photo_viewed', 'cta_clicked', 'section_expanded'
    details,
    timestamp: new Date(),
  });
}

// Dashboard queries
async function getSurveyAnalytics(surveyId: string) {
  const views = await db.analytics.count({ 
    surveyId, 
    eventType: 'page_view' 
  });
  
  const uniqueVisitors = await db.analytics.distinct('ipAddress', {
    surveyId,
    eventType: 'page_view',
  });
  
  const ctaClicks = await db.analytics.count({
    surveyId,
    action: 'cta_clicked',
  });
  
  return {
    totalViews: views,
    uniqueVisitors: uniqueVisitors.length,
    conversionRate: views > 0 ? (ctaClicks / views) * 100 : 0,
  };
}
```

**Acceptance Criteria:**
- ✅ View count tracked accurately
- ✅ Surveyor can see when customer viewed survey
- ✅ Dashboard shows analytics for all surveys
- ✅ No personally identifiable information stored beyond what's necessary

---

#### 4.5 Security & Privacy
**User Story:** As a customer, I want to know my survey data is secure and private.

**Tasks:**
- [ ] Implement access controls:
  - Survey links are unguessable (10+ character random IDs)
  - Optional: Password protection for sensitive surveys
  - Link expiration (default 30 days, configurable)
- [ ] Data privacy:
  - No tracking cookies without consent
  - Customer can request link deletion
  - Data retention policy clearly stated
- [ ] HTTPS enforcement
- [ ] Rate limiting to prevent abuse

**Security Implementation:**
```typescript
// Generate cryptographically secure survey IDs
import { nanoid } from 'nanoid';

function generateSecureSurveyId(): string {
  return nanoid(12); // 12 characters = ~70 bits of entropy
}

// Optional password protection
async function createProtectedSurveyLink(sessionId: string, password?: string) {
  const shortId = generateSecureSurveyId();
  
  const surveyLink = await db.surveyLinks.create({
    shortId,
    sessionId,
    passwordHash: password ? await hashPassword(password) : null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  
  return `${process.env.NEXT_PUBLIC_BASE_URL}/survey/${shortId}`;
}

// Password verification
async function verifySurveyAccess(shortId: string, password?: string): Promise<boolean> {
  const link = await db.surveyLinks.findOne({ shortId });
  
  if (!link) return false;
  if (new Date() > link.expiresAt) return false;
  if (link.passwordHash && !password) return false;
  if (link.passwordHash && !(await verifyPassword(password!, link.passwordHash))) {
    return false;
  }
  
  return true;
}

// Rate limiting (using Redis or in-memory cache)
import rateLimit from 'express-rate-limit';

const surveyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
});

app.get('/survey/:surveyId', surveyLimiter, async (req, res) => {
  // ... handle request
});
```

**Privacy Features:**
```tsx
function MicrositeFooter() {
  return (
    <footer>
      <p>
        This survey link will expire on {expirationDate.toLocaleDateString()}.
        <br />
        <a href="/privacy">Privacy Policy</a> | 
        <a href="/delete-request">Request Deletion</a>
      </p>
    </footer>
  );
}
```

**Acceptance Criteria:**
- ✅ Survey links are cryptographically secure
- ✅ Links expire automatically after set period
- ✅ Optional password protection available
- ✅ Customer can request link/data deletion
- ✅ All traffic over HTTPS
- ✅ Rate limiting prevents abuse

---

#### 4.6 Integration & Polish
**User Story:** As a surveyor, I want the entire workflow from survey to microsite to be seamless.

**Tasks:**
- [ ] End-to-end workflow testing:
  1. Complete voice survey
  2. Annotate photos
  3. Generate PDF
  4. Create microsite link
  5. Share via SMS/Email/WhatsApp
  6. Customer views microsite
  7. Customer requests quote
- [ ] Offline support for microsite creation (generate link, sync later)
- [ ] Performance optimization:
  - Image optimization (WebP, responsive sizes)
  - Code splitting (microsite code separate from survey tool)
  - CDN for static assets
- [ ] Add microsite previews for surveyor before sharing
- [ ] Bug fixes and edge case handling

**Workflow Integration:**
```typescript
// Complete workflow from survey to microsite
async function completeSurveyWorkflow(sessionId: string) {
  // 1. Finalize survey session
  const session = await db.sessions.update(sessionId, { status: 'completed' });
  
  // 2. Generate PDF (client-side, saved to session)
  const pdfBlob = await generateSurveyPdf(session, template);
  const pdfUrl = await uploadPdfToStorage(pdfBlob);
  await db.sessions.update(sessionId, { pdfUrl });
  
  // 3. Create microsite link
  const micrositeUrl = await createSurveyLink(sessionId);
  
  // 4. Generate QR code
  const qrCodeDataUrl = await generateSurveyQRCode(micrositeUrl);
  
  // 5. Return sharing options
  return {
    pdfUrl,
    micrositeUrl,
    qrCodeDataUrl,
    sharingMethods: ['sms', 'email', 'whatsapp', 'native'],
  };
}
```

**Microsite Preview:**
```tsx
function MicrositePreview({ session }: { session: SurveySession }) {
  const [previewUrl, setPreviewUrl] = useState('');
  
  useEffect(() => {
    // Generate temporary preview link
    const tempId = `preview-${nanoid(8)}`;
    setPreviewUrl(`/survey/${tempId}?preview=true`);
  }, []);
  
  return (
    <div className="microsite-preview">
      <h3>Preview Customer Microsite</h3>
      <iframe 
        src={previewUrl} 
        width="375" 
        height="667" 
        style={{ border: '1px solid #ccc', borderRadius: '10px' }}
      />
      <button onClick={() => window.open(previewUrl, '_blank')}>
        Open in New Tab
      </button>
    </div>
  );
}
```

**Acceptance Criteria:**
- ✅ Complete workflow works without errors
- ✅ Surveyor can preview microsite before sharing
- ✅ Microsite loads fast (<2s on 4G)
- ✅ Works on all major mobile browsers (Safari, Chrome)
- ✅ Offline microsite creation (syncs when online)

---

### Week 4 Deliverables
- ✅ Unique survey link generation with QR codes
- ✅ Mobile-first customer microsite UI
- ✅ Multi-channel sharing (SMS, Email, WhatsApp)
- ✅ Analytics and view tracking
- ✅ Security features (link expiration, optional passwords)
- ✅ End-to-end workflow integration
- ✅ Microsite preview for surveyors

### Week 4 Success Metrics
- Customer can view survey on their phone via link
- Microsite loads in <2 seconds on mobile
- Surveyor knows when customer has viewed survey
- >80% of customers view microsite within 24 hours of sharing
- Clear path from microsite view to quote request

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
| **PDF Generation** | @react-pdf/renderer | Client-side PDF generation, React components |
| **Photo Annotation** | Fabric.js or Konva.js | Canvas manipulation for drawing tools |
| **Diagrams** | React Flow or Reaflow | Node-based system schematics |
| **QR Codes** | qrcode.react | Generate QR codes for microsite links |
| **Unique IDs** | nanoid | Short, secure, URL-friendly IDs |
| **Offline** | Service Worker + IndexedDB | PWA standard, works across browsers |
| **SMS** | Twilio API | Reliable SMS delivery for microsite links |
| **Email** | SendGrid API or SMTP | Email delivery with tracking |
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
│ VISUALIZATION   │  │  PDF GENERATOR   │  │ MICROSITE LINK   │
│  • Photo        │  │  • Template      │  │  • Unique URL    │
│    annotation   │  │  • Branding      │  │  • QR Code       │
│  • Schematic    │  │  • Content       │  │  • SMS/Email     │
│  • Flue overlay │  │  • Client-side   │  │  • View tracking │
└─────────────────┘  └──────────────────┘  └──────────────────┘
             │                  │                          │
             │                  ├──────────────────────────┤
             │                  ▼                          ▼
             │         ┌────────────────┐      ┌──────────────────┐
             │         │ PRINT OUTPUT   │      │ DIGITAL OUTPUT   │
             │         │ (Portable      │      │ (Customer        │
             │         │  Printer)      │      │  Microsite)      │
             │         └────────────────┘      └──────────────────┘
             │                                          │
             └──────────────────────────────────────────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │    CUSTOMER     │
                       │  (Views on      │
                       │   Phone)        │
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
- Progressive loading (initial bundle <500KB gzipped, additional features loaded on demand)
- PDF generation library loaded only when needed

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
- ✅ Entity recognition identifies boiler models and measurements

### Week 2 Success
- ✅ Customer sees annotated photo showing boiler/flue location
- ✅ System schematic auto-generates from voice data
- ✅ Flue clearances calculated and visualized
- ✅ Professional-looking diagrams ready for presentation

### Week 3 Success
- ✅ Professional PDF generated client-side in <10 seconds
- ✅ PDF can be downloaded or printed immediately
- ✅ PDF looks better than competitors' offerings
- ✅ No server processing required (privacy & speed)

### Week 4 Success
- ✅ Unique microsite link generated for each survey
- ✅ Customer can view survey on phone via link/QR code
- ✅ Microsite loads in <2 seconds on mobile
- ✅ Multiple sharing options work (SMS, Email, WhatsApp)
- ✅ Surveyor receives notification when customer views microsite

### Overall Launch Success
- ✅ Surveyor can complete a survey in 15-20 minutes (vs 45+ minutes manual)
- ✅ Customer receives both PDF (print) and microsite link (digital) immediately
- ✅ Surveyor wins more jobs by showing professionalism on-site
- ✅ Tool works reliably without internet connection
- ✅ >80% of customers view microsite within 24 hours

---

## Post-Launch Roadmap

### Month 2 (After 4-Week Build)
**Focus:** Collect feedback and iterate on microsite & PDF outputs

**Features:**
- Customer feedback form (embedded in microsite)
- Analytics dashboard (surveys completed, microsite views, conversion rate)
- Microsite customization (customer-specific branding themes)
- Template library (pre-built templates for common scenarios)
- Multi-language support (Welsh, Polish for UK market)
- Advanced microsite features (interactive diagrams, video walkthroughs)

### Month 3-6 (Enhancement Phase)
**Focus:** Advanced features and integrations

**Features:**
- Quote generation (convert survey to formal quote from microsite)
- Integration with accounting software (Xero, QuickBooks)
- Team collaboration (share surveys, review each other's work)
- Advanced visualizations (3D room models, AR overlays in microsite)
- Customer portal expansion (view all past surveys, track quotes)
- A/B testing different microsite layouts for conversion optimization
- Portable printer integration (Bluetooth printing from app)

### Month 6-12 (Scale Phase)
**Focus:** Market expansion and ecosystem

**Features:**
- White-label version (sell to other heating companies)
- Native mobile apps (iOS/Android for better camera/voice/printing)
- LiDAR integration (iPhone 12 Pro+ for precise measurements)
- Thermal imaging (FLIR camera for heat loss detection in microsite)
- Integration with Visual Surveyor (full ecosystem)
- Customer self-service (customer can schedule follow-up from microsite)
- Microsite analytics AI (predict quote acceptance likelihood)

---

## Dependencies & Prerequisites

### Required NPM Packages

**Core Framework:**
- `next@14` - Next.js framework with App Router
- `react@18` - React library
- `react-dom@18` - React DOM renderer

**State & Data:**
- `zustand` - State management
- `idb` - IndexedDB wrapper for offline storage
- `nanoid` - Unique ID generation for microsite links

**Voice Input (Week 1):**
- Web Speech API (browser native, no package needed)
- Optional: `@azure/cognitiveservices-speech-sdk` for fallback

**Visualization (Week 2):**
- `fabric` or `konva` + `react-konva` - Canvas annotation
- `reactflow` or `reaflow` - System diagram generation
- `react-image-crop` - Photo cropping

**PDF Generation (Week 3):**
- `@react-pdf/renderer` - PDF generation (recommended)
  - OR `jspdf` + `html2canvas` - Alternative approach
  - OR `pdfmake` - Another alternative

**Microsite & Sharing (Week 4):**
- `qrcode` or `qrcode.react` - QR code generation
- `twilio` - SMS delivery (requires account)
- `@sendgrid/mail` - Email delivery (requires account)

**Styling & UI:**
- `tailwindcss` - Utility-first CSS
- `framer-motion` - Animations (optional)
- `lucide-react` or `react-icons` - Icon library

**Development:**
- `typescript` - Type safety
- `eslint` - Linting
- `prettier` - Code formatting

### External Services

**Required:**
- Next.js hosting (Vercel, Railway, or similar)
- PostgreSQL database (for survey sessions and microsite links)

**Optional (Enhanced Features):**
- Twilio account (for SMS microsite sharing)
- SendGrid account (for email delivery)
- AWS S3 or Cloudinary (for photo storage)
- Google Cloud Platform (for advanced voice recognition fallback)

### Installation Commands

```bash
# Core dependencies
npm install next@14 react@18 react-dom@18 zustand idb nanoid

# Visualization
npm install fabric reactflow react-image-crop

# PDF generation (choose one)
npm install @react-pdf/renderer
# OR
npm install jspdf html2canvas

# Microsite & sharing
npm install qrcode twilio @sendgrid/mail

# Styling
npm install -D tailwindcss postcss autoprefixer
npm install framer-motion lucide-react

# Development
npm install -D typescript @types/react @types/node eslint prettier
```

### Browser Support
- **Required:** Chrome/Edge (Chromium) on desktop and Android
- **Required:** Safari on iOS (for mobile surveyors)
- **Voice Features:** Chrome/Edge have best Web Speech API support
- **PDF Generation:** All modern browsers (client-side generation)
- **Microsite Viewing:** All mobile browsers (responsive design)

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

This 4-week plan focuses relentlessly on the **four core priorities**:

1. ✅ **Voice Input** - Hands-free capture during survey (Week 1)
2. ✅ **Visualization Layer** - Show customer what they're getting (Week 2)
3. ✅ **PDF Generation** - Professional print output with client-side generation (Week 3)
4. ✅ **Customer Microsite** - Shareable digital experience via unique link (Week 4)

**Key Principle:** "Surveyors sell, engineers fit."

This tool helps the surveyor **win the job on-site** by:
- Capturing technical details effortlessly (voice)
- Showing the customer a clear vision (diagrams, photos)
- Leaving a professional impression (branded PDF + microsite)

### The Complete Workflow

```
Survey → Voice Input → Visualizations → Two Outputs:
                                         ├─> PDF (Print on portable printer)
                                         └─> Microsite (QR code / SMS / Email)
                                                  ↓
                                            Customer views on phone
                                                  ↓
                                            Requests formal quote
```

The goal is **not** to replace their corporate CRM or quoting system. The goal is to **help them win** before they even get back to the office.

### Key Technical Decisions

1. **Client-Side PDF Generation** (@react-pdf/renderer)
   - Privacy: Data never leaves device
   - Speed: No server round-trip
   - Offline: Works without internet

2. **Microsite Over Email Attachment**
   - Mobile-first: Optimized for phone viewing
   - Rich media: Better image quality and interactivity
   - Trackable: Know when customer views survey
   - Shareable: Easy to forward to decision-makers

3. **Next.js with App Router**
   - SSR for fast microsite loading
   - Dynamic routes for unique survey links
   - Built-in API routes for backend logic
   - PWA support for offline capability

---

**Next Steps:**
1. Review this plan with stakeholders
2. Set up Next.js 14 development environment
3. Install dependencies (see Dependencies section)
4. Begin Week 1: Voice Input Foundation
5. Weekly demos to validate progress

**Questions?** Contact the development team or refer to:
- `docs/VISUAL-SURVEYOR-ARCHITECTURE.md` (for sensor integration later)
- `docs/EXECUTIVE-SUMMARY-DEC-2025.md` (for overall system context)

---

**End of 4-Week Build Plan**

*This is a living document. Update weekly as implementation progresses.*
