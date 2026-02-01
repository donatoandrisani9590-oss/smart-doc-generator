/**
 * WorkflowStepper - Dokumenten-Lifecycle Anzeige
 *
 * Zeigt dem User visuell, wo er im Prozess steht:
 * 1. Entwurf - Dokumenttyp gewählt, Felder werden ausgefüllt
 * 2. Inhalte - Klauseln/Anlagen konfiguriert
 * 3. Prüfung - Dokument wird überprüft/bearbeitet
 * 4. Export - Bereit zum Export
 *
 * DocuSign-inspiriert: Klare Prozess-Visualisierung
 * v1.0: Initial implementation
 */

import { Check, FileEdit, Layers, Eye, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWizardContext, type FormData as WizardFormData, type DocumentClause } from "./WizardContext";

interface WorkflowStep {
    id: string;
    label: string;
    icon: React.ElementType;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
    { id: "draft", label: "Entwurf", icon: FileEdit },
    { id: "content", label: "Inhalte", icon: Layers },
    { id: "review", label: "Prüfung", icon: Eye },
    { id: "export", label: "Export", icon: Download },
];

/**
 * Berechnet den aktuellen Workflow-Schritt basierend auf dem State
 */
function calculateCurrentStep(state: {
    documentTypeId: number | null;
    formData: WizardFormData;
    documentClauses: DocumentClause[];
    previewHtml: string;
    hasLocalEdits: boolean;
}): number {
    const { documentTypeId, formData, documentClauses, previewHtml, hasLocalEdits } = state;

    // Schritt 0: Entwurf - Dokumenttyp gewählt, Felder werden ausgefüllt
    if (!documentTypeId) return 0;

    // Prüfe ob Pflichtfelder ausgefüllt sind
    const requiredFields: (keyof WizardFormData)[] = ["vorname", "nachname", "position", "gehalt", "eintrittsdatum"];
    const filledFields = requiredFields.filter(
        (field) => formData[field] !== undefined && formData[field] !== ""
    );
    const hasRequiredFields = filledFields.length >= 3; // Mindestens 3 von 5

    // Schritt 1: Inhalte - Klauseln konfiguriert
    const hasEnabledClauses = documentClauses.some((c) => c.is_enabled);

    // Schritt 2: Prüfung - Vorschau generiert, möglicherweise bearbeitet
    const hasPreview = previewHtml && previewHtml.length > 100;

    // Schritt 3: Export - Alle Felder ausgefüllt, bereit zum Export
    const allFieldsFilled = filledFields.length === requiredFields.length;

    // Logik für Schritt-Berechnung
    if (!hasRequiredFields) return 0; // Noch im Entwurf
    if (!hasEnabledClauses && documentClauses.length > 0) return 1; // Inhalte konfigurieren
    if (!hasPreview) return 1; // Noch bei Inhalten
    if (hasLocalEdits || !allFieldsFilled) return 2; // In Prüfung
    return 3; // Export-bereit
}

export const WorkflowStepper = () => {
    const { state } = useWizardContext();

    const currentStep = calculateCurrentStep({
        documentTypeId: state.documentTypeId,
        formData: state.formData,
        documentClauses: state.documentClauses,
        previewHtml: state.previewHtml,
        hasLocalEdits: state.hasLocalEdits,
    });

    return (
        <div className="flex items-center justify-center gap-1 px-4 py-2 bg-background/80 backdrop-blur border-b">
            {WORKFLOW_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                const isPending = index > currentStep;

                return (
                    <div key={step.id} className="flex items-center">
                        {/* Step */}
                        <div
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all",
                                isCompleted && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                isCurrent && "bg-primary/10 text-primary ring-1 ring-primary/20",
                                isPending && "bg-muted/50 text-muted-foreground"
                            )}
                        >
                            {isCompleted ? (
                                <Check className="w-3.5 h-3.5" />
                            ) : (
                                <Icon className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">{step.label}</span>
                        </div>

                        {/* Connector */}
                        {index < WORKFLOW_STEPS.length - 1 && (
                            <div
                                className={cn(
                                    "w-6 h-0.5 mx-1 transition-colors",
                                    index < currentStep ? "bg-green-400" : "bg-muted"
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default WorkflowStepper;
