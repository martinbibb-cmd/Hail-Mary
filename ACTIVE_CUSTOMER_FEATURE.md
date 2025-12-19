# Active Customer Context Feature

## Overview

The Active Customer Context feature introduces a persistent, always-visible customer selection system that ensures all artifacts (notes, photos, transcripts, uploads, etc.) are properly linked to a customer/lead. This eliminates the "where did it go?" problem by making the target customer always visible and enforcing that artifacts cannot be created without an active customer selected.

## Problem Statement

Previously, the application had issues where:
- Notes, photos, and transcripts could be created without being linked to a customer
- Users had to manually link artifacts after creation
- There was confusion about which customer/lead was being worked on
- Data could be "orphaned" without a customer association

## Solution

### Architecture

The solution introduces a three-part architecture:

1. **PWA (Frontend)**
   - Global Zustand store for active customer state
   - Persistent top bar component showing active customer
   - Customer selector modal
   - Guard hooks to prevent actions without active customer
   - LocalStorage persistence for browser sessions

2. **API (Backend)**
   - LeadId validation middleware
   - Session endpoints for server-side persistence
   - Enforcement of leadId on artifact creation routes

3. **Data Model**
   - Uses `leadId` as the canonical parent ID
   - All artifacts reference a single lead
   - Customers are leads with status='won' (existing model)

## Implementation Details

### PWA Components

#### ActiveCustomerStore (`packages/pwa/src/stores/activeCustomerStore.ts`)

Global Zustand store managing active customer state:

```typescript
interface ActiveCustomerStore {
  activeLeadId: string | null;
  activeLead: Lead | null;
  saveStatus: SaveStatus; // 'idle' | 'saving' | 'saved' | 'error'
  saveError: string | null;
  
  setActiveLead: (lead: Lead) => void;
  clearActiveLead: () => void;
  setSaveStatus: (status: SaveStatus, error?: string) => void;
  hydrate: () => Promise<void>;
}
```

**Features:**
- Persists to localStorage (`hail-mary:active-customer` key)
- Auto-validates on hydration by fetching from API
- Manages save status for UI feedback

#### ActiveCustomerBar (`packages/pwa/src/components/ActiveCustomerBar.tsx`)

Persistent top bar component visible on all screens:

**When customer is active:**
- Shows customer name and address/postcode
- "Change" button to select different customer
- "Clear" button to deselect
- Live save status indicator (⏳ Saving... / ✓ Saved / ⚠️ Error)

**When no customer:**
- Warning message: "⚠️ No Active Customer"
- Prompt: "Select a customer to start capturing data"
- "Select Customer" button

#### CustomerSelectorModal

Searchable modal for selecting active customer:
- Lists all leads/customers
- Search by name, postcode, or ID
- Click to select and navigate to lead workspace

#### useActiveCustomerGuard Hook (`packages/pwa/src/hooks/useActiveCustomerGuard.ts`)

Reusable hook for guarding capture actions:

```typescript
const { guardAction, getActiveLeadId, hasActiveCustomer } = useActiveCustomerGuard();

// Block action if no active customer
if (!guardAction('upload photo')) {
  return; // Shows alert, prevents action
}

// Get leadId for API request
const leadId = getActiveLeadId();
```

### API Components

#### LeadId Middleware (`packages/api/src/middleware/leadId.middleware.ts`)

Two middleware functions for validation:

1. **requireLeadId** - For POST/PUT/PATCH body validation
   - Checks `req.body.leadId` exists
   - Validates format
   - Returns 400 if missing: `"leadId is required (active customer not selected)"`

2. **validateLeadIdParam** - For URL parameter validation
   - Checks `req.params.id` exists
   - Validates format
   - Returns 400 if invalid

**Usage:**
```typescript
router.post('/sessions', requireLeadId, async (req, res) => {
  // leadId is guaranteed to exist and be valid
  const leadId = req.body.leadId!;
  // ...
});
```

