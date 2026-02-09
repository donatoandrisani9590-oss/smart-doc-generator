/**
 * DocumentTypeSelector - Initial document type selection view
 *
 * Shown when no draft exists yet. Allows:
 * - Selecting a document type
 * - Choosing variant groups (v4.2 Feature)
 * - Creating a new draft
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, GitBranch, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import type { ComposerDraft } from "@/components/composer/types";
import type { DocumentTypeResponse, VariantGroupForDraft } from "./types";

interface DocumentTypeSelectorProps {
    documentTypes: DocumentTypeResponse[];
    selectedDocTypeId: number | null;
    setSelectedDocTypeId: (id: number | null) => void;
    variantGroups: VariantGroupForDraft[];
    selectedVariants: Record<number, number>;
    setSelectedVariants: React.Dispatch<React.SetStateAction<Record<number, number>>>;
    isLoadingVariants: boolean;
    isLoadingDraft: boolean;
    setIsLoadingDraft: (loading: boolean) => void;
    setDraft: (draft: ComposerDraft) => void;
    setDraftId: (id: number) => void;
}

export const DocumentTypeSelector = ({
    documentTypes,
    selectedDocTypeId,
    setSelectedDocTypeId,
    variantGroups,
    selectedVariants,
    setSelectedVariants,
    isLoadingVariants,
    isLoadingDraft,
    setIsLoadingDraft,
    setDraft,
    setDraftId,
}: DocumentTypeSelectorProps) => {
    const navigate = useNavigate();
    const toast = useToast();

    const [expandedVariantPreviews, setExpandedVariantPreviews] = useState<Record<number, boolean>>({});

    const handleCreateDraft = async () => {
        if (!selectedDocTypeId) return;

        // Validate mandatory variant groups
        const missingMandatory = variantGroups.filter(
            vg => vg.is_mandatory && !selectedVariants[vg.variant_group_id]
        );
        if (missingMandatory.length > 0) {
            toast.error(
                "Auswahl erforderlich",
                `Bitte wählen Sie eine Variante für: ${missingMandatory.map(vg => vg.variant_group_name).join(", ")}`
            );
            return;
        }

        setIsLoadingDraft(true);
        try {
            const response = await api.post<ComposerDraft>("/api/v1/composer/drafts", {
                document_type_id: selectedDocTypeId,
                country_code: "DE",
                // Pass selected variants (v4.2 Feature)
                selected_variants: Object.entries(selectedVariants).map(([groupId, variantId]) => ({
                    variant_group_id: parseInt(groupId),
                    variant_id: variantId,
                })),
            });

            setDraft(response.data);
            setDraftId(response.data.id);
            navigate(`/composer/${response.data.id}`);

            toast.success("Entwurf erstellt", "Sie können jetzt mit der Bearbeitung beginnen");
        } catch (error) {
            logError("Failed to create draft", { error });
            toast.error("Fehler", "Entwurf konnte nicht erstellt werden");
        } finally {
            setIsLoadingDraft(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-[calc(100vh-140px)]">
            <div className="text-center max-w-lg">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Neues Dokument erstellen</h1>
                <p className="text-muted-foreground mb-6">
                    Wählen Sie einen Dokumenttyp, um mit der Erstellung zu beginnen.
                </p>

                <div className="space-y-4">
                    <Select
                        value={selectedDocTypeId?.toString() ?? ""}
                        onValueChange={(v) => setSelectedDocTypeId(parseInt(v, 10))}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Dokumenttyp wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {documentTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id.toString()}>
                                    {type.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Varianten-Gruppen Auswahl (v4.2 Feature - UX-verbessert) */}
                    {isLoadingVariants && (
                        <div className="flex items-center justify-center py-4 text-muted-foreground">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Lade Varianten...
                        </div>
                    )}

                    {!isLoadingVariants && variantGroups.length > 0 && (
                        <div className="text-left space-y-4">
                            {/* Section Header */}
                            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-t-lg border border-b-0 border-purple-200">
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                    <span className="text-sm font-bold text-purple-700">2</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-purple-800 font-medium">
                                        <GitBranch className="w-4 h-4" />
                                        Varianten auswählen
                                    </div>
                                    <p className="text-xs text-purple-600">
                                        Wählen Sie für jeden Bereich die passende Variante
                                    </p>
                                </div>
                            </div>

                            {/* Variant Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-purple-50/50 rounded-b-lg border border-t-0 border-purple-200">
                                {variantGroups.map((vg) => (
                                    <div
                                        key={vg.variant_group_id}
                                        className="bg-white rounded-lg border border-purple-200 overflow-hidden"
                                    >
                                        {/* Card Header */}
                                        <div className="p-3 border-b border-purple-100 bg-purple-50/50">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-sm text-foreground">
                                                    {vg.variant_group_name}
                                                </span>
                                                {vg.is_mandatory && (
                                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                                                        Pflicht
                                                    </span>
                                                )}
                                            </div>
                                            {vg.variant_group_description && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {vg.variant_group_description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Radio Options */}
                                        <div className="p-3">
                                            <RadioGroup
                                                value={selectedVariants[vg.variant_group_id]?.toString() ?? ""}
                                                onValueChange={(v) =>
                                                    setSelectedVariants(prev => ({
                                                        ...prev,
                                                        [vg.variant_group_id]: parseInt(v, 10),
                                                    }))
                                                }
                                                className="space-y-2"
                                            >
                                                {vg.variants.map((variant) => (
                                                    <div
                                                        key={variant.id}
                                                        className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${selectedVariants[vg.variant_group_id] === variant.id
                                                            ? "bg-purple-50 border border-purple-200"
                                                            : "hover:bg-warm-50"
                                                            }`}
                                                    >
                                                        <RadioGroupItem
                                                            value={variant.id.toString()}
                                                            id={`variant-${variant.id}`}
                                                            className="text-purple-600"
                                                        />
                                                        <Label
                                                            htmlFor={`variant-${variant.id}`}
                                                            className="flex-1 cursor-pointer text-sm"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {variant.variant_code && (
                                                                    <span className="font-mono text-xs bg-warm-100 px-1.5 py-0.5 rounded">
                                                                        {variant.variant_code}
                                                                    </span>
                                                                )}
                                                                <span>{variant.variant_name}</span>
                                                                {variant.is_default && (
                                                                    <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                                                                        Standard
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </div>

                                        {/* Preview Collapsible */}
                                        <Collapsible
                                            open={expandedVariantPreviews[vg.variant_group_id]}
                                            onOpenChange={(open) =>
                                                setExpandedVariantPreviews(prev => ({
                                                    ...prev,
                                                    [vg.variant_group_id]: open,
                                                }))
                                            }
                                        >
                                            <CollapsibleTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="w-full flex items-center justify-center gap-1 p-2 border-t text-xs text-purple-600 hover:bg-purple-50 transition-colors"
                                                >
                                                    {expandedVariantPreviews[vg.variant_group_id] ? (
                                                        <>
                                                            <ChevronUp className="w-3 h-3" />
                                                            Vorschau ausblenden
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown className="w-3 h-3" />
                                                            Vorschau anzeigen
                                                        </>
                                                    )}
                                                </button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div className="p-3 bg-warm-50 border-t text-xs text-muted-foreground">
                                                    <p className="italic">
                                                        Ausgewählte Variante: <strong>{
                                                            vg.variants.find(v => v.id === selectedVariants[vg.variant_group_id])?.variant_name || "Keine"
                                                        }</strong>
                                                    </p>
                                                    <p className="mt-2 text-muted-foreground">
                                                        Der Textbaustein mit dieser Variante wird in Ihr Dokument eingefügt.
                                                    </p>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Button
                        className="w-full"
                        onClick={handleCreateDraft}
                        disabled={!selectedDocTypeId || isLoadingDraft || isLoadingVariants}
                    >
                        {isLoadingDraft ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <FileText className="w-4 h-4 mr-2" />
                        )}
                        Dokument erstellen
                    </Button>
                </div>
            </div>
        </div>
    );
};
