# Implementation Guide: 4-Week Rapid Build

This guide provides step-by-step instructions for implementing the 4-week surveyor workflow.

## Overview

See [4-WEEK-RAPID-BUILD-PLAN.md](./4-WEEK-RAPID-BUILD-PLAN.md) for the complete plan.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 17+
- AWS S3 bucket access (for PDF and photo storage)
- Portable printer support (optional but recommended)

### Installation

```bash
# Install new dependencies
cd packages/api
npm install pdfkit qrcode sharp

cd packages/pwa
npm install react-dropzone react-qr-code
```

## Week 1: Voice Input & Data Structure

### Step 1: Create Survey Schema

Create a comprehensive property survey schema:

```bash
# Location: packages/surveyor-engine/src/samples/property-survey.json
```

See example schema below.

### Step 2: Database Migration

```bash
cd packages/api
npm run db:generate
npm run db:migrate
```

Migration file will be in `packages/api/drizzle/` directory.

### Step 3: API Endpoints

Create survey session routes:

```bash
# Create: packages/api/src/routes/surveySession.ts
# Import in: packages/api/src/index.ts
```

### Step 4: PWA Integration

Update voice survey app:

```bash
# Edit: packages/pwa/src/os/apps/survey/VoiceSurveyApp.tsx
```

## Week 2: Visualization Layer

### Step 1: Visual Plan Generator

```bash
# Create: packages/api/src/services/visualPlanGenerator.ts
```

### Step 2: Diagram Components

```bash
# Create directory: packages/pwa/src/components/diagrams/
# Files:
#   - RoomLayoutDiagram.tsx
#   - HeatingSystemDiagram.tsx
#   - FloorPlanDiagram.tsx
```

### Step 3: Photo Service

```bash
# Create: packages/api/src/services/photoService.ts
# Configure S3 bucket for photo storage
```

## Week 3: PDF Generation

### Step 1: Install Dependencies

```bash
cd packages/api
npm install pdfkit qrcode
npm install --save-dev @types/pdfkit
```

### Step 2: Create PDF Generator

```bash
# Create: packages/api/src/services/pdfGenerator.ts
# Create: packages/api/src/templates/surveyReport.ts
```

### Step 3: QR Code Service

```bash
# Create: packages/api/src/services/qrCodeGenerator.ts
```

### Step 4: Test PDF Output

Print sample PDFs to ensure quality meets requirements.

## Week 4: PWA Microsite

### Step 1: Public Routes

```bash
# Create: packages/pwa/src/routes/PublicSurveyResult.tsx
# Update: packages/pwa/src/App.tsx (add public routes)
```

### Step 2: Token Generator

```bash
# Create: packages/api/src/services/linkGenerator.ts
```

### Step 3: Survey Result View

```bash
# Create: packages/pwa/src/components/SurveyResultView.tsx
```

### Step 4: End-to-End Testing

Test complete workflow:
1. Voice survey completion
2. Visual plan generation
3. PDF generation and printing
4. QR code scanning
5. PWA access

## File Structure

```
packages/
├── api/
│   ├── src/
│   │   ├── routes/
│   │   │   └── surveySession.ts          [NEW]
│   │   ├── services/
│   │   │   ├── visualPlanGenerator.ts    [NEW]
│   │   │   ├── photoService.ts           [NEW]
│   │   │   ├── pdfGenerator.ts           [NEW]
│   │   │   ├── qrCodeGenerator.ts        [NEW]
│   │   │   └── linkGenerator.ts          [NEW]
│   │   └── templates/
│   │       └── surveyReport.ts           [NEW]
│   └── drizzle/
│       └── [migration files]             [NEW]
├── pwa/
│   ├── src/
│   │   ├── components/
│   │   │   ├── diagrams/                 [NEW]
│   │   │   │   ├── RoomLayoutDiagram.tsx
│   │   │   │   ├── HeatingSystemDiagram.tsx
│   │   │   │   └── FloorPlanDiagram.tsx
│   │   │   └── SurveyResultView.tsx      [NEW]
│   │   ├── routes/
│   │   │   └── PublicSurveyResult.tsx    [NEW]
│   │   └── os/apps/survey/
│   │       ├── VoiceSurveyApp.tsx        [UPDATE]
│   │       └── VisualPlanPreview.tsx     [NEW]
└── surveyor-engine/
    └── src/samples/
        └── property-survey.json          [NEW]
```

## Example Property Survey Schema

```json
[
  {
    "id": "property_type",
    "promptText": "What type of property is this?",
    "inputType": "text",
    "validationRule": {
      "regex": "^(house|flat|bungalow|commercial)$"
    },
    "next": "bedrooms"
  },
  {
    "id": "bedrooms",
    "promptText": "How many bedrooms?",
    "inputType": "number",
    "validationRule": {
      "min": 0,
      "max": 20
    },
    "next": "bathrooms"
  },
  {
    "id": "bathrooms",
    "promptText": "How many bathrooms?",
    "inputType": "number",
    "validationRule": {
      "min": 0,
      "max": 10
    },
    "next": "current_boiler_type"
  },
  {
    "id": "current_boiler_type",
    "promptText": "What type of boiler do you currently have?",
    "inputType": "text",
    "next": "boiler_age"
  },
  {
    "id": "boiler_age",
    "promptText": "How old is the boiler in years?",
    "inputType": "number",
    "validationRule": {
      "min": 0,
      "max": 50
    },
    "next": {
      "conditions": [
        { "condition": "> 15", "nextNode": "boiler_issues" },
        { "condition": "<= 15", "nextNode": "service_history" }
      ]
    }
  },
  {
    "id": "boiler_issues",
    "promptText": "Are there any issues with the boiler?",
    "inputType": "text",
    "next": "finish"
  },
  {
    "id": "service_history",
    "promptText": "Is there a service history available?",
    "inputType": "boolean",
    "next": "finish"
  }
]
```

## Environment Variables

Add to `.env`:

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

## Testing Commands

```bash
# Test voice survey
npm run pwa:dev
# Navigate to /os/survey and test voice input

# Test PDF generation
curl -X POST http://localhost:3001/api/survey-sessions/{id}/generate-pdf

# Test PWA link
# Scan QR code or navigate to:
# http://localhost:3000/survey-result/{id}?token={token}
```

## Common Issues

### PDF Generation Slow
- Use async generation
- Cache generated PDFs
- Optimize image sizes before embedding

### QR Code Not Scanning
- Ensure sufficient contrast
- Test with multiple QR readers
- Verify URL is accessible

### Voice Recognition Fails
- Always provide manual input fallback
- Use Chrome/Edge browsers
- Check microphone permissions

## Support

For questions or issues:
- Review the main plan: [4-WEEK-RAPID-BUILD-PLAN.md](./4-WEEK-RAPID-BUILD-PLAN.md)
- Check existing documentation in `docs/`
- Review code samples in this guide

## License

ISC
