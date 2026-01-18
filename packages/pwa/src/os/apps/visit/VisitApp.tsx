import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { 
  VisitSession,
  ApiResponse, 
  PaginatedResponse,
  Lead,
  LeadWorkspace,
} from '@hail-mary/shared'
import { 
  TranscriptFeed, 
  AssetFeed,
  InstallChecklist, 
  KeyDetailsForm,
  VisitSummaryCard,
  type TranscriptSegment,
  type KeyDetails
} from './components'
import { getRockyStatus as getLocalRockyStatus } from './rockyExtractor'
import { useLeadStore } from '../../../stores/leadStore'
import { useVisitStore } from '../../../stores/visitStore'
import { useSpineStore } from '../../../stores/spineStore'
import { clearAutoFilledField } from '../../../services/visitCaptureOrchestrator'
import { formatSaveTime, exportLeadAsJsonFile } from '../../../utils/saveHelpers'
import { useTranscriptionStore } from '../../../stores/transcriptionStore'
import { useVisitCaptureStore } from '../../../stores/visitCaptureStore'
import { useExtractedData } from '../../../hooks/useExtractedData'
import { useLiveTranscriptPolling } from '../../../hooks/useLiveTranscriptPolling'
import { useAuth } from '../../../auth'
import './VisitApp.css'

/**
 * Visit App - Voice-driven survey tool with save reliability
 * 
 * Save Boundaries (automatic + manual):
 * 1. Process Recording - Saves after each transcript segment is processed
 * 2. Stop Recording - Saves when user stops the microphone
 * 3. End Visit - Saves when visit is completed
 * 4. Manual Save - User clicks Save button in header or banner
 * 
 * Save Reliability:
 * - All saves go through retry queue (3 attempts)
 * - Save status shown in real-time (Syncing/Unsaved/Saved/Failed)
 * - After 3 failures, Export JSON button appears for offline backup
 */

// Simple API client
const api = {
  async get<T>(url: string): Promise<T> {
    const res = await fetch(url, { credentials: 'include' })
    return res.json()
  },
  async post<T>(url: string, data: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return res.json()
  },
  async put<T>(url: string, data: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return res.json()
  },
}

type ViewMode = 'list' | 'active'

