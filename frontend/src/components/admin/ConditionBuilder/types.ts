/**
 * ConditionBuilder - Types & Interfaces
 *
 * All type definitions used across the ConditionBuilder module.
 */

import type React from "react";

// ============================================================================
// CORE TYPES
// ============================================================================

/** Condition kind - determines what the condition checks */
export type ConditionKind = "field" | "clause_active" | "variant_selected";

/** Reference to a clause for conditions */
export interface ClauseReference {
    id: number;
    title: string;
}

/** Reference to a variant for conditions */
export interface VariantReference {
    id: number;
    title: string;
    clauseId: number;
    clauseTitle?: string;
}

/** Single condition comparing a field with a value */
export interface SimpleCondition {
    type: "simple";
    id: string;
    /** Kind of condition: field comparison, clause activation, or variant selection */
    conditionKind?: ConditionKind;
    /** Field name (for field conditions) */
    field: string;
    /** Clause ID (for clause_active conditions) */
    clauseId?: number;
    /** Variant ID (for variant_selected conditions) */
    variantId?: number;
    operator: string;
    value: string | number | boolean;
}

/** Group of conditions combined with AND or OR */
export interface ConditionGroup {
    type: "group";
    id: string;
    logic: "and" | "or";
    conditions: (SimpleCondition | ConditionGroup)[];
}

/** Root condition type - can be simple, group, or null */
export type ClauseCondition = SimpleCondition | ConditionGroup | null;

/** Legacy format for backward compatibility */
export interface LegacyCondition {
    field: string;
    operator: string;
    value: string | number | boolean;
}

// ============================================================================
// FIELD & OPERATOR DEFINITIONS
// ============================================================================

/** Field definition with metadata */
export interface FieldDefinition {
    name: string;
    label: string;
    type: "number" | "text" | "boolean" | "select" | "date";
    category: string;
    description?: string;
    options?: string[];
    unit?: string;
}

/** Operator definition */
export interface OperatorDefinition {
    value: string;
    label: string;
    description?: string;
    requiresValue: boolean;
}

/** Quick Template definition */
export interface QuickTemplate {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    condition: SimpleCondition | ConditionGroup;
}

/** Test values for simulation */
export interface TestValues {
    [fieldName: string]: string | number | boolean;
}

// ============================================================================
// NATURAL LANGUAGE & VALIDATION
// ============================================================================

export interface NaturalLanguageOptions {
    fields: FieldDefinition[];
    clauses?: ClauseReference[];
    variants?: VariantReference[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

// ============================================================================
// HISTORY STATE
// ============================================================================

export interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface SortableConditionRowProps {
    condition: SimpleCondition;
    onChange: (condition: SimpleCondition) => void;
    onRemove: () => void;
    onDuplicate?: () => void;
    disabled?: boolean;
    showRemove: boolean;
    index: number;
    fields: FieldDefinition[];
    fieldSearch: string;
    availableClauses: ClauseReference[];
    availableVariants: VariantReference[];
}

export interface ConditionGroupEditorProps {
    group: ConditionGroup;
    onChange: (group: ConditionGroup) => void;
    onRemove?: () => void;
    disabled?: boolean;
    isRoot?: boolean;
    depth?: number;
    fields: FieldDefinition[];
    fieldSearch: string;
    availableClauses: ClauseReference[];
    availableVariants: VariantReference[];
}

export interface ConditionTesterProps {
    condition: ClauseCondition;
    fields: FieldDefinition[];
    onClose: () => void;
}

export interface ConditionBuilderProps {
    condition: ClauseCondition;
    onChange: (condition: ClauseCondition) => void;
    disabled?: boolean;
    fields?: FieldDefinition[];
    /** Available clauses for "clause is active" conditions */
    availableClauses?: ClauseReference[];
    /** Available variants for "variant is selected" conditions */
    availableVariants?: VariantReference[];
    showTemplates?: boolean;
    showTester?: boolean;
    showShortcuts?: boolean;
}
