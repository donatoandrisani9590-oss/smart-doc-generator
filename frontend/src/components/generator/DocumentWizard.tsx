/**
 * DocumentWizard - Orchestrator für den Document Generator
 *
 * Neuer Workflow (Microsoft Word / Apple Pages Style):
 * - Schritt 1: Dokumenttyp + Titel wählen
 * - Dann: Split-Screen Editor mit Live-Preview
 *
 * Der Split-Screen zeigt:
 * - Links (40%): Formularfelder, Textbausteine, Export-Buttons
 * - Rechts (60%): Live WYSIWYG Editor (TinyMCE)
 */

import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { WizardProvider } from "./WizardContext";
import { useDocumentWizard } from "@/hooks/useDocumentWizard";
import { StepDocumentType } from "./steps/StepDocumentType";
import { SplitScreenEditor } from "./SplitScreenEditor";

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Map common AI field names (from intent parser) to form field names */
function mapAIFieldToFormField(key: string): string {
    const mapping: Record<string, string> = {
        first_name: "vorname",
        last_name: "nachname",
        full_name: "nachname", // Will be split later
        salary: "gehalt",
        start_date: "eintrittsdatum",
        working_hours: "wochenstunden",
        vacation_days: "urlaubstage",
        probation_months: "probezeit",
        street: "strasse",
        postal_code: "plz",
        city: "ort",
        birth_date: "geburtsdatum",
    };
    return mapping[key] || key;
}

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
    const dataParam = searchParams.get("data");

    const wizardContext = useDocumentWizard(draftId ? parseInt(draftId, 10) : undefined);
    const { state, actions } = wizardContext;
    const dataAppliedRef = useRef(false);

    // Warn user before leaving with unsaved changes
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (state.hasUnsavedChanges) {
                e.preventDefault();
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [state.hasUnsavedChanges]);

    // Auto-select document type from ?type=X query parameter
    // Supports both numeric IDs and document type names (from SmartChatInput)
    useEffect(() => {
        if (typeIdParam && !state.documentTypeId && !draftId) {
            let resolvedId: number | null = null;
            const typeId = parseInt(typeIdParam, 10);

            if (!isNaN(typeId) && typeId > 0) {
                // Numeric ID - use directly
                resolvedId = typeId;
            } else {
                // String name - resolve to ID by matching against available types
                const searchName = typeIdParam.toLowerCase();
                const matched = documentTypes.find(
                    (t) =>
                        t.name.toLowerCase() === searchName ||
                        t.name.toLowerCase().includes(searchName) ||
                        searchName.includes(t.name.toLowerCase())
                );
                if (matched) {
                    resolvedId = matched.id;
                }
            }

            if (resolvedId) {
                actions.setDocumentType(resolvedId);
                // If no data param, still enter split-screen since user already chose type
                if (!dataParam) {
                    actions.enterSplitScreenMode();
                }
            }
        }
    }, [typeIdParam, state.documentTypeId, draftId, actions, documentTypes, dataParam]);

    // Apply initial data from ?data= query parameter (from SmartChatInput AI extraction)
    useEffect(() => {
        if (dataParam && state.documentTypeId && !draftId && !dataAppliedRef.current) {
            dataAppliedRef.current = true;
            try {
                const initialData = JSON.parse(dataParam);
                if (initialData && typeof initialData === "object") {
                    // Known FormData fields
                    const knownFields = [
                        "vorname", "nachname", "strasse", "plz", "ort", "geburtsdatum",
                        "position", "gehalt", "eintrittsdatum", "wochenstunden", "probezeit",
                        "urlaubstage", "firmenwagen", "homeoffice", "signatory_name",
                        "entgeltgruppe", "kuendigungsfrist", "au_frist",
                        "jahressonderzahlung", "urlaubsgeld_pro_tag", "vwl_betrag",
                        "schichtzuschlaege", "arbeitszeitkonto", "vertragsstrafe",
                    ];

                    const formDataFields: Record<string, unknown> = {};
                    for (const [key, value] of Object.entries(initialData)) {
                        // Map common AI field names to form field names
                        const mappedKey = mapAIFieldToFormField(key);
                        // Transform probezeit: number (e.g. 3) → Select string ("3 Monate")
                        let transformedValue = value;
                        if (mappedKey === "probezeit" && typeof value === "number") {
                            transformedValue = value === 0 ? "Keine" : `${value} Monate`;
                        }
                        if (knownFields.includes(mappedKey)) {
                            formDataFields[mappedKey] = transformedValue;
                        } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                            actions.updateDynamicField(mappedKey, value);
                        }
                    }

                    if (Object.keys(formDataFields).length > 0) {
                        actions.setFormData(formDataFields as Partial<import("./WizardContext").FormData>);
                    }

                    // Auto-generate title from data
                    const name = [initialData.vorname || initialData.first_name, initialData.nachname || initialData.last_name]
                        .filter(Boolean)
                        .join(" ");
                    const typeName = documentTypes.find((t) => t.id === state.documentTypeId)?.name;
                    if (name && typeName) {
                        actions.setDocumentTitle(`${typeName} - ${name}`);
                    }

                    // Enter split-screen mode since we have data
                    actions.enterSplitScreenMode();
                }
            } catch {
                // Ignore invalid JSON in data param
            }
        }
    }, [dataParam, state.documentTypeId, draftId, actions, documentTypes]);

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
