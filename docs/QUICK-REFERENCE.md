# Quick Reference: 4-Week Surveyor Workflow Build

## What We're Building

A complete surveyor workflow where:
1. Surveyor speaks → Voice input captures data
2. App generates → Visual plan with diagrams
3. Printer outputs → Professional PDF with QR code
4. Customer scans → Opens PWA microsite

## File Locations

### Documentation
```
docs/
├── 4-WEEK-RAPID-BUILD-PLAN.md        ← Main plan (475 lines)
├── IMPLEMENTATION-GUIDE.md            ← Step-by-step (240+ lines)
├── IMPLEMENTATION-CHECKLIST.md        ← Task tracker (230+ lines)
└── README-RAPID-BUILD.md              ← Quick start (180+ lines)
```

### New Schema
```
packages/surveyor-engine/src/samples/
└── property-survey.json               ← 20 questions, validated ✅
```

## Week-by-Week Summary

### Week 1: Voice & Data
**Build:** API endpoints, database, voice UI
**Files:** `surveySession.ts`, migration files, update PWA
**Test:** Complete voice survey, data saves

### Week 2: Visuals
**Build:** Diagram generator, photo service, preview
**Files:** `visualPlanGenerator.ts`, diagram components
**Test:** Generate diagrams, upload photos

### Week 3: PDF
**Build:** PDF generator with QR codes
**Files:** `pdfGenerator.ts`, `qrCodeGenerator.ts`
**Test:** Print on A4, scan QR code

### Week 4: PWA
**Build:** Public microsite, token auth, mobile view
**Files:** `PublicSurveyResult.tsx`, `linkGenerator.ts`
**Test:** QR → PWA access works

## Key Dependencies

```bash
# API
npm install pdfkit qrcode sharp

# PWA
npm install react-dropzone react-qr-code
```

## Database Schema

```sql
survey_sessions (id, property_data, heating_system, pdf_url, pwa_token)
survey_photos (id, session_id, url, caption)
survey_views (id, session_id, viewed_at)
```

## API Endpoints

```
# Protected
POST   /api/survey-sessions
GET    /api/survey-sessions/:id
POST   /api/survey-sessions/:id/generate-pdf
POST   /api/survey-sessions/:id/generate-link

# Public (token required)
GET    /api/public/survey-sessions/:id?token=xxx
```

## Success Metrics

- Survey time: < 20 min ✅
- PDF generation: < 30 sec ✅
- Print quality: Professional ✅
- QR scan success: > 98% ✅
- PWA load: < 3 sec ✅

## Next Action

Start Week 1 implementation:
1. Review [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md)
2. Create database migration
3. Build survey session API
4. Test voice workflow

---

**Status:** Planning complete ✅  
**Ready:** Begin implementation  
**Docs:** All planning docs created and validated
