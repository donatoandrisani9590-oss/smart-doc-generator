/**
 * DocumentStatusBadge - Visueller Lifecycle-Status für Dokumente
 *
 * Zeigt farbig kodierten Status:
 * - "Entwurf" (gelb) - Dokument in Bearbeitung
 * - "Bereit" (grün) - Alle Pflichtfelder ausgefüllt
 * - "Exportiert" (blau) - Dokument wurde exportiert
 *
 * DocuSign-inspiriert: Klare Status-Kommunikation
 * v1.0: Initial implementation
 */

import { FileEdit, CheckCircle, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DocumentStatus = "draft" | "ready" | "exported";

interface DocumentStatusBadgeProps {
    status: DocumentStatus;
    className?: string;
    showIcon?: boolean;
    size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
    DocumentStatus,
    {
        label: string;
        icon: React.ElementType;
        className: string;
    }
> = {
    draft: {
        label: "Entwurf",
        icon: FileEdit,
        className: "bg-muted/40 text-muted-foreground/60 border-border/30 hover:bg-muted/50 dark:bg-muted/30 dark:text-muted-foreground/50 dark:border-border/20",
    },
    ready: {
        label: "Bereit",
        icon: CheckCircle,
        className: "bg-green-50/60 text-green-700/70 border-green-200/40 hover:bg-green-50/80 dark:bg-green-900/20 dark:text-green-400/60 dark:border-green-800/30",
    },
    exported: {
        label: "Exportiert",
        icon: Download,
        className: "bg-blue-50/60 text-blue-700/70 border-blue-200/40 hover:bg-blue-50/80 dark:bg-blue-900/20 dark:text-blue-400/60 dark:border-blue-800/30",
    },
};

export const DocumentStatusBadge = ({
    status,
    className,
    showIcon = true,
    size = "md",
}: DocumentStatusBadgeProps) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "font-medium",
                config.className,
                size === "sm" && "text-xs px-1.5 py-0.5",
                size === "md" && "text-xs px-2 py-1",
                className
            )}
        >
            {showIcon && (
                <Icon className={cn("mr-1", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")} />
            )}
            {config.label}
        </Badge>
    );
};

/**
 * Hook um den Dokumentstatus zu berechnen
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDocumentStatus(state: {
    documentTypeId: number | null;
    formData: {
        vorname?: string;
        nachname?: string;
        position?: string;
        gehalt?: string;
        eintrittsdatum?: string;
    };
    documentTitle: string;
    hasExported?: boolean;
}): DocumentStatus {
    const { documentTypeId, formData, documentTitle, hasExported } = state;

    // Exportiert hat Priorität
    if (hasExported) return "exported";

    // Prüfe ob alle Pflichtfelder ausgefüllt sind
    const requiredFields = ["vorname", "nachname", "position", "gehalt", "eintrittsdatum"] as const;
    const allFieldsFilled = requiredFields.every(
        (field) => formData[field] !== undefined && formData[field] !== ""
    );

    const hasTitleAndType = documentTitle.trim() !== "" && documentTypeId !== null;

    if (allFieldsFilled && hasTitleAndType) {
        return "ready";
    }

    return "draft";
}

export default DocumentStatusBadge;
