/**
 * DocuSign Signature Provider
 *
 * Mock implementation of the DocuSign signing provider.
 */

import type { SignatureProvider, SignatureRequest, SignatureRequestStatus } from "@/types/signature";
import type { ISignatureProvider } from "../types";
import { delay } from "../mock-store";

export class DocuSignProvider implements ISignatureProvider {
  name: SignatureProvider = "docusign";

  async createEnvelope(request: SignatureRequest): Promise<string> {
    await delay(300);
    return `ds_env_${request.id}`;
  }

  async sendEnvelope(_envelopeId: string): Promise<void> {
    await delay(200);
  }

  async getEnvelopeStatus(_envelopeId: string): Promise<SignatureRequestStatus> {
    await delay(100);
    return "sent";
  }

  async voidEnvelope(_envelopeId: string, _reason: string): Promise<void> {
    await delay(200);
  }

  async getSignedDocument(_envelopeId: string): Promise<Blob> {
    await delay(500);
    return new Blob(["%PDF-1.4 DocuSign Signed Document"], {
      type: "application/pdf",
    });
  }

  async getSigningUrl(_envelopeId: string, signerId: string): Promise<string> {
    await delay(100);
    return `https://demo.docusign.net/Signing/MTRedeem/${signerId}`;
  }
}
