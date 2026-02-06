/**
 * Intent Parser - Barrel Export
 *
 * Re-exportiert alle oeffentlichen APIs des Intent-Parser-Moduls.
 */

// Types
export type { ParsedIntent, DocumentTypeMapping } from './types';

// Document type mappings & data
export { DOCUMENT_TYPE_MAPPINGS, REQUIRED_FIELDS, FIELD_LABELS } from './document-type-mappings';

// Field extraction patterns
export { PATTERNS } from './field-extraction-patterns';

// Core parser functions
export {
  parseIntent,
  needsMistralFallback,
  formatExtractedData,
  getAutocompleteSuggestions,
  getAvailableDocumentTypes,
  sanitizeInput,
} from './parser';

// Suggestions
export { generateSuggestions, getMissingFields } from './suggestions';

// Validation
export { validateExtractedData } from './validation';

// Default export
export { parseIntent as default } from './parser';
