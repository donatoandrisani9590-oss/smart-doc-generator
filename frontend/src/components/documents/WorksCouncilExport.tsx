/**
 * WorksCouncilExport - Betriebsrat-Mitteilungen generieren
 *
 * v4.2 Feature (Kapitel 15.4.6):
 * - Aus bestehendem Vertrag BR-Mitteilung generieren
 * - Nur §99 BetrVG relevante Daten exportieren
 * - Template-Auswahl und Vorschau
 */

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Users,
    FileText,
    Shield,
    Download,
    Eye,
    Check,
    AlertCircle,
    Loader2,
    Send,
} from "lucide-react";

interface BRTemplate {
    id: number;
    name: string;
    template_type: string;
    included_fields?: string[];
}

interface FormData {
    [key: string]: string | number | boolean | undefined;
}

interface WorksCouncilExportProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentId?: number;
    formData: FormData;
    documentType?: string;
}

// Felder die NIE an den BR gehen dürfen
const SENSITIVE_FIELDS = [
    "salary",
    "gehalt",
    "bruttolohn",
    "nettolohn",
    "bank_account",
    "iban",
    "bic",
    "social_security",
    "sozialversicherungsnummer",
    "tax_id",
    "steuer_id",
    "private_email",
    "private_phone",
    "emergency_contact",
    "health_insurance",
    "krankenkasse",
];

// Standard BR-relevante Felder (§99 BetrVG)
const BR_RELEVANT_FIELDS: Record<string, string> = {
    employee_name: "Name des Mitarbeiters",
    mitarbeiter_name: "Name des Mitarbeiters",
    job_title: "Stellenbezeichnung",
    position: "Position",
    stelle: "Stellenbezeichnung",
    department: "Abteilung",
    abteilung: "Abteilung",
    start_date: "Eintrittsdatum",
    eintrittsdatum: "Eintrittsdatum",
    working_hours: "Wöchentliche Arbeitszeit",
    arbeitszeit: "Wöchentliche Arbeitszeit",
    wochenstunden: "Wochenstunden",
    employment_type: "Beschäftigungsart",
    beschaeftigungsart: "Beschäftigungsart",
    contract_type: "Vertragsart",
    vertragsart: "Vertragsart",
    salary_group: "Eingruppierung",
    eingruppierung: "Eingruppierung",
    tarifgruppe: "Tarifgruppe",
    workplace: "Arbeitsort",
    arbeitsort: "Arbeitsort",
    supervisor: "Vorgesetzter",
    vorgesetzter: "Vorgesetzter",
};

