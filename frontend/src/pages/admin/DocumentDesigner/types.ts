// Types for DocumentDesigner

import type { ClauseCondition } from "@/components/admin/ConditionBuilder/types";

export interface Clause {
    id: number;
    title: string;
    content?: string;
    category: string;
    country_code?: string;
    version?: string;
    placeholders?: string[];
    isMandatory?: boolean;
}

export interface AssignedClause extends Clause {
    uniqueId: string; // Unique ID for DnD (clause can be added multiple times theoretically)
    order: number;
    is_mandatory: boolean;
    condition?: ClauseCondition | null;
    // Variant support
    variant_group_id?: number;
    variant_group_name?: string;
    clause_type?: "standard" | "optional" | "conditional" | "variant";
}

export interface Attachment {
    id: number;
    name: string;
    file_type: string;
    page_count?: number;
    is_mandatory?: boolean;
}

export interface AssignedAttachment {
    id: number;
    attachment: Attachment;
    display_order: number;
    is_mandatory: boolean;
    is_preselected: boolean;
}
