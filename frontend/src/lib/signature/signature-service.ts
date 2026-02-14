/**
 * Signature Service
 *
 * Provider-abstracted signature service for document signing workflows.
 * This service provides a unified API for managing electronic signatures
 * across multiple providers (DocuSign, SignNow, Internal).
 */

import type {
  SignatureProvider,
  ProviderConfig,
  Signer,
  SignerWithStatus,
  SignatureField,
  SignatureRequest,
  SignatureRequestStatus,
  CreateSignatureRequestInput,
  UpdateSignatureRequestInput,
  AuditEvent,
  AuditTrail,
  SignatureTemplate,
  SignatureRequestQuery,
  SignatureRequestListResponse,
} from "@/types/signature";

import type { ISignatureProvider } from "./types";
import {
  mockStore,
  generateId,
  generateSignerId,
  generateFieldId,
  delay,
  addAuditEvent,
} from "./mock-store";
import { InternalSignatureProvider } from "./providers/internal";
import { DocuSignProvider } from "./providers/docusign";
import { SignNowProvider } from "./providers/signnow";

// =============================================================================
// Signature Service Class
// =============================================================================

class SignatureService {
  private config: ProviderConfig;
  private provider: ISignatureProvider;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = {
      provider: config?.provider || "internal",
      sandbox: config?.sandbox ?? true,
      ...config,
    };
    this.provider = this.getProvider(this.config.provider);
  }

  // ---------------------------------------------------------------------------
  // Provider Management
  // ---------------------------------------------------------------------------

  private getProvider(providerName: SignatureProvider): ISignatureProvider {
    switch (providerName) {
      case "docusign":
        return new DocuSignProvider();
      case "signnow":
        return new SignNowProvider();
      case "internal":
      default:
        return new InternalSignatureProvider();
    }
  }

  setProvider(provider: SignatureProvider): void {
    this.config.provider = provider;
    this.provider = this.getProvider(provider);
  }

  getActiveProvider(): SignatureProvider {
    return this.config.provider;
  }

  // ---------------------------------------------------------------------------
  // Signature Request Management
  // ---------------------------------------------------------------------------

  async createSignatureRequest(
    input: CreateSignatureRequestInput
  ): Promise<SignatureRequest> {
    await delay(150);

    const requestId = generateId();
    const now = new Date().toISOString();

    // Generate IDs for signers
    const signersWithIds: SignerWithStatus[] = input.signers.map(
      (signer, index) => ({
        ...signer,
        id: generateSignerId(),
        order: signer.order ?? index + 1,
        status: {
          signerId: "", // Will be set below
          status: "pending",
        },
      })
    );

    // Update status signerIds
    signersWithIds.forEach((signer) => {
      signer.status.signerId = signer.id;
    });

    // Generate IDs for fields
    const fieldsWithIds: SignatureField[] = (input.fields || []).map(
      (field) => ({
        ...field,
        id: generateFieldId(),
      })
    );

    // Calculate expiration date
    const expiresAt = input.expiresInDays
      ? new Date(
          Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000
        ).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default 30 days

    const request: SignatureRequest = {
      id: requestId,
      documentId: input.documentId,
      documentTitle: `Document #${input.documentId}`, // Will be fetched from document service
      status: "draft",
      provider: input.provider || this.config.provider,
      signers: signersWithIds,
      fields: fieldsWithIds,
      message: input.message,
      subject: input.subject || `Please sign: Document #${input.documentId}`,
      createdAt: now,
      createdBy: "current-user", // Will be replaced with actual user
      expiresAt,
    };

    // Store in mock data
    mockStore.requests.set(requestId, request);

    // Add audit event
    addAuditEvent(requestId, "created", {
      actorName: "Current User",
      actorRole: "sender",
      details: {
        documentId: input.documentId,
        signerCount: signersWithIds.length,
        fieldCount: fieldsWithIds.length,
      },
    });

    return request;
  }

  async updateSignatureRequest(
    requestId: string,
    input: UpdateSignatureRequestInput
  ): Promise<SignatureRequest> {
    await delay(100);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    if (request.status !== "draft") {
      throw new Error(
        `Cannot update signature request in status: ${request.status}`
      );
    }

    const updatedRequest: SignatureRequest = {
      ...request,
      signers: input.signers
        ? input.signers.map((s) => ({
            ...s,
            status: { signerId: s.id, status: "pending" as const },
          }))
        : request.signers,
      fields: input.fields || request.fields,
      message: input.message ?? request.message,
      subject: input.subject ?? request.subject,
      expiresAt: input.expiresAt ?? request.expiresAt,
    };

    mockStore.requests.set(requestId, updatedRequest);

    return updatedRequest;
  }

  async sendForSignature(requestId: string): Promise<SignatureRequest> {
    await delay(200);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    if (request.status !== "draft") {
      throw new Error(
        `Cannot send signature request in status: ${request.status}`
      );
    }

    if (request.signers.length === 0) {
      throw new Error("Cannot send signature request without signers");
    }

    // Create envelope with provider
    const envelopeId = await this.provider.createEnvelope(request);

    // Send envelope
    await this.provider.sendEnvelope(envelopeId);

    const now = new Date().toISOString();

    // Update signer statuses
    const updatedSigners = request.signers.map((signer) => ({
      ...signer,
      status: {
        ...signer.status,
        status: "sent" as const,
        sentAt: now,
      },
    }));

    const updatedRequest: SignatureRequest = {
      ...request,
      status: "sent",
      providerEnvelopeId: envelopeId,
      sentAt: now,
      signers: updatedSigners,
    };

    mockStore.requests.set(requestId, updatedRequest);

    // Add audit event
    addAuditEvent(requestId, "sent", {
      actorName: "Current User",
      actorRole: "sender",
      details: {
        provider: request.provider,
        envelopeId,
        signerEmails: request.signers.map((s) => s.email),
      },
    });

    return updatedRequest;
  }

  async getSignatureRequest(requestId: string): Promise<SignatureRequest> {
    await delay(50);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    return request;
  }

  async getSignatureStatus(requestId: string): Promise<SignatureRequest> {
    return this.getSignatureRequest(requestId);
  }

  async listSignatureRequests(
    query: SignatureRequestQuery = {}
  ): Promise<SignatureRequestListResponse> {
    await delay(100);

    let requests = Array.from(mockStore.requests.values());

    // Apply filters
    if (query.status && query.status.length > 0) {
      requests = requests.filter((r) => query.status!.includes(r.status));
    }

    if (query.provider && query.provider.length > 0) {
      requests = requests.filter((r) => query.provider!.includes(r.provider));
    }

    if (query.documentId) {
      requests = requests.filter((r) => r.documentId === query.documentId);
    }

    if (query.signerEmail) {
      requests = requests.filter((r) =>
        r.signers.some(
          (s) => s.email.toLowerCase() === query.signerEmail!.toLowerCase()
        )
      );
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      requests = requests.filter(
        (r) =>
          r.documentTitle.toLowerCase().includes(searchLower) ||
          r.signers.some(
            (s) =>
              s.name.toLowerCase().includes(searchLower) ||
              s.email.toLowerCase().includes(searchLower)
          )
      );
    }

    if (query.createdAfter) {
      const afterDate = new Date(query.createdAfter);
      requests = requests.filter((r) => new Date(r.createdAt) >= afterDate);
    }

    if (query.createdBefore) {
      const beforeDate = new Date(query.createdBefore);
      requests = requests.filter((r) => new Date(r.createdAt) <= beforeDate);
    }

    // Sort
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";

    requests.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case "sentAt":
          aVal = a.sentAt || "";
          bVal = b.sentAt || "";
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "documentTitle":
          aVal = a.documentTitle;
          bVal = b.documentTitle;
          break;
        case "createdAt":
        default:
          aVal = a.createdAt;
          bVal = b.createdAt;
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === "asc" ? comparison : -comparison;
    });

    // Pagination
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const startIndex = (page - 1) * pageSize;
    const paginatedRequests = requests.slice(startIndex, startIndex + pageSize);

    return {
      success: true,
      data: {
        requests: paginatedRequests,
        total: requests.length,
        page,
        pageSize,
      },
    };
  }

  async cancelSignatureRequest(
    requestId: string,
    reason?: string
  ): Promise<SignatureRequest> {
    await delay(150);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    if (request.status === "completed" || request.status === "voided") {
      throw new Error(
        `Cannot cancel signature request in status: ${request.status}`
      );
    }

    // Void with provider if envelope exists
    if (request.providerEnvelopeId) {
      await this.provider.voidEnvelope(
        request.providerEnvelopeId,
        reason || "Cancelled by sender"
      );
    }

    const now = new Date().toISOString();

    const updatedRequest: SignatureRequest = {
      ...request,
      status: "voided",
      voidedAt: now,
      voidReason: reason || "Cancelled by sender",
    };

    mockStore.requests.set(requestId, updatedRequest);

    // Add audit event
    addAuditEvent(requestId, "voided", {
      actorName: "Current User",
      actorRole: "sender",
      details: { reason: reason || "Cancelled by sender" },
    });

    return updatedRequest;
  }

  async sendReminder(requestId: string, signerId: string): Promise<void> {
    await delay(100);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    const signer = request.signers.find((s) => s.id === signerId);
    if (!signer) {
      throw new Error(`Signer not found: ${signerId}`);
    }

    if (signer.status.status === "signed") {
      throw new Error("Cannot send reminder to a signer who has already signed");
    }

    // Add audit event
    addAuditEvent(requestId, "reminder_sent", {
      signerId,
      actorName: "Current User",
      actorRole: "sender",
      details: {
        signerEmail: signer.email,
        signerName: signer.name,
      },
    });
  }

  async deleteSignatureRequest(requestId: string): Promise<void> {
    await delay(100);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    if (request.status !== "draft" && request.status !== "voided") {
      throw new Error(
        `Cannot delete signature request in status: ${request.status}. Void it first.`
      );
    }

    mockStore.requests.delete(requestId);
    mockStore.auditEvents.delete(requestId);
  }

  // ---------------------------------------------------------------------------
  // Document Management
  // ---------------------------------------------------------------------------

  async getSignedDocument(requestId: string): Promise<Blob> {
    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    if (request.status !== "completed") {
      throw new Error(
        "Signed document is only available after all signers have signed"
      );
    }

    if (!request.providerEnvelopeId) {
      throw new Error("No envelope ID found for this request");
    }

    const document = await this.provider.getSignedDocument(
      request.providerEnvelopeId
    );

    // Add audit event
    addAuditEvent(requestId, "downloaded", {
      actorName: "Current User",
      actorRole: "sender",
      details: { documentType: "signed" },
    });

    return document;
  }

  async getSigningUrl(requestId: string, signerId: string): Promise<string> {
    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    const signer = request.signers.find((s) => s.id === signerId);
    if (!signer) {
      throw new Error(`Signer not found: ${signerId}`);
    }

    if (!request.providerEnvelopeId) {
      throw new Error("Request has not been sent yet");
    }

    return this.provider.getSigningUrl(request.providerEnvelopeId, signerId);
  }

  // ---------------------------------------------------------------------------
  // Audit Trail
  // ---------------------------------------------------------------------------

  async getAuditTrail(requestId: string): Promise<AuditTrail> {
    await delay(75);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    const events = mockStore.auditEvents.get(requestId) || [];

    return {
      requestId,
      documentTitle: request.documentTitle,
      events: events.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
      generatedAt: new Date().toISOString(),
    };
  }

  async getAuditEvents(requestId: string): Promise<AuditEvent[]> {
    const trail = await this.getAuditTrail(requestId);
    return trail.events;
  }

  // ---------------------------------------------------------------------------
  // Signer Actions (for embedded signing)
  // ---------------------------------------------------------------------------

  async markAsViewed(requestId: string, signerId: string): Promise<void> {
    await delay(50);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    const signerIndex = request.signers.findIndex((s) => s.id === signerId);
    if (signerIndex === -1) {
      throw new Error(`Signer not found: ${signerId}`);
    }

    const now = new Date().toISOString();
    request.signers[signerIndex].status = {
      ...request.signers[signerIndex].status,
      status: "viewed",
      viewedAt: now,
    };

    mockStore.requests.set(requestId, request);

    addAuditEvent(requestId, "viewed", {
      signerId,
      actorName: request.signers[signerIndex].name,
      actorEmail: request.signers[signerIndex].email,
      actorRole: request.signers[signerIndex].role,
    });
  }

  async submitSignature(
    requestId: string,
    signerId: string,
    signatureData: { signature: string; initials?: string }
  ): Promise<SignatureRequest> {
    await delay(200);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    const signerIndex = request.signers.findIndex((s) => s.id === signerId);
    if (signerIndex === -1) {
      throw new Error(`Signer not found: ${signerId}`);
    }

    const now = new Date().toISOString();
    request.signers[signerIndex].status = {
      ...request.signers[signerIndex].status,
      status: "signed",
      signedAt: now,
    };

    // Check if all signers have signed
    const allSigned = request.signers.every((s) => s.status.status === "signed");
    const someSigned = request.signers.some((s) => s.status.status === "signed");

    if (allSigned) {
      request.status = "completed";
      request.completedAt = now;
      request.signedDocumentUrl = `/api/signatures/${requestId}/document`;
    } else if (someSigned) {
      request.status = "partially_signed";
    }

    mockStore.requests.set(requestId, request);

    addAuditEvent(requestId, "signed", {
      signerId,
      actorName: request.signers[signerIndex].name,
      actorEmail: request.signers[signerIndex].email,
      actorRole: request.signers[signerIndex].role,
      details: {
        hasInitials: !!signatureData.initials,
      },
    });

    if (allSigned) {
      addAuditEvent(requestId, "created", {
        actorRole: "system",
        details: { message: "All signers have completed signing" },
      });
    }

    return request;
  }

  async declineSignature(
    requestId: string,
    signerId: string,
    reason: string
  ): Promise<SignatureRequest> {
    await delay(150);

    const request = mockStore.requests.get(requestId);
    if (!request) {
      throw new Error(`Signature request not found: ${requestId}`);
    }

    const signerIndex = request.signers.findIndex((s) => s.id === signerId);
    if (signerIndex === -1) {
      throw new Error(`Signer not found: ${signerId}`);
    }

    const now = new Date().toISOString();
    request.signers[signerIndex].status = {
      ...request.signers[signerIndex].status,
      status: "declined",
      declinedAt: now,
      declinedReason: reason,
    };

    request.status = "declined";

    mockStore.requests.set(requestId, request);

    addAuditEvent(requestId, "declined", {
      signerId,
      actorName: request.signers[signerIndex].name,
      actorEmail: request.signers[signerIndex].email,
      actorRole: request.signers[signerIndex].role,
      details: { reason },
    });

    return request;
  }

  // ---------------------------------------------------------------------------
  // Template Management
  // ---------------------------------------------------------------------------

  async createTemplate(
    template: Omit<SignatureTemplate, "id" | "createdAt" | "updatedAt">
  ): Promise<SignatureTemplate> {
    await delay(100);

    const now = new Date().toISOString();
    const newTemplate: SignatureTemplate = {
      ...template,
      id: `tmpl_${generateId()}`,
      createdAt: now,
      updatedAt: now,
    };

    mockStore.templates.set(newTemplate.id, newTemplate);

    return newTemplate;
  }

  async getTemplate(templateId: string): Promise<SignatureTemplate> {
    await delay(50);

    const template = mockStore.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return template;
  }

  async listTemplates(): Promise<SignatureTemplate[]> {
    await delay(75);
    return Array.from(mockStore.templates.values());
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await delay(50);

    if (!mockStore.templates.has(templateId)) {
      throw new Error(`Template not found: ${templateId}`);
    }

    mockStore.templates.delete(templateId);
  }

  async createFromTemplate(
    templateId: string,
    documentId: number,
    signers: Omit<Signer, "id">[]
  ): Promise<SignatureRequest> {
    const template = await this.getTemplate(templateId);

    // Validate signer roles match template
    const requiredRoles = new Set(template.signerRoles);
    const providedRoles = new Set(signers.map((s) => s.role));

    for (const role of requiredRoles) {
      if (!providedRoles.has(role)) {
        throw new Error(`Template requires a signer with role: ${role}`);
      }
    }

    return this.createSignatureRequest({
      documentId,
      signers,
      message: template.defaultMessage,
      subject: template.defaultSubject,
      expiresInDays: template.defaultExpirationDays,
    });
  }

  // ---------------------------------------------------------------------------
  // Statistics & Reporting
  // ---------------------------------------------------------------------------

  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<SignatureRequestStatus, number>;
    byProvider: Record<SignatureProvider, number>;
    averageCompletionDays: number;
  }> {
    await delay(100);

    const requests = Array.from(mockStore.requests.values());

    const byStatus: Record<SignatureRequestStatus, number> = {
      draft: 0,
      sent: 0,
      partially_signed: 0,
      completed: 0,
      declined: 0,
      expired: 0,
      voided: 0,
    };

    const byProvider: Record<SignatureProvider, number> = {
      docusign: 0,
      signnow: 0,
      internal: 0,
    };

    let totalCompletionDays = 0;
    let completedCount = 0;

    for (const request of requests) {
      byStatus[request.status]++;
      byProvider[request.provider]++;

      if (request.status === "completed" && request.sentAt && request.completedAt) {
        const sent = new Date(request.sentAt);
        const completed = new Date(request.completedAt);
        const days =
          (completed.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24);
        totalCompletionDays += days;
        completedCount++;
      }
    }

    return {
      total: requests.length,
      byStatus,
      byProvider,
      averageCompletionDays:
        completedCount > 0 ? totalCompletionDays / completedCount : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Webhook Handling (for provider callbacks)
  // ---------------------------------------------------------------------------

  async handleWebhook(
    provider: SignatureProvider,
    _payload: Record<string, unknown>
  ): Promise<void> {
    // This would be implemented on the backend to handle provider webhooks
    // NB: Payload may contain PII – only log provider, not payload
    console.debug(`[SignatureService] Webhook received from ${provider}`);

    // Parse webhook and update request status accordingly
    // This is a placeholder for actual webhook handling logic
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const signatureService = new SignatureService();

// Export class for testing/custom instances
export { SignatureService };
