/**
 * Rocky Client - Cloudflare Worker Integration
 * 
 * Connects to the Rocky AI analysis engine via Cloudflare Worker
 * Default: Gemini, fallback: OpenAI, fallback: Anthropic
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://hail-mary.martinbibb.workers.dev';

export type RockyStatus = 'connected' | 'degraded' | 'blocked';

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
  providerUsed?: 'gemini' | 'openai' | 'anthropic';
  plainEnglishSummary?: string;
  technicalRationale?: string;
  keyDetailsDelta?: Record<string, any>;
  checklistDelta?: Record<string, any>;
  blockers?: string[];
  error?: string;
}

let cachedStatus: RockyStatus = 'blocked';
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

/**
 * Check Rocky health status
 */
export async function checkRockyHealth(): Promise<RockyStatus> {
  const now = Date.now();
  
  // Return cached status if checked recently
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL && cachedStatus !== 'blocked') {
    return cachedStatus;
  }

  try {
    const response = await fetch(`${WORKER_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Rocky health check failed:', response.status);
      cachedStatus = 'degraded';
      lastHealthCheck = now;
      return 'degraded';
    }

    const data: RockyHealthResponse = await response.json();
    
    // Check if at least one provider is available
    const hasProvider = data.providers.gemini || data.providers.openai || data.providers.anthropic;
    cachedStatus = hasProvider ? 'connected' : 'degraded';
    lastHealthCheck = now;
    return cachedStatus;
  } catch (error) {
    console.warn('Rocky health check error:', error);
    cachedStatus = 'degraded';
    lastHealthCheck = now;
    return 'degraded';
  }
}

/**
 * Get current Rocky status (from cache)
 */
export function getRockyStatus(): RockyStatus {
  return cachedStatus;
}

/**
 * Call Rocky to analyse a transcript chunk
 */
export async function analyseWithRocky(request: RockyAnalyseRequest): Promise<RockyAnalyseResponse> {
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
      console.error('Rocky analyse failed:', response.status, errorText);
      return {
        ok: false,
        error: `Rocky analysis failed: ${response.status}`,
        plainEnglishSummary: 'Rocky is currently unavailable. Observation logged in manual mode.',
        blockers: [`Worker returned ${response.status}`],
      };
    }

    const data: RockyAnalyseResponse = await response.json();
    
    // Update status to connected if analysis succeeded
    if (data.ok) {
      cachedStatus = 'connected';
      lastHealthCheck = Date.now();
    }
    
    return data;
  } catch (error) {
    console.error('Rocky analyse error:', error);
    cachedStatus = 'degraded';
    return {
      ok: false,
      error: String(error),
      plainEnglishSummary: 'Rocky is offline. Observation logged in manual mode.',
      blockers: ['Network error or Worker unavailable'],
    };
  }
}

/**
 * Initialize Rocky client (call on app load)
 */
export async function initializeRocky(): Promise<RockyStatus> {
  return checkRockyHealth();
}
