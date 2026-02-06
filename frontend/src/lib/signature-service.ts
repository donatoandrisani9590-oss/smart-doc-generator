/**
 * E-Signature Service
 *
 * This file re-exports everything from the modularized signature/ directory
 * so that existing consumers (e.g. `import { signatureService } from "@/lib/signature-service"`)
 * continue to work without changes.
 */

export {
  signatureService,
  SignatureService,
} from "./signature/index";

export type { ISignatureProvider } from "./signature/index";
