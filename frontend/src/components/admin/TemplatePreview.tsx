/**
 * TemplatePreview Component
 *
 * Allows HR users to preview document templates with:
 * - Sample data filling
 * - Real-time preview updates
 * - Print/PDF export
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    useDocumentType,
    useFormFields,
    usePreview,
    type FormField,
} from "@/hooks/useApi";
import {
    Eye,
    FileText,
    Loader2,
    RefreshCw,
    Printer,
    Maximize2,
    Minimize2,
    Wand2,
} from "lucide-react";
import { printSanitizedHtml } from "@/utils/sanitize";

interface TemplatePreviewProps {
    documentTypeId: number;
}

// Sample data generator based on field type
const generateSampleValue = (field: FormField): string => {
    if (field.default_value) return field.default_value;

    switch (field.field_type) {
        case "date":
            return new Date().toISOString().split("T")[0];
        case "number":
            if (field.field_name.toLowerCase().includes("gehalt")) return "55000";
            if (field.field_name.toLowerCase().includes("stunden")) return "40";
            if (field.field_name.toLowerCase().includes("urlaub")) return "30";
            return "0";
        case "email":
            return "max.mustermann@beispiel.de";
        case "checkbox":
            return "true";
        case "select":
            // Try to get first option
            if (field.options) {
                try {
                    const opts = JSON.parse(field.options);
                    if (Array.isArray(opts) && opts.length > 0) {
                        return String(opts[0].value || opts[0]);
                    }
                } catch {
                    // ignore
                }
            }
            return "";
        case "textarea":
            return "Beispieltext für mehrzeilige Eingabe.";
        default:
            // Text field - generate based on name
            if (field.field_name.toLowerCase().includes("vorname")) return "Max";
            if (field.field_name.toLowerCase().includes("nachname")) return "Mustermann";
            if (field.field_name.toLowerCase().includes("strasse") || field.field_name.toLowerCase().includes("straße")) return "Musterstraße 123";
            if (field.field_name.toLowerCase().includes("plz")) return "10115";
            if (field.field_name.toLowerCase().includes("ort") || field.field_name.toLowerCase().includes("stadt")) return "Berlin";
            if (field.field_name.toLowerCase().includes("firma") || field.field_name.toLowerCase().includes("unternehmen")) return "Beispiel GmbH";
            if (field.field_name.toLowerCase().includes("position") || field.field_name.toLowerCase().includes("stelle")) return "Software-Entwickler";
            if (field.field_name.toLowerCase().includes("abteilung")) return "IT";
            if (field.field_name.toLowerCase().includes("telefon")) return "+49 30 12345678";
            return "Beispielwert";
    }
};

export const TemplatePreview = ({ documentTypeId }: TemplatePreviewProps) => {
    const [sampleData, setSampleData] = useState<Record<string, string>>({});
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [previewEnabled, setPreviewEnabled] = useState(false);

    const { data: documentType, isLoading: loadingType } = useDocumentType(documentTypeId);
    const { data: formFields, isLoading: loadingFields } = useFormFields(documentTypeId);

    const {
        data: previewHtml,
        isLoading: loadingPreview,
        refetch: refetchPreview,
    } = usePreview(documentTypeId, sampleData, previewEnabled && Object.keys(sampleData).length > 0);

    // Initialize sample data when fields load
    useEffect(() => {
        if (formFields && formFields.length > 0) {
            const initial: Record<string, string> = {};
            formFields.forEach((field: FormField) => {
                initial[field.field_name] = generateSampleValue(field);
            });
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: initialize sample data when form fields load
            setSampleData(initial);
            setPreviewEnabled(true);
        }
    }, [formFields]);

    // Update a single field
    const updateField = (fieldName: string, value: string) => {
        setSampleData((prev) => ({ ...prev, [fieldName]: value }));
    };

    // Reset to generated samples
    const resetToDefaults = () => {
        if (formFields) {
            const initial: Record<string, string> = {};
            formFields.forEach((field: FormField) => {
                initial[field.field_name] = generateSampleValue(field);
            });
            setSampleData(initial);
        }
    };

    // Group fields by display_group
    const groupedFields = useMemo(() => {
        if (!formFields) return {};

        const groups: Record<string, FormField[]> = {};
        formFields.forEach((field: FormField) => {
            const group = field.display_group || "Allgemein";
            if (!groups[group]) groups[group] = [];
            groups[group].push(field);
        });
        return groups;
    }, [formFields]);

    if (loadingType || loadingFields) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!documentType) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    Dokumenttyp nicht gefunden
                </CardContent>
            </Card>
        );
    }

    return (
        <div className={`space-y-6 ${isFullscreen ? "fixed inset-0 z-50 bg-background p-6 overflow-auto" : ""}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Template-Vorschau
                    </h2>
                    <p className="text-muted-foreground">
                        {documentType.name}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetToDefaults}>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Beispieldaten
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchPreview()}
                        disabled={loadingPreview}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loadingPreview ? "animate-spin" : ""}`} />
                        Aktualisieren
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="w-4 h-4" />
                        ) : (
                            <Maximize2 className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>

            <div className={`grid gap-6 ${isFullscreen ? "grid-cols-3" : "grid-cols-1 lg:grid-cols-2"}`}>
                {/* Sample Data Editor */}
                <Card className={isFullscreen ? "col-span-1 max-h-[calc(100vh-120px)] overflow-y-auto" : ""}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Beispieldaten
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {Object.entries(groupedFields).map(([groupName, fields]) => (
                            <div key={groupName}>
                                <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                                    {groupName}
                                </h4>
                                <div className="space-y-3">
                                    {fields.map((field: FormField) => (
                                        <div key={field.id}>
                                            <Label className="text-xs flex items-center gap-1">
                                                {field.field_label}
                                                {field.is_required && (
                                                    <span className="text-red-500">*</span>
                                                )}
                                            </Label>
                                            {field.field_type === "textarea" ? (
                                                <textarea
                                                    value={sampleData[field.field_name] || ""}
                                                    onChange={(e) => updateField(field.field_name, e.target.value)}
                                                    className="w-full h-20 px-3 py-2 text-sm border border-input rounded-md resize-none"
                                                    placeholder={field.placeholder_text || ""}
                                                />
                                            ) : field.field_type === "checkbox" ? (
                                                <select
                                                    value={sampleData[field.field_name] || ""}
                                                    onChange={(e) => updateField(field.field_name, e.target.value)}
                                                    className="w-full h-9 px-3 text-sm border border-input rounded-md bg-background"
                                                >
                                                    <option value="true">Ja</option>
                                                    <option value="false">Nein</option>
                                                </select>
                                            ) : field.field_type === "select" && field.options ? (
                                                <select
                                                    value={sampleData[field.field_name] || ""}
                                                    onChange={(e) => updateField(field.field_name, e.target.value)}
                                                    className="w-full h-9 px-3 text-sm border border-input rounded-md bg-background"
                                                >
                                                    <option value="">Bitte wählen...</option>
                                                    {(() => {
                                                        try {
                                                            const opts = JSON.parse(field.options || "[]");
                                                            return opts.map((opt: { value: string; label: string } | string, i: number) => (
                                                                <option
                                                                    key={i}
                                                                    value={typeof opt === "string" ? opt : opt.value}
                                                                >
                                                                    {typeof opt === "string" ? opt : opt.label}
                                                                </option>
                                                            ));
                                                        } catch {
                                                            return null;
                                                        }
                                                    })()}
                                                </select>
                                            ) : (
                                                <Input
                                                    type={field.field_type === "date" ? "date" : field.field_type === "number" ? "number" : "text"}
                                                    value={sampleData[field.field_name] || ""}
                                                    onChange={(e) => updateField(field.field_name, e.target.value)}
                                                    placeholder={field.placeholder_text || ""}
                                                    className="h-9"
                                                />
                                            )}
                                            {field.help_text && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {field.help_text}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {Object.keys(groupedFields).length === 0 && (
                            <p className="text-center text-muted-foreground py-4">
                                Keine Formularfelder definiert
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Preview Panel */}
                <Card className={isFullscreen ? "col-span-2" : ""}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                Vorschau
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        // SECURITY: Sichere Print-Funktion mit HTML-Sanitization
                                        if (previewHtml) {
                                            printSanitizedHtml(previewHtml, documentType?.name || "Dokument");
                                        }
                                    }}
                                    disabled={!previewHtml}
                                >
                                    <Printer className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingPreview ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : previewHtml ? (
                            <div
                                className={`border rounded-lg bg-white overflow-auto ${
                                    isFullscreen ? "h-[calc(100vh-200px)]" : "h-[600px]"
                                }`}
                            >
                                <iframe
                                    srcDoc={previewHtml}
                                    className="w-full h-full"
                                    title="Document Preview"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <FileText className="w-12 h-12 mb-4 opacity-50" />
                                <p>Vorschau wird geladen...</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => {
                                        setPreviewEnabled(true);
                                        refetchPreview();
                                    }}
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Vorschau laden
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
