import { useEffect, useRef } from 'react';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { useVisitCaptureStore } from '../stores/visitCaptureStore';
import { extractStructuredData } from '../services/enhancedDataExtractor';
import { applyExtractedFactsToWorkspace } from '../services/applyExtractedFactsToWorkspace';

type PollResponse = {
  success: boolean;
  data?: {
    segments: Array<{
      seq: number;
      text: string;
      startMs?: number;
      endMs?: number;
    }>;
    nextAfterSeq: number;
  };
  error?: string;
};

/**
 * Polls Option A transcript segments and writes them into the global transcription store.
 * Also throttles derived processing (Rocky/extraction) to at most once per ~8s per session.
 */
export function useLiveTranscriptPolling(opts: {
  leadId: string | null;
  sessionId: string | null;
  enabled: boolean;
  intervalMs?: number;
  processDebounceMs?: number;
}) {
  const { leadId, sessionId, enabled, intervalMs = 1500, processDebounceMs = 8000 } = opts;

  const inFlightRef = useRef(false);
  const lastProcessedAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!enabled || !leadId || !sessionId) return;

    const tick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const store = useTranscriptionStore.getState();
        const active = store.getActiveSession();
        if (!active || active.sessionId !== sessionId || active.leadId !== leadId) return;

        const afterSeq = typeof active.lastSeq === 'number' ? active.lastSeq : -1;
        const res = await fetch(`/api/transcripts/sessions/${sessionId}/segments?afterSeq=${afterSeq}`, {
          method: 'GET',
          credentials: 'include',
        });

        const json: PollResponse = await res.json();
        if (!json.success || !json.data) return;

        const incoming = [...(json.data.segments || [])].sort((a, b) => a.seq - b.seq);
        if (incoming.length === 0) {
          // Still advance cursor if server indicates it (rare but safe)
          if (typeof json.data.nextAfterSeq === 'number' && json.data.nextAfterSeq > afterSeq) {
            store.setLastSeq(json.data.nextAfterSeq);
          }
          return;
        }

        // Map to local segments (stable ids so re-polls are idempotent)
        const baseStartedAt = active.startedAt instanceof Date ? active.startedAt : new Date(active.startedAt as any);
        const mapped = incoming.map((s) => ({
          id: `seq-${s.seq}`,
          timestamp: typeof s.startMs === 'number'
            ? new Date(baseStartedAt.getTime() + s.startMs)
            : new Date(),
          speaker: 'user',
          text: s.text,
          corrected: s.text,
          processed: false,
        }));

        store.addSegments(mapped as any);

        // Update accumulated transcript (append in seq order)
        const appended = incoming.map((s) => s.text).join(' ').trim();
        const nextAccumulated = active.accumulatedTranscript
          ? `${active.accumulatedTranscript} ${appended}`.trim()
          : appended;
        store.updateAccumulatedTranscript(nextAccumulated);

        // Update cursor
        store.setLastSeq(json.data.nextAfterSeq);

        // Throttled derived processing (Rocky / workspace)
        const now = Date.now();
        const last = lastProcessedAtRef.current[sessionId] ?? 0;
        if (now - last >= processDebounceMs) {
          lastProcessedAtRef.current[sessionId] = now;

          // Keep derived visit-capture state synced (persists by leadId/sessionId)
          try {
            useVisitCaptureStore.getState().ingestAccumulatedTranscript(leadId, nextAccumulated);
          } catch {
            // ignore
          }

          // Non-destructive normalized workspace fill
          try {
            const extracted = extractStructuredData(nextAccumulated);
            applyExtractedFactsToWorkspace(leadId, extracted).catch(() => undefined);
          } catch {
            // ignore
          }
        }
      } catch {
        // Swallow polling errors (offline friendly)
      } finally {
        inFlightRef.current = false;
      }
    };

    // Run immediately + interval
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, leadId, sessionId, intervalMs, processDebounceMs]);
}

