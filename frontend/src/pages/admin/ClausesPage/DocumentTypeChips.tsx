/**
 * Dokumenttyp-Filter-Chips für die Textbausteine-Verwaltung.
 *
 * Zeigt eine horizontale Chip-Leiste:
 * - "Alle" (kein Filter)
 * - Ein Chip pro Dokumenttyp mit Anzahl der zugeordneten Textbausteine
 * - "Ohne Zuordnung" für nicht zugeordnete Textbausteine
 *
 * Wenn `filteredClauseIds` übergeben wird, zeigen die Counts die Schnittmenge
 * mit den anderen aktiven Filtern (Suche, Kategorie, Status).
 */

import { useMemo } from "react";
import { FileText, FolderOpen, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentTypeClauseMap } from "@/hooks/useApi";

interface DocumentTypeChipsProps {
    docTypeMap: DocumentTypeClauseMap[];
    allClauseIds: number[];
    /** Clause-IDs die alle ANDEREN Filter (außer DocType) erfüllen — für kontextuelle Counts */
    filteredClauseIds?: number[];
    selectedDocTypeId: number | null;
    onSelect: (docTypeId: number | null) => void;
    isLoading: boolean;
}

/** Sentinel-Wert für "Ohne Zuordnung" */
export const UNASSIGNED_FILTER = -1;

export const DocumentTypeChips = ({
    docTypeMap,
    allClauseIds,
    filteredClauseIds,
    selectedDocTypeId,
    onSelect,
    isLoading,
}: DocumentTypeChipsProps) => {
    const { chipCounts, orphanCount, totalCount } = useMemo(() => {
        const baseIds = filteredClauseIds
            ? new Set(filteredClauseIds)
            : null;

        const assignedIds = new Set(docTypeMap.flatMap((dt) => dt.clause_ids));

        // Count pro Dokumenttyp: Schnittmenge mit baseIds (wenn vorhanden)
        const counts: Record<number, number> = {};
        for (const dt of docTypeMap) {
            counts[dt.document_type_id] = baseIds
                ? dt.clause_ids.filter((id) => baseIds.has(id)).length
                : dt.clause_ids.length;
        }

        // Orphan-Count: IDs die keinem DocType zugeordnet sind
        const idsToCheck = baseIds ? filteredClauseIds! : allClauseIds;
        const orphans = idsToCheck.filter((id) => !assignedIds.has(id)).length;

        // Total: Alle IDs die die Basis-Filter erfüllen
        const total = baseIds ? filteredClauseIds!.length : allClauseIds.length;

        return { chipCounts: counts, orphanCount: orphans, totalCount: total };
    }, [docTypeMap, allClauseIds, filteredClauseIds]);

    if (isLoading) {
        return (
            <div className="flex gap-2 overflow-x-auto pb-1">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-9 w-32 rounded-full bg-warm-100 animate-pulse shrink-0"
                    />
                ))}
            </div>
        );
    }

    const chipBase =
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-colors shrink-0 select-none";
    const chipActive = "bg-primary text-white shadow-sm";
    const chipInactive = "bg-warm-100 text-foreground hover:bg-warm-200";

    return (
        <div className="relative">
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
                {/* "Alle" Chip */}
                <button
                    type="button"
                    className={cn(chipBase, selectedDocTypeId === null ? chipActive : chipInactive)}
                    onClick={() => onSelect(null)}
                >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Alle</span>
                    <span className={cn(
                        "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                        selectedDocTypeId === null
                            ? "bg-white/20 text-white"
                            : "bg-warm-200 text-muted-foreground"
                    )}>
                        {totalCount}
                    </span>
                </button>

                {/* Dokumenttyp-Chips */}
                {docTypeMap.map((dt) => {
                    const count = chipCounts[dt.document_type_id] ?? 0;
                    return (
                        <button
                            key={dt.document_type_id}
                            type="button"
                            className={cn(
                                chipBase,
                                selectedDocTypeId === dt.document_type_id ? chipActive : chipInactive,
                                count === 0 && selectedDocTypeId !== dt.document_type_id && "opacity-50"
                            )}
                            onClick={() =>
                                onSelect(
                                    selectedDocTypeId === dt.document_type_id ? null : dt.document_type_id
                                )
                            }
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="whitespace-nowrap">{dt.document_type_name}</span>
                            <span className={cn(
                                "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                                selectedDocTypeId === dt.document_type_id
                                    ? "bg-white/20 text-white"
                                    : "bg-warm-200 text-muted-foreground"
                            )}>
                                {count}
                            </span>
                        </button>
                    );
                })}

                {/* "Ohne Zuordnung" Chip — nur anzeigen wenn es unzugeordnete gibt */}
                {orphanCount > 0 && (
                    <button
                        type="button"
                        className={cn(
                            chipBase,
                            selectedDocTypeId === UNASSIGNED_FILTER ? chipActive : chipInactive
                        )}
                        onClick={() =>
                            onSelect(
                                selectedDocTypeId === UNASSIGNED_FILTER ? null : UNASSIGNED_FILTER
                            )
                        }
                    >
                        <CircleSlash className="w-3.5 h-3.5" />
                        <span className="whitespace-nowrap">Ohne Zuordnung</span>
                        <span className={cn(
                            "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                            selectedDocTypeId === UNASSIGNED_FILTER
                                ? "bg-white/20 text-white"
                                : "bg-warm-200 text-muted-foreground"
                        )}>
                            {orphanCount}
                        </span>
                    </button>
                )}
            </div>
            {/* Gradient-Fade am rechten Rand wenn scrollbar */}
            <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
    );
};
