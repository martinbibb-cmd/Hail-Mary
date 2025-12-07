# 4-Week Rapid Build Plan: Surveyor Workflow with PDF & PWA

**Version:** 1.0  
**Date:** 2025-12-07  
**Status:** Implementation Plan  

---

## Executive Summary

This document outlines a **4-week rapid build plan** to implement a complete surveyor workflow with the following features:

1. **Voice Input** for data collection during site visits
2. **Visual Plan Generation** with diagrams and photos
3. **Professional PDF Output** for instant on-site printing (A4 format)
4. **PWA Microsite** for digital delivery to customers via QR code

---

## The Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Surveyor On-Site                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Voice Input → Capture property data hands-free          │
│  2. Visual Plan → App generates diagrams/layout              │
│  3. Print PDF → Instant professional document (portable)     │
│  4. Send Link → Customer receives PWA link via QR/SMS        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Customer Receives:**
- 📄 **Physical Copy**: Professional PDF printout (left on-site)
- 📱 **Digital Copy**: PWA link accessible on any device

---

## Week-by-Week Breakdown

### Week 1: Voice Input & Data Structure 🎤

**Goal:** Enable surveyors to capture complete property data via voice input.

#### Key Deliverables

1. **Enhanced Voice Survey Schema**
   - Extend existing `surveyor-engine` with comprehensive property survey
   - Support for property details, heating systems, room measurements
   - Conditional logic based on property characteristics
   - Location: `packages/surveyor-engine/src/samples/property-survey.json`

2. **Survey Session Storage**
   - API endpoints for creating and managing survey sessions
   - Database schema for structured storage
   - Link surveys to customers/leads
   - Files:
     - `packages/api/src/routes/surveySession.ts`
     - `packages/api/src/db/schema/surveySessions.ts`

3. **Voice UI Integration**
   - Update PWA with enhanced voice survey interface
   - Save/resume functionality for interrupted surveys
   - Real-time validation and feedback
   - Location: `packages/pwa/src/os/apps/survey/VoiceSurveyApp.tsx`

#### Success Criteria
- ✅ Complete voice survey in 10-15 minutes
- ✅ Data stored in structured, queryable format
- ✅ Session resumable if interrupted
- ✅ Validation prevents invalid data

---

### Week 2: Visualization Layer (Diagrams/Photos) 📊

**Goal:** Transform survey data into professional visual representations.

#### Key Deliverables

1. **Visual Plan Generator**
   - Service to generate diagrams from survey data
   - Room layout diagrams
   - Heating system schematics
   - Floor plan visualizations
   - Location: `packages/api/src/services/visualPlanGenerator.ts`

2. **Diagram Components**
   - SVG-based diagram rendering
   - Room layout with dimensions and equipment
   - Heating system flow diagrams
   - Floor plan overview
   - Location: `packages/pwa/src/components/diagrams/`

3. **Photo Management**
   - Upload and attach photos to surveys
   - Annotation capabilities
   - S3 storage with CDN
   - Location: `packages/api/src/services/photoService.ts`

4. **Visual Plan Preview**
   - Preview interface before PDF generation
   - Editable components
   - Location: `packages/pwa/src/os/apps/survey/VisualPlanPreview.tsx`

#### Success Criteria
- ✅ Auto-generate diagrams from data
- ✅ Clear, professional visualizations
- ✅ Photos properly linked and displayed
- ✅ Preview accurately represents final output

---

### Week 3: PDF Generation Module 📄

**Goal:** Generate print-ready, professional A4 PDFs with embedded QR codes.

**Critical Requirements:**
- Professional brochure-like appearance
- A4 format (210mm × 297mm)
- High-quality printing on portable printers
- Embedded QR code linking to PWA

#### Key Deliverables

1. **PDF Generator Service**
   - High-quality PDF generation (using `pdfkit` or `puppeteer`)
   - Professional template design
   - Location: `packages/api/src/services/pdfGenerator.ts`

2. **PDF Template**
   - Company branding header
   - Property and customer information
   - Survey summary
   - Diagrams and photos layout
   - Recommendations section
   - QR code footer
   - Contact information
   - Location: `packages/api/src/templates/surveyReport.ts`

