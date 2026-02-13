/**
 * Condition Types - Erweiterte bedingte Logik für Textbausteine und Formularfelder
 *
 * Unterstützt:
 * - Einfache Bedingungen (Feld, Klausel, Variante)
 * - Zusammengesetzte Bedingungen (AND, OR) mit beliebiger Verschachtelung
 * - Abwärtskompatibilität mit dem alten ShowCondition-Format
 */

// ══════════════════════════════════════════════════════════════════════════════
// OPERATORS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Verfügbare Vergleichsoperatoren
 */
export type ConditionOperator =
  | "=" // Gleichheit
  | "!=" // Ungleichheit
  | ">" // Größer als
  | "<" // Kleiner als
  | ">=" // Größer oder gleich
  | "<=" // Kleiner oder gleich
  | "contains" // String enthält Wert
  | "startsWith" // String beginnt mit Wert
  | "endsWith" // String endet mit Wert
  | "isEmpty" // Wert ist leer/null/undefined
  | "isNotEmpty"; // Wert ist nicht leer

// ══════════════════════════════════════════════════════════════════════════════
// CONDITION TYPES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Einfache Bedingung - prüft einen einzelnen Wert
 */
export interface SimpleCondition {
  /** Art der Bedingung */
  type: "field" | "clause_enabled" | "variant_selected";

  /** Feldname für type: 'field' */
  field?: string;

  /** Textbaustein-ID für type: 'clause_enabled' */
  clause_id?: number;

  /** Varianten-ID für type: 'variant_selected' */
  variant_id?: number;

  /** Vergleichsoperator */
  operator: ConditionOperator;

  /** Vergleichswert (nicht nötig für isEmpty/isNotEmpty) */
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
 * Union Type für alle Bedingungsarten
 */
export type Condition = SimpleCondition | CompoundCondition;

// ══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Kontext für die Auswertung von Bedingungen
 */
export interface ConditionContext {
  /** Aktuelle Formularwerte */
  formData: Record<string, string | number | boolean | null | undefined>;

  /** IDs der aktivierten Textbausteine */
  enabledClauseIds: number[];

  /** IDs der ausgewählten Varianten */
  selectedVariantIds: number[];
}

// ══════════════════════════════════════════════════════════════════════════════
// LEGACY FORMAT (Abwärtskompatibilität)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Altes ShowCondition-Format - wird automatisch konvertiert
 * @deprecated Nutze stattdessen das neue Condition-Format
 */
export interface LegacyShowCondition {
  /** Einzelne Textbaustein-ID */
  clause_id?: number;

  /** Mehrere Textbaustein-IDs (OR-verknüpft) */
  clause_ids?: number[];

  /** Einzelne Varianten-ID */
  variant_id?: number;

  /** Mehrere Varianten-IDs (OR-verknüpft) */
  variant_ids?: number[];

  /** Feld-Bedingungen (AND-verknüpft) */
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
 * Prüft ob es sich um eine zusammengesetzte Bedingung handelt
 */
export function isCompoundCondition(
  condition: Condition
): condition is CompoundCondition {
  return condition.type === "AND" || condition.type === "OR";
}

/**
 * Prüft ob es sich um eine einfache Bedingung handelt
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
 * Prüft ob es sich um das alte ShowCondition-Format handelt
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
