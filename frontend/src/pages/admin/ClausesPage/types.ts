/**
 * Shared types for the ClausesPage module
 */

import type { Clause } from "@/hooks/useApi";

export interface VersionHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clause: Clause | null;
}

export interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clause: Clause | null;
    onConfirm: () => void;
    isDeleting: boolean;
    usageCount?: number;
    usedInTypes?: string[];
}

export interface ClausePreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clause: Clause | null;
}
