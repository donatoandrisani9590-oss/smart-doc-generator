/**
 * ExportDialog Component (16.6)
 *
 * Dialog for exporting selected documents:
 * - ZIP download
 * - PDF merge
 * - Export preview with file sizes
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    useExportFormats,
    useExportPreview,
    useExportZip,
    useMergePdf,
    type ExportPreview,
} from "@/hooks/useApi";
import {
    X,
    Download,
    FileArchive,
    FilePlus,
    Loader2,
    FileText,
    AlertCircle,
} from "lucide-react";

interface ExportDialogProps {
    documentIds: number[];
    onClose: () => void;
}

export const ExportDialog = ({ documentIds, onClose }: ExportDialogProps) => {
    const [exportFormat, setExportFormat] = useState<"zip" | "merged_pdf">("zip");
    const [filenamePrefix, setFilenamePrefix] = useState("export");
    const [includeSeparators, setIncludeSeparators] = useState(false);
    const [preview, setPreview] = useState<ExportPreview | null>(null);

    const { data: _formats } = useExportFormats();
    const exportPreview = useExportPreview();
    const exportZip = useExportZip();
    const mergePdf = useMergePdf();

    const isExporting = exportZip.isPending || mergePdf.isPending;
    const error = exportZip.error || mergePdf.error;

    // Load preview on mount
    useEffect(() => {
        if (documentIds.length > 0) {
            exportPreview.mutate(documentIds, {
                onSuccess: (data) => setPreview(data),
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load preview once on mount; exportPreview mutation is stable
    }, [documentIds]);

    const handleExport = async () => {
        if (exportFormat === "zip") {
            await exportZip.mutateAsync({
                documentIds,
                filenamePrefix,
            });
            onClose();
        } else {
            await mergePdf.mutateAsync({
                documentIds,
                outputFilename: filenamePrefix,
                includeSeparatorPages: includeSeparators,
            });
            onClose();
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Download className="w-5 h-5" />
                            Dokumente exportieren
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {documentIds.length} Dokument{documentIds.length !== 1 ? "e" : ""} ausgewählt
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Export Format Selection */}
                    <div>
                        <label className="text-sm font-medium mb-3 block">Export-Format</label>
                        <div className="grid grid-cols-2 gap-3">
                            {/* ZIP Option */}
                            <button
                                onClick={() => setExportFormat("zip")}
                                disabled={!preview?.can_zip}
                                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                                    exportFormat === "zip"
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                } ${!preview?.can_zip ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                <FileArchive className="w-8 h-8 mb-2 text-primary" />
                                <div className="font-medium">ZIP-Archiv</div>
                                <div className="text-sm text-muted-foreground">
                                    Alle Dateien einzeln herunterladen
                                </div>
                            </button>

                            {/* Merge PDF Option */}
                            <button
                                onClick={() => setExportFormat("merged_pdf")}
                                disabled={!preview?.can_merge_pdf}
                                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                                    exportFormat === "merged_pdf"
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                } ${!preview?.can_merge_pdf ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                <FilePlus className="w-8 h-8 mb-2 text-primary" />
                                <div className="font-medium">PDF zusammenführen</div>
                                <div className="text-sm text-muted-foreground">
                                    Zu einer PDF-Datei kombinieren
                                </div>
                                {preview && preview.pdf_count < documentIds.length && (
                                    <div className="text-xs text-amber-600 mt-1">
                                        Nur {preview.pdf_count} PDF{preview.pdf_count !== 1 ? "s" : ""} verfügbar
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Filename */}
                    <div>
                        <label htmlFor="export-filename" className="text-sm font-medium mb-2 block">
                            Dateiname
                        </label>
                        <Input
                            id="export-filename"
                            value={filenamePrefix}
                            onChange={(e) => setFilenamePrefix(e.target.value)}
                            placeholder="export"
                            aria-label="Dateiname für Export"
                            aria-describedby="filename-preview"
                        />
                        <p id="filename-preview" className="text-xs text-muted-foreground mt-1">
                            Wird zu: {filenamePrefix}.{exportFormat === "zip" ? "zip" : "pdf"}
                        </p>
                    </div>

                    {/* PDF Merge Options */}
                    {exportFormat === "merged_pdf" && (
                        <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeSeparators}
                                    onChange={(e) => setIncludeSeparators(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm">Trennseiten zwischen Dokumenten einfügen</span>
                            </label>
                        </div>
                    )}

                    {/* Preview */}
                    {exportPreview.isPending ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : preview ? (
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between text-sm mb-3">
                                    <span className="text-muted-foreground">Export-Vorschau</span>
                                    <span className="font-medium">{formatFileSize(preview.total_size_bytes)}</span>
                                </div>

                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {preview.files.slice(0, 10).map((file) => (
                                        <div
                                            key={file.document_id}
                                            className="flex items-center justify-between text-sm py-1"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span className="truncate">{file.filename}</span>
                                                {!file.is_pdf && exportFormat === "merged_pdf" && (
                                                    <span className="text-xs text-amber-600">(übersprungen)</span>
                                                )}
                                            </div>
                                            <span className="text-muted-foreground shrink-0">
                                                {formatFileSize(file.size_bytes)}
                                            </span>
                                        </div>
                                    ))}
                                    {preview.files.length > 10 && (
                                        <div className="text-sm text-muted-foreground text-center py-2">
                                            ... und {preview.files.length - 10} weitere Dateien
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}

                    {/* Error */}
                    {error && (
                        <div
                            role="alert"
                            className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                        >
                            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                            <span>{error.message}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} disabled={isExporting}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || (exportFormat === "merged_pdf" && !preview?.can_merge_pdf)}
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Exportiere...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Exportieren
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
