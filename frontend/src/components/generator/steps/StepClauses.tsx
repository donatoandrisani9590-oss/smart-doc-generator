/**
 * StepClauses - Schritt 4: Textbausteine anpassen
 *
 * Optionaler Schritt zur Anpassung der Textbausteine:
 * - Textbausteine ein/ausschalten
 * - Reihenfolge ändern
 * - Varianten auswählen
 * - Anlagen hinzufügen
 *
 * HINWEIS: Dieser Schritt wird standardmäßig übersprungen.
 * Der Benutzer kann ihn über einen Link in Schritt 3 aktivieren.
 */

import { FileText, ArrowRight, ArrowLeft, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWizardContext, type DocumentClause } from "../WizardContext";
import { ClauseReorderPanel, type DocumentClause as ClauseReorderClause } from "../ClauseReorderPanel";
import { VariantSelector } from "../VariantSelector";
import { AttachmentSelector } from "../AttachmentSelector";

export const StepClauses = () => {
    const { state, actions } = useWizardContext();
    const {
        documentTypeId,
        documentClauses,
        selectedVariants,
        variantGroups,
        selectedAttachmentIds,
    } = state;

    const enabledCount = documentClauses.filter((c) => c.is_enabled).length;
    const totalCount = documentClauses.length;

    // Map our DocumentClause to ClauseReorderPanel format
    const mapToReorderClause = (clause: DocumentClause): ClauseReorderClause => ({
        id: clause.id,
        uniqueId: clause.unique_id,
        title: clause.name,
        content: clause.content, // Fuer Textbaustein-Vorschau im Tooltip
        is_mandatory: clause.is_required,
        is_enabled: clause.is_enabled,
        is_order_locked: false,
        order: clause.order_index,
        clause_type: "standard" as const,
    });

    // Map ClauseReorderPanel clauses back to our format
    const mapFromReorderClause = (
        reorderClause: ClauseReorderClause,
        original: DocumentClause
    ): DocumentClause => ({
        ...original,
        is_enabled: reorderClause.is_enabled,
        order_index: reorderClause.order,
    });

    // Handler für ClauseReorderPanel - onClausesChange wird mit allen Textbausteine aufgerufen
    const handleClausesChange = (reorderedClauses: ClauseReorderClause[]) => {
        const mappedClauses = reorderedClauses.map((rc) => {
            const original = documentClauses.find((dc) => dc.unique_id === rc.uniqueId);
            if (original) {
                return mapFromReorderClause(rc, original);
            }
            // Fallback: create new clause from reorder data
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

    // Handler für Attachment selection change
    const handleAttachmentSelectionChange = (ids: number[]) => {
        // Clear all and set new ones
        const currentIds = [...selectedAttachmentIds];

        // Find added IDs
        const addedIds = ids.filter(id => !currentIds.includes(id));

        // Find removed IDs
        const removedIds = currentIds.filter(id => !ids.includes(id));

        // Toggle each changed ID
        for (const id of addedIds) {
            actions.toggleAttachment(id);
        }
        for (const id of removedIds) {
            actions.toggleAttachment(id);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Textbausteine anpassen</h2>
                <p className="text-muted-foreground">
                    Passen Sie die Vertragsinhalte nach Ihren Wünschen an.
                </p>
            </div>

            {/* Textbausteine */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            Textbausteine
                        </CardTitle>
                        <Badge variant="secondary">
                            {enabledCount} von {totalCount} aktiv
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {documentClauses.length > 0 ? (
                        <ClauseReorderPanel
                            clauses={documentClauses.map(mapToReorderClause)}
                            onClausesChange={handleClausesChange}
                        />
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Keine Textbausteine für diesen Dokumenttyp verfügbar.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Varianten - rendered for each group */}
            {variantGroups.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Varianten auswählen</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {variantGroups.map((group) => (
                            <div key={group.id} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{group.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                        Pflicht
                                    </Badge>
                                </div>
                                <VariantSelector
                                    groupId={group.id}
                                    selectedVariantId={selectedVariants[group.id]?.variantId}
                                    onSelect={(variantId, clauseId) => {
                                        actions.selectVariant(group.id, variantId, clauseId);
                                    }}
                                    compact
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Anlagen */}
            {documentTypeId && (
                <AttachmentSelector
                    documentTypeId={documentTypeId}
                    selectedIds={selectedAttachmentIds}
                    onSelectionChange={handleAttachmentSelectionChange}
                />
            )}

            {/* Navigation */}
            <div className="flex justify-between">
                <Button
                    variant="outline"
                    size="lg"
                    onClick={() => actions.prevStep()}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Zurück
                </Button>
                <Button
                    size="lg"
                    onClick={() => actions.nextStep()}
                    className="gap-2"
                >
                    Zur Vorschau
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default StepClauses;
