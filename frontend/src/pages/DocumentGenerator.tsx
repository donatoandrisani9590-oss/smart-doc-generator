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
import { Loader2, AlertTriangle, File, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { DocumentWizard } from "@/components/generator/DocumentWizard";

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

    // No document types available
    if (documentTypes.length === 0) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-140px)]">
                <div className="text-center max-w-md">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-warning" />
                    <h3 className="text-lg font-medium">Keine Dokumenttypen verfügbar</h3>
                    <p className="text-muted-foreground mt-2 mb-6">
                        Um Dokumente zu erstellen, benötigen Sie zuerst eine Dokumentvorlage.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                            onClick={() => window.location.href = '/settings?tab=templates'}
                            className="gap-2"
                        >
                            <File className="w-4 h-4" />
                            Vorlage erstellen
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => window.location.href = '/settings?tab=clauses'}
                            className="gap-2"
                        >
                            <Settings2 className="w-4 h-4" />
                            Textbausteine verwalten
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                        Tipp: Sie können auch eine bestehende Word-Vorlage importieren.
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
