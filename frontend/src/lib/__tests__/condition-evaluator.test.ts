import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  evaluateOperator,
  evaluateShowCondition,
  convertLegacyCondition,
  fieldCondition,
  clauseEnabledCondition,
  variantSelectedCondition,
  and,
  or,
} from "../condition-evaluator";
import type { ConditionContext } from "@/types/conditions";

// =============================================================================
// Test helpers
// =============================================================================

function makeContext(
  overrides: Partial<ConditionContext> = {}
): ConditionContext {
  return {
    formData: {},
    enabledClauseIds: [],
    selectedVariantIds: [],
    ...overrides,
  };
}

// =============================================================================
// evaluateOperator
// =============================================================================

describe("evaluateOperator", () => {
  describe("equality (=)", () => {
    it("compares equal strings", () => {
      expect(evaluateOperator("=", "hello", "hello")).toBe(true);
    });

    it("is case-insensitive for strings", () => {
      expect(evaluateOperator("=", "Hello", "hello")).toBe(true);
    });

    it("compares equal numbers", () => {
      expect(evaluateOperator("=", 42, 42)).toBe(true);
    });

    it("coerces string numbers for comparison", () => {
      expect(evaluateOperator("=", "42", 42)).toBe(true);
    });

    it("treats null and undefined as equal", () => {
      expect(evaluateOperator("=", null, undefined)).toBe(true);
    });

    it("treats null and empty string as equal", () => {
      expect(evaluateOperator("=", null, "")).toBe(true);
    });

    it("compares booleans correctly", () => {
      expect(evaluateOperator("=", true, true)).toBe(true);
      expect(evaluateOperator("=", true, false)).toBe(false);
    });

    it("coerces 'true'/'ja' to boolean true", () => {
      expect(evaluateOperator("=", "true", true)).toBe(true);
      expect(evaluateOperator("=", "ja", true)).toBe(true);
    });
  });

  describe("inequality (!=)", () => {
    it("detects different values", () => {
      expect(evaluateOperator("!=", "a", "b")).toBe(true);
    });

    it("detects same values", () => {
      expect(evaluateOperator("!=", "same", "same")).toBe(false);
    });
  });

  describe("numeric comparisons (>, <, >=, <=)", () => {
    it("compares numbers with >", () => {
      expect(evaluateOperator(">", 10, 5)).toBe(true);
      expect(evaluateOperator(">", 5, 10)).toBe(false);
      expect(evaluateOperator(">", 5, 5)).toBe(false);
    });

    it("compares numbers with <", () => {
      expect(evaluateOperator("<", 5, 10)).toBe(true);
      expect(evaluateOperator("<", 10, 5)).toBe(false);
    });

    it("compares with >= and <=", () => {
      expect(evaluateOperator(">=", 5, 5)).toBe(true);
      expect(evaluateOperator(">=", 6, 5)).toBe(true);
      expect(evaluateOperator("<=", 5, 5)).toBe(true);
      expect(evaluateOperator("<=", 4, 5)).toBe(true);
    });

    it("handles German number format (1.234,56)", () => {
      expect(evaluateOperator(">", "1.234,56", 1000)).toBe(true);
      expect(evaluateOperator(">", "1.234,56", 2000)).toBe(false);
    });

    it("handles string numbers", () => {
      expect(evaluateOperator(">", "100", "50")).toBe(true);
    });
  });

  describe("string operations (contains, startsWith, endsWith)", () => {
    it("contains is case-insensitive", () => {
      expect(evaluateOperator("contains", "Hello World", "world")).toBe(true);
    });

    it("contains returns false for non-match", () => {
      expect(evaluateOperator("contains", "Hello", "xyz")).toBe(false);
    });

    it("startsWith works correctly", () => {
      expect(evaluateOperator("startsWith", "Hello World", "hello")).toBe(true);
      expect(evaluateOperator("startsWith", "Hello World", "world")).toBe(false);
    });

    it("endsWith works correctly", () => {
      expect(evaluateOperator("endsWith", "Hello World", "world")).toBe(true);
      expect(evaluateOperator("endsWith", "Hello World", "hello")).toBe(false);
    });
  });

  describe("emptiness (isEmpty, isNotEmpty)", () => {
    it("isEmpty is true for null, undefined, empty string", () => {
      expect(evaluateOperator("isEmpty", null, undefined)).toBe(true);
      expect(evaluateOperator("isEmpty", undefined, undefined)).toBe(true);
      expect(evaluateOperator("isEmpty", "", undefined)).toBe(true);
      expect(evaluateOperator("isEmpty", "  ", undefined)).toBe(true);
    });

    it("isEmpty is true for empty arrays and objects", () => {
      expect(evaluateOperator("isEmpty", [], undefined)).toBe(true);
      expect(evaluateOperator("isEmpty", {}, undefined)).toBe(true);
    });

    it("isEmpty is false for non-empty values", () => {
      expect(evaluateOperator("isEmpty", "hello", undefined)).toBe(false);
      expect(evaluateOperator("isEmpty", 0, undefined)).toBe(false);
    });

    it("isNotEmpty is the inverse of isEmpty", () => {
      expect(evaluateOperator("isNotEmpty", "hello", undefined)).toBe(true);
      expect(evaluateOperator("isNotEmpty", "", undefined)).toBe(false);
    });
  });
});

