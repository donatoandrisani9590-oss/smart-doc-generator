/**
 * WordImportWizard - Import-Assistent für Word-Vorlagen
 *
 * v4.2 Feature (Kapitel 15.2.8):
 * - DOCX hochladen und analysieren
 * - Abschnitte als Textbausteine erkennen
 * - Duplikate warnen
 * - Ausgewählte Abschnitte importieren
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
    FileUp,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Loader2,
    Upload,
    ArrowRight,
    ArrowLeft,
    Eye,
    Info,
    Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { sanitizeHtml } from "@/utils/sanitize";

interface ExtractedSection {
    index: number;
    title: string;
    content: string;
    content_html: string;
    char_count: number;
    has_existing_match: boolean;
    existing_clause_id?: number;
    existing_clause_title?: string;
    selected: boolean;
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
}

interface WordImportWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImportComplete?: (clauseIds: number[]) => void;
    countryCode?: string;
}

type WizardStep = "upload" | "review" | "configure" | "complete";

export function WordImportWizard({
    open,
    onOpenChange,
    onImportComplete,
    countryCode = "DE",
}: WordImportWizardProps) {
    const navigate = useNavigate();
    const [step, setStep] = useState<WizardStep>("upload");
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Analysis data
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [sections, setSections] = useState<ExtractedSection[]>([]);

    // Import config
    const [category, setCategory] = useState("Importiert");
    const [importedIds, setImportedIds] = useState<number[]>([]);

    // Konsistente Kategorien (gleich wie ClauseFormDialog)
    const IMPORT_CATEGORIES = [
        // Arbeitsvertrag-Kategorien
        { value: "Einleitung", label: "Einleitung", group: "Arbeitsvertrag" },
        { value: "Vertragsbeginn", label: "Vertragsbeginn / Probezeit", group: "Arbeitsvertrag" },
        { value: "Arbeitszeit", label: "Arbeitszeit", group: "Arbeitsvertrag" },
        { value: "Vergütung", label: "Vergütung", group: "Arbeitsvertrag" },
        { value: "Nebenleistungen", label: "Nebenleistungen", group: "Arbeitsvertrag" },
        { value: "Urlaub", label: "Urlaub", group: "Arbeitsvertrag" },
        { value: "Pflichten", label: "Pflichten / Verhinderung", group: "Arbeitsvertrag" },
        { value: "Kündigung", label: "Kündigung", group: "Arbeitsvertrag" },
        { value: "Geheimhaltung", label: "Geheimhaltung", group: "Arbeitsvertrag" },
        { value: "Nebentätigkeit", label: "Nebentätigkeit", group: "Arbeitsvertrag" },
        { value: "Wettbewerb", label: "Wettbewerbsverbot", group: "Arbeitsvertrag" },
        { value: "Ausschlussfristen", label: "Ausschlussfristen", group: "Arbeitsvertrag" },
        { value: "Schlussbestimmungen", label: "Schlussbestimmungen", group: "Arbeitsvertrag" },
        // HR-Korrespondenz-Kategorien
        { value: "Einladung", label: "Einladung", group: "HR-Korrespondenz" },
        { value: "Mitteilung", label: "Mitteilung", group: "HR-Korrespondenz" },
        { value: "Fürsorge", label: "Fürsorge/BEM", group: "HR-Korrespondenz" },
        { value: "Abmahnung", label: "Abmahnung", group: "HR-Korrespondenz" },
        { value: "Zeugnis", label: "Zeugnis", group: "HR-Korrespondenz" },
        // Import-spezifisch
        { value: "Importiert", label: "Importiert", group: "Sonstiges" },
        { value: "Sonstiges", label: "Sonstiges", group: "Sonstiges" },
    ];

    // Preview
    const [previewSection, setPreviewSection] = useState<ExtractedSection | null>(null);

    const resetWizard = () => {
        setStep("upload");
        setAnalysisResult(null);
        setSections([]);
        setError(null);
        setImportedIds([]);
        setCategory("Importiert");
    };

    const handleClose = () => {
        resetWizard();
        onOpenChange(false);
    };

    // File upload handling
    const handleFileSelect = async (file: File) => {
        if (!file.name.toLowerCase().endsWith(".docx")) {
            setError("Nur .docx Dateien werden unterstützt.");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError("Datei zu groß. Maximum: 10 MB");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await apiFetch(
                `/api/v1/word-import/analyze?country_code=${countryCode}`,
                {
                    method: "POST",
                    body: formData,
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Upload fehlgeschlagen");
            }

            const result: AnalysisResult = await response.json();
            setAnalysisResult(result);
            setSections(result.sections);
            setStep("review");
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
        if (file) {
            handleFileSelect(file);
        }
    }, [countryCode]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const toggleSection = (index: number) => {
        setSections((prev) =>
            prev.map((s) =>
                s.index === index ? { ...s, selected: !s.selected } : s
            )
        );
    };

    const selectAll = () => {
        setSections((prev) => prev.map((s) => ({ ...s, selected: true })));
    };

    const deselectAll = () => {
        setSections((prev) => prev.map((s) => ({ ...s, selected: false })));
    };

    const handleImport = async () => {
        const selectedSections = sections.filter((s) => s.selected);
        if (selectedSections.length === 0) {
            setError("Bitte wählen Sie mindestens einen Abschnitt aus.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await apiFetch("/api/v1/word-import/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sections: sections,
                    country_code: countryCode,
                    category: category,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Import fehlgeschlagen");
            }

            const result = await response.json();
            setImportedIds(result.clause_ids);
            setStep("complete");
            onImportComplete?.(result.clause_ids);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    const selectedCount = sections.filter((s) => s.selected).length;
    const progress =
        step === "upload" ? 0 :
        step === "review" ? 33 :
        step === "configure" ? 66 :
        100;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileUp className="w-5 h-5" />
                        Word-Vorlage importieren
                    </DialogTitle>
                    <DialogDescription>
                        Importieren Sie bestehende Word-Dokumente als wiederverwendbare Textbausteine
                    </DialogDescription>
                </DialogHeader>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span className={step === "upload" ? "font-medium text-foreground" : ""}>
                            1. Hochladen
                        </span>
                        <span className={step === "review" ? "font-medium text-foreground" : ""}>
                            2. Prüfen
                        </span>
                        <span className={step === "configure" ? "font-medium text-foreground" : ""}>
                            3. Konfigurieren
                        </span>
                        <span className={step === "complete" ? "font-medium text-foreground" : ""}>
                            4. Fertig
                        </span>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm flex items-center gap-2">
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Step Content */}
                <div className="flex-1 overflow-auto">
                    {/* Step 1: Upload */}
                    {step === "upload" && (
                        <div className="space-y-4">
                            <div
                                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                                    isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/25 hover:border-primary/50"
                                }`}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                            >
                                {isLoading ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                                        <p>Dokument wird analysiert...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                        <p className="text-lg font-medium mb-2">
                                            Word-Datei hier ablegen
                                        </p>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            oder klicken zum Auswählen
                                        </p>
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

                            {/* Tips */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Info className="w-4 h-4" />
                                        Tipps für bessere Erkennung
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Verwenden Sie Word-Überschriften-Styles (Überschrift 1, 2, ...)</li>
                                        <li>Paragraphen mit §, Art. oder Nummerierung werden erkannt</li>
                                        <li>Tabellen werden zu Listen konvertiert</li>
                                        <li>Bilder/Logos werden ignoriert</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Step 2: Review */}
                    {step === "review" && analysisResult && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="grid grid-cols-4 gap-4">
                                <Card className="p-4 text-center">
                                    <div className="text-2xl font-bold">{analysisResult.total_chars}</div>
                                    <div className="text-xs text-muted-foreground">Zeichen</div>
                                </Card>
                                <Card className="p-4 text-center">
                                    <div className="text-2xl font-bold text-green-600">
                                        {analysisResult.headings_found}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Überschriften</div>
                                </Card>
                                <Card className="p-4 text-center">
                                    <div className="text-2xl font-bold text-amber-600">
                                        {analysisResult.tables_converted}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Tabellen</div>
                                </Card>
                                <Card className="p-4 text-center">
                                    <div className="text-2xl font-bold text-red-600">
                                        {analysisResult.images_ignored}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Bilder ignoriert</div>
                                </Card>
                            </div>

                            {/* Warnings */}
                            {analysisResult.warnings.length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                    <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200 mb-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Hinweise
                                    </div>
                                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                                        {analysisResult.warnings.map((w, i) => (
                                            <li key={i}>• {w}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Sections List */}
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">
                                    Erkannte Abschnitte ({sections.length})
                                </h3>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={selectAll}>
                                        Alle auswählen
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={deselectAll}>
                                        Keine auswählen
                                    </Button>
                                </div>
                            </div>

                            <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                                {sections.map((section) => (
                                    <div
                                        key={section.index}
                                        className={`flex items-center gap-4 p-3 ${
                                            section.has_existing_match ? "bg-amber-50 dark:bg-amber-900/10" : ""
                                        }`}
                                    >
                                        <Checkbox
                                            checked={section.selected}
                                            onCheckedChange={() => toggleSection(section.index)}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{section.title}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {section.char_count} Zeichen
                                            </div>
                                        </div>
                                        {section.has_existing_match && (
                                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                                                <AlertTriangle className="w-3 h-3 mr-1" />
                                                Ähnlich: {section.existing_clause_title}
                                            </Badge>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPreviewSection(section)}
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="text-sm text-muted-foreground">
                                {selectedCount} von {sections.length} Abschnitten ausgewählt
                            </div>
                        </div>
                    )}

                    {/* Step 3: Configure */}
                    {step === "configure" && (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Import-Einstellungen</CardTitle>
                                    <CardDescription>
                                        Konfigurieren Sie wie die Textbausteine importiert werden
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Kategorie</Label>
                                            <Select value={category} onValueChange={setCategory}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Kategorie wählen" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(
                                                        IMPORT_CATEGORIES.reduce((acc, cat) => {
                                                            if (!acc[cat.group]) acc[cat.group] = [];
                                                            acc[cat.group].push(cat);
                                                            return acc;
                                                        }, {} as Record<string, typeof IMPORT_CATEGORIES>)
                                                    ).map(([group, cats]) => (
                                                        <div key={group}>
                                                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                                                {group}
                                                            </div>
                                                            {cats.map((cat) => (
                                                                <SelectItem key={cat.value} value={cat.value}>
                                                                    {cat.label}
                                                                </SelectItem>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Land</Label>
                                            <Select value={countryCode} disabled>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="DE">Deutschland</SelectItem>
                                                    <SelectItem value="IT">Italien</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Zusammenfassung</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Datei:</span>
                                            <span>{analysisResult?.filename}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Zu importieren:</span>
                                            <span className="font-medium">{selectedCount} Textbausteine</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Übersprungen:</span>
                                            <span>{sections.length - selectedCount} Abschnitte</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Status nach Import:</span>
                                            <Badge variant="outline">Entwurf</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                                <div className="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200 mb-1">
                                    <Info className="w-4 h-4" />
                                    Hinweis
                                </div>
                                <p className="text-blue-700 dark:text-blue-300">
                                    Die importierten Textbausteine werden als "Entwurf" gespeichert.
                                    Bitte prüfen Sie diese und fügen Sie Platzhalter ({"{{ name }}"}) manuell ein.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Complete */}
                    {step === "complete" && (
                        <div className="text-center py-8 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold">Import erfolgreich!</h3>
                            <p className="text-muted-foreground">
                                {importedIds.length} Textbaustein(e) wurden importiert.
                            </p>

                            <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto text-sm">
                                <p className="font-medium mb-2">Nächste Schritte:</p>
                                <ul className="text-left space-y-1 text-muted-foreground">
                                    <li>• Importierte Textbausteine in der Bibliothek prüfen</li>
                                    <li>• Platzhalter {"{{ name }}"} hinzufügen</li>
                                    <li>• Formatierung anpassen wenn nötig</li>
                                    <li>• Textbausteine freigeben (4-Augen-Prinzip)</li>
                                </ul>
                            </div>

                            <Button onClick={() => { handleClose(); navigate("/settings?tab=clauses"); }}>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Zur Textbaustein-Bibliothek
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                {step !== "complete" && (
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={handleClose}>
                            Abbrechen
                        </Button>

                        {step === "review" && (
                            <>
                                <Button variant="outline" onClick={() => setStep("upload")}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Zurück
                                </Button>
                                <Button
                                    onClick={() => setStep("configure")}
                                    disabled={selectedCount === 0}
                                >
                                    Weiter
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </>
                        )}

                        {step === "configure" && (
                            <>
                                <Button variant="outline" onClick={() => setStep("review")}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Zurück
                                </Button>
                                <Button onClick={handleImport} disabled={isLoading}>
                                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {selectedCount} Textbausteine importieren
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                )}

                {step === "complete" && (
                    <DialogFooter>
                        <Button onClick={handleClose}>Schließen</Button>
                    </DialogFooter>
                )}
            </DialogContent>

            {/* Preview Dialog */}
            {previewSection && (
                <Dialog open={!!previewSection} onOpenChange={() => setPreviewSection(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{previewSection.title}</DialogTitle>
                            <DialogDescription>
                                Vorschau des erkannten Inhalts
                            </DialogDescription>
                        </DialogHeader>
                        <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewSection.content_html || previewSection.content) }}
                            />
                        </div>
                        <DialogFooter>
                            <Button onClick={() => setPreviewSection(null)}>Schließen</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </Dialog>
    );
}
