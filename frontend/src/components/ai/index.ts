/**
 * AI Components
 *
 * KI-gesteuerte Komponenten für intelligente Dokumentenerstellung
 */

// Klausel-Vorschläge basierend auf Kontext
export { ClauseSuggestions } from './ClauseSuggestions';
export type { ClauseSuggestionsProps, Clause as ClauseSuggestionClause } from './ClauseSuggestions';

// Compliance-Prüfung
export { ComplianceChecker } from './ComplianceChecker';
export type { ComplianceCheckerProps, Clause as ComplianceClause } from './ComplianceChecker';

// Compliance-Regeln (für externe Nutzung)
export {
  getComplianceRules,
  clauseSuggestionRules,
  normalizeClauseName,
  clauseSatisfiesRule,
  calculateComplianceScore,
  complianceRulesDE,
  complianceRulesIT,
  complianceRulesAT,
  complianceRulesCH,
  complianceRulesByCountry,
} from '@/lib/compliance-rules';

export type {
  ComplianceRule,
  ComplianceResult,
  ComplianceCheckResult,
  ClauseSuggestionRule,
} from '@/lib/compliance-rules';
