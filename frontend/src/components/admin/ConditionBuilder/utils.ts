/**
 * ConditionBuilder - Utility Functions
 *
 * Helper functions for field lookups, ID generation, and condition creation.
 */

import { OPERATORS } from "./constants";
import type {
    ConditionGroup,
    FieldDefinition,
    OperatorDefinition,
    SimpleCondition,
} from "./types";

// ============================================================================
// ID GENERATION
// ============================================================================

/** Generate a unique condition ID */
export const generateId = (): string =>
    `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ============================================================================
// FIELD HELPERS
// ============================================================================

/** Get field definition by name */
export const getFieldInfo = (
    fieldName: string,
    fields: FieldDefinition[]
): FieldDefinition | undefined => {
    return fields.find((f) => f.name === fieldName);
};

/** Get the type of a field by name */
export const getFieldType = (
    fieldName: string,
    fields: FieldDefinition[]
): string => {
    return getFieldInfo(fieldName, fields)?.type || "text";
};

/** Get available operators for a given field */
export const getOperatorsForField = (
    fieldName: string,
    fields: FieldDefinition[]
): OperatorDefinition[] => {
    const fieldType = getFieldType(fieldName, fields);
    return OPERATORS[fieldType] || OPERATORS.text;
};

/** Group fields by their category */
export const groupFieldsByCategory = (
    fields: FieldDefinition[]
): Record<string, FieldDefinition[]> => {
    return fields.reduce(
        (acc, field) => {
            if (!acc[field.category]) acc[field.category] = [];
            acc[field.category].push(field);
            return acc;
        },
        {} as Record<string, FieldDefinition[]>
    );
};

// ============================================================================
// CONDITION CREATION
// ============================================================================

/** Create an empty simple condition */
export const createEmptyCondition = (): SimpleCondition => ({
    type: "simple",
    id: generateId(),
    field: "",
    operator: "",
    value: "",
});

/** Create an empty condition group */
export const createEmptyGroup = (
    logic: "and" | "or" = "and"
): ConditionGroup => ({
    type: "group",
    id: generateId(),
    logic,
    conditions: [createEmptyCondition()],
});

/** Deep clone a condition with new IDs */
export const cloneConditionWithNewIds = (
    condition: SimpleCondition | ConditionGroup
): SimpleCondition | ConditionGroup => {
    if (condition.type === "simple") {
        return { ...condition, id: generateId() };
    }
    return {
        ...condition,
        id: generateId(),
        conditions: condition.conditions.map(cloneConditionWithNewIds),
    };
};
