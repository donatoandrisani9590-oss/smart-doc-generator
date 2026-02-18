/**
 * TemplatePreviewPage
 *
 * Admin page for HR to preview document templates with sample data.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentTypes, type DocumentType } from "@/hooks/useApi";
import { TemplatePreview } from "@/components/admin/TemplatePreview";
import { FileText, Loader2, ChevronRight } from "lucide-react";

export const TemplatePreviewPage = () => {
    const [countryCode, setCountryCode] = useState<string>("DE");
    const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);
    const [loadingDocTypeId, setLoadingDocTypeId] = useState<number | null>(null);

    const { data: documentTypes, isLoading } = useDocumentTypes(countryCode);

    // Handle card click with visual feedback (E2E-017 fix)
    const handleDocTypeSelect = (dt: DocumentType) => {
        setLoadingDocTypeId(dt.id);
        // Small delay to show loading state before transition
        setTimeout(() => {
            setSelectedDocType(dt);
            setLoadingDocTypeId(null);
        }, 200);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    Template-Vorschau
                </h1>
                <p className="text-sm text-muted-foreground">
                    Vorschau von Dokumenten mit Beispieldaten
                </p>
            </div>

            {!selectedDocType ? (
                /* Document Type Selection */
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Dokumenttyp auswählen</CardTitle>
                            <select
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                className="h-8 px-2 text-sm border border-input rounded-md bg-background"
                            >
                                <option value="DE">Deutschland</option>
                                <option value="IT">Italien</option>
                            </select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (documentTypes || []).length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Keine Dokumenttypen gefunden</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(documentTypes || []).map((dt: DocumentType) => {
                                    const isLoadingThis = loadingDocTypeId === dt.id;
                                    return (
                                        <div
                                            key={dt.id}
                                            className={`p-4 border rounded-lg cursor-pointer transition-all group ${
                                                isLoadingThis
                                                    ? "border-primary bg-primary/10 scale-[0.98]"
                                                    : "hover:border-primary hover:bg-primary/5"
                                            }`}
                                            onClick={() => !loadingDocTypeId && handleDocTypeSelect(dt)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg transition-colors ${
                                                        isLoadingThis ? "bg-primary/20" : "bg-primary/10"
                                                    }`}>
                                                        {isLoadingThis ? (
                                                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                                        ) : (
                                                            <FileText className="w-5 h-5 text-primary" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{dt.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {dt.category || "Allgemein"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight className={`w-5 h-5 transition-colors ${
                                                    isLoadingThis ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                                                }`} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                /* Template Preview */
                <div className="space-y-4">
                    <button
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                        onClick={() => setSelectedDocType(null)}
                    >
                        ← Zurück zur Auswahl
                    </button>
                    <TemplatePreview documentTypeId={selectedDocType.id} />
                </div>
            )}
        </div>
    );
};
