/**
 * Worker Client Service
 *
 * Clean interface for calling Cloudflare Worker endpoints.
 * Worker-first architecture: All AI provider calls happen in the worker.
 *
 * Worker endpoints:
 * - GET /health - Health check + provider availability
 * - POST /rocky/analyse - Rocky LLM-based analysis
 * - POST /sarah/explain - Sarah explanations
 * - POST /engineer/analyse - Engineer analysis with KB integration
 * - POST /customer-summary/generate - Customer-friendly summary generation
 */

const WORKER_URL = process.env.WORKER_URL || 'https://hail-mary.martinbibb.workers.dev';
const WORKER_TIMEOUT_MS = 20000; // 20 seconds

// ============================================
// Type Definitions
// ============================================

export interface WorkerHealthResponse {
  ok: boolean;
  providers?: {
    gemini?: boolean;
    openai?: boolean;
    anthropic?: boolean;
  };
}

export interface WorkerEngineerRequest {
  mode: string;
  context: {
    property: { address: string; postcode: string };
    visit: { startedAt: string };
    transcripts: Array<{ text: string; occurredAt: string }>;
    notes: string[];
  };
  queries: string[];
  kbSources: Array<{
    sourceId: string;
    docId: string;
    title: string;
    ref: string;
    text: string;
  }>;
}

export interface WorkerEngineerResponse {
  success: boolean;
  summary: string;
  facts: Array<{
    text: string;
    citations: string[];
    confidence?: 'high' | 'medium' | 'low';
    verified?: boolean;
  }>;
  questions: string[];
  concerns: string[];
}

export interface WorkerCustomerSummaryRequest {
  tone: string;
  propertyAddress: string | null;
  engineer: {
    summary: string;
    facts: Array<{
      text: string;
      citations: Array<{ docId: string; title: string; ref: string }>;
      confidence?: 'high' | 'medium' | 'low';
      verified?: boolean;
    }>;
    questions: string[];
    concerns: string[];
  };
}

export interface WorkerCustomerSummaryResponse {
  success: boolean;
  title: string;
  summaryMarkdown: string;
}

export interface WorkerSarahChatRequest {
  visitContext: {
    property: Record<string, unknown>;
    visit: Record<string, unknown>;
    engineer: Record<string, unknown> | null;
    kbSources: Array<{
      sourceId: string;
      docId: string;
      title: string;
      ref: string;
      text: string;
    }>;
  };
  message: string;
  mode: 'engineer_explain' | 'visit_kb';
  useKnowledgeBase: boolean;
}

export interface WorkerSarahChatResponse {
  success: boolean;
  reply: string;
  citations: Array<{ title: string; docId: string; ref: string }>;
}

// ============================================
// Worker Client Functions
// ============================================

/**
 * Check worker health and provider availability
 */
export async function checkWorkerHealth(): Promise<WorkerHealthResponse> {
  try {
    const response = await fetch(`${WORKER_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`Worker /health responded with status ${response.status}`);
      return { ok: false };
    }

    const data = (await response.json()) as WorkerHealthResponse;
    return data;
  } catch (error) {
    console.warn('Worker /health not reachable:', error);
    return { ok: false };
  }
}

/**
 * Call worker for Engineer analysis
 */
export async function callWorkerEngineer(
  request: WorkerEngineerRequest
): Promise<WorkerEngineerResponse> {
  try {
    const response = await fetch(`${WORKER_URL}/engineer/analyse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker engineer endpoint failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as WorkerEngineerResponse;
    return data;
  } catch (error) {
    console.error('Worker engineer call failed:', error);
    throw error;
  }
}

/**
 * Call worker for Customer Summary generation
 */
export async function callWorkerCustomerSummary(
  request: WorkerCustomerSummaryRequest
): Promise<WorkerCustomerSummaryResponse> {
  try {
    const response = await fetch(`${WORKER_URL}/customer-summary/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker customer-summary endpoint failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as WorkerCustomerSummaryResponse;
    return data;
  } catch (error) {
    console.error('Worker customer-summary call failed:', error);
    throw error;
  }
}

/**
 * Call worker for Sarah chat
 */
export async function callWorkerSarahChat(
  request: WorkerSarahChatRequest
): Promise<WorkerSarahChatResponse> {
  try {
    const response = await fetch(`${WORKER_URL}/sarah/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker sarah/chat endpoint failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as WorkerSarahChatResponse;
    return data;
  } catch (error) {
    console.error('Worker sarah/chat call failed:', error);
    throw error;
  }
}

// ============================================
// Export
// ============================================

export const workerClient = {
  checkHealth: checkWorkerHealth,
  callEngineer: callWorkerEngineer,
  callCustomerSummary: callWorkerCustomerSummary,
  callSarahChat: callWorkerSarahChat,
};
