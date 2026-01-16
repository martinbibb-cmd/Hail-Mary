/**
 * Shared Types for Hail-Mary Quote Tool
 * 
 * These types are used across the API and PWA to ensure consistency.
 */

// ============================================
// Base Types
// ============================================

export interface BaseEntity {
  id: string | number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Lead Types (Single Source of Truth)
// ============================================

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'quoted' | 'won' | 'lost';

// Lead is the single source of truth - combines lead tracking with customer contact info
export interface Lead extends BaseEntity {
  accountId?: number;
  // User assignment for access control
  assignedUserId?: number;
  // Contact information
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: Address;
  // Lead information
  source?: string;
  status: LeadStatus;
  description?: string;
  propertyType?: string;
  estimatedValue?: number;
  notes?: string;
}

// Legacy alias for backwards compatibility (deprecated - use Lead instead)
// @deprecated Use Lead type instead - Customer is now a state of Lead (status='won')
export type Customer = Lead;

// ============================================
// Product Types
// ============================================

export type ProductCategory = 'boiler' | 'cylinder' | 'controls' | 'radiator' | 'parts' | 'labour' | 'other';

export interface Product extends BaseEntity {
  name: string;
  description: string;
  category: ProductCategory;
  manufacturer?: string;
  model?: string;
  sku?: string;
  price: number;
  costPrice?: number;
  specifications?: ProductSpecifications;
  isActive: boolean;
}

export interface ProductSpecifications {
  kw?: number;
  dimensions?: {
    height: number;
    width: number;
    depth: number;
  };
  flowRate?: number;
  clearances?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    front: number;
  };
  partCode?: string;
  [key: string]: unknown;
}

// ============================================
// Quote Types
// ============================================

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

