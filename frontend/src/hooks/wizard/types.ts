/**
 * Shared types for wizard sub-hooks.
 *
 * Contains API response interfaces and localStorage key helpers
 * that were previously private to useDocumentWizard.
 */

// ══════════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface DocumentTypeResponse {
    id: number;
    name: string;
    country_code: string;
    category?: string;
    is_active: boolean;
    default_probation_months?: number;
    default_notice_period?: string;
    default_vacation_days?: number;
    default_weekly_hours?: number;
}

export interface ClauseResponse {
    id: number;
    title: string;
    display_order: number;
    is_mandatory: boolean;
    is_default_selected?: boolean;
    clause_type: string;
    is_order_locked?: boolean;
    has_paragraph_number?: boolean;
    variant_group_id?: number;
    variant_group_name?: string;
}

export interface DraftResponse {
    id: number;
    document_type_id: number;
    document_type_name: string;
    name: string | null;
    form_data: Record<string, unknown>;
    custom_clauses: number[] | null;
    version?: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// LOCALSTORAGE KEYS
// ══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY_PREFIX = "doc_wizard_";

export const getStorageKey = (typeId: number) => `${STORAGE_KEY_PREFIX}${typeId}`;
