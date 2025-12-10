/**
 * Worker Keys Service
 * 
 * Fetches API keys from Cloudflare Worker
 * URL: hail-mary.martinbibb.workers.dev
 * 
 * The worker provides keys in this order:
 * 1. GRMINI_API_KEY
 * 2. OPENAI_API_KEY
 * 3. ANTHROPIC_API_KEY
 */

const WORKER_URL = 'https://hail-mary.martinbibb.workers.dev';

interface WorkerKeysResponse {
  grminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
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
    const response = await fetch(WORKER_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Worker responded with status ${response.status}`);
    }

    const data = (await response.json()) as any;
    return {
      grminiApiKey: data.GRMINI_API_KEY,
      openaiApiKey: data.OPENAI_API_KEY,
      anthropicApiKey: data.ANTHROPIC_API_KEY,
    };
  } catch (error) {
    console.error('Failed to fetch keys from worker:', error);
    throw new Error('Failed to fetch API keys from worker');
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
 * Get GRMINI API key
 */
export async function getGrminiApiKey(): Promise<string | undefined> {
  const keys = await getApiKeys();
  return keys.grminiApiKey;
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