export interface Quote extends BaseEntity {
  quoteNumber: string;
  leadId: string | number;
  lead?: Lead;
  status: QuoteStatus;
  title: string;
  description?: string;
  lines: QuoteLine[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  validUntil: Date;
  notes?: string;
  terms?: string;
}

export interface QuoteLine {
  id: string | number;
  productId: string | number;
  product?: Product;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  lineTotal: number;
}

// ============================================
// Appointment Types
// ============================================

export type AppointmentType = 'survey' | 'installation' | 'service' | 'followup';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';

export interface Appointment extends BaseEntity {
  leadId: string | number;
  lead?: Lead;
  quoteId?: string | number;
  quote?: Quote;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: Date;
  duration: number; // minutes
  address: Address;
  notes?: string;
  assignedTo?: string;
}

// ============================================
// Survey Types
// ============================================

export interface Survey extends BaseEntity {
  appointmentId: string | number;
  appointment?: Appointment;
  leadId: string | number;
  lead?: Lead;
  propertyType: string;
  numberOfBedrooms?: number;
  heatingType?: string;
  currentBoiler?: string;
  pipeWork?: string;
  gasMeterLocation?: string;
  accessNotes?: string;
  photos?: SurveyPhoto[];
  measurements?: Record<string, unknown>;
  notes?: string;
}

export interface SurveyPhoto {
  id: string | number;
  url: string;
  description?: string;
  takenAt: Date;
}

// ============================================
// Document Types
// ============================================

export type DocumentType = 'quote_pdf' | 'proposal' | 'invoice' | 'installation_instructions' | 'handover_pack' | 'other';

export interface Document extends BaseEntity {
  type: DocumentType;
  name: string;
  url: string;
  leadId?: string | number;
  quoteId?: string | number;
  mimeType: string;
  size: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Create/Update DTOs
// ============================================

export type CreateLeadDto = Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateLeadDto = Partial<CreateLeadDto>;

// Legacy aliases for backwards compatibility
// @deprecated Use CreateLeadDto instead
export type CreateCustomerDto = CreateLeadDto;
// @deprecated Use UpdateLeadDto instead
export type UpdateCustomerDto = UpdateLeadDto;

export type CreateProductDto = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateProductDto = Partial<CreateProductDto>;

export type CreateQuoteDto = Omit<Quote, 'id' | 'createdAt' | 'updatedAt' | 'lead' | 'quoteNumber' | 'subtotal' | 'vatAmount' | 'total'>;
export type UpdateQuoteDto = Partial<CreateQuoteDto>;

export type CreateAppointmentDto = Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'lead' | 'quote'>;
export type UpdateAppointmentDto = Partial<CreateAppointmentDto>;

export type CreateSurveyDto = Omit<Survey, 'id' | 'createdAt' | 'updatedAt' | 'lead' | 'appointment'>;
export type UpdateSurveyDto = Partial<CreateSurveyDto>;

// ============================================
// Visit Session & Voice-First Types
// ============================================

export type VisitSessionStatus = 'in_progress' | 'completed' | 'cancelled';

export interface VisitSession {
  id: number;
  accountId: number;
  leadId?: number; // MADE OPTIONAL - legacy compatibility only, new workflows use spine_visits
  lead?: Lead;
  startedAt: Date;
  endedAt?: Date;
  status: VisitSessionStatus;
  summary?: string; // AI-generated summary of the visit
}

export type MediaType = 'photo' | 'video' | 'measurement' | 'other';

export interface MediaAttachment {
  id: number;
  visitSessionId: number;
  leadId: number;
  type: MediaType;
  url: string;
  description?: string;
  createdAt: Date;
}

// ============================================
// Survey Template Types (User-designed surveys)
// ============================================

export type SurveyQuestionType = 'single_choice' | 'multiple_choice' | 'text' | 'number' | 'boolean' | 'date';

export interface SurveyQuestion {
  id: string;
  label: string;
  type: SurveyQuestionType;
  options?: string[];
  required?: boolean;
}

export interface SurveySection {
  id: string;
  label: string;
  questions: SurveyQuestion[];
}

export interface SurveyTemplateSchema {
  sections: SurveySection[];
}

export interface SurveyTemplate {
  id: number;
  accountId: number;
  name: string;
  description?: string;
  schema: SurveyTemplateSchema;
  createdAt: Date;
  updatedAt: Date;
}

export type SurveyInstanceStatus = 'in_progress' | 'complete';

export interface SurveyInstance {
  id: number;
  templateId: number;
  template?: SurveyTemplate;
  visitSessionId: number;
  visitSession?: VisitSession;
  leadId: number;
  lead?: Lead;
  status: SurveyInstanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type AnswerSource = 'voice' | 'manual' | 'ai';

export interface SurveyAnswer {
  id: number;
  instanceId: number;
  questionId: string;
  value: unknown; // string/number/boolean/array
  source: AnswerSource;
  rawText?: string;
  createdAt: Date;
}

export interface VisitObservation {
  id: number;
  visitSessionId: number;
  leadId?: number; // MADE OPTIONAL - legacy compatibility only
  text: string;
  createdAt: Date;
}

// ============================================
// Visit Session DTOs
// ============================================

export interface CreateVisitSessionDto {
  accountId: number;
  leadId?: number; // MADE OPTIONAL - legacy compatibility only, new workflows use spine_visits
}

export interface UpdateVisitSessionDto {
  status?: VisitSessionStatus;
  /**
   * Timestamp for when the visit ended.
   *
   * Note: over JSON this will typically arrive as an ISO string.
   */
  endedAt?: string | Date;
  summary?: string; // Allow updating the summary
}

// ============================================
// Assistant API Types
// ============================================

export interface AssistantMessageRequest {
  sessionId: number;
  leadId: number;
  text: string;
}

export interface AssistantAction {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface AssistantMessageResponse {
  assistantReply: string;
  actions: AssistantAction[];
}

export interface STTRequest {
  audio?: string; // base64 encoded audio or URL
}

export interface STTResponse {
  text: string;
}

// ============================================
// Auth Types
// ============================================

export type AuthProvider = 'local' | 'google' | 'salesforce';
export type UserRole = 'user' | 'admin' | 'guest';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  accountId?: number;
  authProvider: AuthProvider;
  role: UserRole;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface PasswordResetRequestDto {
  email: string;
}

export interface PasswordResetDto {
  token: string;
  newPassword: string;
}

export interface AuthResponse {
  success: boolean;
  data?: AuthUser;
  message?: string;
  error?: string;
  code?: string;
}

// ============================================
// Transcription Types
// ============================================

export type TranscriptSessionStatus = 'recording' | 'processing' | 'completed' | 'error';

export interface TranscriptSession {
  id: number;
  leadId?: number;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Option A (live ingestion) metadata
   */
  source?: string;
  deviceId?: string;
  startedAt?: Date;
  endedAt?: Date;
  status: TranscriptSessionStatus;
  durationSeconds?: number;
  language: string;
  notes?: string;
}

export type SttStatus = 'pending' | 'processing' | 'done' | 'error';

export interface TranscriptAudioChunk {
  id: number;
  sessionId: number;
  index: number;
  startOffsetSeconds: number;
  durationSeconds?: number;
  storagePath: string;
  sttStatus: SttStatus;
  transcriptText?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptSegment {
  id: number;
  sessionId: number;
  /**
   * Legacy chunk-based ingestion (may be null for Option A live segments)
   */
  chunkId?: number;
  /**
   * Option A (live ingestion) fields
   */
  seq?: number;
  startMs?: number;
  endMs?: number;
  startSeconds: number;
  endSeconds: number;
  speaker: string;
  text: string;
  roomTag?: string;
  topicTag?: string;
  confidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Transcription DTOs
export interface CreateTranscriptSessionDto {
  leadId?: number;
  language?: string;
  notes?: string;
}

export interface ChunkUploadMetadata {
  index: number;
  startOffsetSeconds: number;
  durationSeconds?: number;
}

export interface TranscriptSessionWithDetails {
  session: TranscriptSession;
  chunks: TranscriptAudioChunk[];
  segments: TranscriptSegment[];
}

// ============================================
// Survey Helper Types
// ============================================

export type ModuleName = 'core' | 'central_heating' | 'heat_pump' | 'pv' | 'ev' | 'hazards';

export type Priority = 'critical' | 'important' | 'nice_to_have';

export type TriggerMode = 'always' | 'topic_change' | 'on_request' | 'rare_hazard';

export type TopicTag = 
  | 'fabric' 
  | 'lifestyle' 
  | 'boiler' 
  | 'emitters' 
  | 'controls' 
  | 'cylinder' 
  | 'hp_overview' 
  | 'hp_outdoor' 
  | 'roof' 
  | 'electrics' 
  | 'parking' 
  | 'hazards';

export interface ChipOption {
  label: string;
  value: string | number | boolean | null | string[];
}

export interface SurveySlot {
  id: string;
  module: ModuleName;
  topic: TopicTag;
  path: string;
  priority: Priority;
  question: string;
  chipOptions: ChipOption[];
  allowSkip: boolean;
  triggerMode: TriggerMode;
  notes?: string;
  preconditions?: SlotPrecondition[];
}

export interface SlotPrecondition {
  path: string;
  operator: 'equals' | 'not_equals' | 'exists' | 'not_exists' | 'in';
  value?: unknown;
}

// ============================================
// SystemSpecDraft Types - The main spec schema
// ============================================

// Property/Core Information
export interface PropertyInfo {
  propertyType?: 'house' | 'flat' | 'bungalow' | 'other';
  buildYearApprox?: string;
  loftInsulationDepthMm?: string;
  glazingType?: 'single' | 'double' | 'triple' | 'mixed';
}

export interface OccupancyPattern {
  homeAllDay?: boolean | null;
  hotWaterProfile?: 'low' | 'medium' | 'high';
}

// Central Heating Information
export interface ExistingHeatSource {
  systemType?: 'combi' | 'storage_combi' | 'system' | 'regular' | 'back_boiler' | 'other';
  boilerFuel?: 'mains_gas' | 'lpg' | 'oil' | 'electric' | 'other';
  boilerApproxAgeYears?: string;
  generalCondition?: 'good' | 'tired' | 'poor' | 'condemned';
  flueCategory?: 'fanned_round' | 'fanned_square' | 'balanced' | 'open_flue' | 'back_boiler' | 'unknown';
  flueRoute?: 'horizontal_wall' | 'vertical_pitched_roof' | 'vertical_flat_roof' | 'ridge_tile_vent' | 'into_chimney' | 'other';
}

export interface EmitterInfo {
  microborePresence?: 'microbore' | 'mixed' | 'standard_two_pipe' | 'single_pipe_present' | 'unknown';
  pipeworkSummary?: string;
}

export interface WaterQuality {
  evidenceOfSludge?: boolean;
  sludgeSeverity?: 'low' | 'medium' | 'high' | 'unknown';
  filterFitted?: boolean | null;
}

export interface CentralHeatingSpec {
  existingHeatSource?: ExistingHeatSource;
  emitters?: EmitterInfo;
  waterQuality?: WaterQuality;
  controlsSummary?: 'basic' | 'programmable' | 'smart' | 'none';
}

// Heat Pump Information
export interface HeatPumpProposedSystem {
  replaceBoilerCompletely?: boolean | null;
}

export interface HeatPumpEmitterCheck {
  designFlowTempTarget?: number | null;
  roomsNeedingUpsize?: 'few_changes' | 'some_changes' | 'major_changes' | 'unknown';
}

export interface HeatPumpPlantArea {
  existingCylinderReusePossible?: 'reuse' | 'replace' | 'new_location' | 'unknown';
}

export interface HeatPumpOutdoorUnit {
  candidateLocationQuality?: 'good' | 'ok' | 'poor' | 'unknown';
  noiseRiskLevel?: 'low' | 'medium' | 'high';
}

export interface HeatPumpElectrical {
  mainFuseOkForHPAndRest?: 'ok' | 'borderline' | 'upgrade_required' | 'unknown';
}

export interface HeatPumpSpec {
  proposedSystem?: HeatPumpProposedSystem;
  emitterCheck?: HeatPumpEmitterCheck;
  plantArea?: HeatPumpPlantArea;
  outdoorUnit?: HeatPumpOutdoorUnit;
  electrical?: HeatPumpElectrical;
}

// Solar PV Information
export interface RoofUse {
  mainPitchAspect?: 'S' | 'SE' | 'SW' | 'E' | 'W' | 'mixed';
  shadingSummary?: 'none' | 'morning' | 'afternoon' | 'heavy' | 'unknown';
}

export interface StructuralAndAccess {
  roofConditionSummary?: 'good' | 'tired' | 'poor' | 'unknown';
}

export interface ElectricalIntegration {
  inverterLocationQuality?: 'good' | 'ok' | 'poor';
  exportLimitExpected?: '3.68_ok' | 'dno_required' | 'unknown';
}

export interface StorageAndFuture {
  batteryInterestLevel?: 'now' | 'later' | 'no';
}

export interface SolarPvSpec {
  roofUse?: RoofUse;
  structuralAndAccess?: StructuralAndAccess;
  electricalIntegration?: ElectricalIntegration;
  storageAndFuture?: StorageAndFuture;
}

// EV Charging Information
export interface EvParking {
  offStreet?: boolean | 'shared';
  cableRouteComplexity?: 'simple' | 'moderate' | 'complex' | 'unknown';
}

export interface EvElectricalCapacity {
  mainFuseOkForEV?: 'ok' | 'needs_load_management' | 'upgrade_required' | 'unknown';
}

export interface EvEarthingAndRegs {
  earthingTypeKnown?: 'tn_c_s' | 'tn_s' | 'tt' | 'unknown';
}

export interface EvSmartIntegration {
  PVIntegrationPlanned?: boolean | null;
}

export interface EvSpec {
  parking?: EvParking;
  electricalCapacity?: EvElectricalCapacity;
  earthingAndRegs?: EvEarthingAndRegs;
  smartIntegration?: EvSmartIntegration;
}

// Hazards Information
export interface AsbestosInfo {
  surveysOnFile?: boolean;
  suspectedLocations?: string[];
  monkeyMuckObserved?: 'confirmed' | 'suspected' | 'no' | null;
}

export interface HazardsSpec {
  asbestos?: AsbestosInfo;
  legacyMaterials?: string[];
  accessRestrictions?: string[];
}

// Core Supply Information
export interface CoreSupply {
  mainFuseRating?: number;
}

// Main SystemSpecDraft Type
export interface SystemSpecDraft {
  id?: number;
  sessionId?: number;
  activeModules: ModuleName[];
  property?: PropertyInfo;
  occupancyPattern?: OccupancyPattern;
  coreSupply?: CoreSupply;
  centralHeating?: CentralHeatingSpec;
  heatPump?: HeatPumpSpec;
  solarPv?: SolarPvSpec;
  ev?: EvSpec;
  hazards?: HazardsSpec;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// Survey Helper State & Engine Types
// ============================================

export interface HelperState {
  specDraft: SystemSpecDraft;
  activeModules: ModuleName[];
  currentTopic: TopicTag;
  askedSlotIds: string[];
  recentSegments?: TranscriptSegment[];
}

export interface NextQuestionRequest {
  sessionId: number;
  currentTopic?: TopicTag;
}

export interface NextQuestionResponse {
  slot: SurveySlot | null;
  completeness: ModuleCompleteness[];
  message?: string;
}

export interface AnswerRequest {
  sessionId: number;
  slotId: string;
  value: unknown;
  source?: 'chip' | 'voice' | 'manual';
}

export interface AnswerResponse {
  success: boolean;
  updatedPath: string;
  message?: string;
}

export interface ModuleCompleteness {
  module: ModuleName;
  filledCritical: number;
  totalCritical: number;
  filledImportant: number;
  totalImportant: number;
  percentage: number;
  warnings: string[];
}

export interface CompletenessResponse {
  modules: ModuleCompleteness[];
  overallPercentage: number;
  readyToQuote: boolean;
  warnings: string[];
}

// ============================================
// Survey Helper DTOs
// ============================================

export interface CreateSystemSpecDraftDto {
  sessionId: number;
  activeModules: ModuleName[];
}

export interface UpdateSystemSpecDraftDto {
  path: string;
  value: unknown;
}

// ============================================
// Atlas Notes / Structured Transcription Types
// ============================================

export interface AtlasSection {
  key: string;
  name: string;
  description: string;
  order: number;
  required: boolean;
}

export interface AtlasSectionSchema {
  sections: AtlasSection[];
}

export interface AtlasNotes {
  customer_summary?: string;
  existing_system?: string;
  property_details?: string;
  radiators_emitters?: string;
  pipework?: string;
  flue_ventilation?: string;
  hot_water?: string;
  controls?: string;
  electrical?: string;
  gas_supply?: string;
  water_supply?: string;
  location_access?: string;
  materials_parts?: string;
  hazards_risks?: string;
  customer_requests?: string;
  follow_up_actions?: string;
  [key: string]: string | undefined;
}

// Legacy type aliases for backwards compatibility (deprecated)
/** @deprecated Use AtlasSection instead */
export type DepotSection = AtlasSection;
/** @deprecated Use AtlasSectionSchema instead */
export type DepotSectionSchema = AtlasSectionSchema;
/** @deprecated Use AtlasNotes instead */
export type DepotNotes = AtlasNotes;

export interface MaterialItem {
  name: string;
  quantity?: number;
  notes?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  associated_materials: string[];
}

export interface ChecklistConfig {
  checklist_items: ChecklistItem[];
  material_aliases: Record<string, string[]>;
}

export interface MissingInfoItem {
  section: string;
  question: string;
  priority: 'critical' | 'important' | 'nice_to_have';
}

export interface StructuredTranscriptResult {
  atlasNotes: AtlasNotes;
  materials: MaterialItem[];
  missingInfo: MissingInfoItem[];
  checklist: string[];
  confidence: number;
  // Legacy field for backwards compatibility
  /** @deprecated Use atlasNotes instead */
  depotNotes?: AtlasNotes;
}

export interface TranscriptionSanityChecks {
  pipeSizes: boolean;
  commonErrors: boolean;
}

// AI Provider Types for Transcription
// Priority order: Gemini → OpenAI → Anthropic
export type AIProvider = 'gemini' | 'openai' | 'anthropic';

export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
}

export interface TranscriptionConfig {
  whisperApiKey: string;
  primaryAIProvider: AIProviderConfig;
  fallbackAIProvider?: AIProviderConfig;
  enableSanityChecks: boolean;
}

// ============================================
// Lead Workspace - Normalized Data Model Types
// ============================================

export interface LeadContact extends BaseEntity {
  leadId: number;
  name: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country?: string;
}

export interface LeadOccupancy extends BaseEntity {
  leadId: number;
  occupants?: number;
  schedule?: string;
  priorities?: string;
  notes?: string;
}

export interface Property extends BaseEntity {
  leadId: number;
  type?: string; // detached, semi, terraced, flat, bungalow
  ageBand?: string; // pre-1919, 1919-1944, etc.
  construction?: Record<string, unknown>; // { walls: "cavity", roof: "pitched", floors: "suspended" }
  notes?: string;
}

export interface PropertyFloorplan {
  id: number;
  leadId: number;
  fileId?: number;
  label?: string; // "Ground Floor", "First Floor"
  scale?: string; // e.g. "1:50"
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface LeadPhoto {
  id: number;
  leadId: number;
  fileId?: number;
  category?: string; // "boiler", "cylinder", "property", "other"
  caption?: string;
  takenAt?: Date;
  createdAt: Date;
}

export interface LeadHeatloss extends BaseEntity {
  leadId: number;
  wholeHouseW?: number;
  method?: string; // "MCS", "room-by-room", "estimate"
  assumptions?: string;
}

export interface LeadTechnology {
  id: number;
  leadId: number;
  type: string; // boiler, cylinder, pv, battery, ev_charger, etc.
  make?: string;
  model?: string;
  notes?: string;
  createdAt: Date;
}

export interface LeadInterest {
  id: number;
  leadId: number;
  category: string; // heat_pump, solar, battery, insulation, etc.
  value?: string;
  createdAt: Date;
}

export interface LeadFuturePlan {
  id: number;
  leadId: number;
  planType: string; // extension, loft_conversion, etc.
  timeframe?: string; // "next_year", "2-5_years", etc.
  notes?: string;
  createdAt: Date;
}

export interface Recommendation extends BaseEntity {
  leadId: number;
  option: string; // A, B, C
  summary: string;
  rationale?: string;
  dependencies?: string;
}

// Lead Workspace Composite Payload (returned by GET /api/leads/:id/workspace)
export interface LeadWorkspace {
  lead: Lead;
  contact?: LeadContact;
  occupancy?: LeadOccupancy;
  property?: Property;
  heatloss?: LeadHeatloss;
  interests: LeadInterest[];
  futurePlans: LeadFuturePlan[];
  technologies: LeadTechnology[];
  quotes: Quote[];
  recommendations: Recommendation[];
  photos: LeadPhoto[];
  floorplans: PropertyFloorplan[];
}

// DTOs for workspace module endpoints
export type UpdateLeadContactDto = Partial<Omit<LeadContact, 'id' | 'leadId' | 'createdAt' | 'updatedAt'>>;
export type UpdateLeadOccupancyDto = Partial<Omit<LeadOccupancy, 'id' | 'leadId' | 'createdAt' | 'updatedAt'>>;
export type UpdatePropertyDto = Partial<Omit<Property, 'id' | 'leadId' | 'createdAt' | 'updatedAt'>>;
export type UpdateLeadHeatlossDto = Partial<Omit<LeadHeatloss, 'id' | 'leadId' | 'createdAt' | 'updatedAt'>>;

export type CreateLeadTechnologyDto = Omit<LeadTechnology, 'id' | 'leadId' | 'createdAt'>;
export type CreateLeadInterestDto = Omit<LeadInterest, 'id' | 'leadId' | 'createdAt'>;
export type CreateLeadFuturePlanDto = Omit<LeadFuturePlan, 'id' | 'leadId' | 'createdAt'>;
export type CreateRecommendationDto = Omit<Recommendation, 'id' | 'leadId' | 'createdAt' | 'updatedAt'>;
export type UpdateRecommendationDto = Partial<CreateRecommendationDto>;

export type CreateLeadPhotoDto = Omit<LeadPhoto, 'id' | 'leadId' | 'createdAt'>;
export type CreatePropertyFloorplanDto = Omit<PropertyFloorplan, 'id' | 'leadId' | 'createdAt'>;
