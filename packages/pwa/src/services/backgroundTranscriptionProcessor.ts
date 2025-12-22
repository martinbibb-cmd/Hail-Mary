/**
 * Background Transcription Processor
 *
 * Global service that processes transcription segments in the background,
 * extracts structured data, and auto-populates various modules.
 *
 * This service runs independently of any component and continues processing
 * even when the user navigates away from the VisitApp.
 *
 * Features:
 * - Processes transcript segments in the background
 * - Extracts property, boiler, quotation, and occupancy data
 * - Auto-populates Property module
 * - Auto-populates Boiler/Quote module
 * - Provides real-time updates to all connected components
 * - Persists data to Lead store and API
 */

import { voiceRecordingService } from './voiceRecordingService';
import { useTranscriptionStore, type TranscriptSegment } from '../stores/transcriptionStore';
import { useLeadStore } from '../stores/leadStore';
import { useVisitStore } from '../stores/visitStore';
import { extractStructuredData, type ExtractedData } from './enhancedDataExtractor';
import { correctTranscript } from '../utils/transcriptCorrector';
import type { Lead } from '@hail-mary/shared';
import { applyExtractedFactsToWorkspace } from './applyExtractedFactsToWorkspace';

class BackgroundTranscriptionProcessor {
  private static instance: BackgroundTranscriptionProcessor | undefined;
  private isInitialized = false;
  private processingQueue: TranscriptSegment[] = [];
  private isProcessingQueue = false;

