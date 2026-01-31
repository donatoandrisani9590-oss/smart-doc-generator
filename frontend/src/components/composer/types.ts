/**
 * Types für den Unified Document Composer
 *
 * Smart UX Konzept - Phase 1 & 2
 */

export type ClauseOrigin = "global" | "local" | "deviation";

export interface ClauseInstance {
    id: number;
    origin: ClauseOrigin;
    source_clause_id: number | null;
    source_clause_version: number | null;
    title: string;
    content_html: string | null;
    display_order: number;
    is_editable: boolean;
    visual_style: "green" | "blue";

    // Varianten-Support
    variant_group_id?: number;
    selected_variant_id?: number;

    // Conditional Support
    is_condition_met: boolean;

    // Deviation-Info (Phase 2)
    deviated_at?: string;
    deviated_by_user_id?: number;
    deviated_reason?: string;
    original_content_snapshot?: string; // Original-Inhalt vor Deviation

    // Promotion-Info
    promoted_to_clause_id?: number;
    promoted_at?: string;

    // Timestamps
    created_at?: string;
    updated_at?: string;
}

export interface LibraryClause {
    id: number;
    title: string;
    category: string | null;
    preview: string;
    version: number;
    is_approved: boolean;
    has_variants: boolean;
    variant_count: number;
}

export interface ComposerDraft {
    id: number;
    document_type_id: number;
    document_type_name: string;
    country_code: string;
    name: string | null;
    form_data: Record<string, unknown> | null;
    clause_count: number;
    global_clause_count: number;
    local_clause_count: number;
    deviation_count: number;
    created_at?: string;
    updated_at?: string;
}

export interface LibraryCategory {
    name: string;
    count: number;
}

// API Response Types
export interface ClauseInstanceListResponse {
    clauses: ClauseInstance[];
    total: number;
    draft_id: number;
}

export interface LibrarySearchResponse {
    clauses: LibraryClause[];
    total: number;
    page: number;
    page_size: number;
}

// Form Data Type (Mitarbeiterdaten)
export interface DocumentFormData {
    vorname: string;
    nachname: string;
    geburtsdatum: string;
    eintrittsdatum: string;
    position: string;
    gehalt: string;
    wochenstunden: string;
    firmenwagen: boolean;
    homeoffice: boolean;
    probezeit: string;
    [key: string]: string | boolean | number;
}

// Drag & Drop Types
export interface DragItem {
    type: "library-clause" | "canvas-clause";
    clause: LibraryClause | ClauseInstance;
}
