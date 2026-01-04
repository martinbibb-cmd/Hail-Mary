/**
 * Job Graph Service
 *
 * API client for job graph operations
 */

import { apiFetch } from './apiClient';
import type {
  JobGraphState,
  JobGraphSummary,
  CompletenessAssessment,
  Fact,
  Decision,
  Conflict,
  FactCategory,
  DecisionType,
  Confidence,
} from '@hail-mary/shared';

const API_BASE = '/api/job-graph';

export interface JobGraphApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InitializeJobGraphResponse {
  jobGraphId: string;
  status: string;
  milestonesCreated: number;
}

/**
 * Get complete job graph state for a visit
 */
export async function getJobGraphByVisit(visitId: string): Promise<JobGraphState | null> {
  const response = await apiFetch<JobGraphApiResponse<JobGraphState>>(
    `${API_BASE}/visits/${visitId}`
  );
  return response.success ? response.data || null : null;
}

/**
 * Initialize job graph for a visit
 */
export async function initializeJobGraph(visitId: string): Promise<InitializeJobGraphResponse | null> {
  const response = await apiFetch<JobGraphApiResponse<InitializeJobGraphResponse>>(
    `${API_BASE}/visits/${visitId}`,
    {
      method: 'POST',
    }
  );
  return response.success ? response.data || null : null;
}

/**
 * Add a fact to the job graph
 */
export async function addFact(
  jobGraphId: string,
  fact: {
    category: FactCategory;
    key: string;
    value: unknown;
    sourceEventId?: string;
    unit?: string;
    confidence?: Confidence;
    extractedBy?: 'ai' | 'manual' | 'measurement' | 'calculation' | 'lookup';
    notes?: string;
  }
): Promise<Fact | null> {
  const response = await apiFetch<JobGraphApiResponse<Fact>>(
    `${API_BASE}/${jobGraphId}/facts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fact),
    }
  );
  return response.success ? response.data || null : null;
}

/**
 * Record a decision
 */
export async function recordDecision(
  jobGraphId: string,
  decision: {
    milestoneId?: string;
    decisionType: DecisionType;
    decision: string;
    reasoning: string;
    ruleApplied?: unknown;
    evidenceFactIds?: string[];
    confidence?: Confidence;
    risks?: string[];
    createdBy?: 'ai' | 'engineer' | 'system';
  }
): Promise<Decision | null> {
  const response = await apiFetch<JobGraphApiResponse<Decision>>(
    `${API_BASE}/${jobGraphId}/decisions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision),
    }
  );
  return response.success ? response.data || null : null;
}

/**
 * Get conflicts for a job graph
 */
export async function getConflicts(
  jobGraphId: string,
  unresolvedOnly: boolean = false
): Promise<Conflict[]> {
  const query = unresolvedOnly ? '?unresolved=true' : '';
  const response = await apiFetch<JobGraphApiResponse<Conflict[]>>(
    `${API_BASE}/${jobGraphId}/conflicts${query}`
  );
  return response.success ? response.data || [] : [];
}

/**
 * Process job graph (run validation, conflict detection, update state)
 */
export async function processJobGraph(
  jobGraphId: string
): Promise<{ summary: JobGraphSummary; completeness: CompletenessAssessment } | null> {
  const response = await apiFetch<
    JobGraphApiResponse<{ summary: JobGraphSummary; completeness: CompletenessAssessment }>
  >(`${API_BASE}/${jobGraphId}/process`, {
    method: 'POST',
  });
  return response.success ? response.data || null : null;
}

/**
 * Get job graph summary
 */
export async function getJobGraphSummary(jobGraphId: string): Promise<JobGraphSummary | null> {
  const response = await apiFetch<JobGraphApiResponse<JobGraphSummary>>(
    `${API_BASE}/${jobGraphId}/summary`
  );
  return response.success ? response.data || null : null;
}

/**
 * Get completeness assessment
 */
export async function getCompleteness(jobGraphId: string): Promise<CompletenessAssessment | null> {
  const response = await apiFetch<JobGraphApiResponse<CompletenessAssessment>>(
    `${API_BASE}/${jobGraphId}/completeness`
  );
  return response.success ? response.data || null : null;
}
