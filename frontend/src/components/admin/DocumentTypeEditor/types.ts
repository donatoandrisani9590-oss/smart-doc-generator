import type { Clause, DocumentTypeClauseLink } from "@/hooks/useApi";

export interface ClauseSelection extends DocumentTypeClauseLink {
    clause?: Clause;
}

export interface VariantGroupSelection {
    variant_group_id: number;
    display_order: number;
    is_mandatory: boolean;
    default_variant_id?: number | null;
    // Display fields
    name?: string;
    description?: string;
    variant_count?: number;
    variants?: Array<{
        id: number;
        variant_name: string;
        is_default: boolean;
    }>;
}

export interface DocumentTypeEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editId?: number | null;
    countryCode: string;
    onSuccess?: () => void;
}
