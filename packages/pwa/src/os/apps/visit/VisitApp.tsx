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
  InstallChecklist, 
  KeyDetailsForm,
  VisitSummaryCard,
  type TranscriptSegment,
  type ChecklistItem,
  type KeyDetails
} from './components'
import { extractFromTranscript, getRockyStatus as getLocalRockyStatus } from './rockyExtractor'
import { useLeadStore } from '../../../stores/leadStore'
import { useVisitStore } from '../../../stores/visitStore'
import { processTranscriptSegment, trackAutoFilledFields, clearAutoFilledField } from '../../../services/visitCaptureOrchestrator'
import { correctTranscript } from '../../../utils/transcriptCorrector'
import { formatSaveTime, exportLeadAsJsonFile } from '../../../utils/saveHelpers'
import { useCognitiveProfile } from '../../../cognitive/CognitiveProfileContext'
import { voiceRecordingService, getFileExtensionFromMimeType } from '../../../services/voiceRecordingService'
import { backgroundTranscriptionProcessor } from '../../../services/backgroundTranscriptionProcessor'
import { useTranscriptionStore } from '../../../stores/transcriptionStore'
import { extractStructuredData } from '../../../services/enhancedDataExtractor'
import { applyExtractedFactsToWorkspace } from '../../../services/applyExtractedFactsToWorkspace'
import { useExtractedData } from '../../../hooks/useExtractedData'
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

// Default checklist items (from checklist-config.json)
const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'boiler_replacement', label: 'Boiler Replacement', checked: false },
  { id: 'system_flush', label: 'System Flush/Cleanse', checked: false },
  { id: 'pipework_modification', label: 'Pipework Modifications', checked: false },
  { id: 'radiator_upgrade', label: 'Radiator Upgrade/Addition', checked: false },
  { id: 'cylinder_replacement', label: 'Hot Water Cylinder Replacement', checked: false },
  { id: 'controls_upgrade', label: 'Controls Upgrade', checked: false },
  { id: 'gas_work', label: 'Gas Supply Work', checked: false },
  { id: 'electrical_work', label: 'Electrical Work', checked: false },
  { id: 'flue_modification', label: 'Flue Modifications', checked: false },
  { id: 'filter_installation', label: 'Magnetic Filter Installation', checked: false },
]

