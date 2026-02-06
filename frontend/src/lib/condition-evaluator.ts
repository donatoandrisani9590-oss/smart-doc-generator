/**
 * Condition Evaluator - Evaluates conditional logic for clauses and form fields
 *
 * Features:
 * - Recursive evaluation of AND/OR compound conditions
 * - All comparison operators (=, !=, >, <, contains, isEmpty, etc.)
 * - Automatic conversion from legacy ShowCondition format
 * - Type-safe evaluation via ConditionContext
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
 * Evaluates a condition against the given context.
 *
 * @param condition - The condition to evaluate
 * @param context - Context containing form data, clause IDs, and variant IDs
 * @returns true if the condition is satisfied, false otherwise
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

  // Fallback: unknown type - treat as true (safe default)
  console.warn("[ConditionEvaluator] Unknown condition type:", condition);
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOUND CONDITION EVALUATOR
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluates a compound condition (AND/OR).
 */
function evaluateCompoundCondition(
  condition: CompoundCondition,
  context: ConditionContext
): boolean {
  const { conditions } = condition;

  // Empty conditions array = true (no restriction)
  if (!conditions || conditions.length === 0) {
    return true;
  }

  if (condition.type === "AND") {
    // AND: all sub-conditions must be true
    return conditions.every((c) => evaluateCondition(c, context));
  }

  if (condition.type === "OR") {
    // OR: at least one sub-condition must be true
    return conditions.some((c) => evaluateCondition(c, context));
  }

  // Fallback
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// SIMPLE CONDITION EVALUATOR
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluates a simple (non-compound) condition.
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
 * Evaluates a field-based condition.
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
 * Evaluates a clause-enabled condition.
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

  // For clause conditions: = means "is enabled", != means "is not enabled"
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
      // For other operators: check if enabled
      return isEnabled;
  }
}

/**
 * Evaluates a variant-selected condition.
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

  // Same logic as clause conditions
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
 * Evaluates a comparison operator.
 *
 * @param operator - The comparison operator
 * @param fieldValue - The current field value
 * @param compareValue - The value to compare against
 * @returns true if the comparison holds
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
 * Checks equality with type coercion.
 */
function isEqual(a: unknown, b: unknown): boolean {
  // Null/Undefined handling
  if (a === null || a === undefined) {
    return b === null || b === undefined || b === "";
  }
  if (b === null || b === undefined) {
    return a === null || a === undefined || a === "";
  }

  // Boolean handling
  if (typeof a === "boolean" || typeof b === "boolean") {
    return toBoolean(a) === toBoolean(b);
  }

  // Numeric comparison when both are numbers
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA === numB;
  }

  // String comparison (case-insensitive)
  return toString(a).toLowerCase() === toString(b).toLowerCase();
}

/**
 * Converts a value to number.
 */
function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    // Support German number format (1.234,56 -> 1234.56)
    const normalized = value.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized);
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return NaN;
}

/**
 * Converts a value to string.
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

/**
 * Converts a value to boolean.
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
 * Checks whether a value is "empty" (null, undefined, blank string, empty array/object).
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
 * Converts the legacy ShowCondition format to the new Condition format.
 *
 * @param legacy - The legacy ShowCondition object
 * @returns A Condition in the new format
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
 * // Result: AND condition containing all sub-conditions
 * ```
 */
export function convertLegacyCondition(legacy: LegacyShowCondition): Condition {
  const conditions: Condition[] = [];

  // Single clause ID
  if (legacy.clause_id !== undefined) {
    conditions.push({
      type: "clause_enabled",
      clause_id: legacy.clause_id,
      operator: "=",
    });
  }

  // Multiple clause IDs (OR-linked)
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

  // Single variant ID
  if (legacy.variant_id !== undefined) {
    conditions.push({
      type: "variant_selected",
      variant_id: legacy.variant_id,
      operator: "=",
    });
  }

  // Multiple variant IDs (OR-linked)
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

  // Field conditions (AND-linked)
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

  // Build result
  if (conditions.length === 0) {
    // No conditions = always true
    return { type: "AND", conditions: [] };
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  // All conditions are AND-linked
  return {
    type: "AND",
    conditions,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED EVALUATION FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluates a condition - supports both new and legacy formats.
 *
 * This is the main entry point for integration in existing code.
 * It automatically detects the format and evaluates accordingly.
 *
 * @param conditionJson - JSON string or object containing the condition
 * @param context - The evaluation context
 * @returns true if the condition is satisfied
 *
 * @example
 * ```typescript
 * // Legacy format (auto-converted)
 * evaluateShowCondition('{"clause_id": 1}', context);
 *
 * // New format
 * evaluateShowCondition('{"type": "clause_enabled", "clause_id": 1, "operator": "="}', context);
 * ```
 */
export function evaluateShowCondition(
  conditionJson: string | null | undefined,
  context: ConditionContext
): boolean {
  // No condition = always visible
  if (!conditionJson) {
    return true;
  }

  try {
    const parsed = JSON.parse(conditionJson);

    // Empty object = no condition
    if (typeof parsed !== "object" || parsed === null) {
      return true;
    }

    // Check if it's the legacy format
    if (isLegacyCondition(parsed)) {
      const converted = convertLegacyCondition(parsed);
      return evaluateCondition(converted, context);
    }

    // Evaluate new format directly
    return evaluateCondition(parsed as Condition, context);
  } catch (error) {
    // On parse errors: safely treat as true
    console.warn("[ConditionEvaluator] Failed to parse condition:", error, conditionJson);
    return true;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a simple field condition.
 */
export function fieldCondition(
  field: string,
  operator: ConditionOperator,
  value?: string | number | boolean
): SimpleCondition {
  return { type: "field", field, operator, value };
}

/**
 * Creates a clause-enabled condition.
 */
export function clauseEnabledCondition(clauseId: number): SimpleCondition {
  return { type: "clause_enabled", clause_id: clauseId, operator: "=" };
}

/**
 * Creates a variant-selected condition.
 */
export function variantSelectedCondition(variantId: number): SimpleCondition {
  return { type: "variant_selected", variant_id: variantId, operator: "=" };
}

/**
 * Creates an AND compound condition.
 */
export function and(...conditions: Condition[]): CompoundCondition {
  return { type: "AND", conditions };
}

/**
 * Creates an OR compound condition.
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
