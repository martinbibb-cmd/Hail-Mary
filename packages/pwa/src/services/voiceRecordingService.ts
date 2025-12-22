/**
 * Voice Recording Service - Global singleton service for voice recording
 * 
 * This service manages speech recognition and audio recording independently
 * of React components. It ensures that recording continues even when
 * navigating between pages/components.
 * 
 * Key Features:
 * - Survives component unmounts
 * - Manages browser speech recognition (continuous mode)
 * - Manages Whisper audio recording
 * - Provides callbacks for transcript updates
 * - Integrates with visitStore for state synchronization
 */

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export type RecordingProvider = 'browser' | 'whisper'

export interface TranscriptCallback {
  onFinalTranscript: (text: string) => void
  onInterimTranscript: (text: string) => void
  onError: (error: string) => void
}

class VoiceRecordingService {
  private static instance: VoiceRecordingService | null = null
  private recognition: SpeechRecognition | null = null
  private mediaRecorder: MediaRecorder | null = null
  private mediaStream: MediaStream | null = null
  private audioChunks: Blob[] = []
  private isRecording = false
  private currentProvider: RecordingProvider | null = null
  private callbacks: TranscriptCallback | null = null
  
  private constructor() {
    console.log('[VoiceRecordingService] Initializing singleton instance')
    // Initialize speech recognition if available
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognitionAPI) {
        console.log('[VoiceRecordingService] Speech recognition API available')
        this.recognition = new SpeechRecognitionAPI()
        this.recognition.continuous = true
        this.recognition.interimResults = true
        this.recognition.lang = 'en-GB'
        this.setupRecognitionHandlers()
      } else {
        console.warn('[VoiceRecordingService] Speech recognition API not available')
      }
    }
  }

  /**
   * Get the singleton instance of VoiceRecordingService
   */
  public static getInstance(): VoiceRecordingService {
    if (!VoiceRecordingService.instance) {
      console.log('[VoiceRecordingService] Creating new singleton instance')
      VoiceRecordingService.instance = new VoiceRecordingService()
    }
    return VoiceRecordingService.instance
  }

  private setupRecognitionHandlers() {
    if (!this.recognition) return

    this.recognition.onstart = () => {
      console.log('[VoiceRecordingService] Speech recognition started')
      this.isRecording = true
    }

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!this.callbacks) return

      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      if (finalTranscript) {
        console.log('[VoiceRecordingService] Final transcript received:', finalTranscript.trim().substring(0, 50) + '...')
        this.callbacks.onFinalTranscript(finalTranscript.trim())
      } else if (interimTranscript) {
        console.log('[VoiceRecordingService] Interim transcript:', interimTranscript.trim().substring(0, 30) + '...')
        this.callbacks.onInterimTranscript(interimTranscript.trim())
      }
    }

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[VoiceRecordingService] Speech recognition error:', event.error, event.message)
      if (event.error !== 'aborted' && this.callbacks) {
        this.callbacks.onError(`Microphone error: ${event.error}`)
      }
      // Don't set isRecording to false here - let onend handle it
    }

    this.recognition.onend = () => {
      console.log('[VoiceRecordingService] Speech recognition ended. isRecording:', this.isRecording, 'provider:', this.currentProvider)
      // If we're supposed to be recording, restart automatically
      // This handles cases where the browser stops recognition automatically
      if (this.isRecording && this.currentProvider === 'browser') {
        console.log('[VoiceRecordingService] Auto-restarting speech recognition for resiliency')
        try {
          this.recognition?.start()
        } catch (error) {
          console.error('[VoiceRecordingService] Failed to restart recognition:', error)
          this.isRecording = false
          if (this.callbacks) {
            this.callbacks.onError('Failed to restart recording. Please try again.')
          }
        }
      } else {
        console.log('[VoiceRecordingService] Recording session ended normally')
        this.isRecording = false
      }
    }
  }

  /**
   * Check if speech recognition is supported
   */
  isSpeechRecognitionSupported(): boolean {
    return this.recognition !== null
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording
  }

  /**
   * Get current recording provider
   */
  getCurrentProvider(): RecordingProvider | null {
    return this.currentProvider
  }

  /**
   * Set transcript callbacks
   */
  setCallbacks(callbacks: TranscriptCallback) {
    console.log('[VoiceRecordingService] Setting transcript callbacks')
    this.callbacks = callbacks
  }

  /**
   * Clear callbacks
   */
  clearCallbacks() {
    console.log('[VoiceRecordingService] Clearing transcript callbacks')
    this.callbacks = null
  }

  /**
   * Start browser speech recognition
   */
  async startBrowserRecording(): Promise<void> {
    console.log('[VoiceRecordingService] Starting browser speech recognition')
    if (!this.recognition) {
      console.error('[VoiceRecordingService] Speech recognition not supported')
      throw new Error('Speech recognition not supported')
    }

    if (this.isRecording) {
      console.warn('[VoiceRecordingService] Recording already in progress')
      return
    }

    try {
      this.currentProvider = 'browser'
      this.isRecording = true
      this.recognition.start()
      console.log('[VoiceRecordingService] Browser recording started successfully')
    } catch (error) {
      console.error('[VoiceRecordingService] Failed to start browser recording:', error)
      this.isRecording = false
      this.currentProvider = null
      throw error
    }
  }

  /**
   * Stop browser speech recognition
   */
  stopBrowserRecording(): void {
    console.log('[VoiceRecordingService] Stopping browser speech recognition')
    if (!this.recognition) return

    this.isRecording = false
    this.currentProvider = null
    this.recognition.stop()
  }

  /**
   * Start Whisper audio recording
   */
  async startWhisperRecording(): Promise<void> {
    console.log('[VoiceRecordingService] Starting Whisper audio recording')
    if (this.isRecording) {
      console.error('[VoiceRecordingService] Recording already in progress')
      throw new Error('Recording already in progress')
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.mediaStream = stream
      console.log('[VoiceRecordingService] Media stream acquired')

      // Create MediaRecorder with appropriate format
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm'
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4'
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mpeg'
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn('[VoiceRecordingService] No supported audio MIME type found. Attempting audio/webm as last resort - recording may fail.')
        mimeType = 'audio/webm'
      }
      console.log('[VoiceRecordingService] Using MIME type:', mimeType)

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      this.mediaRecorder = mediaRecorder
      this.audioChunks = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('[VoiceRecordingService] Audio chunk received, size:', event.data.size)
          this.audioChunks.push(event.data)
        }
      }

      mediaRecorder.start()
      this.isRecording = true
      this.currentProvider = 'whisper'
      console.log('[VoiceRecordingService] Whisper recording started successfully')
    } catch (error) {
      console.error('[VoiceRecordingService] Failed to start Whisper recording:', error)
      this.cleanup()
      throw error
    }
  }

  /**
   * Stop Whisper audio recording and return the audio blob
   */
  async stopWhisperRecording(): Promise<{ blob: Blob; mimeType: string }> {
    console.log('[VoiceRecordingService] Stopping Whisper audio recording')
    if (!this.mediaRecorder) {
      console.error('[VoiceRecordingService] No active recording')
      throw new Error('No active recording')
    }

    return new Promise((resolve, reject) => {
      const mediaRecorder = this.mediaRecorder!
      const mimeType = mediaRecorder.mimeType

      mediaRecorder.onstop = () => {
        console.log('[VoiceRecordingService] Whisper recording stopped, processing audio')
        this.isRecording = false
        this.currentProvider = null

        // Stop all tracks to release microphone
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop())
          this.mediaStream = null
        }

        // Create blob from recorded chunks
        const audioBlob = new Blob(this.audioChunks, { type: mimeType })
        console.log('[VoiceRecordingService] Audio blob created, size:', audioBlob.size, 'type:', mimeType)
        this.audioChunks = []
        this.mediaRecorder = null

        resolve({ blob: audioBlob, mimeType })
      }

      mediaRecorder.onerror = (error) => {
        console.error('[VoiceRecordingService] Media recorder error:', error)
        this.cleanup()
        reject(error)
      }

      mediaRecorder.stop()
    })
  }

  /**
   * Stop any active recording
   */
  stopRecording(): void {
    console.log('[VoiceRecordingService] Stopping any active recording')
    if (this.currentProvider === 'browser') {
      this.stopBrowserRecording()
    } else if (this.currentProvider === 'whisper' && this.mediaRecorder) {
      this.mediaRecorder.stop()
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    console.log('[VoiceRecordingService] Cleaning up resources')
    this.isRecording = false
    this.currentProvider = null

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    this.mediaRecorder = null
    this.audioChunks = []
    // Note: callbacks are not cleared here to allow for service reuse
    // They will be overwritten when setCallbacks is called again
  }

  /**
   * Destroy the service (cleanup all resources)
   * Note: This should only be called when the app is closing
   */
  destroy(): void {
    console.log('[VoiceRecordingService] Destroying service')
    this.stopRecording()
    this.cleanup()
    
    if (this.recognition) {
      this.recognition.abort()
      this.recognition = null
    }
    
    this.callbacks = null
  }
}

// Export singleton instance
export const voiceRecordingService = VoiceRecordingService.getInstance()

// Helper function to get file extension from MIME type
export function getFileExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return '.mp4'
  if (mimeType.includes('mpeg')) return '.mp3'
  if (mimeType.includes('wav')) return '.wav'
  if (mimeType.includes('ogg')) return '.ogg'
  return '.webm' // default
}
