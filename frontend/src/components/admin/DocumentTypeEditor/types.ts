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

export const CATEGORIES = [
    // Hauptkategorien
    { value: "contract", label: "Arbeitsvertrag" },
    { value: "amendment", label: "\u00c4nderungsvertrag" },
    { value: "agreement", label: "Vereinbarung" },
    // HR-Korrespondenz
    { value: "letter", label: "Schreiben" },
    { value: "invitation", label: "Einladung" },
    { value: "care", label: "F\u00fcrsorgegespr\u00e4ch / BEM" },
    { value: "notice", label: "K\u00fcndigung" },
    { value: "warning", label: "Abmahnung" },
    { value: "certificate", label: "Bescheinigung / Zeugnis" },
    // Sonstiges
    { value: "other", label: "Sonstiges" },
] as const;