// =============================================================================
// evaluateCondition - simple conditions
// =============================================================================

describe("evaluateCondition", () => {
  describe("field conditions", () => {
    it("evaluates field equality", () => {
      const ctx = makeContext({ formData: { name: "Max" } });
      const cond = fieldCondition("name", "=", "Max");
      expect(evaluateCondition(cond, ctx)).toBe(true);
    });

    it("returns true for missing field name (safe default)", () => {
      const ctx = makeContext({ formData: { name: "Max" } });
      const cond = { type: "field" as const, operator: "=" as const, value: "Max" };
      expect(evaluateCondition(cond, ctx)).toBe(true);
    });
  });

  describe("clause_enabled conditions", () => {
    it("returns true when clause is enabled", () => {
      const ctx = makeContext({ enabledClauseIds: [1, 2, 3] });
      const cond = clauseEnabledCondition(2);
      expect(evaluateCondition(cond, ctx)).toBe(true);
    });

    it("returns false when clause is not enabled", () => {
      const ctx = makeContext({ enabledClauseIds: [1, 3] });
      const cond = clauseEnabledCondition(2);
      expect(evaluateCondition(cond, ctx)).toBe(false);
    });

    it("supports != operator (clause not enabled)", () => {
      const ctx = makeContext({ enabledClauseIds: [1, 3] });
      const cond = { type: "clause_enabled" as const, clause_id: 2, operator: "!=" as const };
      expect(evaluateCondition(cond, ctx)).toBe(true);
    });
  });

  describe("variant_selected conditions", () => {
    it("returns true when variant is selected", () => {
      const ctx = makeContext({ selectedVariantIds: [10, 20] });
      const cond = variantSelectedCondition(10);
      expect(evaluateCondition(cond, ctx)).toBe(true);
    });

    it("returns false when variant is not selected", () => {
      const ctx = makeContext({ selectedVariantIds: [10, 20] });
      const cond = variantSelectedCondition(99);
      expect(evaluateCondition(cond, ctx)).toBe(false);
    });
  });
});

// =============================================================================
// evaluateCondition - compound conditions
// =============================================================================

describe("compound conditions", () => {
  it("AND requires all sub-conditions to be true", () => {
    const ctx = makeContext({
      formData: { salary: 80000 },
      enabledClauseIds: [1],
    });
    const cond = and(
      fieldCondition("salary", ">", 50000),
      clauseEnabledCondition(1)
    );
    expect(evaluateCondition(cond, ctx)).toBe(true);
  });

  it("AND fails if any sub-condition is false", () => {
    const ctx = makeContext({
      formData: { salary: 30000 },
      enabledClauseIds: [1],
    });
    const cond = and(
      fieldCondition("salary", ">", 50000),
      clauseEnabledCondition(1)
    );
    expect(evaluateCondition(cond, ctx)).toBe(false);
  });

  it("OR requires at least one sub-condition to be true", () => {
    const ctx = makeContext({
      formData: { salary: 30000 },
      enabledClauseIds: [1],
    });
    const cond = or(
      fieldCondition("salary", ">", 50000),
      clauseEnabledCondition(1)
    );
    expect(evaluateCondition(cond, ctx)).toBe(true);
  });

  it("OR fails if all sub-conditions are false", () => {
    const ctx = makeContext({
      formData: { salary: 30000 },
      enabledClauseIds: [],
    });
    const cond = or(
      fieldCondition("salary", ">", 50000),
      clauseEnabledCondition(1)
    );
    expect(evaluateCondition(cond, ctx)).toBe(false);
  });

  it("empty AND conditions array returns true", () => {
    const ctx = makeContext();
    expect(evaluateCondition({ type: "AND", conditions: [] }, ctx)).toBe(true);
  });

  it("handles deeply nested conditions", () => {
    const ctx = makeContext({
      formData: { salary: 80000, position: "manager" },
      enabledClauseIds: [5],
    });
    const cond = and(
      or(
        fieldCondition("salary", ">", 70000),
        fieldCondition("position", "=", "director")
      ),
      clauseEnabledCondition(5)
    );
    expect(evaluateCondition(cond, ctx)).toBe(true);
  });
});

