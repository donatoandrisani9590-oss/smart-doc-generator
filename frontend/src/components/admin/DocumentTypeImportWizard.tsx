/**
 * DocumentTypeImportWizard - Import-Assistent für komplette Dokumententypen
 *
 * Importiert Word-Dokumente als neue Dokumententypen inkl.:
 * - Automatische Klausel-Erkennung
 * - Platzhalter-Erkennung
 * - Varianten-Zuordnung zu existierenden Klauseln
 * - Formularfeld-Erstellung
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    FileUp,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Loader2,
    Upload,
    ArrowRight,
    ArrowLeft,
    Link2,
    PlusCircle,
    GitBranch,
    Sparkles,
    Wand2,
    GripVertical,
    X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";

// Types
interface PlaceholderSuggestion {
    original_text: string;
    suggested_placeholder: string;
    placeholder_type: string;
    confidence: number;
    accepted: boolean;
}

interface ExtractedSection {
    index: number;
    title: string;
    content: string;
    content_html: string;
    char_count: number;
    action: "create_new" | "use_existing" | "add_variant" | "skip";
    existing_clause_id?: number;
    existing_clause_title?: string;
    similarity_score?: number;
    is_variant_of?: number;
    variant_name?: string;
    is_mandatory: boolean;
    display_order: number;
    placeholders: PlaceholderSuggestion[];
}

interface AnalysisResult {
    filename: string;
    total_chars: number;
    sections_count: number;
    sections: ExtractedSection[];
    warnings: string[];
    headings_found: number;
    tables_converted: number;
    images_ignored: number;
    placeholders_detected: number;
    similar_clauses_found: number;
}

interface DocumentTypeImportWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImportComplete?: (documentTypeId: number) => void;
    countryCode?: string;
}

type WizardStep = "upload" | "analysis" | "clauses" | "placeholders" | "summary";

const DOCUMENT_CATEGORIES = [
    "Arbeitsvertrag",
    "Zusatzvereinbarung",
    "Kündigung",
    "Abmahnung",
    "Zeugnis",
    "Änderungsvertrag",
    "Versetzung",
    "Sonstiges",
];

export function DocumentTypeImportWizard({
    open,
    onOpenChange,
    onImportComplete,
    countryCode = "DE",
}: DocumentTypeImportWizardProps) {
    const navigate = useNavigate();
    const [step, setStep] = useState<WizardStep>("upload");
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form data
    const [documentTypeName, setDocumentTypeName] = useState("");
    const [documentTypeCategory, setDocumentTypeCategory] = useState("");
    const [selectedCountry, setSelectedCountry] = useState(countryCode);

    // Analysis data
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [sections, setSections] = useState<ExtractedSection[]>([]);

    // Import result
    const [importResult, setImportResult] = useState<any>(null);

    const resetWizard = () => {
        setStep("upload");
        setAnalysisResult(null);
        setSections([]);
        setError(null);
        setDocumentTypeName("");
        setDocumentTypeCategory("");
        setImportResult(null);
    };

    const handleClose = () => {
        resetWizard();
        onOpenChange(false);
    };

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    // File upload
    const handleFileSelect = async (file: File) => {
        if (!file.name.toLowerCase().endsWith(".docx")) {
            setError("Nur .docx Dateien werden unterstützt.");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setError(`Datei zu gross. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)} MB`);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("country_code", selectedCountry);

            const response = await apiFetch("/api/v1/document-type-import/analyze", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Analyse fehlgeschlagen");
            }

            const result: AnalysisResult = await response.json();
            setAnalysisResult(result);
            setSections(result.sections);

            // Auto-fill name from filename
            const nameFromFile = file.name.replace(/\.docx$/i, "").replace(/[_-]/g, " ");
            setDocumentTypeName(nameFromFile);

            setStep("analysis");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [selectedCountry]);

    // Section actions
    const updateSection = (index: number, updates: Partial<ExtractedSection>) => {
        setSections((prev) =>
            prev.map((s) => (s.index === index ? { ...s, ...updates } : s))
        );
    };

    const togglePlaceholder = (sectionIndex: number, placeholderIndex: number) => {
        setSections((prev) =>
            prev.map((s) => {
                if (s.index === sectionIndex) {
                    const newPlaceholders = [...s.placeholders];
                    newPlaceholders[placeholderIndex] = {
                        ...newPlaceholders[placeholderIndex],
                        accepted: !newPlaceholders[placeholderIndex].accepted,
                    };
                    return { ...s, placeholders: newPlaceholders };
                }
                return s;
            })
        );
    };

    // Import
    const handleImport = async () => {
        if (!documentTypeName || !documentTypeCategory) {
            setError("Bitte Name und Kategorie angeben.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await apiFetch("/api/v1/document-type-import/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document_type_name: documentTypeName,
                    document_type_category: documentTypeCategory,
                    country_code: selectedCountry,
                    sections: sections,
                    global_placeholders: [],
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Import fehlgeschlagen");
            }

            const result = await response.json();
            setImportResult(result);
            setStep("summary");
            onImportComplete?.(result.document_type_id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    const getStepProgress = () => {
        switch (step) {
            case "upload": return 0;
            case "analysis": return 25;
            case "clauses": return 50;
            case "placeholders": return 75;
            case "summary": return 100;
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case "create_new": return <PlusCircle className="w-4 h-4 text-green-600" />;
            case "use_existing": return <Link2 className="w-4 h-4 text-blue-600" />;
            case "add_variant": return <GitBranch className="w-4 h-4 text-purple-600" />;
            case "skip": return <X className="w-4 h-4 text-gray-400" />;
        }
    };

    const getActionLabel = (action: string) => {
        switch (action) {
            case "create_new": return "Neue Klausel erstellen";
            case "use_existing": return "Existierende verwenden";
            case "add_variant": return "Als Variante hinzufügen";
            case "skip": return "Überspringen";
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileUp className="w-5 h-5" />
                        Dokumententyp aus Word importieren
                    </DialogTitle>
                    <DialogDescription>
                        Importieren Sie ein komplettes Word-Dokument als neuen Dokumententyp mit Klauseln
                    </DialogDescription>
                </DialogHeader>

                {/* Progress */}
                <div className="space-y-2">
                    <Progress value={getStepProgress()} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span className={step === "upload" ? "font-medium text-foreground" : ""}>
                            1. Hochladen
                        </span>
                        <span className={step === "analysis" ? "font-medium text-foreground" : ""}>
                            2. Analyse
                        </span>
                        <span className={step === "clauses" ? "font-medium text-foreground" : ""}>
                            3. Klauseln
                        </span>
                        <span className={step === "placeholders" ? "font-medium text-foreground" : ""}>
                            4. Platzhalter
                        </span>
                        <span className={step === "summary" ? "font-medium text-foreground" : ""}>
                            5. Fertig
                        </span>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm flex items-center gap-2">
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {/* Step 1: Upload */}
                    {step === "upload" && (
                        <div className="space-y-4">
                            {/* Document Type Info */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Dokumententyp-Informationen</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Land *</Label>
                                            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="DE">🇩🇪 Deutschland</SelectItem>
                                                    <SelectItem value="IT">🇮🇹 Italien</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Kategorie *</Label>
                                            <Select value={documentTypeCategory} onValueChange={setDocumentTypeCategory}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Kategorie wählen..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DOCUMENT_CATEGORIES.map((cat) => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* File Upload */}
                            <div
                                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                                }`}
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                            >
                                {isLoading ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                                        <p>Dokument wird analysiert...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                        <p className="text-lg font-medium mb-2">Word-Datei hier ablegen</p>
                                        <p className="text-sm text-muted-foreground mb-4">oder klicken zum Auswählen (max. 10 MB)</p>
                                        <Input
                                            type="file"
                                            accept=".docx"
                                            className="max-w-xs mx-auto"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleFileSelect(file);
                                            }}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Analysis */}
                    {step === "analysis" && analysisResult && (
                        <div className="space-y-4">
                            {/* Name */}
                            <div className="space-y-2">
                                <Label>Name des Dokumententyps *</Label>
                                <Input
                                    value={documentTypeName}
                                    onChange={(e) => setDocumentTypeName(e.target.value)}
                                    placeholder="z.B. Arbeitsvertrag Vollzeit"
                                />
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-5 gap-4">
                                <Card className="p-3 text-center">
                                    <div className="text-2xl font-bold">{analysisResult.total_chars}</div>
                                    <div className="text-xs text-muted-foreground">Zeichen</div>
                                </Card>
                                <Card className="p-3 text-center">
                                    <div className="text-2xl font-bold text-green-600">{analysisResult.sections_count}</div>
                                    <div className="text-xs text-muted-foreground">Abschnitte</div>
                                </Card>
                                <Card className="p-3 text-center">
                                    <div className="text-2xl font-bold text-blue-600">{analysisResult.similar_clauses_found}</div>
                                    <div className="text-xs text-muted-foreground">Ähnliche</div>
                                </Card>
                                <Card className="p-3 text-center">
                                    <div className="text-2xl font-bold text-purple-600">{analysisResult.placeholders_detected}</div>
                                    <div className="text-xs text-muted-foreground">Platzhalter</div>
                                </Card>
                                <Card className="p-3 text-center">
                                    <div className="text-2xl font-bold text-amber-600">{analysisResult.images_ignored}</div>
                                    <div className="text-xs text-muted-foreground">Bilder ignoriert</div>
                                </Card>
                            </div>

                            {/* Warnings */}
                            {analysisResult.warnings.length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 font-medium text-amber-800 mb-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Hinweise
                                    </div>
                                    <ul className="text-sm text-amber-700 space-y-1">
                                        {analysisResult.warnings.map((w, i) => (
                                            <li key={i}>• {w}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Sections Preview */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Erkannte Abschnitte</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {sections.map((section) => (
                                            <div key={section.index} className="flex items-center gap-3 p-2 border rounded">
                                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                                <div className="flex-1">
                                                    <div className="font-medium">{section.title}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {section.char_count} Zeichen • {section.placeholders.length} Platzhalter
                                                    </div>
                                                </div>
                                                {section.similarity_score && section.similarity_score > 0.5 && (
                                                    <Badge variant="outline" className="text-blue-600">
                                                        {Math.round(section.similarity_score * 100)}% ähnlich
                                                    </Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Step 3: Clauses Configuration */}
                    {step === "clauses" && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Konfigurieren Sie für jeden Abschnitt, wie er importiert werden soll.
                            </p>

                            <Accordion type="multiple" className="space-y-2">
                                {sections.map((section) => (
                                    <AccordionItem key={section.index} value={String(section.index)} className="border rounded-lg">
                                        <AccordionTrigger className="px-4 hover:no-underline">
                                            <div className="flex items-center gap-3 flex-1">
                                                {getActionIcon(section.action)}
                                                <span className="font-medium">{section.title}</span>
                                                <Badge variant="outline" className="ml-auto mr-4">
                                                    {getActionLabel(section.action)}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4">
                                            <div className="space-y-4">
                                                {/* Action Selection */}
                                                <RadioGroup
                                                    value={section.action}
                                                    onValueChange={(v) => updateSection(section.index, { action: v as any })}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="create_new" id={`new-${section.index}`} />
                                                        <Label htmlFor={`new-${section.index}`} className="flex items-center gap-2">
                                                            <PlusCircle className="w-4 h-4 text-green-600" />
                                                            Neue Klausel erstellen
                                                        </Label>
                                                    </div>

                                                    {section.existing_clause_id && (
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="use_existing" id={`existing-${section.index}`} />
                                                            <Label htmlFor={`existing-${section.index}`} className="flex items-center gap-2">
                                                                <Link2 className="w-4 h-4 text-blue-600" />
                                                                Existierende verwenden: "{section.existing_clause_title}"
                                                                <Badge variant="secondary">
                                                                    {Math.round((section.similarity_score || 0) * 100)}%
                                                                </Badge>
                                                            </Label>
                                                        </div>
                                                    )}

                                                    {section.existing_clause_id && (
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="add_variant" id={`variant-${section.index}`} />
                                                            <Label htmlFor={`variant-${section.index}`} className="flex items-center gap-2">
                                                                <GitBranch className="w-4 h-4 text-purple-600" />
                                                                Als Variante zu "{section.existing_clause_title}" hinzufügen
                                                            </Label>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="skip" id={`skip-${section.index}`} />
                                                        <Label htmlFor={`skip-${section.index}`} className="flex items-center gap-2 text-muted-foreground">
                                                            <X className="w-4 h-4" />
                                                            Überspringen
                                                        </Label>
                                                    </div>
                                                </RadioGroup>

                                                {/* Variant Name */}
                                                {section.action === "add_variant" && (
                                                    <div className="space-y-2 pl-6">
                                                        <Label>Varianten-Name</Label>
                                                        <Input
                                                            value={section.variant_name || ""}
                                                            onChange={(e) => updateSection(section.index, { variant_name: e.target.value })}
                                                            placeholder="z.B. 6 Monate"
                                                        />
                                                    </div>
                                                )}

                                                {/* Mandatory */}
                                                <div className="flex items-center gap-2 pl-6">
                                                    <Checkbox
                                                        id={`mandatory-${section.index}`}
                                                        checked={section.is_mandatory}
                                                        onCheckedChange={(v) => updateSection(section.index, { is_mandatory: !!v })}
                                                    />
                                                    <Label htmlFor={`mandatory-${section.index}`}>Pflichtklausel</Label>
                                                </div>

                                                {/* Content Preview */}
                                                <div className="bg-muted/50 rounded p-3 text-sm max-h-[150px] overflow-y-auto">
                                                    <div dangerouslySetInnerHTML={{ __html: section.content_html }} />
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    )}

                    {/* Step 4: Placeholders */}
                    {step === "placeholders" && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Wand2 className="w-4 h-4" />
                                Erkannte Platzhalter prüfen und anpassen
                            </div>

                            {sections.filter(s => s.action !== "skip" && s.placeholders.length > 0).length === 0 ? (
                                <Card className="p-8 text-center">
                                    <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="font-medium">Keine Platzhalter erkannt</p>
                                    <p className="text-sm text-muted-foreground">
                                        Sie können Platzhalter später manuell hinzufügen.
                                    </p>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {sections
                                        .filter(s => s.action !== "skip" && s.placeholders.length > 0)
                                        .map((section) => (
                                            <Card key={section.index}>
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm">{section.title}</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-2">
                                                        {section.placeholders.map((ph, phIdx) => (
                                                            <div
                                                                key={phIdx}
                                                                className={`flex items-center gap-3 p-2 rounded border ${
                                                                    ph.accepted ? "bg-green-50 border-green-200" : "bg-muted/50"
                                                                }`}
                                                            >
                                                                <Checkbox
                                                                    checked={ph.accepted}
                                                                    onCheckedChange={() => togglePlaceholder(section.index, phIdx)}
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="text-sm">
                                                                        <span className="text-muted-foreground">"{ph.original_text}"</span>
                                                                        <ArrowRight className="inline w-3 h-3 mx-2" />
                                                                        <code className="px-1 bg-primary/10 rounded text-primary">
                                                                            {ph.suggested_placeholder}
                                                                        </code>
                                                                    </div>
                                                                </div>
                                                                <Badge variant="outline">
                                                                    {Math.round(ph.confidence * 100)}%
                                                                </Badge>
                                                                <Badge variant="secondary">{ph.placeholder_type}</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 5: Summary */}
                    {step === "summary" && importResult && (
                        <div className="text-center py-8 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold">Import erfolgreich!</h3>
                            <p className="text-muted-foreground">
                                Dokumententyp "{importResult.document_type_name}" wurde erstellt.
                            </p>

                            <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
                                <Card className="p-3 text-center">
                                    <div className="text-2xl font-bold text-green-600">{importResult.clauses_created}</div>
                                    <div className="text-xs text-muted-foreground">Klauseln erstellt</div>
                                </Card>
                                <Card className="p-3 text-center">
                                    <div className="text-2xl font-bold text-blue-600">{importResult.clauses_linked}</div>
                                    <div className="text-xs text-muted-foreground">Verknüpft</div>
                                </Card>
                                <Card className="p-3 text-center">
                                    <div className="text-2xl font-bold text-purple-600">{importResult.variants_added}</div>
                                    <div className="text-xs text-muted-foreground">Varianten</div>
                                </Card>
                                <Card className="p-3 text-center">
                                    <div className="text-2xl font-bold text-amber-600">{importResult.form_fields_created}</div>
                                    <div className="text-xs text-muted-foreground">Formularfelder</div>
                                </Card>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto text-sm text-left">
                                <p className="font-medium mb-2">Nächste Schritte:</p>
                                <ul className="space-y-1 text-muted-foreground">
                                    <li>• Klauseln im Klausel-Editor prüfen</li>
                                    <li>• Platzhalter anpassen wenn nötig</li>
                                    <li>• Formularfelder konfigurieren</li>
                                    <li>• Dokumententyp testen</li>
                                </ul>
                            </div>

                            <Button onClick={() => { handleClose(); navigate("/settings?tab=templates"); }}>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Zu den Dokumententypen
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step !== "summary" && (
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={handleClose}>
                            Abbrechen
                        </Button>

                        {step === "analysis" && (
                            <>
                                <Button variant="outline" onClick={() => setStep("upload")}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Zurück
                                </Button>
                                <Button
                                    onClick={() => setStep("clauses")}
                                    disabled={!documentTypeName || !documentTypeCategory}
                                >
                                    Weiter
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </>
                        )}

                        {step === "clauses" && (
                            <>
                                <Button variant="outline" onClick={() => setStep("analysis")}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Zurück
                                </Button>
                                <Button onClick={() => setStep("placeholders")}>
                                    Weiter
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </>
                        )}

                        {step === "placeholders" && (
                            <>
                                <Button variant="outline" onClick={() => setStep("clauses")}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Zurück
                                </Button>
                                <Button onClick={handleImport} disabled={isLoading}>
                                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Dokumententyp importieren
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                )}

                {step === "summary" && (
                    <DialogFooter>
                        <Button onClick={handleClose}>Schließen</Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
