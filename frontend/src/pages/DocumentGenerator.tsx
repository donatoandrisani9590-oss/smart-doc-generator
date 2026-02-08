/**
 * DocumentGenerator - UX-Refactoring: Wizard-basierter Document Generator
 *
 * Diese Seite verwendet jetzt einen schrittweisen Wizard-Ansatz:
 * - Schritt 1: Dokumenttyp und Titel wählen
 * - Schritt 2: Mitarbeiterdaten eingeben
 * - Schritt 3: Vertragsdetails eingeben
 * - Schritt 4: Klauseln anpassen (optional, standardmäßig übersprungen)
 * - Schritt 5: Vorschau und Export
 *
 * Der Split-Screen Editor-Modus ist optional verfügbar.
 */

import { useState, useEffect } from "react";
import { Loader2, Rocket } from "lucide-react";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { DocumentWizard } from "@/components/generator/DocumentWizard";
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";

// Types für API-Responses
interface DocumentTypeResponse {
    id: number;
    name: string;
    country_code: string;
    category?: string;
    is_active: boolean;
}

export const DocumentGenerator = () => {
    const toast = useToast();
    const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load document types on mount
    useEffect(() => {
        const loadDocumentTypes = async () => {
            setIsLoading(true);
            try {
                const response = await api.get<DocumentTypeResponse[]>("/api/v1/document-types/");
                const activeTypes = response.data.filter(t => t.is_active);
                setDocumentTypes(activeTypes);
            } catch (error) {
                logError("Failed to load document types", { error });
                toast.error("Fehler", "Dokumenttypen konnten nicht geladen werden");
            } finally {
                setIsLoading(false);
            }
        };
        loadDocumentTypes();
    }, [toast]);

    // Loading State
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-140px)]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Dokumenttypen werden geladen...</p>
                </div>
            </div>
        );
    }

    // No document types available - show onboarding guide
    if (documentTypes.length === 0) {
        return (
            <div className="max-w-2xl mx-auto py-12 space-y-8">
                <div className="text-center">
                    <Rocket className="w-12 h-12 mx-auto mb-4 text-primary/50" />
                    <h3 className="text-lg font-semibold">Willkommen beim Dokumenten-Generator</h3>
                    <p className="text-muted-foreground mt-2">
                        Bevor Sie Ihr erstes Dokument erstellen können, müssen einige Einstellungen vorgenommen werden.
                        Folgen Sie den Schritten unten, um loszulegen.
                    </p>
                </div>

                <OnboardingBanner
                    clauseCount={0}
                    documentTypeCount={0}
                    hasCompanyData={false}
                    hasLogo={false}
                />

                <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                        Tipp: Sie können auch eine bestehende Word-Vorlage unter Einstellungen &gt; Textbausteine &gt; Word importieren hochladen.
                    </p>
                </div>
            </div>
        );
    }

    // Render the wizard
    return (
        <DocumentWizard
            documentTypes={documentTypes.map(t => ({
                id: t.id,
                name: t.name,
                country_code: t.country_code,
                category: t.category,
            }))}
        />
    );
};

export default DocumentGenerator;
