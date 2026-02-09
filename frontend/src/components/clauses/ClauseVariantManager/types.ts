/**
 * Types for ClauseVariantManager
 *
 * v4.2 Feature (Kapitel 16.13):
 * - Varianten-Gruppen erstellen und verwalten
 * - Mehrere Varianten eines Textbausteins definieren
 * - Standard-Variante festlegen
 * - Bedingungen für automatische Auswahl
 */

export interface ClauseVariant {
    id: number;
    group_id: number;
    clause_id: number;
    variant_name: string;
    variant_code?: string;
    description?: string;
    auto_select_condition?: string;
    sort_order: number;
    is_default: boolean;
    is_active: boolean;
    clause_title?: string;
    clause_content_preview?: string;
}

export interface VariantGroup {
    id: number;
    name: string;
    description?: string;
    category?: string;
    country_code: string;
    base_clause_id?: number;
    is_active: boolean;
    created_at?: string;
    variants: ClauseVariant[];
}

export interface ClauseVariantManagerProps {
    countryCode?: string;
    onVariantSelect?: (groupId: number, variantId: number, clauseId: number) => void;
}
