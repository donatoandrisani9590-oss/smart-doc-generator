/**
 * ConditionBuilder - Condition Logic
 *
 * Functions for natural language conversion, evaluation, and validation.
 */

import { getFieldInfo, getOperatorsForField } from "./utils";
import type {
    ClauseCondition,
    ConditionGroup,
    FieldDefinition,
    NaturalLanguageOptions,
    SimpleCondition,
    TestValues,
    ValidationResult,
} from "./types";

// ============================================================================
// CONDITION TO NATURAL LANGUAGE
// ============================================================================

export const conditionToNaturalLanguage = (
    condition: ClauseCondition,
    options: NaturalLanguageOptions | FieldDefinition[],
    depth: number = 0
): string => {
    // Handle backwards compatibility - if options is an array, it's the old fields array
    const { fields, clauses = [], variants = [] } = Array.isArray(options)
        ? { fields: options, clauses: [], variants: [] }
        : options;

    if (!condition) return "";

    if (condition.type === "simple") {
        const conditionKind = condition.conditionKind || "field";

        // Handle clause_active conditions
        if (conditionKind === "clause_active" && condition.clauseId) {
            const clause = clauses.find(c => c.id === condition.clauseId);
            const clauseName = clause?.title || `Klausel #${condition.clauseId}`;
            const isActive = condition.value === true;
            const operatorNot = condition.operator === "!=" ? "nicht " : "";
            return `Klausel \u201E${clauseName}\u201C ist ${operatorNot}${isActive ? "aktiv" : "inaktiv"}`;
        }

        // Handle variant_selected conditions
        if (conditionKind === "variant_selected" && condition.variantId) {
            const variant = variants.find(v => v.id === condition.variantId);
            const variantName = variant?.title || `Variante #${condition.variantId}`;
            const isSelected = condition.value === true;
            const operatorNot = condition.operator === "!=" ? "nicht " : "";
            return `Variante \u201E${variantName}\u201C ist ${operatorNot}${isSelected ? "gew\u00E4hlt" : "nicht gew\u00E4hlt"}`;
        }

        // Handle field conditions (default)
        const field = getFieldInfo(condition.field, fields);
        const operators = getOperatorsForField(condition.field, fields);
        const operator = operators.find((o) => o.value === condition.operator);

        if (!field || !operator) return "";

        // Handle operators that don't require a value
        if (!operator.requiresValue) {
            return `\u201E${field.label}\u201C ${operator.label}`;
        }

        // Format the value
        let displayValue: string;
        if (field.type === "boolean") {
            displayValue = condition.value === true ? "Ja" : "Nein";
        } else if (field.type === "number" && typeof condition.value === "number") {
            displayValue = condition.value.toLocaleString("de-DE");
            if (field.unit) displayValue += ` ${field.unit}`;
        } else {
            displayValue = String(condition.value);
        }

        return `\u201E${field.label}\u201C ${operator.label} ${displayValue}`;
    }

    if (condition.type === "group") {
        const parts = condition.conditions
            .map((c) => conditionToNaturalLanguage(c, { fields, clauses, variants }, depth + 1))
            .filter((s) => s.length > 0);

        if (parts.length === 0) return "";
        if (parts.length === 1) return parts[0];

        const connector = condition.logic === "and" ? " UND " : " ODER ";
        const result = parts.join(connector);

        // Add parentheses for nested groups
        return depth > 0 ? `(${result})` : result;
    }

    return "";
};

// ============================================================================
// CONDITION EVALUATION (for testing/simulation)
// ============================================================================

export const evaluateCondition = (
    condition: ClauseCondition,
    testValues: TestValues,
    fields: FieldDefinition[]
): boolean => {
    if (!condition) return true; // No condition = always show

    if (condition.type === "simple") {
        const fieldValue = testValues[condition.field];
        const conditionValue = condition.value;

        if (fieldValue === undefined) return false;

        switch (condition.operator) {
            case "==":
                return fieldValue === conditionValue;
            case "!=":
                return fieldValue !== conditionValue;
            case ">":
                return Number(fieldValue) > Number(conditionValue);
            case ">=":
                return Number(fieldValue) >= Number(conditionValue);
            case "<":
                return Number(fieldValue) < Number(conditionValue);
            case "<=":
                return Number(fieldValue) <= Number(conditionValue);
            case "contains":
                return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
            case "startsWith":
                return String(fieldValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());
            case "endsWith":
                return String(fieldValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());
            case "isEmpty":
                return fieldValue === "" || fieldValue === null || fieldValue === undefined;
            case "isNotEmpty":
                return fieldValue !== "" && fieldValue !== null && fieldValue !== undefined;
            case "between": {
                const parts = String(conditionValue).split("-");
                if (parts.length !== 2) return false;
                const min = Number(parts[0]);
                const max = Number(parts[1]);
                if (isNaN(min) || isNaN(max)) return false;
                const numValue = Number(fieldValue);
                return numValue >= min && numValue <= max;
            }
            default:
                return false;
        }
    }

    if (condition.type === "group") {
        const results = condition.conditions.map((c) => evaluateCondition(c, testValues, fields));
        return condition.logic === "and"
            ? results.every((r) => r)
            : results.some((r) => r);
    }

    return false;
};

// ============================================================================
// CONDITION VALIDATION
// ============================================================================

export const validateCondition = (
    condition: ClauseCondition,
    fields: FieldDefinition[]
): ValidationResult => {
    const errors: string[] = [];

    if (!condition) {
        return { isValid: true, errors: [] };
    }

    const validateSimple = (c: SimpleCondition, path: string): void => {
        if (!c.field) {
            errors.push(`${path}: Kein Feld ausgew\u00E4hlt`);
        }
        if (!c.operator) {
            errors.push(`${path}: Kein Operator ausgew\u00E4hlt`);
        }
        const operators = getOperatorsForField(c.field, fields);
        const operator = operators.find((o) => o.value === c.operator);
        if (operator?.requiresValue && (c.value === "" || c.value === undefined)) {
            errors.push(`${path}: Kein Wert angegeben`);
        }
        // Validate "between" operator format
        if (c.operator === "between" && c.value) {
            const parts = String(c.value).split("-");
            if (parts.length !== 2 || isNaN(Number(parts[0])) || isNaN(Number(parts[1]))) {
                errors.push(`${path}: Ung\u00FCltiges Format f\u00FCr "zwischen" (erwartet: Zahl-Zahl, z.B. 50000-80000)`);
            } else if (Number(parts[0]) > Number(parts[1])) {
                errors.push(`${path}: Der erste Wert muss kleiner als der zweite sein`);
            }
        }
    };

    const validateGroup = (g: ConditionGroup, path: string): void => {
        if (g.conditions.length === 0) {
            errors.push(`${path}: Keine Bedingungen in der Gruppe`);
        }
        g.conditions.forEach((c, i) => {
            if (c.type === "simple") {
                validateSimple(c, `${path} \u2192 Bedingung ${i + 1}`);
            } else {
                validateGroup(c, `${path} \u2192 Gruppe ${i + 1}`);
            }
        });
    };

    if (condition.type === "simple") {
        validateSimple(condition, "Bedingung");
    } else {
        validateGroup(condition, "Gruppe");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};