#### Session Routes (`packages/api/src/routes/session.ts`)

Server-side persistence for active customer:

- **POST /api/session/active-lead** - Save active leadId for user
- **GET /api/session/active-lead** - Retrieve active leadId for user
- **DELETE /api/session/active-lead** - Clear active leadId for user

Currently uses in-memory Map storage (per user). Can be upgraded to Redis or database for multi-server deployments.

#### Routes Updated with LeadId Validation

1. **Transcription** (`packages/api/src/routes/transcription.ts`)
   - `POST /api/transcription/sessions` - Requires leadId

2. **Visit Sessions** (`packages/api/src/routes/visitSessions.ts`)
   - `POST /api/visit-sessions` - Requires leadId

3. **Voice Notes** (indirect validation via transcript session)
   - Already linked through transcript session leadId

## Integration Points

### Setting Active Customer

The active customer is automatically set when:
1. User navigates to a lead workspace (`/leads/:id`)
2. User clicks "Select Customer" and chooses from modal
3. Application hydrates from localStorage on boot

Code example from LeadWorkspace:
```typescript
const { setActiveLead } = useActiveCustomerStore();

useEffect(() => {
  const loadWorkspace = async () => {
    const data = await fetch(`/api/leads/${id}/workspace`);
    if (data.success) {
      setActiveLead(data.data.lead); // Auto-set active customer
    }
  };
  loadWorkspace();
}, [id]);
```

### Using Active Customer in Components

Example for photo upload:
```typescript
import { useActiveCustomerGuard } from '../hooks/useActiveCustomerGuard';

function PhotoUploadButton() {
  const { guardAction, getActiveLeadId } = useActiveCustomerGuard();
  
  const handleUpload = async (file: File) => {
    // Guard the action
    if (!guardAction('upload photo')) {
      return; // Blocked - no customer selected
    }
    
    // Get leadId for API request
    const leadId = getActiveLeadId();
    
    // Upload with leadId
    const formData = new FormData();
    formData.append('file', file);
    formData.append('leadId', leadId!);
    
    await fetch('/api/files', {
      method: 'POST',
      body: formData,
    });
  };
  
  return <button onClick={() => /* ... */}>Upload Photo</button>;
}
```

## User Experience

### Before This Feature
1. User creates note/photo/transcript
2. System saves it without customer link
3. User has to manually find and link it later
4. OR data is orphaned and lost

### After This Feature
1. User must select active customer first
2. Top bar always shows who they're working with
3. All captures automatically link to that customer
4. Clear visual feedback on save status
5. Can easily switch customers when needed

## Configuration

### LocalStorage Key
```
hail-mary:active-customer
```

Stores: `{ leadId: string, lead: Lead }`

### Session Storage (Server-side)
In-memory Map keyed by `userId`
Can be upgraded to Redis/database by modifying `packages/api/src/routes/session.ts`

## Future Enhancements

### Short Term
- [ ] Apply leadId validation to all artifact creation routes
- [ ] Implement auto-save for notes with debouncing
- [ ] Add visual blocking of capture buttons when no active customer
- [ ] Show "Saved to [Customer Name]" confirmation toasts

### Medium Term
- [ ] Upgrade server-side storage to Redis/database
- [ ] Add "Recent Customers" quick-select in bar
- [ ] Implement keyboard shortcuts (Ctrl+K for customer search)
- [ ] Add active customer sync across browser tabs
- [ ] Conflict resolution when multiple tabs have different active customers

### Long Term
- [ ] Cross-device synchronization via WebSocket
- [ ] Activity timeline showing when customer was active
- [ ] Team awareness (see what customer teammates are working on)
- [ ] Smart suggestions based on calendar, recent visits, etc.

## Testing

### Manual Testing Checklist

