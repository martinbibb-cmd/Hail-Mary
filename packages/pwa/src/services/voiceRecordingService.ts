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
  private recognition: SpeechRecognition | null = null
  private mediaRecorder: MediaRecorder | null = null
  private mediaStream: MediaStream | null = null
  private audioChunks: Blob[] = []
  private isRecording = false
  private currentProvider: RecordingProvider | null = null
  private callbacks: TranscriptCallback | null = null
  
  constructor() {
    // Initialize speech recognition if available
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognitionAPI) {
        this.recognition = new SpeechRecognitionAPI()
        this.recognition.continuous = true
        this.recognition.interimResults = true
        this.recognition.lang = 'en-GB'
        this.setupRecognitionHandlers()
      }
    }
  }

  private setupRecognitionHandlers() {
    if (!this.recognition) return

    this.recognition.onstart = () => {
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
        this.callbacks.onFinalTranscript(finalTranscript.trim())
      } else if (interimTranscript) {
        this.callbacks.onInterimTranscript(interimTranscript.trim())
      }
    }

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      if (event.error !== 'aborted' && this.callbacks) {
        this.callbacks.onError(`Microphone error: ${event.error}`)
      }
      // Don't set isRecording to false here - let onend handle it
    }

    this.recognition.onend = () => {
      // If we're supposed to be recording, restart automatically
      // This handles cases where the browser stops recognition automatically
      if (this.isRecording && this.currentProvider === 'browser') {
        console.log('Speech recognition ended unexpectedly, restarting...')
        try {
          this.recognition?.start()
        } catch (error) {
          console.error('Failed to restart recognition:', error)
          this.isRecording = false
        }
      } else {
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
    this.callbacks = callbacks
  }

  /**
   * Clear callbacks
   */
  clearCallbacks() {
    this.callbacks = null
  }

  /**
   * Start browser speech recognition
   */
  async startBrowserRecording(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported')
    }

    if (this.isRecording) {
      console.warn('Recording already in progress')
      return
    }

    try {
      this.currentProvider = 'browser'
      this.isRecording = true
      this.recognition.start()
    } catch (error) {
      this.isRecording = false
      this.currentProvider = null
      throw error
    }
  }

  /**
   * Stop browser speech recognition
   */
  stopBrowserRecording(): void {
    if (!this.recognition) return

    this.isRecording = false
    this.currentProvider = null
    this.recognition.stop()
  }

  /**
   * Start Whisper audio recording
   */
  async startWhisperRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress')
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.mediaStream = stream

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
        console.warn('No supported audio MIME type found. Attempting audio/webm as last resort - recording may fail.')
        mimeType = 'audio/webm'
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      this.mediaRecorder = mediaRecorder
      this.audioChunks = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      mediaRecorder.start()
      this.isRecording = true
      this.currentProvider = 'whisper'
    } catch (error) {
      this.cleanup()
      throw error
    }
  }

  /**
   * Stop Whisper audio recording and return the audio blob
   */
  async stopWhisperRecording(): Promise<{ blob: Blob; mimeType: string }> {
    if (!this.mediaRecorder) {
      throw new Error('No active recording')
    }

    return new Promise((resolve, reject) => {
      const mediaRecorder = this.mediaRecorder!
      const mimeType = mediaRecorder.mimeType

      mediaRecorder.onstop = () => {
        this.isRecording = false
        this.currentProvider = null

        // Stop all tracks to release microphone
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop())
          this.mediaStream = null
        }

        // Create blob from recorded chunks
        const audioBlob = new Blob(this.audioChunks, { type: mimeType })
        this.audioChunks = []
        this.mediaRecorder = null

        resolve({ blob: audioBlob, mimeType })
      }

      mediaRecorder.onerror = (error) => {
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
export const voiceRecordingService = new VoiceRecordingService()

// Helper function to get file extension from MIME type
export function getFileExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return '.mp4'
  if (mimeType.includes('mpeg')) return '.mp3'
  if (mimeType.includes('wav')) return '.wav'
  if (mimeType.includes('ogg')) return '.ogg'
  return '.webm' // default
}
