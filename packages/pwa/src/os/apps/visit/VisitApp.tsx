import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { 
  Customer, 
  VisitSession,
  ApiResponse, 
  PaginatedResponse 
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
    const res = await fetch(url)
    return res.json()
  },
  async post<T>(url: string, data: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  },
  async put<T>(url: string, data: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [activeSession, setActiveSession] = useState<VisitSession | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Lead store for save triggers
  const currentLeadId = useLeadStore((state) => state.currentLeadId)
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
  
  // New state for 3-panel layout
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([])
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
  const [liveTranscript, setLiveTranscript] = useState('')
  const [sttSupported, setSttSupported] = useState(voiceRecordingService.isSpeechRecognitionSupported())
  
  // Audio recording state for Whisper mode
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  
  // Accumulated final transcript for Rocky processing
  const accumulatedTranscriptRef = useRef<string>('')

  // Rocky status (always 'connected' for local extraction)
  const [rockyStatus] = useState<'connected' | 'degraded' | 'blocked'>(getLocalRockyStatus())

  // Setup voice recording callbacks when component mounts
  useEffect(() => {
    voiceRecordingService.setCallbacks({
      onFinalTranscript: (text: string) => {
        // Add as a new transcript segment
        const segment: TranscriptSegment = {
          id: `segment-${Date.now()}`,
          timestamp: new Date(),
          speaker: 'user',
          text: text,
        }
        setTranscriptSegments(prev => [...prev, segment])
        
        // Increment transcript count in visit store
        incrementTranscriptCount()
        
        // Process with Rocky
        processWithRocky(text)
        
        // Clear live transcript
        setLiveTranscript('')
      },
      onInterimTranscript: (text: string) => {
        // Update live transcript
        setLiveTranscript(text)
      },
      onError: (error: string) => {
        console.error('Voice recording error:', error)
        setExceptions(prev => [...prev, error])
      },
    })

    // Sync initial recording state from service
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

    // Note: We don't clear callbacks on unmount because recording should persist
    // across navigation. The service manages callback lifecycle globally. Callbacks
    // are re-registered each time the component mounts with fresh closures to prevent
    // stale references while maintaining recording continuity.
    return () => {
      // Callbacks remain active to allow recording to continue across navigation
    }
  }, [incrementTranscriptCount, processWithRocky, startRecordingInStore])

  // Load customers
  useEffect(() => {
    api.get<PaginatedResponse<Customer>>('/api/customers')
      .then(res => {
        setCustomers(res.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const startVisit = async (customer: Customer) => {
    setLoading(true)
    try {
      const res = await api.post<ApiResponse<VisitSession>>('/api/visit-sessions', {
        accountId: 1,
        leadId: customer.id,
      })
      
      if (res.success && res.data) {
        setSelectedCustomer(customer)
        setActiveSession(res.data)
        setViewMode('active')
        // Update visit store with active session
        setActiveSessionInStore(res.data, customer)
        // Reset state for new visit
        setTranscriptSegments([])
        setChecklistItems(DEFAULT_CHECKLIST_ITEMS)
        setKeyDetails({})
        setAutoFilledFields([])
        setExceptions([])
        setVisitSummary(undefined)
        accumulatedTranscriptRef.current = ''
      }
    } catch (error) {
      console.error('Failed to start visit:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadExistingVisit = async (customer: Customer) => {
    setLoading(true)
    try {
      // Try to find an active session for this customer
      const sessionsRes = await api.get<PaginatedResponse<VisitSession>>(`/api/visit-sessions?leadId=${customer.id}&status=in_progress`)
      
      if (sessionsRes.data && sessionsRes.data.length > 0) {
        const session = sessionsRes.data[0]
        setSelectedCustomer(customer)
        setActiveSession(session)
        setViewMode('active')
        // Update visit store with active session
        setActiveSessionInStore(session, customer)
        // Reset state (in future, could load previous data)
        setTranscriptSegments([])
        setChecklistItems(DEFAULT_CHECKLIST_ITEMS)
        setKeyDetails({})
        setAutoFilledFields([])
        setExceptions([])
        setVisitSummary(session.summary)
        accumulatedTranscriptRef.current = ''
      } else {
        // No active session, start new one
        startVisit(customer)
      }
    } catch {
      console.error('Failed to load visit')
      startVisit(customer)
    } finally {
      setLoading(false)
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

  // STT Functions
  const startListening = useCallback(async () => {
    if (isListening || !sttSupported) return
    
    setLiveTranscript('')
    
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
    setLiveTranscript('')

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
        setTranscriptSegments(prev => [...prev, segment])
        
        // Increment transcript count in visit store
        incrementTranscriptCount()
        
        // Process with Rocky (correction + extraction)
        // This will update accumulatedTranscriptRef.current synchronously
        processWithRocky(transcriptText.trim())
        
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

  const generateSummary = useCallback(async () => {
    if (!activeSession) return
    await generateSummaryForSession(activeSession.id)
  }, [activeSession])

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
    
    try {
      await api.put<ApiResponse<VisitSession>>(`/api/visit-sessions/${activeSession.id}`, {
        status: 'completed',
        endedAt: new Date(),
      })
      setViewMode('list')
      setActiveSession(null)
      setSelectedCustomer(null)
      // Clear visit store
      clearSessionInStore()
      setTranscriptSegments([])
      setChecklistItems(DEFAULT_CHECKLIST_ITEMS)
      setKeyDetails({})
      setAutoFilledFields([])
      setExceptions([])
      setVisitSummary(undefined)
      accumulatedTranscriptRef.current = ''
    } catch (error) {
      console.error('Failed to end visit:', error)
    }
  }

  if (loading) {
    return <div className="visit-app-loading">Loading...</div>
  }

  if (viewMode === 'active' && activeSession && selectedCustomer) {
    const failures = currentLeadId ? (saveFailuresByLeadId[currentLeadId] || 0) : 0
    const isDirty = currentLeadId ? dirtyByLeadId[currentLeadId] : false
    const lastSaved = currentLeadId ? lastSavedAtByLeadId[currentLeadId] : null

    return (
      <div className="visit-app visit-app-active">
        <div className="visit-app-header">
          <div className="visit-app-header-info">
            <h2>🎙️ {selectedCustomer.firstName} {selectedCustomer.lastName}</h2>
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
        <p className="visit-app-subtitle">Select a customer to start or continue a visit</p>
      </div>

      <div className="visit-customer-list">
        {customers.length === 0 ? (
          <p className="visit-empty">No customers yet. Create a customer first!</p>
        ) : (
          customers.map(customer => (
            <button
              key={customer.id}
              className="visit-customer-item"
              onClick={() => loadExistingVisit(customer)}
            >
              <div className="visit-customer-info">
                <strong>{customer.firstName} {customer.lastName}</strong>
                <span>{customer.address?.city || customer.email}</span>
              </div>
              <span className="visit-customer-arrow">→</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
