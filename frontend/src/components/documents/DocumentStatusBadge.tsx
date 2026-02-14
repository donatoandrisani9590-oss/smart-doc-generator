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
        className: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    },
    ready: {
        label: "Bereit",
        icon: CheckCircle,
        className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    },
    exported: {
        label: "Exportiert",
        icon: Download,
        className: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
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
