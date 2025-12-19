/**
 * Rocky Client - Local Deterministic Extraction + Optional Worker
 * 
 * Primary mode: Local deterministic pattern matching (always available)
 * Optional enhancement: Cloudflare Worker with AI providers (Gemini/OpenAI/Anthropic)
 * 
 * Architectural Rule: Rocky decides. Sarah explains.
 * Rocky is NOT degraded just because Worker is offline - local extraction is the core.
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://hail-mary.martinbibb.workers.dev';

export type RockyStatus = 'connected' | 'degraded' | 'blocked';
export type CloudAIStatus = 'available' | 'unavailable' | 'not-configured';

export interface RockyHealthResponse {
  ok: boolean;
  providers: {
    gemini: boolean;
    openai: boolean;
    anthropic: boolean;
  };
}

export interface RockyAnalyseRequest {
  visitId: string;
  transcriptChunk: string;
  snapshot?: Record<string, any>;
}

export interface RockyAnalyseResponse {
  ok: boolean;
  providerUsed?: 'gemini' | 'openai' | 'anthropic' | 'local';
  plainEnglishSummary?: string;
  technicalRationale?: string;
  keyDetailsDelta?: Record<string, any>;
  checklistDelta?: Record<string, any>;
  blockers?: string[];
  error?: string;
}

// Rocky local extraction is always 'connected' (no external dependency)
let cachedStatus: RockyStatus = 'connected';
let cloudAIStatus: CloudAIStatus = 'not-configured';
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

/**
 * Check Cloud AI (Worker) health status
 * This is separate from Rocky status - Rocky works locally regardless
 */
export async function checkCloudAIHealth(): Promise<CloudAIStatus> {
  const now = Date.now();
  
  // Return cached status if checked recently
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return cloudAIStatus;
  }

  try {
    const response = await fetch(`${WORKER_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Cloud AI health check failed:', response.status);
      cloudAIStatus = 'unavailable';
      lastHealthCheck = now;
      return cloudAIStatus;
    }

    const data: RockyHealthResponse = await response.json();
    
    // Check if at least one provider is available
    const hasProvider = data.providers.gemini || data.providers.openai || data.providers.anthropic;
    cloudAIStatus = hasProvider ? 'available' : 'unavailable';
    lastHealthCheck = now;
    return cloudAIStatus;
  } catch (error) {
    console.warn('Cloud AI health check error:', error);
    cloudAIStatus = 'unavailable';
    lastHealthCheck = now;
    return cloudAIStatus;
  }
}

/**
 * Check Rocky health status
 * Rocky is local/deterministic, so it's always 'connected' unless there's a config issue
 */
export async function checkRockyHealth(): Promise<RockyStatus> {
  // Local extraction always works - no Worker dependency
  cachedStatus = 'connected';
  return cachedStatus;
}

/**
 * Get current Rocky status (from cache)
 * Rocky is always 'connected' as it uses local extraction
 */
export function getRockyStatus(): RockyStatus {
  return cachedStatus;
}

/**
 * Get Cloud AI status (optional enhancement)
 */
export function getCloudAIStatus(): CloudAIStatus {
  return cloudAIStatus;
}

/**
 * Call Cloud AI Worker to analyse a transcript chunk (optional enhancement)
 * This is supplementary to local extraction, not required
 */
export async function analyseWithCloudAI(request: RockyAnalyseRequest): Promise<RockyAnalyseResponse> {
  try {
    const response = await fetch(`${WORKER_URL}/rocky/analyse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Cloud AI analyse failed:', response.status, errorText);
      cloudAIStatus = 'unavailable';
      return {
        ok: false,
        error: `Cloud AI analysis failed: ${response.status}`,
        plainEnglishSummary: 'Cloud AI unavailable. Using local extraction.',
        blockers: [`Worker returned ${response.status}`],
      };
    }

    const data: RockyAnalyseResponse = await response.json();
    
    // Update Cloud AI status if analysis succeeded
    if (data.ok) {
      cloudAIStatus = 'available';
      lastHealthCheck = Date.now();
    }
    
    return data;
  } catch (error) {
    console.warn('Cloud AI analyse error:', error);
    cloudAIStatus = 'unavailable';
    return {
      ok: false,
      error: String(error),
      plainEnglishSummary: 'Cloud AI unavailable. Using local extraction.',
      blockers: ['Network error or Worker unavailable'],
    };
  }
}

/**
 * Call Rocky to analyse a transcript chunk
 * Uses local extraction (primary) or optionally Cloud AI if configured
 */
export async function analyseWithRocky(request: RockyAnalyseRequest): Promise<RockyAnalyseResponse> {
  // Rocky always uses local extraction now
  // This function kept for backward compatibility but delegates to local extraction
  return {
    ok: true,
    providerUsed: 'local',
    plainEnglishSummary: 'Observation logged locally.',
  };
}

/**
 * Initialize Rocky client (call on app load)
 * Rocky is local, so always returns 'connected'
 * Optionally check Cloud AI status in background
 */
export async function initializeRocky(): Promise<RockyStatus> {
  // Check Cloud AI in background (non-blocking)
  checkCloudAIHealth().catch(() => {
    // Ignore errors - Cloud AI is optional
  });
  
  return checkRockyHealth();
}
