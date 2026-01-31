/**
 * FormFieldsManager Page
 *
 * Admin page for managing form fields across document types.
 * Allows HR to customize fields without IT.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentTypes, type DocumentType } from "@/hooks/useApi";
import { FormFieldEditor } from "@/components/admin/FormFieldEditor";
import { FileText, Loader2, ChevronRight } from "lucide-react";

export const FormFieldsManager = () => {
    const [countryCode, setCountryCode] = useState<string>("DE");
    const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);

    const { data: documentTypes, isLoading } = useDocumentTypes(countryCode);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Formularfelder verwalten</h1>
                <p className="text-muted-foreground">
                    Passen Sie Labels, Validierung und Hilfetexte für Formularfelder an
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Document Type Selection */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base">Dokumenttyp wählen</CardTitle>
                            <select
                                value={countryCode}
                                onChange={(e) => {
                                    setCountryCode(e.target.value);
                                    setSelectedDocType(null);
                                }}
                                className="h-8 px-2 text-sm border border-input rounded-md bg-background"
                            >
                                <option value="DE">DE</option>
                                <option value="IT">IT</option>
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
                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Keine Dokumenttypen</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {(documentTypes || []).map((dt: DocumentType) => (
                                    <div
                                        key={dt.id}
                                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                                            selectedDocType?.id === dt.id
                                                ? "bg-primary/10 border border-primary"
                                                : "hover:bg-muted/50"
                                        }`}
                                        onClick={() => setSelectedDocType(dt)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium text-sm">{dt.name}</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Field Editor */}
                <div className="lg:col-span-2">
                    {selectedDocType ? (
                        <FormFieldEditor
                            documentTypeId={selectedDocType.id}
                            documentTypeName={selectedDocType.name}
                        />
                    ) : (
                        <Card>
                            <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
                                <div className="text-center">
                                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Wählen Sie einen Dokumenttyp aus der Liste</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};
