/**
 * Mock Data Store
 *
 * In-memory store and helper functions for the signature service.
 * Will be replaced by real API calls in production.
 */

import type {
  SignatureRequest,
  AuditEvent,
  SignatureTemplate,
} from "@/types/signature";

// =============================================================================
// Mock Data Store
// =============================================================================

export interface MockDataStore {
  requests: Map<string, SignatureRequest>;
  auditEvents: Map<string, AuditEvent[]>;
  templates: Map<string, SignatureTemplate>;
}

export const mockStore: MockDataStore = {
  requests: new Map(),
  auditEvents: new Map(),
  templates: new Map(),
};

// =============================================================================
// Helper Functions
// =============================================================================

export function generateId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function generateSignerId(): string {
  return `signer_${Math.random().toString(36).substring(2, 11)}`;
}

export function generateFieldId(): string {
  return `field_${Math.random().toString(36).substring(2, 11)}`;
}

export function generateAuditEventId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function addAuditEvent(
  requestId: string,
  eventType: AuditEvent["eventType"],
  options: Partial<AuditEvent> = {}
): AuditEvent {
  const event: AuditEvent = {
    id: generateAuditEventId(),
    requestId,
    eventType,
    timestamp: new Date().toISOString(),
    actorRole: "system",
    ...options,
  };

  const events = mockStore.auditEvents.get(requestId) || [];
  events.push(event);
  mockStore.auditEvents.set(requestId, events);

  return event;
}
