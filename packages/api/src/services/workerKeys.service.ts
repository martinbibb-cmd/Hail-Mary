/**
 * Worker Keys Service
 *
 * Historical note:
 * Some earlier iterations expected the Cloudflare Worker to return raw API keys.
 * The current worker design (see `packages/worker`) exposes ONLY health/config
 * (e.g. GET /health) and never returns secrets.
 *
 * Therefore:
 * - We treat the worker as an optional hint only.
 * - If the worker is unreachable/misconfigured, we return empty keys and let
 *   callers fall back to server env vars (OPENAI_API_KEY, etc).
 */

const WORKER_URL = 'https://hail-mary.martinbibb.workers.dev';

interface WorkerKeysResponse {
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

interface WorkerHealthResponse {
  ok?: boolean;
  providers?: {
    gemini?: boolean;
    openai?: boolean;
    anthropic?: boolean;
  };
}

let cachedKeys: WorkerKeysResponse | null = null;
let lastFetchTime = 0;
let fetchInProgress: Promise<WorkerKeysResponse> | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch API keys from Cloudflare Worker
 */
async function fetchKeysFromWorker(): Promise<WorkerKeysResponse> {
  try {
    const response = await fetch(`${WORKER_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Worker /health responded with status ${response.status}`);
      return {};
    }

    const data = (await response.json()) as WorkerHealthResponse;
    // Worker does not return secrets; return empty keys and let callers fall back.
    if (data?.providers) {
      console.log('Worker providers configured:', data.providers);
    }
    return {};
  } catch (error) {
    console.warn('Worker /health not reachable:', error);
    // Non-fatal: callers should fall back to environment variables.
    return {};
  }
}

/**
 * Get API keys from worker with caching
 */
export async function getApiKeys(): Promise<WorkerKeysResponse> {
  // If a fetch is already in progress, wait for it
  if (fetchInProgress) {
    return fetchInProgress;
  }

  const now = Date.now();
  
  // Return cached keys if they're still valid
  if (cachedKeys && (now - lastFetchTime) < CACHE_DURATION_MS) {
    return cachedKeys;
  }

  // Start a new fetch and store the promise
  fetchInProgress = fetchKeysFromWorker()
    .then(keys => {
      cachedKeys = keys;
      lastFetchTime = Date.now();
      fetchInProgress = null;
      return keys;
    })
    .catch(error => {
      fetchInProgress = null;
      throw error;
    });

  return fetchInProgress;
}

/**
 * Get Gemini API key
 */
export async function getGeminiApiKey(): Promise<string | undefined> {
  const keys = await getApiKeys();
  return keys.geminiApiKey;
}

/**
 * Get OpenAI API key
 */
export async function getOpenaiApiKey(): Promise<string | undefined> {
  const keys = await getApiKeys();
  return keys.openaiApiKey;
}

/**
 * Get Anthropic API key
 */
export async function getAnthropicApiKey(): Promise<string | undefined> {
  const keys = await getApiKeys();
  return keys.anthropicApiKey;
}

/**
 * Clear cached keys (useful for testing or forced refresh)
 */
export function clearKeyCache(): void {
  cachedKeys = null;
  lastFetchTime = 0;
  fetchInProgress = null;
}