export function WorksCouncilExport({
    open,
    onOpenChange,
    documentId,
    formData,
    documentType: _documentType,
}: WorksCouncilExportProps) {
    const [templates, setTemplates] = useState<BRTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string>("");
    const [generatedId, setGeneratedId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState("select");

    // Templates laden
    useEffect(() => {
        if (open) {
            loadTemplates();
        }
    }, [open]);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const response = await apiFetch("/api/v1/works-council/templates?template_type=einstellung");
            if (response.ok) {
                const data = await response.json();
                setTemplates(data);
                if (data.length > 0) {
                    setSelectedTemplate(String(data[0].id));
                }
            }
        } catch (error) {
            console.error("Failed to load templates:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // BR-relevante Daten aus formData extrahieren
    const extractBRData = (): Record<string, string> => {
        const brData: Record<string, string> = {};

        for (const [key, value] of Object.entries(formData)) {
            const keyLower = key.toLowerCase();

            // Sensitive Daten ausschließen
            if (SENSITIVE_FIELDS.some((f) => keyLower.includes(f))) {
                continue;
            }

            // Nur BR-relevante Felder einbeziehen
            const label = BR_RELEVANT_FIELDS[keyLower] || BR_RELEVANT_FIELDS[key];
            if (label && value !== undefined && value !== "") {
                brData[key] = String(value);
            }
        }

        return brData;
    };

    const brData = extractBRData();
    const employeeName = formData.employee_name || formData.mitarbeiter_name || "Unbekannt";

    // Vorschau generieren
    const generatePreview = async () => {
        setIsLoading(true);
        try {
            const response = await apiFetch("/api/v1/works-council/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    template_id: selectedTemplate ? parseInt(selectedTemplate) : undefined,
                    document_id: documentId,
                    employee_name: String(employeeName),
                    notification_type: "einstellung",
                    form_data: brData,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setPreviewHtml(data.content_html);
                setGeneratedId(data.id);
                setActiveTab("preview");
            }
        } catch (error) {
            console.error("Preview generation failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Als gesendet markieren
    const markAsSent = async () => {
        if (!generatedId) return;

        setIsGenerating(true);
        try {
            await apiFetch(`/api/v1/works-council/notifications/${generatedId}/status?status=versendet`, {
                method: "PATCH",
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update status:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    // PDF Download (simuliert)
    const downloadPDF = () => {
        // In Produktion: PDF generieren und herunterladen
        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>BR-Mitteilung - ${employeeName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        td { padding: 8px; border: 1px solid #ddd; }
                        .br-legal-notice { background: #f5f5f5; padding: 15px; margin-top: 30px; }
                    </style>
                </head>
                <body>
                    ${previewHtml}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Betriebsrat-Mitteilung erstellen
                    </DialogTitle>
                    <DialogDescription>
                        Erstellen Sie eine §99 BetrVG konforme Mitteilung an den Betriebsrat.
                        Sensible Daten (Gehalt, Bank, etc.) werden automatisch ausgeschlossen.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="select">
                            <FileText className="w-4 h-4 mr-2" />
                            Vorlage
                        </TabsTrigger>
                        <TabsTrigger value="data">
                            <Shield className="w-4 h-4 mr-2" />
                            Daten prüfen
                        </TabsTrigger>
                        <TabsTrigger value="preview" disabled={!previewHtml}>
                            <Eye className="w-4 h-4 mr-2" />
                            Vorschau
                        </TabsTrigger>
                    </TabsList>

                    {/* Template Selection */}
                    <TabsContent value="select" className="flex-1 overflow-auto">
                        <div className="space-y-4 p-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Vorlage auswählen
                                </label>
                                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Vorlage wählen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((t) => (
                                            <SelectItem key={t.id} value={String(t.id)}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="default">Standard-Vorlage</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-500" />
                                        Hinweis zur Datensicherheit
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    <p>
                                        Die BR-Mitteilung enthält ausschließlich die für den
                                        Betriebsrat relevanten Informationen gemäß §99 BetrVG.
                                        Folgende Daten werden <strong>nicht</strong> übermittelt:
                                    </p>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Gehalt und Vergütungsdetails</li>
                                        <li>Bankverbindung</li>
                                        <li>Sozialversicherungsnummer</li>
                                        <li>Steuer-ID</li>
                                        <li>Private Kontaktdaten</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Data Review */}
                    <TabsContent value="data" className="flex-1 overflow-auto">
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Übermittelte Daten</h3>
                                <Badge variant="outline" className="text-green-600">
                                    <Check className="w-3 h-3 mr-1" />
                                    {Object.keys(brData).length} Felder
                                </Badge>
                            </div>

                            <div className="border rounded-lg divide-y">
                                {Object.entries(brData).map(([key, value]) => {
                                    const label = BR_RELEVANT_FIELDS[key.toLowerCase()] ||
                                        BR_RELEVANT_FIELDS[key] ||
                                        key.replace(/_/g, " ");
                                    return (
                                        <div key={key} className="flex items-center justify-between px-4 py-2">
                                            <span className="text-sm text-muted-foreground">{label}</span>
                                            <span className="text-sm font-medium">{value}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {Object.keys(brData).length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                                    <p>Keine BR-relevanten Daten gefunden.</p>
                                    <p className="text-sm">
                                        Bitte füllen Sie zuerst das Formular aus.
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Preview */}
                    <TabsContent value="preview" className="flex-1 overflow-auto">
                        <div className="p-4">
                            {previewHtml ? (
                                <div
                                    className="prose prose-sm max-w-none bg-white p-6 border rounded-lg shadow-sm"
                                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                                />
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    Klicken Sie auf "Vorschau generieren" um die Mitteilung zu sehen.
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>

                    {activeTab !== "preview" && (
                        <Button
                            onClick={generatePreview}
                            disabled={isLoading || Object.keys(brData).length === 0}
                        >
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Eye className="w-4 h-4 mr-2" />
                            Vorschau generieren
                        </Button>
                    )}

                    {activeTab === "preview" && previewHtml && (
                        <>
                            <Button variant="outline" onClick={downloadPDF}>
                                <Download className="w-4 h-4 mr-2" />
                                PDF herunterladen
                            </Button>
                            <Button onClick={markAsSent} disabled={isGenerating}>
                                {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                <Send className="w-4 h-4 mr-2" />
                                Als gesendet markieren
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
