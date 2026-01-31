/**
 * DocumentCanvas - Mittlere Spalte mit dem Dokument-Editor
 *
 * Smart UX Konzept:
 * - Drop-Zone für Klauseln aus der Bibliothek
 * - Sortierbare Klausel-Blöcke
 * - "Hier klicken für neuen Text" Insertion Points
 */

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence } from "framer-motion";
import { Plus, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ClauseBlock } from "./ClauseBlock";
import type { ClauseInstance } from "./types";

interface DocumentCanvasProps {
    clauses: ClauseInstance[];
    selectedClauseId: number | null;
    onSelectClause: (id: number | null) => void;
    onAddLocalClause: (position?: number) => void;
    onDeleteClause: (id: number) => void;
    onDeviateClause: (id: number) => void;
    documentTypeName?: string;
    isLoading?: boolean;
}

// Insertion Point zwischen Klauseln
const InsertionPoint = ({ onClick }: { onClick: () => void }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={cn(
                "h-8 flex items-center justify-center transition-all",
                isHovered ? "opacity-100" : "opacity-0 hover:opacity-100"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <button
                onClick={onClick}
                className={cn(
                    "flex items-center gap-2 px-3 py-1 rounded-full",
                    "text-xs text-muted-foreground",
                    "hover:bg-primary/10 hover:text-primary",
                    "transition-all cursor-pointer",
                    "border border-dashed border-transparent hover:border-primary/30"
                )}
            >
                <Plus className="w-3 h-3" />
                <span>Hier klicken für neuen Text</span>
            </button>
        </div>
    );
};

export const DocumentCanvas = ({
    clauses,
    selectedClauseId,
    onSelectClause,
    onAddLocalClause,
    onDeleteClause,
    onDeviateClause,
    documentTypeName = "Dokument",
    isLoading = false,
}: DocumentCanvasProps) => {
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deviateConfirmId, setDeviateConfirmId] = useState<number | null>(null);

    const { setNodeRef, isOver } = useDroppable({
        id: "document-canvas",
    });

    const handleDeleteConfirm = () => {
        if (deleteConfirmId !== null) {
            onDeleteClause(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    const handleDeviateConfirm = () => {
        if (deviateConfirmId !== null) {
            onDeviateClause(deviateConfirmId);
            setDeviateConfirmId(null);
        }
    };

    const clauseToDelete = clauses.find((c) => c.id === deleteConfirmId);
    const clauseToDeviate = clauses.find((c) => c.id === deviateConfirmId);

    return (
        <>
            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Klausel entfernen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Möchten Sie die Klausel "{clauseToDelete?.title}" wirklich aus dem Dokument entfernen?
                            {clauseToDelete?.origin === "local" && (
                                <span className="block mt-2 text-amber-600">
                                    <AlertCircle className="w-4 h-4 inline mr-1" />
                                    Diese individuelle Klausel wird unwiderruflich gelöscht.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
                            Entfernen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Deviate Confirmation Dialog */}
            <AlertDialog open={deviateConfirmId !== null} onOpenChange={() => setDeviateConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Standard abwandeln?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Wenn Sie die Klausel "{clauseToDeviate?.title}" anpassen, wird sie von der Bibliothek entkoppelt.
                            <span className="block mt-2">
                                Änderungen am Original wirken sich nicht mehr auf dieses Dokument aus.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeviateConfirm}>
                            Ja, anpassen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Canvas */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b bg-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <h2 className="font-semibold">{documentTypeName}</h2>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{clauses.length} Klauseln</span>
                        <span className="text-border">•</span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {clauses.filter((c) => c.origin === "global").length} Standard
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            {clauses.filter((c) => c.origin !== "global").length} Individuell
                        </span>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div
                    ref={setNodeRef}
                    className={cn(
                        "flex-1 overflow-auto p-6",
                        isOver && "bg-primary/5 ring-2 ring-primary/20 ring-inset"
                    )}
                    onClick={() => onSelectClause(null)}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-muted-foreground">Klauseln werden geladen...</p>
                            </div>
                        </div>
                    ) : clauses.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="py-12 text-center">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FileText className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="font-medium mb-2">Dokument ist leer</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Ziehen Sie Klauseln aus der Bibliothek hierher oder erstellen Sie eine neue.
                                </p>
                                <Button onClick={() => onAddLocalClause()}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Neuen Abschnitt hinzufügen
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-1">
                            <SortableContext items={clauses.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                                <AnimatePresence>
                                    {clauses.map((clause, index) => (
                                        <div key={clause.id}>
                                            {/* Insertion Point vor der Klausel */}
                                            {index === 0 && (
                                                <InsertionPoint onClick={() => onAddLocalClause(0)} />
                                            )}

                                            {/* Klausel-Block */}
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <ClauseBlock
                                                    clause={clause}
                                                    isSelected={selectedClauseId === clause.id}
                                                    onSelect={() => onSelectClause(clause.id)}
                                                    onDelete={() => setDeleteConfirmId(clause.id)}
                                                    onDeviate={
                                                        clause.origin === "global"
                                                            ? () => setDeviateConfirmId(clause.id)
                                                            : undefined
                                                    }
                                                />
                                            </div>

                                            {/* Insertion Point nach der Klausel */}
                                            <InsertionPoint onClick={() => onAddLocalClause(index + 1)} />
                                        </div>
                                    ))}
                                </AnimatePresence>
                            </SortableContext>

                            {/* Final Add Button */}
                            <div className="pt-4">
                                <Button
                                    variant="outline"
                                    className="w-full border-dashed"
                                    onClick={() => onAddLocalClause()}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Neuen Abschnitt hinzufügen
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Drop Zone Indicator */}
                    {isOver && (
                        <div className="fixed inset-x-0 bottom-20 flex justify-center pointer-events-none">
                            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg animate-pulse">
                                Klausel hier ablegen
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