// =============================================================================
// Legacy format conversion
// =============================================================================

describe("convertLegacyCondition", () => {
  it("converts single clause_id", () => {
    const legacy = { clause_id: 5 };
    const converted = convertLegacyCondition(legacy);
    const ctx = makeContext({ enabledClauseIds: [5] });
    expect(evaluateCondition(converted, ctx)).toBe(true);
  });

  it("converts multiple clause_ids as OR", () => {
    const legacy = { clause_ids: [1, 2, 3] };
    const converted = convertLegacyCondition(legacy);
    // Should be true if ANY of the clauses is enabled
    const ctx = makeContext({ enabledClauseIds: [2] });
    expect(evaluateCondition(converted, ctx)).toBe(true);
  });

  it("converts single variant_id", () => {
    const legacy = { variant_id: 10 };
    const converted = convertLegacyCondition(legacy);
    const ctx = makeContext({ selectedVariantIds: [10] });
    expect(evaluateCondition(converted, ctx)).toBe(true);
  });

  it("converts field_conditions", () => {
    const legacy = {
      field_conditions: [
        { field: "salary", operator: ">" as const, value: 50000 },
      ],
    };
    const converted = convertLegacyCondition(legacy);
    const ctx = makeContext({ formData: { salary: 75000 } });
    expect(evaluateCondition(converted, ctx)).toBe(true);
  });

  it("combines clause_id and field_conditions with AND", () => {
    const legacy = {
      clause_id: 1,
      field_conditions: [
        { field: "salary", operator: ">" as const, value: 50000 },
      ],
    };
    const converted = convertLegacyCondition(legacy);
    // Both must be true
    const ctx1 = makeContext({
      enabledClauseIds: [1],
      formData: { salary: 75000 },
    });
    expect(evaluateCondition(converted, ctx1)).toBe(true);

    const ctx2 = makeContext({
      enabledClauseIds: [],
      formData: { salary: 75000 },
    });
    expect(evaluateCondition(converted, ctx2)).toBe(false);
  });

  it("empty legacy returns always-true condition", () => {
    const legacy = {};
    const converted = convertLegacyCondition(legacy);
    expect(evaluateCondition(converted, makeContext())).toBe(true);
  });
});

// =============================================================================
// evaluateShowCondition (JSON string entry point)
// =============================================================================

describe("evaluateShowCondition", () => {
  it("returns true for null/undefined input", () => {
    expect(evaluateShowCondition(null, makeContext())).toBe(true);
    expect(evaluateShowCondition(undefined, makeContext())).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(evaluateShowCondition("", makeContext())).toBe(true);
  });

  it("parses and evaluates new-format JSON", () => {
    const json = JSON.stringify({
      type: "field",
      field: "salary",
      operator: ">",
      value: 50000,
    });
    const ctx = makeContext({ formData: { salary: 75000 } });
    expect(evaluateShowCondition(json, ctx)).toBe(true);
  });

  it("auto-detects and converts legacy JSON", () => {
    const json = JSON.stringify({ clause_id: 3 });
    const ctx = makeContext({ enabledClauseIds: [3] });
    expect(evaluateShowCondition(json, ctx)).toBe(true);
  });

  it("returns true for invalid JSON (safe fallback)", () => {
    expect(evaluateShowCondition("not-json{", makeContext())).toBe(true);
  });
});

// =============================================================================
// Builder functions
// =============================================================================

describe("builder functions", () => {
  it("fieldCondition creates correct structure", () => {
    const cond = fieldCondition("salary", ">", 50000);
    expect(cond).toEqual({
      type: "field",
      field: "salary",
      operator: ">",
      value: 50000,
    });
  });

  it("clauseEnabledCondition creates correct structure", () => {
    const cond = clauseEnabledCondition(5);
    expect(cond).toEqual({
      type: "clause_enabled",
      clause_id: 5,
      operator: "=",
    });
  });

  it("variantSelectedCondition creates correct structure", () => {
    const cond = variantSelectedCondition(10);
    expect(cond).toEqual({
      type: "variant_selected",
      variant_id: 10,
      operator: "=",
    });
  });

  it("and/or create compound conditions", () => {
    const a = fieldCondition("x", "=", 1);
    const b = fieldCondition("y", "=", 2);
    expect(and(a, b)).toEqual({ type: "AND", conditions: [a, b] });
    expect(or(a, b)).toEqual({ type: "OR", conditions: [a, b] });
  });
});
