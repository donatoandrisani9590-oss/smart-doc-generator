/**
 * SignNow Signature Provider
 *
 * Mock implementation of the SignNow signing provider.
 */

import type { SignatureProvider, SignatureRequest, SignatureRequestStatus } from "@/types/signature";
import type { ISignatureProvider } from "../types";
import { delay } from "../mock-store";

export class SignNowProvider implements ISignatureProvider {
  name: SignatureProvider = "signnow";

  async createEnvelope(request: SignatureRequest): Promise<string> {
    await delay(250);
    return `sn_doc_${request.id}`;
  }

  async sendEnvelope(_envelopeId: string): Promise<void> {
    await delay(150);
  }

  async getEnvelopeStatus(_envelopeId: string): Promise<SignatureRequestStatus> {
    await delay(75);
    return "sent";
  }

  async voidEnvelope(_envelopeId: string, _reason: string): Promise<void> {
    await delay(150);
  }

  async getSignedDocument(_envelopeId: string): Promise<Blob> {
    await delay(400);
    return new Blob(["%PDF-1.4 SignNow Signed Document"], {
      type: "application/pdf",
    });
  }

  async getSigningUrl(_envelopeId: string, signerId: string): Promise<string> {
    await delay(75);
    return `https://app.signnow.com/webapp/document/${signerId}`;
  }
}
