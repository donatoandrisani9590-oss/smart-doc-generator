/**
 * Signature Module Types
 *
 * Re-exports all types from @/types/signature and defines
 * the local ISignatureProvider interface used by provider implementations.
 */

export type {
  SignatureProvider,
  ProviderConfig,
  Signer,
  SignerWithStatus,
  SignatureField,
  SignatureFieldPlacement,
  SignatureRequest,
  SignatureRequestStatus,
  CreateSignatureRequestInput,
  UpdateSignatureRequestInput,
  SignerRole,
  SignerStatusType,
  SignatureStatus,
  SignatureFieldType,
  AuditEvent,
  AuditEventType,
  AuditTrail,
  WebhookEventType,
  WebhookPayload,
  SignatureTemplate,
  SignatureRequestResponse,
  SignatureRequestListResponse,
  SignedDocumentResponse,
  SignatureRequestFilters,
  SignatureRequestQuery,
} from "@/types/signature";

import type {
  SignatureProvider,
  SignatureRequest,
  SignatureRequestStatus,
} from "@/types/signature";

// =============================================================================
// Signature Provider Interface
// =============================================================================

export interface ISignatureProvider {
  name: SignatureProvider;
  createEnvelope(request: SignatureRequest): Promise<string>;
  sendEnvelope(envelopeId: string): Promise<void>;
  getEnvelopeStatus(envelopeId: string): Promise<SignatureRequestStatus>;
  voidEnvelope(envelopeId: string, reason: string): Promise<void>;
  getSignedDocument(envelopeId: string): Promise<Blob>;
  getSigningUrl(envelopeId: string, signerId: string): Promise<string>;
}
