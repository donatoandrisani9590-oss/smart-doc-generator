/**
 * Magic Word Import - One-Click Import Wizard
 *
 * Der komplette Import-Flow für Word-Dokumente:
 * 1. Drag & Drop Upload
 * 2. Automatische Analyse mit Magic Detection
 * 3. Side-by-Side Mapping Editor
 * 4. Klausel-Generierung
 *
 * "Idiotensicher" - Keine manuellen Placeholder-Eingaben nötig!
 */

import React, { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload,
    FileText,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ArrowRight,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { SideBySideMappingEditor } from "./SideBySideMappingEditor";

// Types
interface TextPosition {
    paragraph_index: number;
    run_index: number;
    char_start: number;
    char_end: number;
    table_info?: { table_idx: number; row_idx: number; cell_idx: number } | null;
}

interface DetectedValue {
    id: string;
    text: string;
    value_type: string;
    position: TextPosition;
    confidence: number;
    suggested_placeholder: string | null;
    suggested_label: string | null;
    alternatives: string[];
    is_confirmed: boolean;
    user_override?: string | null;
}

interface DocumentSection {
    id: string;
    section_type: string;
    content: string;
    html_content: string;
    position_start: number;
    position_end: number;
    detected_values: DetectedValue[];
}

interface MagicAnalysisResult {
    document_id: string;
    original_filename: string;
    preview_html: string;
    preview_pdf_path: string | null;
    sections: DocumentSection[];
    detected_values: DetectedValue[];
    statistics: {
        total_sections: number;
        total_detected_values: number;
        values_by_type: Record<string, number>;
        average_confidence: number;
        high_confidence_count: number;
        suggested_placeholder_count: number;
    };
    created_at: string;
}

interface GenerateClausesResponse {
    clause_id: number;
    clause_title: string;
    content_html: string;
    placeholder_count: number;
}

type ImportStep = "upload" | "analyzing" | "mapping" | "generating" | "complete";

interface MagicWordImportProps {
    onSuccess?: (clauseId: number) => void;
    onCancel?: () => void;
}

// API Functions
async function analyzeDocument(
    file: File,
    generatePdf: boolean = false
): Promise<MagicAnalysisResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiFetch(`/api/v1/word-import/magic/analyze?generate_pdf=${generatePdf}`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Analyse fehlgeschlagen");
    }

    return response.json();
}

async function generateClause(
    documentId: string,
    placeholderMapping: Record<string, string>,
    clauseTitle: string,
    category: string,
    countryCode: string
): Promise<GenerateClausesResponse> {
    const response = await apiFetch("/api/v1/word-import/magic/generate-clause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            document_id: documentId,
            placeholder_mapping: placeholderMapping,
            clause_title: clauseTitle,
            category,
            country_code: countryCode,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Generierung fehlgeschlagen");
    }

    return response.json();
}

async function clearCache(documentId: string) {
    await apiFetch(`/api/v1/word-import/magic/cache/${documentId}`, {
        method: "DELETE",
    });
}

