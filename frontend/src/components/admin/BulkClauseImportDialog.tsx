/**
 * BulkClauseImportDialog - Freitext-Import für Klauseln
 *
 * Ermöglicht es, einen ganzen Vertragstext einzufügen und
 * §-Paragraphen automatisch als einzelne Klauseln zu erkennen.
 * Nutzt die bestehende /api/v1/word-import/import API.
 */

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CheckCircle,
    AlertTriangle,
    Loader2,
    ArrowRight,
    ArrowLeft,
    Eye,
    FileText,
    Scissors,
    Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";

// §-Paragraph Erkennung
interface DetectedParagraph {
    index: number;
    title: string;
    content: string;
    content_html: string;
    char_count: number;
    selected: boolean;
    // Für API-Kompatibilität mit word-import
    has_existing_match: boolean;
}

interface BulkClauseImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImportComplete?: (clauseIds: number[]) => void;
    countryCode?: string;
}

type WizardStep = "input" | "review" | "configure" | "complete";

const IMPORT_CATEGORIES = [
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
    { value: "Einladung", label: "Einladung", group: "HR-Korrespondenz" },
    { value: "Mitteilung", label: "Mitteilung", group: "HR-Korrespondenz" },
    { value: "Fürsorge", label: "Fürsorge/BEM", group: "HR-Korrespondenz" },
    { value: "Abmahnung", label: "Abmahnung", group: "HR-Korrespondenz" },
    { value: "Zeugnis", label: "Zeugnis", group: "HR-Korrespondenz" },
    { value: "Importiert", label: "Importiert (Freitext)", group: "Sonstiges" },
    { value: "Sonstiges", label: "Sonstiges", group: "Sonstiges" },
];

/**
 * Erkennt §-Paragraphen im Freitext.
 * Unterstützt Formate wie:
 * - § 1 Titel
 * - §1 Titel
 * - § 1. Titel
 * - § 1 - Titel
 */
function detectParagraphs(text: string): DetectedParagraph[] {
    const lines = text.split("\n");
    const paragraphs: DetectedParagraph[] = [];
    let currentTitle = "";
    let currentContent: string[] = [];
    let paragraphIndex = 0;

    const PARAGRAPH_REGEX = /^§\s*(\d+)[\s.\-–:)]*\s*(.+)$/;

    const flushCurrent = () => {
        if (currentTitle && currentContent.length > 0) {
            const content = currentContent.join("\n").trim();
            const contentHtml = content
                .split("\n\n")
                .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
                .join("");

            paragraphs.push({
                index: paragraphIndex++,
                title: currentTitle,
                content: content,
                content_html: contentHtml,
                char_count: content.length,
                selected: true,
                has_existing_match: false,
            });
        }
        currentTitle = "";
        currentContent = [];
    };

    for (const line of lines) {
        const match = line.trim().match(PARAGRAPH_REGEX);
        if (match) {
            flushCurrent();
            const num = match[1];
            const title = match[2].trim();
            currentTitle = `§ ${num} ${title}`;
        } else if (currentTitle) {
            currentContent.push(line);
        }
    }

    // Letzten Paragraphen speichern
    flushCurrent();

    return paragraphs;
}