3. **QR Code Generator**
   - Generate QR codes linking to PWA
   - Embed in PDF footer
   - Library: `qrcode`
   - Location: `packages/api/src/services/qrCodeGenerator.ts`

4. **PDF API**
   ```
   POST /api/survey-sessions/:id/generate-pdf
   GET  /api/survey-sessions/:id/pdf
   ```

#### PDF Layout Specification

```
┌────────────────────────────────────────────────┐
│ [LOGO]        PROPERTY SURVEY REPORT           │
│                                                 │
│ Customer: John Smith                            │
│ Property: 123 Main Street, SW1A 1AA            │
│ Survey Date: 7 Dec 2025                        │
├────────────────────────────────────────────────┤
│ 1. PROPERTY DETAILS                            │
│    • Type: 3-bed house                         │
│    • Year Built: 1985                          │
│                                                 │
│ 2. CURRENT HEATING SYSTEM                      │
│    [HEATING SYSTEM DIAGRAM]                    │
│                                                 │
│ 3. ROOM-BY-ROOM ANALYSIS                       │
│    [ROOM LAYOUT DIAGRAMS]                      │
│    [PHOTOS]                                    │
│                                                 │
│ 4. RECOMMENDATIONS                             │
│    • Priority items and costs                  │
│                                                 │
├────────────────────────────────────────────────┤
│ Scan for digital version:                      │
│         ┌─────────┐                            │
│         │ QR CODE │  → PWA Link                │
│         └─────────┘                            │
└────────────────────────────────────────────────┘
```

#### Success Criteria
- ✅ Professional, brochure-quality appearance
- ✅ Prints clearly on portable A4 printer
- ✅ QR code scans correctly
- ✅ File size < 5MB with photos
- ✅ Generation time < 30 seconds

---

### Week 4: PWA Microsite View 📱

**Goal:** Create mobile-optimized digital version accessible via QR code.

#### Key Deliverables

1. **Public PWA Route**
   - No-login required access
   - Token-based authentication
   - Location: `packages/pwa/src/routes/PublicSurveyResult.tsx`

2. **Survey Result View**
   - Mobile-first responsive design
   - Same content as PDF, optimized for screens
   - Interactive expandable sections
   - Photo viewer
   - Location: `packages/pwa/src/components/SurveyResultView.tsx`

3. **Shareable Link Generator**
   - Secure, time-limited tokens
   - Track when customer views
   - Location: `packages/api/src/services/linkGenerator.ts`

4. **QR Landing Page**
   - Optimized landing experience
   - Clear navigation
   - Download PDF option
   - Location: `packages/pwa/src/routes/SurveyLanding.tsx`

#### PWA View Structure

```
/survey-result/:sessionId?token=xxx
  ↓
┌─────────────────────────────────────┐
│  🏠 Your Property Survey             │
│                                      │
│  123 Main Street, SW1A 1AA          │
│  Surveyed: 7 Dec 2025               │
├─────────────────────────────────────┤
│  📊 Property Details [▼]            │
│  🔥 Heating System [▼]              │
│  📐 Room Analysis [▼]               │
│  📸 Photos [▼]                      │
│  💡 Recommendations [▼]             │
│                                      │
│  [📥 Download PDF]                  │
│  [📧 Email to Me]                   │
└─────────────────────────────────────┘
```

#### Success Criteria
- ✅ QR code provides instant access
- ✅ Mobile-optimized and responsive
- ✅ All PDF content accessible
- ✅ Download PDF feature works
- ✅ Links expire after 30 days
- ✅ View tracking for analytics

---

## Technology Stack

### Backend Dependencies
```json
{
  "dependencies": {
    "pdfkit": "^0.14.0",
    "qrcode": "^1.5.3",
    "sharp": "^0.33.0"
  }
}
```

### Frontend Dependencies
```json
{
  "dependencies": {
    "react-dropzone": "^14.2.3",
    "react-qr-code": "^2.0.12"
  }
}
```

---

## Database Schema

