# Visit Summary Feature

## Overview
The Visit Summary feature provides AI-generated summaries of visit sessions, making it easy to quickly review what was discussed during a customer visit.

## Features

### 1. Automatic Summary Generation
- Summaries are automatically generated when the transcript reaches 50+ words
- Only generates once to avoid redundant API calls
- Uses transcript content and visit observations

### 2. Manual Summary Generation
- Click the "Generate Summary" button in the Visit Summary card at any time
- Useful for regenerating summary after significant new information is added

### 3. Summary Display
- Located below the three-panel layout (Transcript, Checklist, Key Details)
- Shows keyword-based analysis of visit content
- Includes key observations and transcript word count

## How It Works

### Database Schema
```sql
ALTER TABLE "visit_sessions" ADD COLUMN "summary" TEXT;
```

### API Endpoint
```
POST /api/visit-sessions/:id/generate-summary
```

### Summary Generation Logic
1. Retrieves transcript segments from database
2. Retrieves visit observations
3. Analyzes for common keywords:
   - Boiler mentions
   - Cylinder mentions
   - Radiator mentions
   - Pipework mentions
4. Falls back to transcript preview if no keywords found
5. Includes top 5 observations
6. Returns formatted summary with word count

## UI Components

### VisitSummaryCard
Located at: `packages/pwa/src/os/apps/visit/components/VisitSummaryCard.tsx`

**Props:**
- `summary?: string` - The summary text to display
- `isGenerating?: boolean` - Whether summary is being generated
- `onGenerate: () => void` - Callback for generate button click

## Usage Example

### In VisitApp.tsx
```typescript
<VisitSummaryCard 
  summary={visitSummary}
  isGenerating={isGeneratingSummary}
  onGenerate={generateSummary}
/>
```

## Database Migration

To apply the migration:
```bash
cd packages/api
npm run db:migrate
```

This will add the `summary` column to the `visit_sessions` table.

## Testing

### Manual Testing
1. Start a visit session
2. Speak at least 50 words of transcript content
3. Observe automatic summary generation
4. Click "Generate Summary" to regenerate
5. Verify summary appears in the card

### API Testing
```bash
# Generate summary for visit session with ID 1
curl -X POST http://localhost:3001/api/visit-sessions/1/generate-summary
```

## Future Enhancements

Potential improvements for future versions:
1. Use LLM (Sarah service) for more sophisticated summaries
2. Add summary editing capability
3. Export summary to PDF
4. Email summary to customer
5. Version history for summaries
6. Custom summary templates

## Troubleshooting

**Summary not generating:**
- Check that transcript has at least 50 words
- Verify API endpoint is accessible
- Check browser console for errors

**Empty summary:**
- Ensure visit has transcript segments or observations
- Check database has proper data

**Duplicate generations:**
- This should not happen - debouncing prevents multiple calls
- If it occurs, check the `visitSummary` state is being properly set
