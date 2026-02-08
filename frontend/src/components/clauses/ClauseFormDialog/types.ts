import type { Clause } from "@/hooks/useApi";

export interface ClauseFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editClause?: Clause | null; // Wenn vorhanden, Bearbeitungsmodus
    defaultCountryCode?: string;
    onSuccess?: (clause: Clause) => void;
}

export type WizardStep = "basics" | "content" | "preview";

export interface CategoryOption {
    value: string;
    label: string;
    description: string;
    group: string;
}

export interface CountryOption {
    value: string;
    label: string;
    flag: string;
}