export function BulkClauseImportDialog({
    open,
    onOpenChange,
    onImportComplete,
    countryCode = "DE",
}: BulkClauseImportDialogProps) {
    const [step, setStep] = useState<WizardStep>("input");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Input
    const [rawText, setRawText] = useState("");

    // Detected paragraphs
    const [paragraphs, setParagraphs] = useState<DetectedParagraph[]>([]);

    // Config
    const [category, setCategory] = useState("Importiert");
    const [importedIds, setImportedIds] = useState<number[]>([]);

    // Preview
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    const resetWizard = useCallback(() => {
        setStep("input");
        setRawText("");
        setParagraphs([]);
        setCategory("Importiert");
        setImportedIds([]);
        setPreviewIndex(null);
        setError(null);
        setIsLoading(false);
    }, []);

    const handleClose = useCallback(
        (open: boolean) => {
            if (!open) resetWizard();
            onOpenChange(open);
        },
        [onOpenChange, resetWizard]
    );

    // Text analysieren
    const handleAnalyze = useCallback(() => {
        setError(null);
        const detected = detectParagraphs(rawText);
        if (detected.length === 0) {
            setError(
                "Keine §-Paragraphen erkannt. Bitte stellen Sie sicher, dass Ihr Text Paragraphen im Format '§ 1 Titel' enthält."
            );
            return;
        }
        setParagraphs(detected);
        setStep("review");
    }, [rawText]);

    // Selektion
    const toggleSection = (index: number) => {
        setParagraphs((prev) =>
            prev.map((p) =>
                p.index === index ? { ...p, selected: !p.selected } : p
            )
        );
    };

    const selectAll = () => {
        setParagraphs((prev) => prev.map((p) => ({ ...p, selected: true })));
    };

    const deselectAll = () => {
        setParagraphs((prev) => prev.map((p) => ({ ...p, selected: false })));
    };

    // Import via bestehende API
    const handleImport = async () => {
        const selectedParagraphs = paragraphs.filter((p) => p.selected);
        if (selectedParagraphs.length === 0) {
            setError("Bitte wählen Sie mindestens einen Paragraphen aus.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await apiFetch("/api/v1/word-import/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sections: paragraphs,
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
            setError(
                err instanceof Error ? err.message : "Unbekannter Fehler"
            );
        } finally {
            setIsLoading(false);
        }
    };

    const selectedCount = paragraphs.filter((p) => p.selected).length;
    const progress =
        step === "input"
            ? 0
            : step === "review"
              ? 33
              : step === "configure"
                ? 66
                : 100;

    const groups = useMemo(() => {
        const map: Record<string, typeof IMPORT_CATEGORIES> = {};
        for (const cat of IMPORT_CATEGORIES) {
            if (!map[cat.group]) map[cat.group] = [];
            map[cat.group].push(cat);
        }
        return map;
    }, []);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scissors className="w-5 h-5" />
                        Freitext-Import: §-Paragraphen erkennen
                    </DialogTitle>
                    <DialogDescription>
                        Fügen Sie einen Vertragstext ein und die App erkennt
                        automatisch die §-Paragraphen als einzelne Klauseln.
                    </DialogDescription>
                </DialogHeader>

                <Progress value={progress} className="h-1" />

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto min-h-0">
                    {/* Step 1: Freitext eingeben */}
                    {step === "input" && (
                        <div className="space-y-4 p-1">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    Vertragstext einfügen
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Kopieren Sie den vollständigen Vertragstext
                                    hier hinein. Paragraphen werden anhand von
                                    §-Zeichen erkannt (z.B. "§ 1 Vertragsgegenstand").
                                </p>
                                <Textarea
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                    placeholder={`§ 1 Vertragsgegenstand\nDer Arbeitnehmer wird ab dem {{eintrittsdatum}} als {{position}} eingestellt.\n\n§ 2 Arbeitszeit\nDie regelmäßige wöchentliche Arbeitszeit beträgt {{wochenstunden}} Stunden.\n\n§ 3 Vergütung\n...`}
                                    className="min-h-[350px] font-mono text-sm"
                                />
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{rawText.length} Zeichen</span>
                                <span>
                                    {"Tipp: {{ platzhalter }} werden automatisch erkannt"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Erkannte Paragraphen prüfen */}
                    {step === "review" && (
                        <div className="space-y-3 p-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-secondary" />
                                    <span className="text-sm font-medium">
                                        {paragraphs.length} Paragraphen erkannt
                                    </span>
                                    <Badge variant="outline">
                                        {selectedCount} ausgewählt
                                    </Badge>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={selectAll}
                                    >
                                        Alle
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={deselectAll}
                                    >
                                        Keine
                                    </Button>
                                </div>
                            </div>

                            <ScrollArea className="h-[400px]">
                                <div className="space-y-2">
                                    {paragraphs.map((p) => (
                                        <div
                                            key={p.index}
                                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                                p.selected
                                                    ? "bg-primary/5 border-primary/20"
                                                    : "bg-warm-50 border-transparent"
                                            }`}
                                        >
                                            <Checkbox
                                                checked={p.selected}
                                                onCheckedChange={() =>
                                                    toggleSection(p.index)
                                                }
                                                className="mt-0.5"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">
                                                        {p.title}
                                                    </span>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-xs"
                                                    >
                                                        {p.char_count} Zeichen
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {p.content.substring(
                                                        0,
                                                        150
                                                    )}
                                                    {p.content.length > 150
                                                        ? "..."
                                                        : ""}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="flex-shrink-0"
                                                onClick={() =>
                                                    setPreviewIndex(
                                                        previewIndex ===
                                                            p.index
                                                            ? null
                                                            : p.index
                                                    )
                                                }
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>

                            {/* Vorschau */}
                            {previewIndex !== null && (
                                <div className="border rounded-lg p-4 bg-white">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">
                                            Vorschau:{" "}
                                            {
                                                paragraphs.find(
                                                    (p) =>
                                                        p.index ===
                                                        previewIndex
                                                )?.title
                                            }
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setPreviewIndex(null)
                                            }
                                        >
                                            Schließen
                                        </Button>
                                    </div>
                                    <div
                                        className="prose prose-sm max-w-none text-sm"
                                        dangerouslySetInnerHTML={{
                                            __html:
                                                paragraphs.find(
                                                    (p) =>
                                                        p.index ===
                                                        previewIndex
                                                )?.content_html || "",
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Konfiguration */}
                    {step === "configure" && (
                        <div className="space-y-4 p-1">
                            <div className="text-center py-4">
                                <FileText className="w-12 h-12 mx-auto mb-2 text-primary/50" />
                                <p className="font-medium">
                                    {selectedCount} Paragraphen werden
                                    importiert
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Wählen Sie die Standard-Kategorie für alle
                                    importierten Klauseln.
                                </p>
                            </div>

                            <div className="max-w-md mx-auto space-y-4">
                                <div className="space-y-2">
                                    <Label>Kategorie</Label>
                                    <Select
                                        value={category}
                                        onValueChange={setCategory}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Kategorie wählen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(groups).map(
                                                ([group, cats]) => (
                                                    <SelectGroup key={group}>
                                                        <SelectLabel>
                                                            {group}
                                                        </SelectLabel>
                                                        {cats.map((cat) => (
                                                            <SelectItem
                                                                key={cat.value}
                                                                value={
                                                                    cat.value
                                                                }
                                                            >
                                                                {cat.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Land</Label>
                                    <div className="flex items-center gap-2 p-2 border rounded-md bg-warm-50">
                                        <span>
                                            {countryCode === "DE"
                                                ? "🇩🇪 Deutschland"
                                                : "🇮🇹 Italien"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="border rounded-lg p-3 bg-warm-50 mt-4">
                                <p className="text-xs text-muted-foreground font-medium mb-2">
                                    Ausgewählte Paragraphen:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {paragraphs
                                        .filter((p) => p.selected)
                                        .map((p) => (
                                            <Badge
                                                key={p.index}
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {p.title}
                                            </Badge>
                                        ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Abgeschlossen */}
                    {step === "complete" && (
                        <div className="text-center py-8 space-y-4">
                            <CheckCircle className="w-16 h-16 mx-auto text-secondary" />
                            <div>
                                <h3 className="text-lg font-semibold">
                                    Import erfolgreich!
                                </h3>
                                <p className="text-muted-foreground">
                                    {importedIds.length} Klauseln wurden
                                    erstellt.
                                </p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-1">
                                {paragraphs
                                    .filter((p) => p.selected)
                                    .map((p) => (
                                        <Badge
                                            key={p.index}
                                            className="bg-secondary/10 text-secondary border-secondary/20"
                                        >
                                            {p.title}
                                        </Badge>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between">
                    {step !== "complete" && step !== "input" && (
                        <Button
                            variant="outline"
                            onClick={() =>
                                setStep(
                                    step === "configure"
                                        ? "review"
                                        : "input"
                                )
                            }
                            disabled={isLoading}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Zurück
                        </Button>
                    )}

                    <div className="flex gap-2 ml-auto">
                        {step === "input" && (
                            <Button
                                onClick={handleAnalyze}
                                disabled={rawText.trim().length < 20}
                            >
                                Paragraphen erkennen
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}

                        {step === "review" && (
                            <Button
                                onClick={() => setStep("configure")}
                                disabled={selectedCount === 0}
                            >
                                {selectedCount} importieren
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}

                        {step === "configure" && (
                            <Button
                                onClick={handleImport}
                                disabled={isLoading}
                                className="bg-secondary hover:bg-secondary/90"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Importiere...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        {selectedCount} Klauseln erstellen
                                    </>
                                )}
                            </Button>
                        )}

                        {step === "complete" && (
                            <Button onClick={() => handleClose(false)}>
                                Schließen
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
