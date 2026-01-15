export interface AdminSystemStatus {
  api?: {
    version?: string;
    nodeVersion?: string;
    uptimeSeconds?: number;
  };
  app?: {
    version?: string;
  };
  db?: {
    ok?: boolean;
    urlMasked?: string;
    latencyMs?: number;
  };
  migrations?: {
    ok?: boolean;
    lastRunAt?: string | null;
    notes?: string | null;
  };
  config?: {
    schemaLoadedFrom?: string;
    schemaUsedFallback?: boolean;
    checklistConfigLoadedFrom?: string;
    checklistConfigUsedFallback?: boolean;
  };
  degraded?: {
    [key: string]: boolean;
  };
  degradedSubsystems?: string[];
  degradedNotes?: string[];
  warnings?: string[];
  isDocker?: boolean;
  nasAuthMode?: boolean;
  timestamp?: string;
}

export interface AdminSystemStatusResponse {
  success: boolean;
  data?: AdminSystemStatus;
  error?: string;
}

export interface AdminVersionService {
  service: string;
  updateAvailable?: boolean;
  currentDigest?: string;
  latestDigest?: string;
  error?: string;
}

export interface AdminVersionResponse {
  hasUpdates: boolean;
  services: AdminVersionService[];
  checkedAt: string;
}

export interface AdminHealthService {
  name: string;
  state: string;
  healthy: boolean;
}

export interface AdminHealthResponse {
  healthy: boolean;
  services: AdminHealthService[];
  checkedAt: string;
}