  private constructor() {
    console.log('[BackgroundTranscriptionProcessor] Initializing');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BackgroundTranscriptionProcessor {
    if (!BackgroundTranscriptionProcessor.instance) {
      BackgroundTranscriptionProcessor.instance = new BackgroundTranscriptionProcessor();
    }
    return BackgroundTranscriptionProcessor.instance;
  }

  /**
   * Initialize the processor
   * Sets up voice recording callbacks to process transcripts globally
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('[BackgroundTranscriptionProcessor] Already initialized');
      return;
    }

    console.log('[BackgroundTranscriptionProcessor] Setting up global transcript callbacks');

    // Set up global callbacks for voice recording (do not overwrite other listeners)
    voiceRecordingService.addListener({
      onFinalTranscript: (text: string) => {
        // Clear interim transcript on final
        useTranscriptionStore.getState().setInterimTranscript('');
        this.handleFinalTranscript(text);
      },
      onInterimTranscript: (text: string) => {
        // Store interim transcripts for real-time UI updates across navigation
        useTranscriptionStore.getState().setInterimTranscript(text);
      },
      onError: (error: string) => {
        console.error('[BackgroundTranscriptionProcessor] Voice recording error:', error);
      },
    });

    this.isInitialized = true;
    console.log('[BackgroundTranscriptionProcessor] Initialization complete');
  }

  /**
   * Handle final transcript segment
   */
  private handleFinalTranscript(text: string): void {
    const transcriptionStore = useTranscriptionStore.getState();
    const activeSession = transcriptionStore.getActiveSession();

    if (!activeSession) {
      console.warn('[BackgroundTranscriptionProcessor] No active session, ignoring transcript');
      return;
    }

    // Keep visit banner counters in sync even if VisitApp is unmounted
    try {
      useVisitStore.getState().incrementTranscriptCount();
    } catch {
      // ignore
    }

    // Apply transcript corrections
    const correction = correctTranscript(text);
    const correctedText = correction.corrected;

    // Create segment
    const segment: TranscriptSegment = {
      id: `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      speaker: 'user',
      text,
      corrected: correctedText,
      processed: false,
    };

    // Add to transcription store
    transcriptionStore.addSegment(segment);

    // Update accumulated transcript
    const newAccumulated = activeSession.accumulatedTranscript
      ? `${activeSession.accumulatedTranscript} ${correctedText}`
      : correctedText;
    transcriptionStore.updateAccumulatedTranscript(newAccumulated);

    // Add to processing queue
    this.processingQueue.push(segment);

    // Process the queue
    this.processQueue();

    console.log('[BackgroundTranscriptionProcessor] Transcript segment queued for processing');
  }

  /**
   * Process the queue of transcript segments
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.processingQueue.length > 0) {
        const segment = this.processingQueue.shift();
        if (!segment) continue;

        await this.processSegment(segment);
      }
    } catch (error) {
      console.error('[BackgroundTranscriptionProcessor] Error processing queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process individual transcript segment
   */
  private async processSegment(segment: TranscriptSegment): Promise<void> {
    const transcriptionStore = useTranscriptionStore.getState();
    const activeSession = transcriptionStore.getActiveSession();

    if (!activeSession) {
      console.warn('[BackgroundTranscriptionProcessor] No active session');
      return;
    }

    try {
      console.log('[BackgroundTranscriptionProcessor] Processing segment:', segment.id);

      // Extract structured data from accumulated transcript
      const extractedData = extractStructuredData(activeSession.accumulatedTranscript);

      console.log('[BackgroundTranscriptionProcessor] Extracted data:', {
        confidence: extractedData.confidence,
        hasProperty: Object.keys(extractedData.property).length > 0,
        hasBoiler: Object.keys(extractedData.boiler).length > 0,
        hasQuotation: Object.keys(extractedData.quotation).length > 0,
        hasOccupancy: Object.keys(extractedData.occupancy).length > 0,
      });

      // Auto-populate modules
      await this.autoPopulateModules(activeSession.leadId, extractedData);

      // Ensure extracted facts fill the normalized workspace tables (Property/Occupancy)
      // Non-destructive: fills blanks only.
      await applyExtractedFactsToWorkspace(activeSession.leadId, extractedData);

      // Mark segment as processed
      transcriptionStore.markSegmentProcessed(segment.id);

      // Trigger save via lead store
      this.triggerSave(activeSession.leadId, extractedData);

      console.log('[BackgroundTranscriptionProcessor] Segment processed successfully:', segment.id);
    } catch (error) {
      console.error('[BackgroundTranscriptionProcessor] Error processing segment:', error);
    }
  }

  /**
   * Auto-populate various modules based on extracted data
   */
  private async autoPopulateModules(leadId: string, data: ExtractedData): Promise<void> {
    const leadStore = useLeadStore.getState();

    // Build lead updates
    const updates: Partial<Lead> = {};

    // Property module updates
    if (data.property.propertyType) {
      updates.propertyType = data.property.propertyType;
    }

    // Boiler-related notes
    const notes: string[] = [];

    if (data.boiler.currentBoilerType) {
      notes.push(`Current boiler: ${data.boiler.currentBoilerType}`);
    }

    if (data.boiler.currentBoilerMake) {
      notes.push(`Make: ${data.boiler.currentBoilerMake}`);
    }

    if (data.boiler.boilerAge) {
      notes.push(`Age: ${data.boiler.boilerAge} years`);
    }

    if (data.boiler.replacementRequired) {
      notes.push(`Replacement needed (Urgency: ${data.boiler.replacementUrgency || 'unknown'})`);
    }

    // Quotation data
    if (data.quotation.workRequired && data.quotation.workRequired.length > 0) {
      notes.push(`Work required: ${data.quotation.workRequired.join(', ')}`);
    }

    if (data.quotation.estimatedCost) {
      updates.estimatedValue = data.quotation.estimatedCost;
      notes.push(`Estimated cost: £${data.quotation.estimatedCost}`);
    }

    // Issues
    if (data.issues.length > 0) {
      notes.push(`Issues: ${data.issues.join(', ')}`);
    }

    // Combine notes
    if (notes.length > 0) {
      updates.notes = notes.join('\n');
    }

    // Update lead store
    leadStore.updateLeadData(leadId, updates);

    // Store extraction metadata separately
    this.storeExtractionMetadata(leadId, data);

    console.log('[BackgroundTranscriptionProcessor] Modules auto-populated', {
      leadId,
      updatedFields: Object.keys(updates),
    });
  }

  /**
   * Store extraction metadata for UI hints and suggestions
   */
  private storeExtractionMetadata(leadId: string, data: ExtractedData): void {
    const storageKey = `lead-${leadId}-extracted-data`;

    try {
      const existing = localStorage.getItem(storageKey);
      const existingData = existing ? JSON.parse(existing) : {};

      // Merge with existing data (keep most confident values)
      const merged = {
        ...existingData,
        property: { ...existingData.property, ...data.property },
        boiler: { ...existingData.boiler, ...data.boiler },
        quotation: { ...existingData.quotation, ...data.quotation },
        occupancy: { ...existingData.occupancy, ...data.occupancy },
        issues: [...new Set([...(existingData.issues || []), ...data.issues])],
        notes: [...new Set([...(existingData.notes || []), ...data.notes])],
        lastUpdated: new Date().toISOString(),
        confidence: Math.max(existingData.confidence || 0, data.confidence),
      };

      localStorage.setItem(storageKey, JSON.stringify(merged));
    } catch (error) {
      console.error('[BackgroundTranscriptionProcessor] Failed to store metadata:', error);
    }
  }

  /**
   * Trigger save via lead store
   */
  private triggerSave(leadId: string, data: ExtractedData): void {
    const leadStore = useLeadStore.getState();

    leadStore.enqueueSave({
      leadId,
      reason: 'process_recording',
      payload: {
        extractedData: data,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Start a new transcription session
   */
  public startSession(leadId: string, sessionId: string): void {
    console.log('[BackgroundTranscriptionProcessor] Starting session:', { leadId, sessionId });

    const transcriptionStore = useTranscriptionStore.getState();
    transcriptionStore.startSession(leadId, sessionId);
  }

  /**
   * Stop the current session
   */
  public stopSession(): void {
    console.log('[BackgroundTranscriptionProcessor] Stopping session');

    const transcriptionStore = useTranscriptionStore.getState();
    const activeSession = transcriptionStore.getActiveSession();

    if (activeSession) {
      // Final save before stopping
      const leadStore = useLeadStore.getState();
      leadStore.enqueueSave({
        leadId: activeSession.leadId,
        reason: 'stop_recording',
        payload: {
          finalTranscript: activeSession.accumulatedTranscript,
          segmentCount: activeSession.segments.length,
          timestamp: new Date().toISOString(),
        },
      });
    }

    transcriptionStore.stopSession();
  }

  /**
   * Get extracted data for a lead
   */
  public getExtractedData(leadId: string): ExtractedData | null {
    const storageKey = `lead-${leadId}-extracted-data`;

    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('[BackgroundTranscriptionProcessor] Failed to get extracted data:', error);
      return null;
    }
  }

  /**
   * Clear extracted data for a lead
   */
  public clearExtractedData(leadId: string): void {
    const storageKey = `lead-${leadId}-extracted-data`;
    localStorage.removeItem(storageKey);
  }
}

// Export singleton instance
export const backgroundTranscriptionProcessor = BackgroundTranscriptionProcessor.getInstance();

// Auto-initialize on module load (runs once when app starts)
if (typeof window !== 'undefined') {
  // Wait for app to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      backgroundTranscriptionProcessor.initialize();
    });
  } else {
    backgroundTranscriptionProcessor.initialize();
  }
}