export const VisitApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeSession, setActiveSession] = useState<VisitSession | null>(null)
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
  
  // Visit store for session/recording state
  const setActiveSessionInStore = useVisitStore((state) => state.setActiveSession)
  const startRecordingInStore = useVisitStore((state) => state.startRecording)
  const stopRecordingInStore = useVisitStore((state) => state.stopRecording)
  const incrementTranscriptCount = useVisitStore((state) => state.incrementTranscriptCount)
  const clearSessionInStore = useVisitStore((state) => state.clearSession)
  const endVisitGlobal = useVisitStore((state) => state.endVisit)
  
  // New state for 3-panel layout
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST_ITEMS)
  const [keyDetails, setKeyDetails] = useState<KeyDetails>({})
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([])
  const [exceptions, setExceptions] = useState<string[]>([])
  
  // Visit summary state
  const [visitSummary, setVisitSummary] = useState<string | undefined>(undefined)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  
  // Get STT provider setting
  const { settings } = useCognitiveProfile()
  const sttProvider = settings.sttProvider
  
  // STT state
  const [isListening, setIsListening] = useState(false)
  const sttSupported = voiceRecordingService.isSpeechRecognitionSupported()
  const transcriptionSession = useTranscriptionStore((state) => state.activeSession)
  const liveTranscript = useTranscriptionStore((state) => state.interimTranscript)
  const transcriptSegments: TranscriptSegment[] = useMemo(() => {
    const segments = transcriptionSession?.segments || []
    // Ensure timestamps are Dates (persist middleware may rehydrate as strings in some cases)
    return segments.map((s) => ({
      ...s,
      timestamp: s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp as any),
    })) as TranscriptSegment[]
  }, [transcriptionSession?.segments])
  const extracted = useExtractedData(currentLeadId)
  
  // Audio recording state for Whisper mode
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  
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

      setKeyDetails((prev) => ({
        ...prev,
        ...(mappedType ? { propertyType: mappedType } : null),
        ...(wsSchedule ? { occupancy: wsSchedule } : null),
      }))
    } catch {
      // ignore
    }
  }, [currentLeadId])

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
      backgroundTranscriptionProcessor.stopSession()
      setChecklistItems(DEFAULT_CHECKLIST_ITEMS)
      setKeyDetails({})
      setAutoFilledFields([])
      setExceptions([])
      setVisitSummary(undefined)
    }
  }, [currentLeadId, clearSessionInStore])

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
      setKeyDetails((prev) => ({ ...prev, ...next }))
    }
  }, [currentLeadId, extracted.isAvailable, extracted.property, extracted.occupancy, extracted.boiler, extracted.issues, keyDetails])

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
      setExceptions(prev => [...prev, 'Failed to generate summary'])
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  // Process transcript with Rocky (deterministic/local) + correction + live extraction
  const processWithRocky = useCallback((newTranscript: string) => {
    if (!newTranscript.trim()) return

    let correctedText = newTranscript // Default to raw if no correction applied
    
    // Step 1: Use orchestrator for live extraction (applies corrections internally)
    if (currentLeadId) {
      const captureResult = processTranscriptSegment(newTranscript, {
        currentLeadId,
        accumulatedTranscript: accumulatedTranscriptRef.current,
        previousFacts: keyDetails,
      })

      // Get corrected text from orchestrator result
      correctedText = captureResult.transcriptCorrection.corrected

      // Log corrections for debugging
      if (captureResult.transcriptCorrection.corrections.length > 0) {
        console.log('Transcript corrections:', captureResult.transcriptCorrection.corrections)
      }

      // Track auto-filled fields
      if (captureResult.autoFilledFields.length > 0) {
        setAutoFilledFields(prev => [...new Set([...prev, ...captureResult.autoFilledFields])])
        trackAutoFilledFields(currentLeadId, captureResult.autoFilledFields)
      }

      // Update local state (Key Details now synced with Lead store)
      setKeyDetails(captureResult.extractedFields)
    } else {
      // Fallback: no active lead, apply corrections manually
      const correction = correctTranscript(newTranscript)
      correctedText = correction.corrected
    }

    // Update accumulated transcript with corrected version
    accumulatedTranscriptRef.current = accumulatedTranscriptRef.current
      ? `${accumulatedTranscriptRef.current} ${correctedText}`
      : correctedText

    // Run local extraction for checklist updates
    // Note: We reprocess the full transcript each time because:
    // 1. Rocky extraction is deterministic and fast (no LLM)
    // 2. New context can change interpretation of previous statements
    // 3. This ensures consistency and accuracy in field extraction
    const result = extractFromTranscript({
      transcript: accumulatedTranscriptRef.current,
      previousFacts: keyDetails,
      previousChecklist: checklistItems,
    })

    // Update checklist
    if (result.checklistUpdates.length > 0) {
      setChecklistItems(prev => {
        const updated = [...prev]
        for (const update of result.checklistUpdates) {
          const index = updated.findIndex(item => item.id === update.id)
          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              checked: update.checked,
              note: update.note,
              autoDetected: true,
            }
          }
        }
        return updated
      })
    }

    // Update exceptions/flags
    if (result.flags.length > 0) {
      const newExceptions = result.flags.map(flag => `${flag.type.toUpperCase()}: ${flag.message}`)
      setExceptions(prev => [...new Set([...prev, ...newExceptions])])
    }

    // Trigger save after processing recording
    if (currentLeadId) {
      enqueueSave({
        leadId: currentLeadId,
        reason: 'process_recording',
        payload: {
          rawTranscript: newTranscript,
          correctedTranscript: correctedText,
          fullTranscript: accumulatedTranscriptRef.current,
          keyDetails: result.facts,
          checklistItems,
          timestamp: new Date().toISOString(),
        },
      })
      
      // Auto-generate summary after significant transcript accumulation
      // Only generate if we have enough content and not already generating
      const trimmedTranscript = accumulatedTranscriptRef.current.trim()
      if (trimmedTranscript && trimmedTranscript.length > 0) {
        const words = trimmedTranscript.split(/\s+/)
        const wordCount = words.filter(w => w.length > 0).length
        // Only auto-generate once when threshold is crossed
        if (wordCount >= 50 && !isGeneratingSummary && activeSession && !visitSummary) {
          generateSummaryForSession(activeSession.id)
        }
      }
    }
  }, [keyDetails, checklistItems, currentLeadId, markDirty, enqueueSave, isGeneratingSummary, activeSession, visitSummary])

  // Sync initial recording state from service on mount.
  // Transcript consumption runs globally (BackgroundTranscriptionProcessor) so it keeps working across navigation.
  useEffect(() => {
    const isCurrentlyRecording = voiceRecordingService.getIsRecording()
    const currentProvider = voiceRecordingService.getCurrentProvider()
    
    if (isCurrentlyRecording) {
      if (currentProvider === 'browser') {
        setIsListening(true)
        startRecordingInStore('browser')
      } else if (currentProvider === 'whisper') {
        setIsRecording(true)
        startRecordingInStore('whisper')
      }
    }
  }, [startRecordingInStore])

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
          })).data || null
      
      if (sessionToUse) {
        setActiveSession(sessionToUse)
        setViewMode('active')
        // Update visit store with active session
        setActiveSessionInStore(sessionToUse, lead)
        // Start background transcription session
        backgroundTranscriptionProcessor.startSession(
          String(lead.id),
          sessionToUse.id.toString()
        )
        // Reset state for new visit
        setChecklistItems(DEFAULT_CHECKLIST_ITEMS)
        setKeyDetails({})
        setAutoFilledFields([])
        setExceptions([])
        setVisitSummary(undefined)
      }
    } catch (error) {
      console.error('Failed to start visit:', error)
    } finally {
      setLoading(false)
    }
  }

  // STT Functions
  const startListening = useCallback(async () => {
    if (isListening || !sttSupported) return

    try {
      await voiceRecordingService.startBrowserRecording()
      setIsListening(true)
      startRecordingInStore('browser')
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      setExceptions(prev => [...prev, `Failed to start recording: ${(error as Error).message}`])
    }
  }, [isListening, sttSupported, startRecordingInStore])

  const stopListening = useCallback(() => {
    voiceRecordingService.stopBrowserRecording()
    setIsListening(false)
    stopRecordingInStore()

    // Trigger save when stopping recording (with corrected transcript)
    if (currentLeadId && accumulatedTranscriptRef.current) {
      enqueueSave({
        leadId: currentLeadId,
        reason: 'stop_recording',
        payload: {
          correctedTranscript: accumulatedTranscriptRef.current, // Already corrected during processing
          keyDetails,
          checklistItems,
          timestamp: new Date().toISOString(),
        },
      })
    }
  }, [currentLeadId, enqueueSave, keyDetails, checklistItems, stopRecordingInStore])

  // Audio Recording Functions for Whisper mode
  const startRecording = useCallback(async () => {
    try {
      await voiceRecordingService.startWhisperRecording()
      setIsRecording(true)
      startRecordingInStore('whisper')
    } catch (error) {
      console.error('Failed to start audio recording:', error)
      setExceptions(prev => [...prev, `Microphone error: ${(error as Error).message}`])
    }
  }, [startRecordingInStore])

  const stopRecording = useCallback(async () => {
    setIsRecording(false)
    stopRecordingInStore()
    setIsTranscribing(true)

    try {
      // Stop recording and get the audio blob
      const { blob: audioBlob, mimeType } = await voiceRecordingService.stopWhisperRecording()
      
      // Determine file extension from mimeType using helper
      const fileExt = getFileExtensionFromMimeType(mimeType)
      
      // Upload to Whisper API
      const formData = new FormData()
      formData.append('audio', audioBlob, `recording${fileExt}`)
      formData.append('language', 'en-GB')
      
      const response = await fetch('/api/transcription/whisper-transcribe', {
        method: 'POST',
        body: formData,
      })
      
      const result = await response.json()
      
      if (result.success && result.data) {
        const transcriptText = result.data.text
        
        // Add as a new transcript segment
        const segment: TranscriptSegment = {
          id: `segment-${Date.now()}`,
          timestamp: new Date(),
          speaker: 'user',
          text: transcriptText.trim(),
        }
        // Persist into global transcription store so transcript continues across navigation
        const transcriptionStore = useTranscriptionStore.getState()
        transcriptionStore.addSegment(segment as any)
        const active = transcriptionStore.getActiveSession()
        if (active) {
          const nextAccumulated = active.accumulatedTranscript
            ? `${active.accumulatedTranscript} ${transcriptText.trim()}`
            : transcriptText.trim()
          transcriptionStore.updateAccumulatedTranscript(nextAccumulated)
        }
        
        // Increment transcript count in visit store
        incrementTranscriptCount()
        
        // Process with Rocky (correction + extraction)
        // This will update accumulatedTranscriptRef.current synchronously
        processWithRocky(transcriptText.trim())

        // Also run enhanced extraction to populate workspace (Property/Occupancy) non-destructively
        if (currentLeadId) {
          const extracted = extractStructuredData(transcriptText.trim())
          applyExtractedFactsToWorkspace(currentLeadId, extracted).catch(() => undefined)
        }
        
        // Trigger save after processing completes
        // processWithRocky is synchronous, so we can safely access the updated ref
        // Synchronize with browser repaint to ensure React state updates complete
        requestAnimationFrame(() => {
          if (currentLeadId) {
            enqueueSave({
              leadId: currentLeadId,
              reason: 'stop_recording',
              payload: {
                correctedTranscript: accumulatedTranscriptRef.current,
                keyDetails,
                checklistItems,
                timestamp: new Date().toISOString(),
              },
            })
          }
        })
      } else {
        setExceptions(prev => [...prev, `Transcription error: ${result.error || 'Unknown error'}`])
      }
    } catch (error) {
      console.error('Failed to transcribe audio:', error)
      setExceptions(prev => [...prev, `Transcription error: ${(error as Error).message}`])
    } finally {
      setIsTranscribing(false)
    }
  }, [currentLeadId, enqueueSave, keyDetails, checklistItems, processWithRocky, stopRecordingInStore, incrementTranscriptCount])

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
    // Update local state
    setKeyDetails(newDetails)

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
          setAutoFilledFields(prev => prev.filter(f => f !== field))
        }
      })

      // Mark lead as dirty to trigger save
      markDirty(currentLeadId)
    }
  }, [currentLeadId, keyDetails, autoFilledFields, markDirty])

  const generateSummary = useCallback(async () => {
    if (!activeSession) return
    await generateSummaryForSession(activeSession.id)
  }, [activeSession])

  const endVisit = async () => {
    if (!activeSession) return

    try {
      // Use global endVisit action with visit data for saving
      await endVisitGlobal({
        keyDetails,
        checklistItems,
        exceptions,
      })
      
      // Clear local UI state
      setViewMode('list')
      setActiveSession(null)
      setChecklistItems(DEFAULT_CHECKLIST_ITEMS)
      setKeyDetails({})
      setAutoFilledFields([])
      setExceptions([])
      setVisitSummary(undefined)
      accumulatedTranscriptRef.current = ''
    } catch (error) {
      console.error('Failed to end visit:', error)
      setExceptions(prev => [...prev, `Failed to end visit: ${error instanceof Error ? error.message : 'Unknown error'}`])
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

        <div className="visit-three-panel">
          <div className="visit-panel visit-panel-left">
            <TranscriptFeed 
              segments={transcriptSegments}
              isRecording={isListening}
              liveTranscript={liveTranscript}
            />
          </div>

          <div className="visit-panel visit-panel-center">
            <InstallChecklist 
              items={checklistItems}
              onItemToggle={(id, checked) => {
                setChecklistItems(prev => 
                  prev.map(item => item.id === id ? { ...item, checked } : item)
                )
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

        <div className="visit-controls">
          {sttProvider === 'whisper' ? (
            // Whisper mode: record audio and transcribe on stop
            <button
              className={`btn-mic ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
              disabled={isTranscribing}
            >
              {isTranscribing 
                ? '⏳ Transcribing...' 
                : isRecording 
                ? '⏹️ Stop Recording' 
                : '🎤 Start Recording (Whisper)'
              }
            </button>
          ) : sttSupported ? (
            // Browser mode: real-time speech recognition
            <button
              className={`btn-mic ${isListening ? 'recording' : ''}`}
              onClick={isListening ? stopListening : startListening}
              title={isListening ? 'Stop Recording' : 'Start Recording'}
            >
              {isListening ? '⏹️ Stop Recording' : '🎤 Start Recording'}
            </button>
          ) : (
            <p className="stt-unsupported">
              ℹ️ Voice input requires Chrome, Edge, or Safari
            </p>
          )}
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