export const VisitApp: React.FC = () => {
  const storedActiveSession = useVisitStore((state) => state.activeSession)
  const storedActiveLead = useVisitStore((state) => state.activeLead)
  const [viewMode, setViewMode] = useState<ViewMode>(() => (storedActiveSession ? 'active' : 'list'))
  const [activeSession, setActiveSession] = useState<VisitSession | null>(() => storedActiveSession)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  
  // Lead store for save triggers
  const currentLeadId = useLeadStore((state) => state.currentLeadId)
  const leadById = useLeadStore((state) => state.leadById)
  const enqueueSave = useLeadStore((state) => state.enqueueSave)
  const markDirty = useLeadStore((state) => state.markDirty)
  const isSyncing = useLeadStore((state) => state.isSyncing)
  const saveFailuresByLeadId = useLeadStore((state) => state.saveFailuresByLeadId)
  const dirtyByLeadId = useLeadStore((state) => state.dirtyByLeadId)
  const lastSavedAtByLeadId = useLeadStore((state) => state.lastSavedAtByLeadId)
  const exportLeadAsJson = useLeadStore((state) => state.exportLeadAsJson)
  
  // Spine store for address context
  const activeAddress = useSpineStore((state) => state.activeAddress)
  
  // Visit store for session/recording state
  const setActiveSessionInStore = useVisitStore((state) => state.setActiveSession)
  const clearSessionInStore = useVisitStore((state) => state.clearSession)
  const globalEndVisit = useVisitStore((state) => state.endVisit)
  
  // Structured visit state (global; survives navigation while recording)
  const checklistItems = useVisitCaptureStore((state) => state.checklistItems)
  const keyDetails = useVisitCaptureStore((state) => state.keyDetails)
  const autoFilledFields = useVisitCaptureStore((state) => state.autoFilledFields)
  const exceptions = useVisitCaptureStore((state) => state.exceptions)
  const resetCaptureForSession = useVisitCaptureStore((state) => state.resetForSession)
  const clearCapture = useVisitCaptureStore((state) => state.clear)
  const toggleChecklistItem = useVisitCaptureStore((state) => state.toggleChecklistItem)
  const setKeyDetailsInCapture = useVisitCaptureStore((state) => state.setKeyDetails)
  const setExceptionsInCapture = useVisitCaptureStore((state) => state.setExceptions)
  const removeAutoFilledFieldInCapture = useVisitCaptureStore((state) => state.removeAutoFilledField)
  
  
  // Visit summary state
  const [visitSummary, setVisitSummary] = useState<string | undefined>(undefined)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [assetRefreshKey, setAssetRefreshKey] = useState(0)
  const [isImportingMedia, setIsImportingMedia] = useState(false)
  const [importMediaError, setImportMediaError] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const transcriptionSession = useTranscriptionStore((state) => state.activeSession)
  const transcriptSegments: TranscriptSegment[] = useMemo(() => {
    const segments = transcriptionSession?.segments || []
    // Ensure timestamps are Dates (persist middleware may rehydrate as strings in some cases)
    return segments.map((s) => ({
      ...s,
      timestamp: s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp as any),
    })) as TranscriptSegment[]
  }, [transcriptionSession?.segments])
  const extracted = useExtractedData(currentLeadId)

  // Live transcript polling (Option A) for the active transcript session
  useLiveTranscriptPolling({
    leadId: currentLeadId,
    sessionId: transcriptionSession?.sessionId ?? null,
    enabled: viewMode === 'active' && !!currentLeadId,
    intervalMs: 1500,
    processDebounceMs: 8000,
  })
  
  // Accumulated final transcript for Rocky processing
  const accumulatedTranscriptRef = useRef<string>('')

  // Rocky status (always 'connected' for local extraction)
  const [rockyStatus] = useState<'connected' | 'degraded' | 'blocked'>(getLocalRockyStatus())

  const activeLead: Lead | null = useMemo(() => {
    if (!currentLeadId) return null
    return leadById[currentLeadId] || null
  }, [currentLeadId, leadById])

  const syncKeyDetailsFromWorkspace = useCallback(async () => {
    if (!currentLeadId) return
    try {
      const res = await fetch(`/api/leads/${currentLeadId}/workspace`, { credentials: 'include' })
      const json: ApiResponse<LeadWorkspace> = await res.json()
      if (!json.success || !json.data) return

      const ws = json.data
      const wsType = (ws.property?.type || '').toLowerCase().trim()
      const wsSchedule = (ws.occupancy?.schedule || '').trim()

      const mappedType = wsType
        ? (wsType === 'flat' || wsType === 'bungalow' || wsType === 'other' ? wsType : 'house')
        : undefined

      setKeyDetailsInCapture({
        ...keyDetails,
        ...(mappedType ? { propertyType: mappedType } : null),
        ...(wsSchedule ? { occupancy: wsSchedule } : null),
      })
    } catch {
      // ignore
    }
  }, [currentLeadId, keyDetails, setKeyDetailsInCapture])

  // Keep local ref synced with global transcription store (used by Whisper flow + manual save payloads)
  useEffect(() => {
    accumulatedTranscriptRef.current = transcriptionSession?.accumulatedTranscript || ''
  }, [transcriptionSession?.accumulatedTranscript])

  // If the active lead changes mid-session, reset visit context so saves route to the new lead.
  // Do NOT clear persisted transcript segments here; they are loaded per-lead above.
  const lastLeadIdRef = useRef<string | null>(null)
  useEffect(() => {
    // First mount: just record baseline
    if (lastLeadIdRef.current === null) {
      lastLeadIdRef.current = currentLeadId
      return
    }

    if (lastLeadIdRef.current !== currentLeadId) {
      lastLeadIdRef.current = currentLeadId
      setViewMode('list')
      setActiveSession(null)
      clearSessionInStore()
      clearCapture()
      setVisitSummary(undefined)
    }
  }, [currentLeadId, clearSessionInStore, clearCapture])

  // Re-enter active view when returning to Visit Notes (component remount).
  // Transcript + derived structured state are global/persisted (transcription + visitCapture stores).
  useEffect(() => {
    if (!currentLeadId) return
    if (!storedActiveSession || !storedActiveLead) return
    if (String(storedActiveLead.id) !== String(currentLeadId)) return

    setActiveSession(storedActiveSession)
    setViewMode('active')
  }, [currentLeadId, storedActiveSession, storedActiveLead])

  // Keep workspace-backed fields in Key Details synced while the Visit screen is active.
  useEffect(() => {
    if (viewMode !== 'active' || !currentLeadId) return

    syncKeyDetailsFromWorkspace()
    const interval = window.setInterval(syncKeyDetailsFromWorkspace, 10000)
    return () => window.clearInterval(interval)
  }, [viewMode, currentLeadId, syncKeyDetailsFromWorkspace])

  // Keep Key Details in sync with extracted + workspace-backed facts.
  // Non-destructive: only fill blanks so user edits don't get overwritten.
  useEffect(() => {
    if (!currentLeadId || !extracted.isAvailable) return

    const next: Partial<KeyDetails> = {}

    // Property type
    if (!keyDetails.propertyType && extracted.property.propertyType) {
      const pt = extracted.property.propertyType
      next.propertyType = (pt === 'flat' || pt === 'bungalow') ? pt : 'house'
    }

    // Bedrooms
    if ((keyDetails.bedrooms === undefined || keyDetails.bedrooms === null) && typeof extracted.property.bedrooms === 'number') {
      next.bedrooms = extracted.property.bedrooms
    }

    // Occupancy summary (best-effort)
    if (!keyDetails.occupancy) {
      next.occupancy = extracted.occupancy.schedule
        || (typeof extracted.occupancy.homeAllDay === 'boolean'
          ? (extracted.occupancy.homeAllDay ? 'Home all day' : 'Out 9-5')
          : undefined)
    }

    // Boiler age
    if ((keyDetails.boilerAge === undefined || keyDetails.boilerAge === null) && typeof extracted.boiler.boilerAge === 'number') {
      next.boilerAge = extracted.boiler.boilerAge
    }

    // Current system (type + make)
    if (!keyDetails.currentSystem) {
      const type = extracted.boiler.currentBoilerType
      const make = extracted.boiler.currentBoilerMake
      const label = [make, type].filter(Boolean).join(' ')
      if (label) next.currentSystem = label
    }

    // Issues
    if ((!keyDetails.issues || keyDetails.issues.length === 0) && extracted.issues.length > 0) {
      next.issues = extracted.issues
    }

    if (Object.keys(next).length > 0) {
      setKeyDetailsInCapture({ ...keyDetails, ...next })
    }
  }, [currentLeadId, extracted.isAvailable, extracted.property, extracted.occupancy, extracted.boiler, extracted.issues, keyDetails, setKeyDetailsInCapture])

  // Helper function to generate summary (used to avoid circular dependency)
  const generateSummaryForSession = async (sessionId: number) => {
    setIsGeneratingSummary(true)
    try {
      const res = await api.post<ApiResponse<VisitSession>>(
        `/api/visit-sessions/${sessionId}/generate-summary`,
        {}
      )
      
      if (res.success && res.data && res.data.summary) {
        setVisitSummary(res.data.summary)
        // Update the active session with the new summary
        setActiveSession(res.data)
      }
    } catch (error) {
      console.error('Failed to generate summary:', error)
      setExceptionsInCapture([...new Set([...exceptions, 'Failed to generate summary'])])
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  // Ready once we have an active lead (VisitApp is guarded, but keep it defensive)
  useEffect(() => {
    setLoading(false)
  }, [])

  const startOrResumeVisit = async (lead: Lead) => {
    setLoading(true)
    try {
      // Try to find an active session for this lead (API doesn't currently filter status server-side)
      const sessionsRes = await api.get<PaginatedResponse<VisitSession>>(`/api/visit-sessions?leadId=${lead.id}&limit=20`)
      const existingInProgress = (sessionsRes.data || []).find((s) => s.status === 'in_progress') || null
      const sessionToUse = existingInProgress
        ? existingInProgress
        : (await api.post<ApiResponse<VisitSession>>('/api/visit-sessions', {
            accountId: user?.accountId ?? 1,
            leadId: Number(lead.id),
            addressId: activeAddress?.id, // Include addressId to anchor to property
          })).data || null
      
      if (sessionToUse) {
        setActiveSession(sessionToUse)
        setViewMode('active')
        // Update visit store with active session
        setActiveSessionInStore(sessionToUse, lead)

        // Ensure we have an Option A transcript session to poll for this lead.
        const transcriptionStore = useTranscriptionStore.getState()
        const existingTranscript = transcriptionStore.getActiveSession()
        const isSameTranscript =
          existingTranscript &&
          existingTranscript.leadId === String(lead.id) &&
          existingTranscript.isActive &&
          !!existingTranscript.sessionId

        let transcriptSessionId = isSameTranscript ? existingTranscript!.sessionId : null

        if (!transcriptSessionId) {
          // Stable device id to help server-side attribution
          let deviceId = localStorage.getItem('hail-mary:device-id')
          if (!deviceId) {
            try {
              deviceId = crypto.randomUUID()
            } catch {
              deviceId = `device-${Date.now()}`
            }
            localStorage.setItem('hail-mary:device-id', deviceId)
          }

          const createRes = await api.post<ApiResponse<{ sessionId: number }>>(
            `/api/leads/${lead.id}/transcripts/sessions`,
            {
              source: 'atlas-pwa',
              deviceId,
              language: 'en-GB',
              addressId: activeSession?.addressId, // IMPORTANT: anchor to property
            }
          )

          if (createRes.success && createRes.data?.sessionId) {
            transcriptSessionId = String(createRes.data.sessionId)
            transcriptionStore.startSession(String(lead.id), transcriptSessionId)
          }
        }

        // Reset structured capture state only when switching to a new session.
        // If the user is simply navigating away/back, keep the existing derived state.
        const captureState = useVisitCaptureStore.getState()
        const isSameCapture =
          captureState.leadId === String(lead.id) &&
          captureState.sessionId === (transcriptSessionId || '')
        if (!isSameCapture) {
          resetCaptureForSession(String(lead.id), transcriptSessionId || sessionToUse.id.toString())
        }

        // Reset summary (always re-generatable)
        setVisitSummary(undefined)
      }
    } catch (error) {
      console.error('Failed to start visit:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManualSave = useCallback(() => {
    if (!currentLeadId) return

    enqueueSave({
      leadId: currentLeadId,
      reason: 'manual_save',
      payload: {
        visitSessionId: activeSession?.id,
        correctedTranscript: accumulatedTranscriptRef.current,
        keyDetails,
        checklistItems,
        exceptions,
        timestamp: new Date().toISOString(),
      },
    })
  }, [currentLeadId, enqueueSave, activeSession, keyDetails, checklistItems, exceptions])

  const handleExportJson = useCallback(() => {
    if (!currentLeadId) return
    const json = exportLeadAsJson(currentLeadId)
    exportLeadAsJsonFile(currentLeadId, json)
  }, [currentLeadId, exportLeadAsJson])

  const handleKeyDetailsChange = useCallback((newDetails: KeyDetails) => {
    // Update global structured state
    setKeyDetailsInCapture(newDetails)

    // Write-through for fields backed by Property/Occupancy workspace tables.
    // This prevents Key Details from becoming a parallel data model.
    if (currentLeadId) {
      const prev = keyDetails

      if (newDetails.propertyType !== prev.propertyType && newDetails.propertyType) {
        fetch(`/api/leads/${currentLeadId}/property`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type: newDetails.propertyType }),
        }).catch(() => undefined)
      }

      if (newDetails.occupancy !== prev.occupancy) {
        fetch(`/api/leads/${currentLeadId}/occupancy`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ schedule: newDetails.occupancy || '' }),
        }).catch(() => undefined)
      }
    }

    // Clear auto-fill indicators for changed fields
    // Only check fields that were auto-filled for efficiency
    if (currentLeadId && autoFilledFields.length > 0) {
      autoFilledFields.forEach(field => {
        const newValue = newDetails[field]
        const oldValue = keyDetails[field]
        
        // Consider it changed if values differ (using JSON for deep comparison of arrays/objects)
        const hasChanged = JSON.stringify(newValue) !== JSON.stringify(oldValue)
        
        if (hasChanged) {
          clearAutoFilledField(currentLeadId, field)
          removeAutoFilledFieldInCapture(field)
        }
      })

      // Mark lead as dirty to trigger save
      markDirty(currentLeadId)
    }
  }, [currentLeadId, keyDetails, autoFilledFields, markDirty, removeAutoFilledFieldInCapture, setKeyDetailsInCapture])

  const generateSummary = useCallback(async () => {
    if (!activeSession) return
    await generateSummaryForSession(activeSession.id)
  }, [activeSession])

  const getOrCreateDeviceId = useCallback(() => {
    let deviceId = localStorage.getItem('hail-mary:device-id')
    if (!deviceId) {
      try {
        deviceId = crypto.randomUUID()
      } catch {
        deviceId = `device-${Date.now()}`
      }
      localStorage.setItem('hail-mary:device-id', deviceId)
    }
    return deviceId
  }, [])

  const handleClickImportMedia = useCallback(() => {
    setImportMediaError(null)
    importInputRef.current?.click()
  }, [])

  const handleImportMediaSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    // allow re-selecting the same file(s)
    e.target.value = ''

    if (!files || files.length === 0) return
    if (!currentLeadId || !activeSession) return

    setIsImportingMedia(true)
    setImportMediaError(null)

    try {
      const formData = new FormData()
      Array.from(files).forEach((f) => formData.append('files', f))
      formData.append('deviceId', getOrCreateDeviceId())

      const res = await fetch(`/api/leads/${currentLeadId}/visits/${activeSession.id}/assets`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Upload failed (HTTP ${res.status})`)
      }

      setAssetRefreshKey((k) => k + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import media'
      console.error('Import media failed:', err)
      setImportMediaError(msg)
    } finally {
      setIsImportingMedia(false)
    }
  }, [activeSession, currentLeadId, getOrCreateDeviceId])

  const endVisit = async () => {
    if (!activeSession) return

    // Trigger save on end visit (with corrected transcript)
    if (currentLeadId) {
      enqueueSave({
        leadId: currentLeadId,
        reason: 'end_visit',
        payload: {
          visitSessionId: activeSession.id,
          correctedTranscript: accumulatedTranscriptRef.current, // Already corrected during processing
          keyDetails,
          checklistItems,
          exceptions,
          timestamp: new Date().toISOString(),
        },
      })
    }

    // Finalize the active transcript session (Option A) best-effort
    try {
      const activeTranscript = useTranscriptionStore.getState().getActiveSession()
      if (activeTranscript?.sessionId) {
        await fetch(`/api/transcripts/sessions/${activeTranscript.sessionId}/finalize`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch {
      // ignore (offline-friendly)
    }
    
    // Use global endVisit action (handles API call + store cleanup)
    const result = await globalEndVisit()
    
    if (result.success) {
      setViewMode('list')
      setActiveSession(null)
      // Clear transcription store
      useTranscriptionStore.getState().clearSession()
      // Clear structured capture state
      clearCapture()
      // Reset local state
      setVisitSummary(undefined)
      accumulatedTranscriptRef.current = ''
    } else {
      console.error('Failed to end visit:', result.error)
    }
  }

  if (loading) {
    return <div className="visit-app-loading">Loading...</div>
  }

  if (viewMode === 'active' && activeSession && activeLead) {
    const failures = currentLeadId ? (saveFailuresByLeadId[currentLeadId] || 0) : 0
    const isDirty = currentLeadId ? dirtyByLeadId[currentLeadId] : false
    const lastSaved = currentLeadId ? lastSavedAtByLeadId[currentLeadId] : null

    return (
      <div className="visit-app visit-app-active">
        <div className="visit-app-header">
          <div className="visit-app-header-info">
            <h2>🎙️ {activeLead.firstName} {activeLead.lastName}</h2>
            <span className="visit-status-badge">Active Visit</span>
            <span className={`rocky-status-badge rocky-${rockyStatus}`}>
              Rocky: {rockyStatus === 'connected' ? '✅ Local' : rockyStatus === 'degraded' ? '⚠️ Degraded' : '❌ Offline'}
            </span>
          </div>
          <div className="visit-header-actions">
            <input
              ref={importInputRef}
              type="file"
              multiple
              accept=".m4a,.mp3,.wav,.jpg,.jpeg,.png,.heic,.txt,.json,.obj,.glb,.usdz"
              style={{ display: 'none' }}
              onChange={handleImportMediaSelected}
            />

            {/* Save Status Indicator */}
            <div className="visit-save-status">
              {isSyncing && (
                <span className="visit-status-chip visit-status-syncing">
                  ⏳ Syncing...
                </span>
              )}
              
              {!isSyncing && failures >= 3 && (
                <span className="visit-status-chip visit-status-error">
                  ⚠️ Save Failed
                </span>
              )}
              
              {!isSyncing && failures < 3 && isDirty && (
                <span className="visit-status-chip visit-status-dirty">
                  ● Unsaved
                </span>
              )}
              
              {!isSyncing && failures < 3 && !isDirty && lastSaved && (
                <span className="visit-status-chip visit-status-saved">
                  ✓ Saved {formatSaveTime(lastSaved)}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <button
              className="btn-secondary"
              onClick={handleClickImportMedia}
              disabled={isImportingMedia}
              title="Import media to this visit"
            >
              {isImportingMedia ? 'Importing…' : 'Import media'}
            </button>

            {failures >= 3 && (
              <button 
                className="btn-export"
                onClick={handleExportJson}
                title="Export visit data as JSON"
              >
                Export JSON
              </button>
            )}
            
            <button 
              className="btn-save"
              onClick={handleManualSave}
              disabled={isSyncing}
              title="Manually save visit data"
            >
              Save
            </button>
            
            <button className="btn-secondary" onClick={endVisit}>
              End Visit
            </button>
          </div>
        </div>

        {importMediaError && (
          <div style={{ padding: '0 16px 8px 16px', color: '#ffb4b4' }}>
            {importMediaError}
          </div>
        )}

        <div className="visit-three-panel">
          <div className="visit-panel visit-panel-left">
            {currentLeadId && (
              <AssetFeed
                leadId={currentLeadId}
                visitId={activeSession.id}
                refreshKey={assetRefreshKey}
              />
            )}
            <TranscriptFeed 
              segments={transcriptSegments}
              onRoleSwitch={(segmentId, newRole) => {
                useTranscriptionStore.getState().updateSegmentRole(segmentId, newRole);
              }}
            />
          </div>

          <div className="visit-panel visit-panel-center">
            <InstallChecklist 
              items={checklistItems}
              onItemToggle={(id, checked) => {
                toggleChecklistItem(id, checked)
              }}
              exceptions={exceptions}
            />
          </div>

          <div className="visit-panel visit-panel-right">
            <KeyDetailsForm 
              details={keyDetails}
              onChange={handleKeyDetailsChange}
              autoFilledFields={autoFilledFields}
            />
          </div>
        </div>

        <div className="visit-summary-section">
          <VisitSummaryCard 
            summary={visitSummary}
            isGenerating={isGeneratingSummary}
            onGenerate={generateSummary}
          />
        </div>
      </div>
    )
  }

  // Customer list view
  return (
    <div className="visit-app">
      <div className="visit-app-header">
        <h2>📋 Visit Notes</h2>
        <p className="visit-app-subtitle">Start or continue a visit for the active lead</p>
      </div>

      <div className="visit-customer-list">
        {activeLead ? (
          <button
            className="visit-customer-item"
            onClick={() => startOrResumeVisit(activeLead)}
          >
            <div className="visit-customer-info">
              <strong>{activeLead.firstName} {activeLead.lastName}</strong>
              <span>{activeLead.address?.city || activeLead.address?.postcode || `Lead #${activeLead.id}`}</span>
            </div>
            <span className="visit-customer-arrow">→</span>
          </button>
        ) : (
          <p className="visit-empty">No active lead selected. Use the banner above to select or create one.</p>
        )}
      </div>
    </div>
  )
}
