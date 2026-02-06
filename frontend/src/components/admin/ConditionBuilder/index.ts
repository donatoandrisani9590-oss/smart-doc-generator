/**
 * ConditionBuilder - Barrel Export
 *
 * Re-exports everything that was previously exported from the monolithic file.
 */

// Main component
export { ConditionBuilder } from "./ConditionBuilder";
export { ConditionBuilder as default } from "./ConditionBuilder";

// Types
export type {
    ConditionKind,
    ClauseReference,
    VariantReference,
    SimpleCondition,
    ConditionGroup,
    ClauseCondition,
    LegacyCondition,
    FieldDefinition,
    OperatorDefinition,
    QuickTemplate,
    TestValues,
    NaturalLanguageOptions,
    ValidationResult,
    HistoryState,
    SortableConditionRowProps,
    ConditionGroupEditorProps,
    ConditionTesterProps,
    ConditionBuilderProps,
} from "./types";

// Serialization / JSON helpers
export {
    conditionToJson,
    jsonToCondition,
    isConditionComplete,
    getConditionFields,
    testCondition,
} from "./serialization";

// Condition logic
export {
    conditionToNaturalLanguage,
    evaluateCondition,
    validateCondition,
} from "./condition-logic";
