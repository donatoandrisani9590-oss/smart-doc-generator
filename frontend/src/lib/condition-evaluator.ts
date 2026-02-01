/**
 * Condition Evaluator - Bewertet bedingte Logik fuer Klauseln und Formularfelder
 *
 * Features:
 * - Rekursive Auswertung von AND/OR-Bedingungen
 * - Unterstuetzung aller Operatoren (=, !=, >, <, contains, isEmpty, etc.)
 * - Automatische Konvertierung des Legacy-Formats
 * - Typ-sichere Auswertung mit ConditionContext
 */

import {
  isCompoundCondition,
  isSimpleCondition,
  isLegacyCondition,
  type Condition,
  type SimpleCondition,
  type CompoundCondition,
  type ConditionContext,
  type ConditionOperator,
  type LegacyShowCondition,
} from "@/types/conditions";

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EVALUATOR
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Wertet eine Bedingung gegen den gegebenen Kontext aus
 *
 * @param condition - Die auszuwertende Bedingung
 * @param context - Der Kontext mit Formulardaten, Klauseln und Varianten
 * @returns true wenn die Bedingung erfuellt ist, sonst false
 *
 * @example
 * ```typescript
 * const condition: Condition = {
 *   type: 'AND',
 *   conditions: [
 *     { type: 'clause_enabled', clause_id: 1, operator: '=' },
 *     { type: 'field', field: 'gehalt', operator: '>', value: 50000 }
 *   ]
 * };
 *
 * const result = evaluateCondition(condition, {
 *   formData: { gehalt: 75000 },
 *   enabledClauseIds: [1, 2, 3],
 *   selectedVariantIds: []
 * });
 * // result === true
 * ```
 */