// Main Component
export function MagicWordImport({ onSuccess, onCancel }: MagicWordImportProps) {
    // State
    const [step, setStep] = useState<ImportStep>("upload");
    const [file, setFile] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState<MagicAnalysisResult | null>(
        null
    );
    const [placeholderMapping, setPlaceholderMapping] = useState<
        Record<string, string>
    >({});
    const [clauseTitle, setClauseTitle] = useState("");
    const [category, setCategory] = useState("Importiert");
    const [countryCode, setCountryCode] = useState("DE");
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [generatedClause, setGeneratedClause] =
        useState<GenerateClausesResponse | null>(null);

    // Mutations
    const analyzeMutation = useMutation({
        mutationFn: (file: File) => analyzeDocument(file, false),
        onSuccess: (result) => {
            setAnalysisResult(result);
            setClauseTitle(
                result.original_filename.replace(/\.docx?$/i, "") || "Importierter Textbaustein"
            );
            setStep("mapping");
        },
        onError: (err: Error) => {
            setError(err.message);
            setStep("upload");
        },
    });

    const generateMutation = useMutation({
        mutationFn: () =>
            generateClause(
                analysisResult!.document_id,
                placeholderMapping,
                clauseTitle,
                category,
                countryCode
            ),
        onSuccess: (result) => {
            setGeneratedClause(result);
            setStep("complete");
        },
        onError: (err: Error) => {
            setError(err.message);
        },
    });

    // Handlers
    const handleFileSelect = useCallback(
        (selectedFile: File) => {
            // Validate file
            if (!selectedFile.name.match(/\.docx?$/i)) {
                setError("Nur .docx Dateien werden unterstützt.");
                return;
            }

            if (selectedFile.size > 10 * 1024 * 1024) {
                setError("Datei zu groß. Maximum: 10 MB");
                return;
            }

            setFile(selectedFile);
            setError(null);
            setStep("analyzing");
            analyzeMutation.mutate(selectedFile);
        },
        [analyzeMutation]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile) {
                handleFileSelect(droppedFile);
            }
        },
        [handleFileSelect]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleMappingComplete = useCallback(
        (mapping: Record<string, string>) => {
            setPlaceholderMapping(mapping);
            setStep("generating");
        },
        []
    );

    const handleMappingCancel = useCallback(() => {
        if (analysisResult) {
            clearCache(analysisResult.document_id);
        }
        setStep("upload");
        setFile(null);
        setAnalysisResult(null);
    }, [analysisResult]);

    const handleGenerateClause = useCallback(() => {
        generateMutation.mutate();
    }, [generateMutation]);

    const handleReset = useCallback(() => {
        if (analysisResult) {
            clearCache(analysisResult.document_id);
        }
        setStep("upload");
        setFile(null);
        setAnalysisResult(null);
        setPlaceholderMapping({});
        setGeneratedClause(null);
        setError(null);
    }, [analysisResult]);

    // Render step content
    const renderUploadStep = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto"
        >
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                        <Sparkles className="w-6 h-6 text-yellow-500" />
                        Magic Word-Import
                    </CardTitle>
                    <p className="text-muted-foreground">
                        Ziehe dein Word-Dokument hierher - wir erkennen automatisch alle
                        Platzhalter
                    </p>
                </CardHeader>
                <CardContent>
                    {/* Drop zone */}
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={cn(
                            "border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer",
                            isDragging
                                ? "border-blue-500 bg-blue-50"
                                : "border-warm-300 hover:border-warm-400 hover:bg-warm-50"
                        )}
                        onClick={() => document.getElementById("file-input")?.click()}
                    >
                        <input
                            id="file-input"
                            type="file"
                            accept=".docx"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(file);
                            }}
                        />

                        <Upload
                            className={cn(
                                "w-16 h-16 mx-auto mb-4",
                                isDragging ? "text-blue-500" : "text-warm-400"
                            )}
                        />

                        <p className="text-lg font-medium mb-2">
                            {isDragging
                                ? "Datei hier ablegen..."
                                : "Klicken oder Datei hierher ziehen"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Unterstützt: .docx (max. 10 MB)
                        </p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-red-800">Fehler</p>
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Features list */}
                    <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-green-50 rounded-lg">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                            <p className="text-sm font-medium">Automatische Erkennung</p>
                            <p className="text-xs text-muted-foreground">
                                Daten, Beträge, Namen
                            </p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <Sparkles className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                            <p className="text-sm font-medium">KI-Vorschläge</p>
                            <p className="text-xs text-muted-foreground">
                                Intelligente Zuordnung
                            </p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                            <p className="text-sm font-medium">Ein-Klick Import</p>
                            <p className="text-xs text-muted-foreground">
                                Keine IT-Kenntnisse nötig
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );

    const renderAnalyzingStep = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md mx-auto text-center"
        >
            <Card>
                <CardContent className="pt-8 pb-8">
                    <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-spin" />
                    <h3 className="text-xl font-semibold mb-2">Dokument wird analysiert...</h3>
                    <p className="text-muted-foreground mb-4">
                        Wir erkennen automatisch alle potentiellen Platzhalter
                    </p>

                    {file && (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <FileText className="w-4 h-4" />
                            {file.name}
                        </div>
                    )}

                    <div className="mt-6">
                        <Progress value={undefined} className="h-2" />
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );

    const renderGeneratingStep = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-lg mx-auto"
        >
            <Card>
                <CardHeader>
                    <CardTitle>Textbaustein erstellen</CardTitle>
                    <p className="text-muted-foreground">
                        {Object.keys(placeholderMapping).length} Platzhalter werden zugeordnet
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Clause title */}
                    <div>
                        <Label htmlFor="clause-title">Titel des Textbausteins</Label>
                        <Input
                            id="clause-title"
                            value={clauseTitle}
                            onChange={(e) => setClauseTitle(e.target.value)}
                            placeholder="z.B. Arbeitsvertrag Vollzeit"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <Label htmlFor="category">Kategorie</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Importiert">Importiert</SelectItem>
                                <SelectItem value="Verträge">Verträge</SelectItem>
                                <SelectItem value="Briefe">Briefe</SelectItem>
                                <SelectItem value="Bescheinigungen">Bescheinigungen</SelectItem>
                                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Country */}
                    <div>
                        <Label htmlFor="country">Land</Label>
                        <Select value={countryCode} onValueChange={setCountryCode}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DE">Deutschland</SelectItem>
                                <SelectItem value="IT">Italien</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-warm-50 rounded-lg">
                        <h4 className="font-medium mb-2">Zusammenfassung</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>
                                Datei: <strong>{analysisResult?.original_filename}</strong>
                            </li>
                            <li>
                                Erkannte Werte:{" "}
                                <strong>
                                    {analysisResult?.statistics.total_detected_values}
                                </strong>
                            </li>
                            <li>
                                Zugeordnete Platzhalter:{" "}
                                <strong>{Object.keys(placeholderMapping).length}</strong>
                            </li>
                        </ul>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setStep("mapping")}
                            className="flex-1"
                        >
                            Zurück
                        </Button>
                        <Button
                            onClick={handleGenerateClause}
                            disabled={generateMutation.isPending || !clauseTitle}
                            className="flex-1"
                        >
                            {generateMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generiere...
                                </>
                            ) : (
                                <>
                                    Textbaustein erstellen
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );

    const renderCompleteStep = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-lg mx-auto text-center"
        >
            <Card>
                <CardContent className="pt-8 pb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                    >
                        <CheckCircle2 className="w-20 h-20 mx-auto mb-4 text-green-500" />
                    </motion.div>

                    <h3 className="text-2xl font-semibold mb-2">Import erfolgreich!</h3>
                    <p className="text-muted-foreground mb-6">
                        Der Textbaustein wurde erstellt und kann sofort verwendet werden.
                    </p>

                    {generatedClause && (
                        <div className="p-4 bg-green-50 rounded-lg mb-6 text-left">
                            <h4 className="font-medium text-green-800 mb-2">
                                {generatedClause.clause_title}
                            </h4>
                            <ul className="text-sm text-green-700 space-y-1">
                                <li>Textbaustein-ID: #{generatedClause.clause_id}</li>
                                <li>
                                    Platzhalter eingefügt: {generatedClause.placeholder_count}
                                </li>
                            </ul>
                        </div>
                    )}

                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={handleReset}>
                            Weiteren Import starten
                        </Button>
                        <Button
                            onClick={() => {
                                if (onSuccess && generatedClause) {
                                    onSuccess(generatedClause.clause_id);
                                }
                            }}
                        >
                            Zum Textbaustein
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );

    // Full-screen mapping editor
    if (step === "mapping" && analysisResult) {
        return (
            <div className="fixed inset-0 z-50 bg-white">
                <SideBySideMappingEditor
                    analysisResult={analysisResult}
                    onComplete={handleMappingComplete}
                    onCancel={handleMappingCancel}
                />
            </div>
        );
    }

    // Regular steps
    return (
        <div className="min-h-[600px] p-8">
            {/* Progress indicator */}
            <div className="max-w-2xl mx-auto mb-8">
                <div className="flex items-center justify-between">
                    {["upload", "analyzing", "mapping", "generating", "complete"].map(
                        (s, i) => (
                            <React.Fragment key={s}>
                                <div
                                    className={cn(
                                        "flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium",
                                        step === s
                                            ? "border-blue-500 bg-blue-500 text-white"
                                            : ["upload", "analyzing", "mapping", "generating", "complete"].indexOf(
                                                  step
                                              ) > i
                                            ? "border-green-500 bg-green-500 text-white"
                                            : "border-warm-300 text-warm-400"
                                    )}
                                >
                                    {["upload", "analyzing", "mapping", "generating", "complete"].indexOf(
                                        step
                                    ) > i ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : (
                                        i + 1
                                    )}
                                </div>
                                {i < 4 && (
                                    <div
                                        className={cn(
                                            "flex-1 h-1 mx-2",
                                            ["upload", "analyzing", "mapping", "generating", "complete"].indexOf(
                                                step
                                            ) > i
                                                ? "bg-green-500"
                                                : "bg-warm-200"
                                        )}
                                    />
                                )}
                            </React.Fragment>
                        )
                    )}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Upload</span>
                    <span>Analyse</span>
                    <span>Mapping</span>
                    <span>Generieren</span>
                    <span>Fertig</span>
                </div>
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
                {step === "upload" && renderUploadStep()}
                {step === "analyzing" && renderAnalyzingStep()}
                {step === "generating" && renderGeneratingStep()}
                {step === "complete" && renderCompleteStep()}
            </AnimatePresence>

            {/* Cancel button */}
            {step !== "complete" && step !== "mapping" && onCancel && (
                <div className="text-center mt-8">
                    <Button variant="ghost" onClick={onCancel}>
                        <X className="w-4 h-4 mr-2" />
                        Abbrechen
                    </Button>
                </div>
            )}
        </div>
    );
}

export default MagicWordImport;
