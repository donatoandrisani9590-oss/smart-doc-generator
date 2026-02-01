/**
 * E-Signature Types & Interfaces
 * Provider-abstracted signature system for document signing workflows
 */

// =============================================================================
// Provider Configuration
// =============================================================================

export type SignatureProvider = 'docusign' | 'signnow' | 'internal';

export interface ProviderConfig {
  provider: SignatureProvider;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  webhookUrl?: string;
  sandbox?: boolean;
}

// =============================================================================
// Signer Types
// =============================================================================

export type SignerRole = 'employee' | 'manager' | 'witness' | 'contractor' | 'legal';

export interface Signer {
  id: string;
  name: string;
  email: string;
  role: SignerRole;
  order: number; // Signing order (1 = first, 2 = second, etc.)
  phone?: string;
  accessCode?: string; // Optional PIN for additional security
  language?: string;
}

export interface SignerWithStatus extends Signer {
  status: SignatureStatus;
}

// =============================================================================
// Signature Field Types
// =============================================================================

export type SignatureFieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox';

export interface SignatureField {
  id: string;
  signerId: string;
  type: SignatureFieldType;
  page: number;
  x: number; // X coordinate (percentage of page width, 0-100)
  y: number; // Y coordinate (percentage of page height, 0-100)
  width: number; // Width (percentage of page width)
  height: number; // Height (percentage of page height)
  required: boolean;
  label?: string;
  placeholder?: string;
  value?: string; // Pre-filled value for text fields
  fontSize?: number;
  fontFamily?: string;
}

export interface SignatureFieldPlacement {
  signerId: string;
  fields: SignatureField[];
}

// =============================================================================
// Signature Request Types
// =============================================================================

export type SignatureRequestStatus =
  | 'draft'
  | 'sent'
  | 'partially_signed'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'voided';

export interface SignatureRequest {
  id: string;
  documentId: number;
  documentTitle: string;
  documentUrl?: string;
  status: SignatureRequestStatus;
  provider: SignatureProvider;
  providerEnvelopeId?: string; // External provider's envelope/document ID
  signers: SignerWithStatus[];
  fields: SignatureField[];
  message?: string; // Email message to signers
  subject?: string; // Email subject line
  createdAt: string;
  createdBy: string;
  sentAt?: string;
  completedAt?: string;
  expiresAt?: string;
  voidedAt?: string;
  voidReason?: string;
  signedDocumentUrl?: string;
  certificateUrl?: string; // Signing certificate URL
  metadata?: Record<string, unknown>;
}

export interface CreateSignatureRequestInput {
  documentId: number;
  signers: Omit<Signer, 'id'>[];
  fields?: Omit<SignatureField, 'id'>[];
  message?: string;
  subject?: string;
  expiresInDays?: number;
  provider?: SignatureProvider;
}

export interface UpdateSignatureRequestInput {
  signers?: Signer[];
  fields?: SignatureField[];
  message?: string;
  subject?: string;
  expiresAt?: string;
}

// =============================================================================
// Signature Status Types
// =============================================================================

export type SignerStatusType = 'pending' | 'sent' | 'delivered' | 'viewed' | 'signed' | 'declined';

export interface SignatureStatus {
  signerId: string;
  status: SignerStatusType;
  sentAt?: string;
  deliveredAt?: string;
  viewedAt?: string;
  signedAt?: string;
  declinedAt?: string;
  declinedReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

// =============================================================================
// Audit Trail Types
// =============================================================================

export type AuditEventType =
  | 'created'
  | 'sent'
  | 'delivered'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'voided'
  | 'expired'
  | 'reminder_sent'
  | 'downloaded'
  | 'correction_requested'
  | 'delegated';

export interface AuditEvent {
  id: string;
  requestId: string;
  eventType: AuditEventType;
  timestamp: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: SignerRole | 'system' | 'sender';
  signerId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
  };
  details?: Record<string, unknown>;
}

export interface AuditTrail {
  requestId: string;
  documentTitle: string;
  events: AuditEvent[];
  generatedAt: string;
}

// =============================================================================
// Webhook Types
// =============================================================================

export type WebhookEventType =
  | 'signature_request.sent'
  | 'signature_request.viewed'
  | 'signature_request.signed'
  | 'signature_request.completed'
  | 'signature_request.declined'
  | 'signature_request.expired'
  | 'signature_request.voided';

export interface WebhookPayload {
  eventType: WebhookEventType;
  timestamp: string;
  requestId: string;
  signerId?: string;
  provider: SignatureProvider;
  providerEventId?: string;
  data: Record<string, unknown>;
}

// =============================================================================
// Template Types
// =============================================================================

export interface SignatureTemplate {
  id: string;
  name: string;
  description?: string;
  documentType: string;
  signerRoles: SignerRole[];
  fieldPlacements: SignatureFieldPlacement[];
  defaultMessage?: string;
  defaultSubject?: string;
  defaultExpirationDays?: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Response Types
// =============================================================================

export interface SignatureRequestResponse {
  success: boolean;
  data?: SignatureRequest;
  error?: string;
}

export interface SignatureRequestListResponse {
  success: boolean;
  data?: {
    requests: SignatureRequest[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
}

export interface SignedDocumentResponse {
  success: boolean;
  data?: {
    url: string;
    expiresAt: string;
  };
  error?: string;
}

// =============================================================================
// Filter & Query Types
// =============================================================================

export interface SignatureRequestFilters {
  status?: SignatureRequestStatus[];
  provider?: SignatureProvider[];
  createdAfter?: string;
  createdBefore?: string;
  documentId?: number;
  signerEmail?: string;
  search?: string;
}

export interface SignatureRequestQuery extends SignatureRequestFilters {
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'sentAt' | 'status' | 'documentTitle';
  sortOrder?: 'asc' | 'desc';
}
