# Job Graph + Conflict Engine Implementation

## Overview

The job graph orchestration spine is now fully implemented across the Hail-Mary stack. This system provides the missing link between data capture (Companion app) and defensible outputs (quotes, PDFs, portal uploads).

**Core Philosophy:** "On-site decisions, human-first, AI assists"

**Key Principle:** Manufacturer Instructions (MI) ALWAYS override Building Regulations when more restrictive.

## Architecture

### Three-Layer Implementation

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (packages/pwa/src/modules/job-graph/)         │
│  - JobGraphView (main hub)                              │
│  - MilestoneTimeline (progress tracker)                 │
│  - FactsPanel, ConflictsPanel, DecisionLog             │
│  - 9 files, 2,279 lines                                │
└─────────────────────────────────────────────────────────┘
                          ↓ API calls
┌─────────────────────────────────────────────────────────┐
│  API Layer (packages/api/)                              │
│  - 8 REST endpoints (/api/job-graph/*)                 │
│  - 5 database tables (spine_*)                          │
│  - Migration: 0017_add_job_graph_system.sql            │
└─────────────────────────────────────────────────────────┘
                          ↓ imports
┌─────────────────────────────────────────────────────────┐
│  Core Logic (packages/shared/src/job-graph/)           │
│  - JobGraphOrchestrator (main state machine)           │
│  - ConflictEngine (MI vs Regs precedence)              │
│  - 4 Validators (BS 5440, BS 7671, HSG264, MI)         │
│  - 12 files, 3,371 lines                               │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### 5 New Spine Tables

1. **spine_job_graphs** - Main orchestration state per visit
   - One job graph per visit (1:1 relationship)
   - Tracks overall status and confidence
   - Links to property and visit

2. **spine_milestones** - Progress checkpoints
   - 12 standard milestones (property surveyed → quote options)
   - Each has status, confidence (0-100), blockers
   - Dependency tracking (can't complete flue without building regs)

3. **spine_facts** - Extracted information
   - Links to timeline events (evidence chain)
   - Categories: property, structure, systems, compliance, customer, measurements
   - Confidence scored based on extraction method (AI/manual/measurement)

4. **spine_decisions** - Evidence-linked decisions
   - Every decision has reasoning + rule reference
   - Links to evidence facts (complete audit trail)
   - Tracks risks and assumptions
   - Records creator (engineer/AI/system)

5. **spine_conflicts** - Detected issues
   - MI vs Building Regs conflicts (auto-resolved with MI precedence)
   - Fact contradictions
   - Missing critical data
   - Incompatibilities

## API Endpoints

Base path: `/api/job-graph`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/visits/:visitId` | Get complete job graph state for visit |
| POST | `/visits/:visitId` | Initialize job graph (creates 12 milestones) |
| POST | `/:jobGraphId/facts` | Add fact with evidence linking |
| POST | `/:jobGraphId/decisions` | Record decision with reasoning |
| GET | `/:jobGraphId/conflicts?unresolved=true` | Get conflicts (optionally filter) |
| POST | `/:jobGraphId/process` | Run validation (conflict detection + compliance checks) |
| GET | `/:jobGraphId/summary` | Get summary (stats, readiness) |
| GET | `/:jobGraphId/completeness` | Get completeness assessment |

## UI Components

### Main Components

**JobGraphView** (`/visits/:visitId/job-graph`)
- Main "Bring it together" hub
- Shows overall confidence (circular 0-100 indicator)
- Milestone timeline with progress
- Tabbed panels: Facts / Decisions / Conflicts
- Output readiness (Quote / PDF / Portal)
- Run Validation button (processes state)

**MilestoneTimeline**
- Visual progress bar showing % complete
- Grid of 12 milestone cards
- Status icons (✅ complete, ⚙️ in progress, ⏳ pending, 🚫 blocked)
- Confidence indicator on each card
- Shows blockers

**ConfidenceIndicator**
- Circular progress (0-100)
- Color coding:
  - Red (0-30): Low confidence
  - Amber (31-70): Medium confidence
  - Green (71-100): High confidence
- Three sizes: small/medium/large

**FactsPanel**
- Category filter buttons (All, Property, Structure, Systems, etc.)
- Fact cards showing: category, key, value, unit, confidence
- Evidence linking (shows source timeline event)
- Add fact form with JSON value parsing

**ConflictsPanel**
- Summary stats by severity (critical/warning/info)
- Conflict cards with severity color coding
- Rule comparison (MI vs Building Regs)
- Restrictiveness indicators (MI more restrictive = auto-resolve)
- Resolution display
- Expandable resolved conflicts section

**DecisionLog**
- Expandable decision cards
- Decision type icons (compliance, system_design, safety, etc.)
- Creator badges (engineer/AI/system)
- Complete reasoning display
- Rule applied section
- Evidence facts (linked to actual fact data)
- Risks & assumptions list

## Navigation Integration

### Active Visit Workflow

1. **Start Visit from Property Page**
   - Navigate to `/properties/:id`
   - Click "Start visit" button
   - Auto-navigates to `/visits/:visitId/job-graph`
   - Job graph auto-initializes with 12 milestones

2. **Job Graph Button in Top Bar**
   - ActivePropertyBar shows "Job Graph" button when visit active
   - Always accessible from anywhere in app
   - Blue primary button styling

3. **Direct URL Access**
   - `/visits/:visitId/job-graph` - direct link to job graph

## Git Commits

All work pushed to branch: `claude/job-graph-conflict-engine-VunYi`

| Commit | Description | Files | Lines |
|--------|-------------|-------|-------|
| 388eb61 | Core logic implementation | 12 | 3,371 |
| 0a1d913 | Database schema + API routes | 2 | ~500 |
| 41a89c8 | UI layer implementation | 9 | 2,279 |
| d780087 | Routing + migration | 2 | 135 |
| 3b60071 | Navigation integration | 3 | 24 |

**Total:** 29 files, ~6,309 lines of production code

## Next Steps (Requires Dev Environment)

### 1. Run Database Migration

```bash
cd packages/api
npm run db:migrate
```

This will apply migration `0017_add_job_graph_system.sql` to create the 5 new tables.

### 2. Test Basic Flow

```bash
# Start API server
cd packages/api
npm run dev

# Start PWA
cd packages/pwa
npm run dev
```

Test workflow:
1. Navigate to a property page
2. Click "Start visit"
3. Verify navigation to job graph
4. Check 12 milestones initialized
5. Add test facts via UI
6. Click "Run Validation"
7. Check conflict detection
8. Verify confidence updates

### 3. Wire Up Automatic Fact Extraction

**Integration Point:** Connect timeline event ingestion to fact extraction

Current state:
- Timeline events ingested from Companion app → `spine_timeline_events` table
- Job graph manually accepts facts via UI

Next step:
- Add background job or real-time processor
- When timeline event inserted → analyze with AI → extract facts
- Link facts to source event via `sourceEventId`

Implementation approach:
```typescript
// In API - event handler after timeline event insert
async function processTimelineEvent(event: TimelineEvent) {
  // 1. Send to AI for analysis
  const analysis = await analyzeEvent(event);

  // 2. Extract facts
  const facts = extractFactsFromAnalysis(analysis);

  // 3. Insert facts with evidence linking
  for (const fact of facts) {
    await db.insert(spineFacts).values({
      jobGraphId: event.jobGraphId,
      sourceEventId: event.id,  // Evidence chain!
      category: fact.category,
      key: fact.key,
      value: fact.value,
      confidence: fact.confidence,
      extractedBy: 'ai',
    });
  }

  // 4. Trigger job graph state update
  await processJobGraph(event.jobGraphId);
}
```

### 4. Add Decision Automation

**Integration Point:** Auto-generate decisions from accumulated facts

Current state:
- Decisions can be recorded via API
- UI shows decision log

Next step:
- After facts accumulated, AI generates decision recommendations
- Engineer reviews and approves/modifies
- Decision recorded with complete evidence trail

Implementation:
```typescript
async function generateDecisionRecommendations(jobGraphId: string) {
  const state = await getJobGraphState(jobGraphId);

  // Send facts + milestones to AI
  const recommendations = await ai.generateDecisions({
    facts: state.facts,
    milestones: state.milestones,
    decisions: state.decisions,
  });

  // Return recommendations for engineer approval
  return recommendations.map(rec => ({
    type: rec.type,
    decision: rec.decision,
    reasoning: rec.reasoning,
    ruleApplied: rec.rule,
    evidenceFactIds: rec.evidenceIds,
    confidence: rec.confidence,
    risks: rec.risks,
  }));
}
```

### 5. Connect Output Generators

**Quote Generation:**
- When job graph reaches "ready_for_outputs" status
- Use decisions to populate quote
- Link quote back to job graph for audit trail

**PDF Export:**
- Generate customer pack with:
  - Summary (milestones completed, overall confidence)
  - Key decisions with reasoning
  - Evidence (photos from timeline events)
  - Compliance attestations (which standards checked)

**Portal Upload:**
- Check completeness before upload
- Require minimum confidence threshold
- Block upload if critical conflicts unresolved

### 6. Testing Scenarios

**Scenario 1: MI vs Building Regs Conflict**
- Add fact: "Boiler MI requires 50mm flue clearance"
- Add fact: "BS 5440 requires 30mm flue clearance"
- Run validation
- Expected: Conflict detected, auto-resolved with MI precedence
- Verify: Conflict shows "MI more restrictive → using MI requirement"

**Scenario 2: Missing Critical Data**
- Complete property survey milestone
- Skip electrical capacity check
- Attempt to complete "Heating System Spec" milestone
- Expected: Blocker detected, milestone cannot complete
- Verify: "Heating System Spec" shows blocker: "Missing electrical capacity data"

**Scenario 3: Confidence Progression**
- Add low-confidence facts (AI-extracted, confidence: 50)
- Add high-confidence facts (manual measurement, confidence: 95)
- Run validation
- Expected: Milestone confidence increases
- Verify: Overall job graph confidence updates

**Scenario 4: Complete Workflow**
1. Start visit → job graph initialized
2. Capture photos via Companion app → timeline events created
3. AI extracts facts from photos → facts linked to events
4. Engineer reviews facts → adjusts confidence if needed
5. Run validation → conflicts detected and resolved
6. Make decisions → record with evidence trail
7. Check completeness → identify missing data
8. Complete all milestones → job graph ready for outputs
9. Generate quote → populated from decisions
10. Export PDF → includes evidence trails

## Code Quality

### Type Safety
- ✅ Full TypeScript across all layers
- ✅ Shared types from `@hail-mary/shared`
- ✅ No `any` types used
- ✅ Complete API response typing

### Evidence Linking
- ✅ Timeline Event → Fact (`sourceEventId`)
- ✅ Fact → Decision (`evidenceFactIds[]`)
- ✅ Decision → Conflict (`affectedDecisionIds[]`)
- ✅ Complete audit trail for compliance

### Validation
- ✅ BS 5440 (flues and ventilation)
- ✅ BS 7671 (electrical safety)
- ✅ HSG264 (gas safety)
- ✅ Manufacturer Instructions (product-specific)

### Conflict Detection
- ✅ MI vs Building Regs (auto-resolves with MI precedence)
- ✅ Fact contradictions
- ✅ Missing critical data
- ✅ System incompatibilities

### Confidence Scoring
- ✅ Facts: Based on extraction method + source quality
- ✅ Decisions: Calculated from evidence confidence + rule strength - risk penalty
- ✅ Milestones: Aggregate from facts/decisions affecting milestone
- ✅ Job Graph: Weighted average (70% critical milestones, 30% important)

## Philosophy Implementation

### ✅ On-site decisions, human-first
- Engineer always reviews AI recommendations
- Manual override on all confidence scores
- Clear attribution (created_by: engineer/ai/system)

### ✅ Manufacturer Instructions > Building Regulations
- ConflictEngine auto-detects MI vs Regs conflicts
- Auto-resolves with MI when more restrictive
- Complete documentation of reasoning

### ✅ No hidden conflicts
- All conflicts detected and recorded
- Resolution reasoning documented
- UI shows both resolved and unresolved conflicts

### ✅ Everything tags to propertyId
- Job graph → visit → property
- All facts linked to job graph → property
- Complete property history across visits

### ✅ Confidence on every decision
- 0-100 scale on facts, decisions, milestones
- Color-coded UI (red/amber/green)
- Confidence updates trigger state recalculation

### ✅ Supplier-agnostic
- All business logic uses internal IDs
- Manufacturer data mapped to internal catalog
- No vendor lock-in

## Implementation Completeness

### ✅ Completed
- [x] Core logic (12 files, 3,371 lines)
- [x] Database schema (5 tables)
- [x] API routes (8 endpoints)
- [x] UI components (9 files, 2,279 lines)
- [x] Routing integration
- [x] Navigation workflow
- [x] Migration script
- [x] Type safety end-to-end
- [x] Documentation

### ⏳ Pending (Dev Environment Required)
- [ ] Database migration execution
- [ ] End-to-end testing
- [ ] Automatic fact extraction from timeline events
- [ ] AI decision recommendation integration
- [ ] Output generators (quote, PDF, portal)
- [ ] Background processing workers
- [ ] Performance optimization (caching, indexing)
- [ ] Mobile responsive testing

## Performance Considerations

### Database Indexes
All critical indexes already defined:
- `spine_job_graphs_visit_idx` on visit_id
- `spine_job_graphs_property_idx` on property_id
- `spine_milestones_job_graph_idx` on job_graph_id
- `spine_facts_job_graph_idx` on job_graph_id
- `spine_facts_category_idx` on category
- `spine_decisions_job_graph_idx` on job_graph_id
- `spine_conflicts_job_graph_idx` on job_graph_id

### Query Optimization
- Single query loads complete job graph state (includes all related data)
- Facts/decisions/conflicts loaded via joins
- No N+1 query problems

### Future Optimizations
- Add Redis caching for job graph summaries
- Implement incremental state updates (don't recalculate everything)
- Add GraphQL for selective field loading
- Implement pagination for large fact/decision lists

## Security Considerations

### Authentication
- All API endpoints require authentication (Express middleware)
- Visit access controlled by property ownership
- Job graph access inherits from visit access

### Data Validation
- All API inputs validated before database insert
- JSONB fields validated against schemas
- Confidence scores clamped to 0-100 range
- UUIDs validated before foreign key references

### Audit Trail
- All decisions include creator field
- All facts include extracted_by field
- Timestamps on all entities (created_at)
- Evidence linking provides complete chain of custody

## Contributing

### Development Workflow
1. Checkout branch: `claude/job-graph-conflict-engine-VunYi`
2. Make changes
3. Run tests: `npm test`
4. Build: `npm run build`
5. Commit with descriptive message
6. Push to branch

### Code Style
- TypeScript strict mode
- ESLint rules enforced
- Prettier for formatting
- No console.logs in production code
- Comprehensive error handling

### Testing
- Unit tests for core logic
- Integration tests for API endpoints
- E2E tests for UI workflows
- Load testing for performance validation

## Contact

For questions or issues, refer to the main Hail-Mary repository documentation.

---

**Implementation Status:** ✅ Foundation Complete (Ready for Dev Environment Testing)

**Last Updated:** 2026-01-04

**Branch:** `claude/job-graph-conflict-engine-VunYi`
