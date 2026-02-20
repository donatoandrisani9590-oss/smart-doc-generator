/**
 * WorkflowStepper - Dual-Mode Dokumenten-Lifecycle Anzeige
 *
 * Pre-Export Mode (Formular-Fortschritt):
 *  1. Entwurf - Dokumenttyp gewählt, Felder werden ausgefüllt
 *  2. Inhalte - Textbausteine/Anlagen konfiguriert
 *  3. Prüfung - Dokument wird überprüft/bearbeitet
 *  4. Export - Bereit zum Export
 *
 * Post-Export Mode (Lifecycle-Fortschritt):
 *  Exportiert ✓ → Freigabe → Versendet → Abgeschlossen
 *  Switches when lastExportedDocumentId is set.
 *
 * DocuSign-inspiriert: Klare Prozess-Visualisierung
 * v2.0: Dual-mode (pre-export + post-export lifecycle)
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWizardContext, type FormData as WizardFormData, type DocumentClause } from "./WizardContext";

// ── Step definitions ─────────────────────────────────────────────────────

interface WorkflowStep {
    id: string;
    label: string;
}

const PRE_EXPORT_STEPS: WorkflowStep[] = [
    { id: "setup", label: "1. Setup" },
    { id: "edit", label: "2. Edit" },
    { id: "export", label: "3. Export" },
];

const POST_EXPORT_STEPS: WorkflowStep[] = [
    { id: "exported", label: "Exportiert" },
    { id: "freigabe", label: "Freigabe" },
    { id: "versendet", label: "Versendet" },
    { id: "abgeschlossen", label: "Abgeschlossen" },
];

// ── Pre-export step calculation ──────────────────────────────────────────

function calculatePreExportStep(state: {
    documentTypeId: number | null;
    formData: WizardFormData;
    documentClauses: DocumentClause[];
    previewHtml: string;
    hasLocalEdits: boolean;
}): number {
    const { documentTypeId, formData, documentClauses, previewHtml, hasLocalEdits } = state;

    // Step 0: Setup - Selecting document type and filling initial fields (via Agent or Wizard)
    if (!documentTypeId) return 0;

    const requiredFields: (keyof WizardFormData)[] = ["vorname", "nachname", "position", "gehalt", "eintrittsdatum"];
    const filledFields = requiredFields.filter(
        (field) => formData[field] !== undefined && formData[field] !== ""
    );
    const hasRequiredFields = filledFields.length >= 3;

    // If not basic requirements met, still in Setup
    if (!hasRequiredFields) return 0;

    // Step 2: Export - Ready when all required fields are filled and no un-saved edits exist
    const allFieldsFilled = filledFields.length === requiredFields.length;
    const hasEnabledClauses = documentClauses.some((c) => c.is_enabled);
    const hasPreview = previewHtml && previewHtml.length > 50;

    if (allFieldsFilled && hasPreview && !hasLocalEdits && hasEnabledClauses) {
        return 2; // Export
    }

    // Step 1: Edit - We have required fields, are configuring clauses, and reviewing the preview
    return 1; // Edit
}

// ═══════════════════════════════════════════════════════════════════════════

interface WorkflowStepperProps {
    /** Compact mode: inline, no border/background — for embedding in toolbar */
    compact?: boolean;
}

export const WorkflowStepper = ({ compact = false }: WorkflowStepperProps) => {
    const { state } = useWizardContext();

    const isPostExport = !!state.lastExportedDocumentId;

    // Determine which steps and current position to show
    const steps = isPostExport ? POST_EXPORT_STEPS : PRE_EXPORT_STEPS;

    // Post-export: step 0 ("Exportiert") is completed, current is step 1 ("Freigabe")
    // This gives a clear visual cue that export is done and lifecycle actions are next.
    const currentStep = isPostExport
        ? 1
        : calculatePreExportStep({
            documentTypeId: state.documentTypeId,
            formData: state.formData,
            documentClauses: state.documentClauses,
            previewHtml: state.previewHtml,
            hasLocalEdits: state.hasLocalEdits,
        });

    return (
        <div className={cn(
            compact ? "ive-pill-tabs" : "ive-pill-tabs mx-auto"
        )}>
            {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                    <div
                        key={step.id}
                        className={cn(
                            "ive-pill-tab flex items-center gap-1",
                            isCurrent && "ive-pill-tab-active",
                            isCompleted && "text-green-600/70 dark:text-green-400/70"
                        )}
                    >
                        {isCompleted && <Check className="w-3 h-3" />}
                        <span>{step.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default WorkflowStepper;
