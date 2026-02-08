/**
 * Types for the UnifiedDocumentComposer page
 */

export interface DocumentTypeResponse {
    id: number;
    name: string;
    country_code: string;
    is_active: boolean;
}

export interface VariantGroupForDraft {
    id: number;
    variant_group_id: number;
    variant_group_name: string;
    variant_group_description?: string;
    display_order: number;
    is_mandatory: boolean;
    default_variant_id?: number;
    effective_default_id?: number;
    variants: Array<{
        id: number;
        variant_name: string;
        variant_code?: string;
        is_default: boolean;
        clause_id: number;
    }>;
}
