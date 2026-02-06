/**
 * ConditionBuilder - Serialization
 *
 * JSON conversion helpers and exported utility functions.
 */

import { DEFAULT_CONDITION_FIELDS } from "./constants";
import { evaluateCondition, validateCondition } from "./condition-logic";
import { generateId } from "./utils";
import type {
    ClauseCondition,
    ConditionGroup,
    FieldDefinition,
    LegacyCondition,
    SimpleCondition,
    TestValues,
} from "./types";

// ============================================================================
// JSON CONVERSION HELPERS
// ============================================================================

/** Convert condition to JSON for storage */
export const conditionToJson = (condition: ClauseCondition): string | null => {
    if (!condition) return null;
    return JSON.stringify(condition);
};

/** Parse JSON to condition, handling legacy formats */
export const jsonToCondition = (json: string | null): ClauseCondition => {
    if (!json) return null;

    try {
        const parsed = JSON.parse(json);

        // Handle legacy format
        if (parsed && typeof parsed === "object" && !parsed.type) {
            if (parsed.and || parsed.or) {
                const logic = parsed.and ? "and" : "or";
                const conditions = (parsed.and || parsed.or) as LegacyCondition[];
                return {
                    type: "group",
                    id: generateId(),
                    logic,
                    conditions: conditions.map((c) => ({
                        type: "simple" as const,
                        id: generateId(),
                        field: c.field,
                        operator: c.operator,
                        value: c.value,
                    })),
                };
            }

            return {
                type: "simple",
                id: generateId(),
                field: parsed.field,
                operator: parsed.operator,
                value: parsed.value,
            };
        }

        // Ensure IDs exist
        const ensureIds = (c: SimpleCondition | ConditionGroup): SimpleCondition | ConditionGroup => {
            if (c.type === "simple") {
                return { ...c, id: c.id || generateId() };
            }
            return {
                ...c,
                id: c.id || generateId(),
                conditions: c.conditions.map(ensureIds),
            };
        };

        if (parsed.type) {
            return ensureIds(parsed);
        }

        return parsed as ClauseCondition;
    } catch {
        return null;
    }
};

/** Validate condition completeness */
export const isConditionComplete = (
    condition: ClauseCondition,
    fields: FieldDefinition[] = DEFAULT_CONDITION_FIELDS
): boolean => {
    const result = validateCondition(condition, fields);
    return result.isValid;
};

/** Get all field names used in condition */
export const getConditionFields = (condition: ClauseCondition): string[] => {
    if (!condition) return [];

    const fields: string[] = [];

    const collect = (c: ClauseCondition): void => {
        if (!c) return;
        if (c.type === "simple") {
            if (c.field) fields.push(c.field);
        } else if (c.type === "group") {
            c.conditions.forEach(collect);
        }
    };

    collect(condition);
    return [...new Set(fields)];
};

/** Evaluate condition with test values */
export const testCondition = (
    condition: ClauseCondition,
    values: TestValues,
    fields: FieldDefinition[] = DEFAULT_CONDITION_FIELDS
): boolean => {
    return evaluateCondition(condition, values, fields);
};
