/**
 * BulkUploadValidator Component
 *
 * Pre-import validation for CSV/Excel files:
 * - File upload with drag & drop
 * - Automatic validation
 * - Error/warning display
 * - Data preview
 * - Generation trigger
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    useValidateBulkUpload,
    useStartBulkGeneration,
    useBulkJobStatus,
    getBulkTemplateUrl,
    type BulkValidationResult,
} from "@/hooks/useApi";
import {
    Upload,
    FileSpreadsheet,
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    Download,
    X,
    Loader2,
    Play,
    Eye,
    FileText,
    Table,
} from "lucide-react";

interface BulkUploadValidatorProps {
    documentTypeId: number;
    documentTypeName: string;
    onComplete?: () => void;
}

export const BulkUploadValidator = ({
    documentTypeId,
    documentTypeName,
}: BulkUploadValidatorProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [validationResult, setValidationResult] = useState<BulkValidationResult | null>(null);
    const [jobId, setJobId] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const validateMutation = useValidateBulkUpload();
    const startGeneration = useStartBulkGeneration();
    const { data: jobStatus } = useBulkJobStatus(jobId || 0, !!jobId);

    // Handle file selection
    const handleFileSelect = useCallback(async (selectedFile: File) => {
        setFile(selectedFile);
        setValidationResult(null);
        setJobId(null);

        try {
            const result = await validateMutation.mutateAsync({
                documentTypeId,
                file: selectedFile,
            });
            setValidationResult(result);
        } catch (error) {
            console.error("Validation failed:", error);
        }
    }, [documentTypeId, validateMutation]);

    // Handle drag events
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragIn = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragOut = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const droppedFile = files[0];
            if (isValidFileType(droppedFile)) {
                handleFileSelect(droppedFile);
            }
        }
    };

    const isValidFileType = (file: File) => {
        const validTypes = [
            "text/csv",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ];
        return validTypes.includes(file.type) ||
            file.name.endsWith(".csv") ||
            file.name.endsWith(".xlsx") ||
            file.name.endsWith(".xls");
    };

    // Start generation
    const handleStartGeneration = async () => {
        if (!file || !validationResult?.is_valid) return;

        try {
            const result = await startGeneration.mutateAsync({
                documentTypeId,
                file,
                outputFormat: "pdf",
            });
            setJobId(result.job_id);
        } catch (error) {
            console.error("Generation failed:", error);
        }
    };

    // Reset
    const handleReset = () => {
        setFile(null);
        setValidationResult(null);
        setJobId(null);
    };

    // Job completed
    if (jobStatus?.status === "completed") {
        return (
            <Card className="border-green-200 bg-green-50">
                <CardContent className="py-8 text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-green-800 mb-2">
                        Generierung abgeschlossen
                    </h3>
                    <p className="text-green-700 mb-4">
                        {jobStatus.processed} Dokumente wurden erfolgreich erstellt.
                    </p>
                    <div className="flex gap-2 justify-center">
                        <Button
                            onClick={() => {
                                if (jobStatus.result_file_path) {
                                    window.open(`/api/v1/bulk/jobs/${jobId}/download`, "_blank");
                                }
                            }}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            ZIP herunterladen
                        </Button>
                        <Button variant="outline" onClick={handleReset}>
                            Neue Generierung
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Job in progress
    const isJobInProgress = jobId && jobStatus && !["completed", "failed", "cancelled"].includes(jobStatus.status);
    if (isJobInProgress) {
        const progressPercent = jobStatus.total > 0
            ? Math.round((jobStatus.processed / jobStatus.total) * 100)
            : 0;
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="text-center mb-6">
                        <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                        <h3 className="text-lg font-semibold mb-2">
                            Dokumente werden generiert...
                        </h3>
                        <p className="text-muted-foreground">
                            {jobStatus.processed} von {jobStatus.total} verarbeitet
                        </p>
                    </div>
                    <Progress value={progressPercent} className="h-3" />
                    <p className="text-center text-sm text-muted-foreground mt-2">
                        {progressPercent}%
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Template Download */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" />
                        Vorlage herunterladen
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Laden Sie eine Vorlage herunter, die alle erforderlichen Spalten
                        für "{documentTypeName}" enthält.
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getBulkTemplateUrl(documentTypeId, "xlsx"), "_blank")}
                        >
                            <Table className="w-4 h-4 mr-2" />
                            Excel (.xlsx)
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getBulkTemplateUrl(documentTypeId, "csv"), "_blank")}
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            CSV
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        Datei hochladen
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!file ? (
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                isDragging
                                    ? "border-primary bg-primary/5"
                                    : "border-muted-foreground/25 hover:border-primary/50"
                            }`}
                            onDragEnter={handleDragIn}
                            onDragLeave={handleDragOut}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-lg font-medium mb-2">
                                Datei hierher ziehen
                            </p>
                            <p className="text-muted-foreground mb-4">
                                oder klicken um auszuwählen
                            </p>
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                id="bulk-file-input"
                                onChange={(e) => {
                                    const selectedFile = e.target.files?.[0];
                                    if (selectedFile) handleFileSelect(selectedFile);
                                }}
                            />
                            <Button
                                variant="outline"
                                onClick={() => document.getElementById("bulk-file-input")?.click()}
                            >
                                Datei auswählen
                            </Button>
                            <p className="text-xs text-muted-foreground mt-4">
                                Unterstützte Formate: CSV, Excel (.xlsx, .xls)
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet className="w-8 h-8 text-primary" />
                                <div>
                                    <p className="font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleReset}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    {validateMutation.isPending && (
                        <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Datei wird validiert...
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Validation Results */}
            {validationResult && (
                <Card className={validationResult.is_valid ? "border-green-200" : "border-red-200"}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            {validationResult.is_valid ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                            )}
                            Validierungsergebnis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-2xl font-bold">{validationResult.row_count}</p>
                                <p className="text-xs text-muted-foreground">Zeilen</p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-2xl font-bold">{validationResult.column_count}</p>
                                <p className="text-xs text-muted-foreground">Spalten</p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-2xl font-bold text-red-500">
                                    {validationResult.field_errors.length}
                                </p>
                                <p className="text-xs text-muted-foreground">Fehler</p>
                            </div>
                        </div>

                        {/* Errors */}
                        {validationResult.errors.length > 0 && (
                            <div className="p-3 bg-red-50 rounded-lg">
                                <h4 className="font-medium text-red-800 flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Fehler
                                </h4>
                                <ul className="text-sm text-red-700 space-y-1">
                                    {validationResult.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Warnings */}
                        {validationResult.warnings.length > 0 && (
                            <div className="p-3 bg-yellow-50 rounded-lg">
                                <h4 className="font-medium text-yellow-800 flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Warnungen
                                </h4>
                                <ul className="text-sm text-yellow-700 space-y-1">
                                    {validationResult.warnings.map((warn, i) => (
                                        <li key={i}>{warn}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Field Errors Table */}
                        {validationResult.field_errors.length > 0 && (
                            <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                    Feldvalidierungsfehler
                                </h4>
                                <div className="overflow-x-auto max-h-48">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="p-2 text-left">Zeile</th>
                                                <th className="p-2 text-left">Spalte</th>
                                                <th className="p-2 text-left">Wert</th>
                                                <th className="p-2 text-left">Fehler</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validationResult.field_errors.slice(0, 20).map((err, i) => (
                                                <tr key={i} className="border-b">
                                                    <td className="p-2">{err.row}</td>
                                                    <td className="p-2 font-mono text-xs">{err.column}</td>
                                                    <td className="p-2 max-w-[100px] truncate">{err.value}</td>
                                                    <td className="p-2 text-red-600">{err.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {validationResult.field_errors.length > 20 && (
                                        <p className="text-xs text-muted-foreground mt-2 text-center">
                                            ... und {validationResult.field_errors.length - 20} weitere Fehler
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Preview */}
                        {validationResult.preview_data.length > 0 && (
                            <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    Datenvorschau (erste 5 Zeilen)
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                {validationResult.detected_columns.map((col) => (
                                                    <th key={col} className="p-2 text-left font-mono">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validationResult.preview_data.map((row, i) => (
                                                <tr key={i} className="border-b">
                                                    {validationResult.detected_columns.map((col) => (
                                                        <td key={col} className="p-2 max-w-[120px] truncate">
                                                            {String(row[col] || "")}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={handleReset}>
                                Andere Datei wählen
                            </Button>
                            {validationResult.is_valid && (
                                <Button
                                    onClick={handleStartGeneration}
                                    disabled={startGeneration.isPending}
                                >
                                    {startGeneration.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Play className="w-4 h-4 mr-2" />
                                    )}
                                    {validationResult.row_count} Dokumente generieren
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
