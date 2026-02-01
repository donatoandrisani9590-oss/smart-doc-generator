/**
 * Condition Types - Erweiterte bedingte Logik fuer Klauseln und Formularfelder
 *
 * Unterstuetzt:
 * - Einfache Bedingungen (Feld, Klausel, Variante)
 * - Zusammengesetzte Bedingungen (AND, OR) mit beliebiger Verschachtelung
 * - Abwaertskompatibilitaet mit dem alten ShowCondition-Format
 */

// ══════════════════════════════════════════════════════════════════════════════
// OPERATORS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Verfuegbare Vergleichsoperatoren
 */
export type ConditionOperator =
  | "=" // Gleichheit
  | "!=" // Ungleichheit
  | ">" // Groesser als
  | "<" // Kleiner als
  | ">=" // Groesser oder gleich
  | "<=" // Kleiner oder gleich
  | "contains" // String enthaelt Wert
  | "startsWith" // String beginnt mit Wert
  | "endsWith" // String endet mit Wert
  | "isEmpty" // Wert ist leer/null/undefined
  | "isNotEmpty"; // Wert ist nicht leer

// ══════════════════════════════════════════════════════════════════════════════
// CONDITION TYPES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Einfache Bedingung - prueft einen einzelnen Wert
 */
export interface SimpleCondition {
  /** Art der Bedingung */
  type: "field" | "clause_enabled" | "variant_selected";

  /** Feldname fuer type: 'field' */
  field?: string;

  /** Klausel-ID fuer type: 'clause_enabled' */
  clause_id?: number;

  /** Varianten-ID fuer type: 'variant_selected' */
  variant_id?: number;

  /** Vergleichsoperator */
  operator: ConditionOperator;

  /** Vergleichswert (nicht noetig fuer isEmpty/isNotEmpty) */
  value?: string | number | boolean;
}

/**
 * Zusammengesetzte Bedingung - kombiniert mehrere Bedingungen
 */
export interface CompoundCondition {
  /** Logischer Operator */
  type: "AND" | "OR";

  /** Verschachtelte Bedingungen */
  conditions: Condition[];
}

/**
 * Union Type fuer alle Bedingungsarten
 */
export type Condition = SimpleCondition | CompoundCondition;

// ══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Kontext fuer die Auswertung von Bedingungen
 */
export interface ConditionContext {
  /** Aktuelle Formularwerte */
  formData: Record<string, string | number | boolean | null | undefined>;

  /** IDs der aktivierten Klauseln */
  enabledClauseIds: number[];

  /** IDs der ausgewaehlten Varianten */
  selectedVariantIds: number[];
}

// ══════════════════════════════════════════════════════════════════════════════
// LEGACY FORMAT (Abwaertskompatibilitaet)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Altes ShowCondition-Format - wird automatisch konvertiert
 * @deprecated Nutze stattdessen das neue Condition-Format
 */
export interface LegacyShowCondition {
  /** Einzelne Klausel-ID */
  clause_id?: number;

  /** Mehrere Klausel-IDs (OR-verknuepft) */
  clause_ids?: number[];

  /** Einzelne Varianten-ID */
  variant_id?: number;

  /** Mehrere Varianten-IDs (OR-verknuepft) */
  variant_ids?: number[];

  /** Feld-Bedingungen (AND-verknuepft) */
  field_conditions?: Array<{
    field: string;
    operator: "=" | "!=" | ">" | "<" | ">=" | "<=";
    value: string | number | boolean;
  }>;
}

// ══════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Prueft ob es sich um eine zusammengesetzte Bedingung handelt
 */
export function isCompoundCondition(
  condition: Condition
): condition is CompoundCondition {
  return condition.type === "AND" || condition.type === "OR";
}

/**
 * Prueft ob es sich um eine einfache Bedingung handelt
 */
export function isSimpleCondition(
  condition: Condition
): condition is SimpleCondition {
  return (
    condition.type === "field" ||
    condition.type === "clause_enabled" ||
    condition.type === "variant_selected"
  );
}

/**
 * Prueft ob es sich um das alte ShowCondition-Format handelt
 */
export function isLegacyCondition(obj: unknown): obj is LegacyShowCondition {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const legacy = obj as LegacyShowCondition;

  // Wenn type vorhanden ist, ist es das neue Format
  if ("type" in obj) {
    return false;
  }

  // Legacy-Format hat mindestens eines dieser Felder
  return (
    "clause_id" in legacy ||
    "clause_ids" in legacy ||
    "variant_id" in legacy ||
    "variant_ids" in legacy ||
    "field_conditions" in legacy
  );
}
