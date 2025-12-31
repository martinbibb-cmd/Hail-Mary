/**
 * GC Boiler Catalog Types
 * 
 * Types for the GC-based boiler truth layer system.
 */

// ============================================
// Enums and Constants
// ============================================

export type GcBoilerType = 'combi' | 'system' | 'regular' | 'unknown';
export type GcFuelType = 'ng' | 'lpg' | 'oil' | 'unknown';
export type BoilerStatus = 'active' | 'deprecated' | 'draft';

export type SourceType = 
  | 'manufacturer_pdf'
  | 'datasheet'
  | 'crowd'
  | 'manual_entry'
  | 'web'
  | 'unknown';

export type ExtractedBy = 'human' | 'ai' | 'import';

export type EnrichmentStatus = 
  | 'pending'
  | 'searching'
  | 'candidates_found'
  | 'needs_human'
  | 'approved'
  | 'rejected'
  | 'merged';

export type OverrunHandledBy = 'boiler' | 'external' | 'unknown';

// Field source hierarchy for confidence scoring
export type FieldSource = 
  | 'GC_CATALOG'               // 0.95
  | 'IMAGE_OCR_PLATE'          // 0.85
  | 'IMAGE_BRAND_FAMILY_RECO'  // 0.70
  | 'MANUAL_ENGINEER_ENTRY'    // 0.65
  | 'HEURISTIC_FROM_PIPES'     // 0.55
  | 'UNKNOWN';                 // 0.00

// ============================================
// Core Data Types
// ============================================

export interface BoilerGcCatalog {
  id: string;
  gcNumber: string;
  manufacturer?: string;
  brand?: string;
  model?: string;
  variant?: string;
  
  // Classification
  boilerType?: GcBoilerType;
  fuel?: GcFuelType;
  
  // Performance
  chOutputKwNominal?: number;
  dhwOutputKwNominal?: number;
  modulationMinKw?: number;
  modulationMaxKw?: number;
  erpEfficiencyPercent?: number;
  erpClass?: string;
  
  // Electrical / controls (install-critical)
  pumpOverrunRequired?: boolean;
  permanentLiveRequired?: boolean;
  overrunHandledBy?: OverrunHandledBy;
  typicalFuseA?: number;
  controlsSupported?: ControlsSupported;
  
  // Hydraulic
  internalPumpPresent?: boolean;
  internalDiverterPresent?: boolean;
  plateHexPresent?: boolean;
  expansionVesselPresent?: boolean;
  
  // Physical / flue
  heightMm?: number;
  widthMm?: number;
  depthMm?: number;
  weightKg?: number;
  flueDiameterMm?: number;
  maxFlueLengthM?: number;
  plumeKitCompatible?: boolean;
  
  // Metadata
  firstSeenAt: Date;
  updatedAt: Date;
  status: BoilerStatus;
  qualityScore?: number;
  notes?: string;
}

export interface ControlsSupported {
  on_off?: boolean;
  opentherm?: boolean;
  ebus?: boolean;
  modbus?: boolean;
  [key: string]: boolean | undefined;
}

export interface BoilerGcSource {
  id: string;
  gcCatalogId: string;
  sourceType: SourceType;
  sourceRef?: string;
  extractedBy: ExtractedBy;
  extractedAt: Date;
  fieldsCovered?: string[];
  confidence?: number;
  rawSnippet?: string;
  checksum?: string;
}

export interface BoilerGcEnrichmentQueue {
  id: string;
  gcNumber: string;
  requestedByUserId?: number;
  requestedFromLeadId?: number;
  context?: EnrichmentContext;
  status: EnrichmentStatus;
  searchAttempts: number;
  lastSearchAt?: Date;
  candidates?: EnrichmentCandidate[];
  chosenCandidate?: EnrichmentCandidate;
  reviewerUserId?: number;
  reviewerNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrichmentContext {
  photos?: string[];
  brandGuess?: string;
  notes?: string;
  location?: string;
  [key: string]: unknown;
}

export interface EnrichmentCandidate {
  manufacturer?: string;
  model?: string;
  boilerType?: GcBoilerType;
  fuel?: GcFuelType;
  chKw?: number;
  dhwKw?: number;
  dims?: {
    height?: number;
    width?: number;
    depth?: number;
  };
  overrunRequired?: boolean;
  permanentLiveRequired?: boolean;
  sourceRef?: string;
  sourceType?: SourceType;
  confidence?: number;
}

export interface BoilerGcAlias {
  id: string;
  gcNumberCanonical: string;
  alias: string;
  createdAt: Date;
}

// ============================================
// Field-Level Confidence Types
// ============================================

export interface FieldValue<T> {
  value: T | null;
  confidence: number;
  source: FieldSource;
  notes?: string;
  alternates?: Array<{
    value: T;
    confidence: number;
    source: FieldSource;
  }>;
}

// ============================================
// API Request/Response Types
// ============================================

export interface GetGcCatalogRequest {
  gcNumber: string;
}

export interface GetGcCatalogResponse {
  success: boolean;
  data?: {
    catalog: BoilerGcCatalog;
    sources: BoilerGcSource[];
    qualityScore: number;
  };
  error?: string;
}

export interface ResolveGcRequest {
  gcNumber?: string;
  photoEvidence?: string[];
  manualBrand?: string;
  manualModel?: string;
  manualType?: GcBoilerType;
  pipeSignature?: string;
  wiringCores?: number;
  cylinderPresent?: boolean;
  [key: string]: unknown;
}

export interface ResolvedField {
  [key: string]: FieldValue<unknown>;
}

export interface ResolveGcResponse {
  success: boolean;
  data?: {
    resolved: ResolvedField;
    requiredPrompts: string[];
    gcFound: boolean;
    installIssues?: string[];
  };
  error?: string;
}

export interface EnrichmentRequest {
  gcNumber: string;
  context?: EnrichmentContext;
}

export interface EnrichmentRequestResponse {
  success: boolean;
  data?: {
    queueId: string;
    status: EnrichmentStatus;
  };
  error?: string;
}

export interface ApproveEnrichmentRequest {
  queueId: string;
  chosenCandidate?: EnrichmentCandidate;
  catalogPatch?: Partial<BoilerGcCatalog>;
}

export interface ApproveEnrichmentResponse {
  success: boolean;
  data?: {
    catalogId: string;
    gcNumber: string;
  };
  error?: string;
}

export interface RejectEnrichmentRequest {
  queueId: string;
  reason: string;
}

export interface RejectEnrichmentResponse {
  success: boolean;
  error?: string;
}

// ============================================
// Utility Functions (type guards)
// ============================================

export function isValidGcBoilerType(type: string): type is GcBoilerType {
  return ['combi', 'system', 'regular', 'unknown'].includes(type);
}

export function isValidGcFuelType(fuel: string): fuel is GcFuelType {
  return ['ng', 'lpg', 'oil', 'unknown'].includes(fuel);
}

export function getConfidenceForSource(source: FieldSource): number {
  const confidenceMap: Record<FieldSource, number> = {
    'GC_CATALOG': 0.95,
    'IMAGE_OCR_PLATE': 0.85,
    'IMAGE_BRAND_FAMILY_RECO': 0.70,
    'MANUAL_ENGINEER_ENTRY': 0.65,
    'HEURISTIC_FROM_PIPES': 0.55,
    'UNKNOWN': 0.00,
  };
  return confidenceMap[source] || 0.00;
}
