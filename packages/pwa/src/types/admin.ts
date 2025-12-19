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
    depotSchemaLoadedFrom?: string;
    depotSchemaUsedFallback?: boolean;
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
