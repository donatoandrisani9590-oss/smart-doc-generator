/**
 * ClauseSelectionSection - Textbaustein-Auswahl für den Split-Screen Editor
 *
 * Zeigt eine Liste von Textbausteine mit Checkboxen zum Ein-/Ausschalten.
 * Ein "Feineinstellung" Button öffnet das detaillierte ClauseReorderPanel.
 */

import { useState } from "react";
import { Settings2, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useWizardContext, type DocumentClause } from "../WizardContext";
import { ClauseReorderPanel, type DocumentClause as ReorderClause } from "../ClauseReorderPanel";

export const ClauseSelectionSection = () => {
    const { state, actions } = useWizardContext();
    const { documentClauses } = state;
    const [finetuneOpen, setFinetuneOpen] = useState(false);

    // Toggle clause handler
    const handleToggle = (uniqueId: string, isRequired: boolean) => {
        if (isRequired) return; // Can't toggle required clauses
        actions.toggleClause(uniqueId);
    };

    // Map for ClauseReorderPanel
    const mapToReorderClause = (clause: DocumentClause): ReorderClause => ({
        id: clause.id,
        uniqueId: clause.unique_id,
        title: clause.name,
        is_mandatory: clause.is_required,
        is_enabled: clause.is_enabled,
        is_order_locked: false,
        order: clause.order_index,
        clause_type: "standard" as const,
    });

    const mapFromReorderClause = (
        reorderClause: ReorderClause,
        original: DocumentClause
    ): DocumentClause => ({
        ...original,
        is_enabled: reorderClause.is_enabled,
        order_index: reorderClause.order,
    });

    const handleClausesChange = (reorderedClauses: ReorderClause[]) => {
        const mappedClauses = reorderedClauses.map((rc) => {
            const original = documentClauses.find((dc) => dc.unique_id === rc.uniqueId);
            if (original) {
                return mapFromReorderClause(rc, original);
            }
            return {
                id: rc.id,
                unique_id: rc.uniqueId,
                name: rc.title,
                content: "",
                is_required: rc.is_mandatory,
                is_enabled: rc.is_enabled,
                order_index: rc.order,
                has_variants: false,
            };
        });
        actions.reorderClauses(mappedClauses);
    };

    if (documentClauses.length === 0) {
        return (
            <div className="p-3 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
                Keine Textbausteine für diesen Dokumenttyp verfügbar.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Clause list */}
            <div className="p-3 bg-background rounded-lg border space-y-2 max-h-64 overflow-y-auto">
                {documentClauses.map((clause) => (
                    <div
                        key={clause.unique_id}
                        className={`flex items-center justify-between p-2 rounded-md transition-colors ${
                            clause.is_enabled ? "bg-primary/5" : "bg-muted/30 opacity-60"
                        }`}
                    >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <Checkbox
                                id={`clause-${clause.unique_id}`}
                                checked={clause.is_enabled}
                                onCheckedChange={() => handleToggle(clause.unique_id, clause.is_required)}
                                disabled={clause.is_required}
                            />
                            <Label
                                htmlFor={`clause-${clause.unique_id}`}
                                className={`text-sm cursor-pointer truncate ${
                                    clause.is_required ? "cursor-not-allowed" : ""
                                }`}
                            >
                                {clause.name}
                            </Label>
                        </div>
                        {clause.is_required && (
                            <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                                <Lock className="w-3 h-3" />
                                Pflicht
                            </Badge>
                        )}
                    </div>
                ))}
            </div>

            {/* Fine-tuning button */}
            <Dialog open={finetuneOpen} onOpenChange={setFinetuneOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                        <Settings2 className="w-4 h-4" />
                        Reihenfolge anpassen...
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>Textbausteine anpassen</DialogTitle>
                    </DialogHeader>
                    <div className="overflow-y-auto max-h-[60vh]">
                        <ClauseReorderPanel
                            clauses={documentClauses.map(mapToReorderClause)}
                            onClausesChange={handleClausesChange}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ClauseSelectionSection;
