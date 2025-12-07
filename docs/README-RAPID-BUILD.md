# 4-Week Rapid Build: Surveyor Workflow Implementation

## 📋 Overview

This directory contains the implementation plan and resources for building a complete surveyor workflow with:

- **Voice Input** for hands-free data capture
- **Visual Plans** with diagrams and photos
- **Professional PDF Output** for on-site printing (A4 format)
- **PWA Microsite** for digital customer delivery via QR code

## 📚 Documentation

### Main Documents

1. **[4-WEEK-RAPID-BUILD-PLAN.md](./4-WEEK-RAPID-BUILD-PLAN.md)** - Complete implementation plan
   - Week-by-week breakdown
   - Technical specifications
   - Database schema
   - Success criteria

2. **[IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md)** - Step-by-step implementation guide
   - Installation instructions
   - File structure
   - Code examples
   - Testing commands

### Supporting Documents

- [SURVEYOR_ENGINE_GUIDE.md](./SURVEYOR_ENGINE_GUIDE.md) - Voice survey integration
- [VISUAL-SURVEYOR-ARCHITECTURE.md](./VISUAL-SURVEYOR-ARCHITECTURE.md) - Visual features architecture

## 🚀 Quick Start

### 1. Review the Plan

Read the [4-week plan](./4-WEEK-RAPID-BUILD-PLAN.md) to understand the complete workflow and deliverables.

### 2. Install Dependencies

```bash
# API dependencies
cd packages/api
npm install pdfkit qrcode sharp

# PWA dependencies  
cd packages/pwa
npm install react-dropzone react-qr-code
```

### 3. Set Up Environment

Create/update `.env` in `packages/api/`:

```bash
# PDF & Photo Storage
PDF_STORAGE_BUCKET=hailmary-pdfs
PHOTO_STORAGE_BUCKET=hailmary-photos
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=eu-west-2

# PWA Configuration
PWA_BASE_URL=https://app.hailmary.com

# JWT for PWA tokens
JWT_SECRET=your-secure-secret-here
JWT_EXPIRY=30d
```

### 4. Follow Week-by-Week

Start with Week 1 in the [Implementation Guide](./IMPLEMENTATION-GUIDE.md).

## 📅 Implementation Timeline

| Week | Focus | Key Deliverables |
|------|-------|------------------|
| **Week 1** | Voice Input & Data | Survey schema, API endpoints, database |
| **Week 2** | Visualization | Diagrams, photos, visual plan preview |
| **Week 3** | PDF Generation | PDF service, QR codes, print quality |
| **Week 4** | PWA Microsite | Public routes, mobile view, sharing |

## 🎯 Success Criteria

- ✅ Surveyor completes on-site survey in < 20 minutes
- ✅ PDF looks professional and prints clearly
- ✅ QR code provides instant PWA access
- ✅ Customer can view survey on any device
- ✅ Complete workflow: Voice → Visual → PDF → PWA

## 🏗️ Architecture

```
Voice Input          Visual Plan          PDF Output          PWA Delivery
     ↓                   ↓                     ↓                    ↓
┌─────────┐      ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│ Surveyor│      │   Diagrams   │     │  PDF with   │     │   Customer  │
│  speaks │  →   │     +        │  →  │  QR Code    │  →  │   scans &   │
│  answers│      │   Photos     │     │             │     │   views     │
└─────────┘      └──────────────┘     └─────────────┘     └─────────────┘
```

## 📦 New Files Created

### Documentation
- `docs/4-WEEK-RAPID-BUILD-PLAN.md` - Main implementation plan
- `docs/IMPLEMENTATION-GUIDE.md` - Step-by-step guide
- `docs/README-RAPID-BUILD.md` - This file

### Schema
- `packages/surveyor-engine/src/samples/property-survey.json` - Survey questions

### To Be Created (per implementation guide)

**Week 1:**
- `packages/api/src/routes/surveySession.ts`
- `packages/api/drizzle/[migration].sql`

**Week 2:**
- `packages/api/src/services/visualPlanGenerator.ts`
- `packages/pwa/src/components/diagrams/`

**Week 3:**
- `packages/api/src/services/pdfGenerator.ts`
- `packages/api/src/services/qrCodeGenerator.ts`

**Week 4:**
- `packages/pwa/src/routes/PublicSurveyResult.tsx`
- `packages/api/src/services/linkGenerator.ts`

## 🧪 Testing

Each week has specific testing requirements:

```bash
# Week 1: Test voice survey
npm run pwa:dev
# Navigate to /os/survey

# Week 3: Test PDF generation
curl -X POST http://localhost:3001/api/survey-sessions/{id}/generate-pdf

# Week 4: Test PWA access
# Scan QR code or open link in mobile browser
```

## 📊 Progress Tracking

Track implementation progress in the PR:
- [ ] Week 1: Voice Input & Data Structure
- [ ] Week 2: Visualization Layer
- [ ] Week 3: PDF Generation Module
- [ ] Week 4: PWA Microsite View
- [ ] End-to-end testing
- [ ] Documentation updates

## 🤝 Contributing

When implementing:

1. Follow the week-by-week plan
2. Create tests for new functionality
3. Update documentation as you go
4. Test on portable printers (Week 3)
5. Test QR code scanning (Week 3-4)

## 📞 Support

- Review existing docs in `docs/`
- Check surveyor-engine README
- Refer to visual surveyor architecture
- Test incrementally, week by week

## 🎉 Outcome

After 4 weeks, surveyors will:

1. **Arrive on-site** with PWA
2. **Conduct voice survey** (15 minutes)
3. **Generate visual plan** with diagrams
4. **Print PDF** on portable printer
5. **Hand customer the PDF** with QR code
6. **Customer scans QR** and accesses digital version

**Result:** Professional experience, instant delivery, digital + physical copies.

---

**Start Date:** 2025-12-07  
**Target Completion:** 4 weeks from start  
**Status:** Planning complete, ready for implementation
