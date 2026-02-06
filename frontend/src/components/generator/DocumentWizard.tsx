/**
 * DocumentWizard - Orchestrator für den Document Generator
 *
 * Neuer Workflow (Microsoft Word / Apple Pages Style):
 * - Schritt 1: Dokumenttyp + Titel wählen
 * - Dann: Split-Screen Editor mit Live-Preview
 *
 * Der Split-Screen zeigt:
 * - Links (40%): Formularfelder, Klauseln, Export-Buttons
 * - Rechts (60%): Live WYSIWYG Editor (TinyMCE)
 */

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { WizardProvider } from "./WizardContext";
import { useDocumentWizard } from "@/hooks/useDocumentWizard";
import { StepDocumentType } from "./steps/StepDocumentType";
import { SplitScreenEditor } from "./SplitScreenEditor";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface DocumentType {
    id: number;
    name: string;
    country_code?: string;
    category?: string;
}

interface DocumentWizardProps {
    documentTypes: DocumentType[];
}

// ══════════════════════════════════════════════════════════════════════════════
// WIZARD CONTENT COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

const WizardContent = ({ documentTypes }: DocumentWizardProps) => {
    const [searchParams] = useSearchParams();
    const draftId = searchParams.get("draft");
    const typeIdParam = searchParams.get("type");

    const wizardContext = useDocumentWizard(draftId ? parseInt(draftId, 10) : undefined);
    const { state, actions } = wizardContext;

    // Auto-select document type from ?type=X query parameter
    useEffect(() => {
        if (typeIdParam && !state.documentTypeId && !draftId) {
            const typeId = parseInt(typeIdParam, 10);
            if (!isNaN(typeId) && typeId > 0) {
                actions.setDocumentType(typeId);
            }
        }
    }, [typeIdParam, state.documentTypeId, draftId, actions]);

    // Loading state
    if (state.isLoading && !state.documentTypeId) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Lade Dokumenttypen...</p>
                </div>
            </div>
        );
    }

    // Determine what to render based on mode
    const renderContent = () => {
        // Split-Screen Mode: Nur wenn explizit aktiviert
        if (state.mode === "split-screen") {
            return <SplitScreenEditor documentTypes={documentTypes} />;
        }

        // Wizard Mode (Standard): Dokumenttyp-Auswahl
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <StepDocumentType documentTypes={documentTypes} />
            </div>
        );
    };

    return (
        <WizardProvider value={wizardContext}>
            {renderContent()}
        </WizardProvider>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export const DocumentWizard = ({ documentTypes }: DocumentWizardProps) => {
    return <WizardContent documentTypes={documentTypes} />;
};

export default DocumentWizard;