export function evaluateCondition(
  condition: Condition,
  context: ConditionContext
): boolean {
  if (isCompoundCondition(condition)) {
    return evaluateCompoundCondition(condition, context);
  }

  if (isSimpleCondition(condition)) {
    return evaluateSimpleCondition(condition, context);
  }

  // Fallback: Unbekannter Typ - als true behandeln (sicherer Default)
  console.warn("[ConditionEvaluator] Unknown condition type:", condition);
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOUND CONDITION EVALUATOR
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Wertet eine zusammengesetzte Bedingung aus (AND/OR)
 */
function evaluateCompoundCondition(
  condition: CompoundCondition,
  context: ConditionContext
): boolean {
  const { conditions } = condition;

  // Leere conditions-Array = true (keine Einschraenkung)
  if (!conditions || conditions.length === 0) {
    return true;
  }

  if (condition.type === "AND") {
    // AND: Alle Bedingungen muessen true sein
    return conditions.every((c) => evaluateCondition(c, context));
  }

  if (condition.type === "OR") {
    // OR: Mindestens eine Bedingung muss true sein
    return conditions.some((c) => evaluateCondition(c, context));
  }

  // Fallback
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// SIMPLE CONDITION EVALUATOR
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Wertet eine einfache Bedingung aus
 */
function evaluateSimpleCondition(
  condition: SimpleCondition,
  context: ConditionContext
): boolean {
  switch (condition.type) {
    case "field":
      return evaluateFieldCondition(condition, context);

    case "clause_enabled":
      return evaluateClauseCondition(condition, context);

    case "variant_selected":
      return evaluateVariantCondition(condition, context);

    default:
      console.warn("[ConditionEvaluator] Unknown simple condition type:", condition);
      return true;
  }
}

/**
 * Wertet eine Feld-Bedingung aus
 */
function evaluateFieldCondition(
  condition: SimpleCondition,
  context: ConditionContext
): boolean {
  const { field, operator, value } = condition;

  if (!field) {
    console.warn("[ConditionEvaluator] Field condition missing field name");
    return true;
  }

  const fieldValue = context.formData[field];

  return evaluateOperator(operator, fieldValue, value);
}

/**
 * Wertet eine Klausel-Bedingung aus
 */
function evaluateClauseCondition(
  condition: SimpleCondition,
  context: ConditionContext
): boolean {
  const { clause_id, operator } = condition;

  if (clause_id === undefined || clause_id === null) {
    console.warn("[ConditionEvaluator] Clause condition missing clause_id");
    return true;
  }

  const isEnabled = context.enabledClauseIds.includes(clause_id);

  // Fuer Klausel-Bedingungen: = bedeutet "ist aktiviert", != bedeutet "ist nicht aktiviert"
  switch (operator) {
    case "=":
      return isEnabled;
    case "!=":
      return !isEnabled;
    case "isEmpty":
      return !isEnabled;
    case "isNotEmpty":
      return isEnabled;
    default:
      // Fuer andere Operatoren: pruefe ob aktiviert
      return isEnabled;
  }
}

/**
 * Wertet eine Varianten-Bedingung aus
 */
function evaluateVariantCondition(
  condition: SimpleCondition,
  context: ConditionContext
): boolean {
  const { variant_id, operator } = condition;

  if (variant_id === undefined || variant_id === null) {
    console.warn("[ConditionEvaluator] Variant condition missing variant_id");
    return true;
  }

  const isSelected = context.selectedVariantIds.includes(variant_id);

  // Analog zu Klausel-Bedingungen
  switch (operator) {
    case "=":
      return isSelected;
    case "!=":
      return !isSelected;
    case "isEmpty":
      return !isSelected;
    case "isNotEmpty":
      return isSelected;
    default:
      return isSelected;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// OPERATOR EVALUATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Wertet einen Vergleichsoperator aus
 *
 * @param operator - Der Vergleichsoperator
 * @param fieldValue - Der aktuelle Feldwert
 * @param compareValue - Der Vergleichswert
 * @returns true wenn der Vergleich zutrifft
 */
export function evaluateOperator(
  operator: ConditionOperator,
  fieldValue: unknown,
  compareValue: unknown
): boolean {
  switch (operator) {
    case "=":
      return isEqual(fieldValue, compareValue);

    case "!=":
      return !isEqual(fieldValue, compareValue);

    case ">":
      return toNumber(fieldValue) > toNumber(compareValue);

    case "<":
      return toNumber(fieldValue) < toNumber(compareValue);

    case ">=":
      return toNumber(fieldValue) >= toNumber(compareValue);

    case "<=":
      return toNumber(fieldValue) <= toNumber(compareValue);

    case "contains":
      return toString(fieldValue)
        .toLowerCase()
        .includes(toString(compareValue).toLowerCase());

    case "startsWith":
      return toString(fieldValue)
        .toLowerCase()
        .startsWith(toString(compareValue).toLowerCase());

    case "endsWith":
      return toString(fieldValue)
        .toLowerCase()
        .endsWith(toString(compareValue).toLowerCase());

    case "isEmpty":
      return isEmpty(fieldValue);

    case "isNotEmpty":
      return !isEmpty(fieldValue);

    default:
      console.warn("[ConditionEvaluator] Unknown operator:", operator);
      return true;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Prueft Gleichheit mit Typkonvertierung
 */
function isEqual(a: unknown, b: unknown): boolean {
  // Null/Undefined Handling
  if (a === null || a === undefined) {
    return b === null || b === undefined || b === "";
  }
  if (b === null || b === undefined) {
    return a === null || a === undefined || a === "";
  }

  // Boolean Handling
  if (typeof a === "boolean" || typeof b === "boolean") {
    return toBoolean(a) === toBoolean(b);
  }

  // Numerischer Vergleich wenn beide Zahlen sind
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA === numB;
  }

  // String-Vergleich (case-insensitive)
  return toString(a).toLowerCase() === toString(b).toLowerCase();
}

/**
 * Konvertiert zu Number
 */
function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    // Deutsche Zahlenformatierung unterstuetzen (1.234,56 -> 1234.56)
    const normalized = value.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized);
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return NaN;
}

/**
 * Konvertiert zu String
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

/**
 * Konvertiert zu Boolean
 */
function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    return lower === "true" || lower === "1" || lower === "yes" || lower === "ja";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return Boolean(value);
}

/**
 * Prueft ob ein Wert "leer" ist
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// LEGACY CONVERSION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Konvertiert das alte ShowCondition-Format in das neue Condition-Format
 *
 * @param legacy - Das alte ShowCondition-Objekt
 * @returns Eine Condition im neuen Format
 *
 * @example
 * ```typescript
 * const legacy = {
 *   clause_id: 1,
 *   variant_ids: [2, 3],
 *   field_conditions: [{ field: 'gehalt', operator: '>', value: 50000 }]
 * };
 *
 * const condition = convertLegacyCondition(legacy);
 * // Ergebnis: AND-Bedingung mit allen Teilbedingungen
 * ```
 */
export function convertLegacyCondition(legacy: LegacyShowCondition): Condition {
  const conditions: Condition[] = [];

  // Einzelne Klausel-ID
  if (legacy.clause_id !== undefined) {
    conditions.push({
      type: "clause_enabled",
      clause_id: legacy.clause_id,
      operator: "=",
    });
  }

  // Mehrere Klausel-IDs (OR-verknuepft)
  if (legacy.clause_ids && legacy.clause_ids.length > 0) {
    if (legacy.clause_ids.length === 1) {
      conditions.push({
        type: "clause_enabled",
        clause_id: legacy.clause_ids[0],
        operator: "=",
      });
    } else {
      conditions.push({
        type: "OR",
        conditions: legacy.clause_ids.map((id) => ({
          type: "clause_enabled" as const,
          clause_id: id,
          operator: "=" as const,
        })),
      });
    }
  }

  // Einzelne Varianten-ID
  if (legacy.variant_id !== undefined) {
    conditions.push({
      type: "variant_selected",
      variant_id: legacy.variant_id,
      operator: "=",
    });
  }

  // Mehrere Varianten-IDs (OR-verknuepft)
  if (legacy.variant_ids && legacy.variant_ids.length > 0) {
    if (legacy.variant_ids.length === 1) {
      conditions.push({
        type: "variant_selected",
        variant_id: legacy.variant_ids[0],
        operator: "=",
      });
    } else {
      conditions.push({
        type: "OR",
        conditions: legacy.variant_ids.map((id) => ({
          type: "variant_selected" as const,
          variant_id: id,
          operator: "=" as const,
        })),
      });
    }
  }

  // Feld-Bedingungen (AND-verknuepft)
  if (legacy.field_conditions && legacy.field_conditions.length > 0) {
    for (const fc of legacy.field_conditions) {
      conditions.push({
        type: "field",
        field: fc.field,
        operator: fc.operator,
        value: fc.value,
      });
    }
  }

  // Ergebnis zusammenbauen
  if (conditions.length === 0) {
    // Keine Bedingungen = immer true
    return { type: "AND", conditions: [] };
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  // Alle Bedingungen sind AND-verknuepft
  return {
    type: "AND",
    conditions,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED EVALUATION FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Wertet eine Bedingung aus - unterstuetzt sowohl neues als auch altes Format
 *
 * Dies ist die Hauptfunktion fuer die Integration in bestehenden Code.
 * Sie erkennt automatisch das Format und wertet entsprechend aus.
 *
 * @param conditionJson - JSON-String oder Objekt mit der Bedingung
 * @param context - Der Auswertungskontext
 * @returns true wenn die Bedingung erfuellt ist
 *
 * @example
 * ```typescript
 * // Altes Format (wird automatisch konvertiert)
 * evaluateShowCondition('{"clause_id": 1}', context);
 *
 * // Neues Format
 * evaluateShowCondition('{"type": "clause_enabled", "clause_id": 1, "operator": "="}', context);
 * ```
 */
export function evaluateShowCondition(
  conditionJson: string | null | undefined,
  context: ConditionContext
): boolean {
  // Keine Bedingung = immer sichtbar
  if (!conditionJson) {
    return true;
  }

  try {
    const parsed = JSON.parse(conditionJson);

    // Leeres Objekt = keine Bedingung
    if (typeof parsed !== "object" || parsed === null) {
      return true;
    }

    // Pruefe ob es das Legacy-Format ist
    if (isLegacyCondition(parsed)) {
      const converted = convertLegacyCondition(parsed);
      return evaluateCondition(converted, context);
    }

    // Neues Format direkt auswerten
    return evaluateCondition(parsed as Condition, context);
  } catch (error) {
    // Bei Parse-Fehlern: sicher als true behandeln
    console.warn("[ConditionEvaluator] Failed to parse condition:", error, conditionJson);
    return true;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Erstellt eine einfache Feld-Bedingung
 */
export function fieldCondition(
  field: string,
  operator: ConditionOperator,
  value?: string | number | boolean
): SimpleCondition {
  return { type: "field", field, operator, value };
}

/**
 * Erstellt eine Klausel-aktiviert-Bedingung
 */
export function clauseEnabledCondition(clauseId: number): SimpleCondition {
  return { type: "clause_enabled", clause_id: clauseId, operator: "=" };
}

/**
 * Erstellt eine Variante-ausgewaehlt-Bedingung
 */
export function variantSelectedCondition(variantId: number): SimpleCondition {
  return { type: "variant_selected", variant_id: variantId, operator: "=" };
}

/**
 * Erstellt eine AND-Bedingung
 */
export function and(...conditions: Condition[]): CompoundCondition {
  return { type: "AND", conditions };
}

/**
 * Erstellt eine OR-Bedingung
 */
export function or(...conditions: Condition[]): CompoundCondition {
  return { type: "OR", conditions };
}

// ══════════════════════════════════════════════════════════════════════════════
// TYPE RE-EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

export type {
  Condition,
  SimpleCondition,
  CompoundCondition,
  ConditionContext,
  ConditionOperator,
  LegacyShowCondition,
};
