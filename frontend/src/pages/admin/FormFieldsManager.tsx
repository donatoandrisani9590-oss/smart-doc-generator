/**
 * FormFieldsManager Page
 *
 * Admin page for managing form fields across document types.
 * Allows HR to customize fields without IT.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
                <h1 className="text-xl font-semibold tracking-tight text-foreground/80">Formularfelder verwalten</h1>
                <p className="text-sm text-muted-foreground">
                    Passe Labels, Validierung und Hilfetexte für Formularfelder an
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Document Type Selection */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base text-foreground/80">Dokumenttyp wählen</CardTitle>
                            <Select value={countryCode} onValueChange={(val) => { setCountryCode(val); setSelectedDocType(null); }}>
                                <SelectTrigger className="h-8 w-20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DE">DE</SelectItem>
                                    <SelectItem value="IT">IT</SelectItem>
                                </SelectContent>
                            </Select>
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
                                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                                            selectedDocType?.id === dt.id
                                                ? "bg-muted/40 shadow-[var(--shadow-elevated)]"
                                                : "hover:bg-muted/20"
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
                                    <p>Wähle einen Dokumenttyp aus der Liste</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};
