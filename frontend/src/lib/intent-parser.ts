/**
 * Intent Parser - Re-export
 *
 * Dieses Modul re-exportiert alles aus dem aufgeteilten ./intent/ Verzeichnis.
 * Existierende Imports (z.B. aus __tests__/intent-parser.test.ts und mistral-service.ts)
 * funktionieren weiterhin ohne Aenderung.
 */

export {
  // Types
  type ParsedIntent,
  type DocumentTypeMapping,

  // Data
  DOCUMENT_TYPE_MAPPINGS,
  REQUIRED_FIELDS,
  FIELD_LABELS,
  PATTERNS,

  // Core parser
  parseIntent,
  needsMistralFallback,
  formatExtractedData,
  getAutocompleteSuggestions,
  getAvailableDocumentTypes,
  sanitizeInput,

  // Suggestions
  generateSuggestions,
  getMissingFields,

  // Validation
  validateExtractedData,
} from './intent/index';

// Default export
export { default } from './intent/index';
