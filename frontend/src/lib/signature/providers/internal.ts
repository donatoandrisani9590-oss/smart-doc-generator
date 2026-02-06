/**
 * Internal Signature Provider
 *
 * Mock implementation of the internal signing provider.
 */

import type { SignatureProvider, SignatureRequest, SignatureRequestStatus } from "@/types/signature";
import type { ISignatureProvider } from "../types";
import { delay, generateId } from "../mock-store";

export class InternalSignatureProvider implements ISignatureProvider {
  name: SignatureProvider = "internal";

  async createEnvelope(request: SignatureRequest): Promise<string> {
    await delay(100);
    return `internal_${request.id}`;
  }

  async sendEnvelope(_envelopeId: string): Promise<void> {
    await delay(100);
  }

  async getEnvelopeStatus(_envelopeId: string): Promise<SignatureRequestStatus> {
    await delay(50);
    return "sent";
  }

  async voidEnvelope(_envelopeId: string, _reason: string): Promise<void> {
    await delay(100);
  }

  async getSignedDocument(_envelopeId: string): Promise<Blob> {
    await delay(200);
    // Return empty PDF blob for mock
    return new Blob(["%PDF-1.4 Mock Signed Document"], {
      type: "application/pdf",
    });
  }

  async getSigningUrl(_envelopeId: string, signerId: string): Promise<string> {
    await delay(50);
    return `https://sign.internal.app/sign/${signerId}?token=${generateId()}`;
  }
}