- [ ] Active customer bar visible on all screens
- [ ] Can select customer via modal
- [ ] Can search customers by name/postcode/ID
- [ ] Can clear active customer
- [ ] localStorage persists across page refresh
- [ ] API rejects transcript creation without leadId
- [ ] API rejects visit session creation without leadId
- [ ] LeadWorkspace auto-sets active customer
- [ ] Save status indicator updates correctly

### Automated Testing (Recommended)

```typescript
// Example test for ActiveCustomerStore
describe('ActiveCustomerStore', () => {
  it('should persist to localStorage when setting active lead', () => {
    const store = useActiveCustomerStore.getState();
    const lead = { id: '1', firstName: 'John', lastName: 'Doe' };
    
    store.setActiveLead(lead);
    
    const stored = localStorage.getItem('hail-mary:active-customer');
    expect(stored).toContain('"leadId":"1"');
  });
  
  it('should clear localStorage when clearing active lead', () => {
    const store = useActiveCustomerStore.getState();
    store.clearActiveLead();
    
    const stored = localStorage.getItem('hail-mary:active-customer');
    expect(stored).toBeNull();
  });
});
```

## Troubleshooting

### Issue: Active customer not persisting
**Solution:** Check browser localStorage is enabled and not full

### Issue: API returns "leadId is required" error
**Solution:** Ensure active customer is selected before attempting action. Check that frontend is sending leadId in request body.

### Issue: Active customer cleared on page refresh
**Solution:** Check localStorage permissions. Verify hydrate() is called in App.tsx on mount.

### Issue: Customer selector modal not showing leads
**Solution:** Verify `/api/leads` endpoint is accessible and returning data. Check network tab for errors.

## API Reference

### Frontend Store

```typescript
// Get store instance
import { useActiveCustomerStore } from './stores/activeCustomerStore';

// In component
const { activeLeadId, activeLead, setActiveLead, clearActiveLead, setSaveStatus } = useActiveCustomerStore();

// Set active customer
setActiveLead(lead);

// Clear active customer
clearActiveLead();

// Update save status
setSaveStatus('saving');
setSaveStatus('saved');
setSaveStatus('error', 'Failed to save note');
```

### Backend Middleware

```typescript
import { requireLeadId, validateLeadIdParam } from './middleware/leadId.middleware';

// Require leadId in body
router.post('/artifacts', requireLeadId, handler);

// Validate leadId in URL params
router.get('/leads/:id/artifacts', validateLeadIdParam, handler);
```

### Backend Session API

```typescript
// Save active lead for user
POST /api/session/active-lead
Body: { leadId: "123" }

// Get active lead for user
GET /api/session/active-lead
Response: { success: true, data: { leadId: "123" } }

// Clear active lead for user
DELETE /api/session/active-lead
Response: { success: true, message: "Active lead cleared" }
```

## Architecture Decisions

### Why Zustand?
- Already used in the project (windowStore, tabletLayoutStore)
- Lightweight and simple API
- Easy integration with React hooks
- No provider/context wrapper needed

### Why leadId as canonical ID?
- Database already uses leadId as primary reference
- Customers are leads with status='won' (no separate table)
- Simpler than maintaining both leadId and customerId
- Aligns with existing data model

### Why localStorage for persistence?
- Simple, no server dependency
- Instant load times
- Works offline
- Browser-specific (appropriate for UI state)

### Why in-memory Map for server-side?
- Fast lookups (O(1))
- No external dependency initially
- Easy to upgrade to Redis/DB later
- Sufficient for MVP/single-server deployments

## Migration Notes

This feature is **additive** and does not require database migrations. Existing data is unchanged. Going forward:

1. New transcripts will require leadId
2. New visit sessions will require leadId
3. Other artifact routes should be updated gradually
4. Existing artifacts without leadId remain accessible but are not enforced

No breaking changes for existing functionality.

## Credits

Implementation follows the architectural pattern described in the problem statement:
- Persistent Active Customer bar (always visible)
- First-class Active Customer concept
- Auto-association of all artifacts
- Clear "Select customer first" blocking
- Save status indicators
