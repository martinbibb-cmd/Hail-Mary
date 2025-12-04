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
// Customer & Lead Types
// ============================================

export interface Customer {
  id: number;
  accountId?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: Address;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'quoted' | 'won' | 'lost';

export interface Lead extends BaseEntity {
  customerId?: string | number;
  customer?: Customer;
  source: string;
  status: LeadStatus;
  description: string;
  propertyType?: string;
  estimatedValue?: number;
  notes?: string;
}

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
  customerId: string | number;
  customer?: Customer;
  leadId?: string | number;
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
  customerId: string | number;
  customer?: Customer;
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
  customerId: string | number;
  customer?: Customer;
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
  customerId?: string | number;
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

export type CreateCustomerDto = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCustomerDto = Partial<CreateCustomerDto>;

export type CreateLeadDto = Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'customer'>;
export type UpdateLeadDto = Partial<CreateLeadDto>;

export type CreateProductDto = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateProductDto = Partial<CreateProductDto>;

export type CreateQuoteDto = Omit<Quote, 'id' | 'createdAt' | 'updatedAt' | 'customer' | 'lead' | 'quoteNumber' | 'subtotal' | 'vatAmount' | 'total'>;
export type UpdateQuoteDto = Partial<CreateQuoteDto>;

export type CreateAppointmentDto = Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'customer' | 'quote'>;
export type UpdateAppointmentDto = Partial<CreateAppointmentDto>;

export type CreateSurveyDto = Omit<Survey, 'id' | 'createdAt' | 'updatedAt' | 'customer' | 'appointment'>;
export type UpdateSurveyDto = Partial<CreateSurveyDto>;

// ============================================
// Visit Session & Voice-First Types
// ============================================

export type VisitSessionStatus = 'in_progress' | 'completed' | 'cancelled';

export interface VisitSession {
  id: number;
  accountId: number;
  customerId: number;
  customer?: Customer;
  startedAt: Date;
  endedAt?: Date;
  status: VisitSessionStatus;
}

export type MediaType = 'photo' | 'video' | 'measurement' | 'other';

export interface MediaAttachment {
  id: number;
  visitSessionId: number;
  customerId: number;
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
  customerId: number;
  customer?: Customer;
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
  customerId: number;
  text: string;
  createdAt: Date;
}

// ============================================
// Visit Session DTOs
// ============================================

export interface CreateVisitSessionDto {
  accountId: number;
  customerId: number;
}

export interface UpdateVisitSessionDto {
  status?: VisitSessionStatus;
  endedAt?: Date;
}

// ============================================
// Assistant API Types
// ============================================

export interface AssistantMessageRequest {
  sessionId: number;
  customerId: number;
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
export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  accountId?: number;
  authProvider: AuthProvider;
  role: UserRole;
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
