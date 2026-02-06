/**
 * Signature Module - Barrel Export
 *
 * Re-exports everything from the signature module so existing consumers
 * can import from "@/lib/signature" or "@/lib/signature-service" unchanged.
 */

// Types (re-exported from @/types/signature + local ISignatureProvider)
export type { ISignatureProvider } from "./types";
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
} from "./types";

// Mock store and helpers
export {
  mockStore,
  generateId,
  generateSignerId,
  generateFieldId,
  generateAuditEventId,
  delay,
  addAuditEvent,
} from "./mock-store";
export type { MockDataStore } from "./mock-store";

// Provider implementations
export { InternalSignatureProvider } from "./providers/internal";
export { DocuSignProvider } from "./providers/docusign";
export { SignNowProvider } from "./providers/signnow";

// Main service (singleton + class)
export { signatureService, SignatureService } from "./signature-service";