```sql
-- Survey Sessions
CREATE TABLE survey_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  customer_id UUID REFERENCES customers(id),
  surveyor_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'in_progress',
  
  -- Survey data (JSONB for flexibility)
  property_data JSONB NOT NULL,
  heating_system JSONB,
  measurements JSONB,
  customer_requirements JSONB,
  
  -- Generated assets
  visual_plan_data JSONB,
  pdf_url TEXT,
  pwa_token TEXT,
  
  survey_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Photos
CREATE TABLE survey_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES survey_sessions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  category VARCHAR(50),
  annotations JSONB,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- PWA View Tracking
CREATE TABLE survey_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES survey_sessions(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET
);

-- Indexes
CREATE INDEX idx_survey_sessions_lead ON survey_sessions(lead_id);
CREATE INDEX idx_survey_sessions_status ON survey_sessions(status);
CREATE INDEX idx_survey_photos_session ON survey_photos(session_id);
```

---

## API Endpoints

### Survey Sessions (Protected)
```
POST   /api/survey-sessions              Create new survey
GET    /api/survey-sessions/:id          Get survey
PUT    /api/survey-sessions/:id          Update survey
DELETE /api/survey-sessions/:id          Delete survey

POST   /api/survey-sessions/:id/photos   Upload photo
POST   /api/survey-sessions/:id/generate-visual-plan
POST   /api/survey-sessions/:id/generate-pdf
POST   /api/survey-sessions/:id/generate-link
```

### Public (Token-authenticated)
```
GET    /api/public/survey-sessions/:id?token=xxx
POST   /api/public/survey-sessions/:id/track-view
GET    /api/public/survey-sessions/:id/pdf?token=xxx
```

---

## Testing Strategy

### Week 1
- Voice survey completes successfully
- All data types captured correctly
- Session persistence works
- API endpoints functional

### Week 2
- Diagrams generate correctly
- Photos upload and display
- Visual plan preview renders
- All diagram types work

### Week 3
- PDF generates without errors
- Layout matches specifications
- QR code embeds and scans
- PDF prints clearly
- File size acceptable

### Week 4
- PWA link opens correctly
- Token auth works
- Mobile responsive
- PDF download works
- View tracking functional
- Links expire properly

### End-to-End
- Complete workflow: Voice → Visual → PDF → PWA
- On-site completion < 20 minutes
- Customer can access via QR
- Professional quality output

---

## Deployment Requirements

### Environment Variables
```bash
PDF_STORAGE_BUCKET=hailmary-pdfs
PHOTO_STORAGE_BUCKET=hailmary-photos
PWA_BASE_URL=https://app.hailmary.com
JWT_SECRET=<secure-secret>

AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=eu-west-2
```

### Infrastructure
- S3 buckets for PDFs and photos
- CDN for fast asset delivery
- Database migrations
- Service worker updates for PWA

---

## Success Metrics

### Efficiency
- Survey time: < 20 minutes (target: 15)
- PDF generation: < 30 seconds
- Voice accuracy: > 95%

### Customer Experience
- QR scan success: > 98%
- PWA load time: < 3 seconds
- Print quality: Professional

### Technical
- PDF size: < 5MB average
- API response: < 2s
- Token validity: 30 days
- Zero data loss

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Voice fails | Manual input fallback |
| PDF slow | Async generation, caching |
| QR doesn't scan | SMS/email link backup |
| Printer issues | Support multiple types, email option |
| Link expires | Reminder emails, re-send option |

---

## Future Enhancements

1. Offline mode for poor connectivity
2. Multi-language support
3. E-signature capability
4. SMS integration
5. Analytics dashboard
6. Custom branding
7. Video attachments
8. AR room scanning

---

## References

- [Surveyor Engine Guide](./SURVEYOR_ENGINE_GUIDE.md)
- [Visual Surveyor Architecture](./VISUAL-SURVEYOR-ARCHITECTURE.md)
- [PWA Structure](./CUSTOMER-PORTAL-PWA-STRUCTURE.md)

---

**End of Document**

*Update this document as implementation progresses.*
