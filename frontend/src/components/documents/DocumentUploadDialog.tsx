/**
 * DocumentUploadDialog - Upload and analyze existing documents
 *
 * ContractHero-inspired: Upload PDFs/DOCXs and extract metadata with AI.
 *
 * Features:
 * - Drag & drop upload
 * - AI-powered field extraction
 * - Preview extracted data
 * - One-click to create from extracted data
 *
 * Privacy: Uses Mistral (EU) or Ollama (local)
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  X,
  ArrowRight,
  FileIcon,
  Zap,
  Brain,
  Shield,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";

// Types
interface ExtractedField {
  field_name: string;
  field_value: string;
  confidence: number;
  source_text?: string;
}

interface ExtractionResult {
  success: boolean;
  document_type_guess: string | null;
  document_type_confidence: number;
  extracted_fields: ExtractedField[];
  raw_text_preview: string | null;
  page_count: number;
  file_type: string;
  provider: string;
  error: string | null;
}

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Field name translations
const FIELD_LABELS: Record<string, string> = {
  vorname: "Vorname",
  nachname: "Nachname",
  position: "Position",
  gehalt: "Gehalt",
  eintrittsdatum: "Eintrittsdatum",
  wochenstunden: "Wochenstunden",
  urlaubstage: "Urlaubstage",
  probezeit: "Probezeit",
};

export function DocumentUploadDialog({
  open,
  onOpenChange,
}: DocumentUploadDialogProps) {
  const navigate = useNavigate();
  const isUploadEnabled = useFeatureEnabled("enable_document_upload");
  const isAIEnabled = useFeatureEnabled("enable_ai_extraction");

  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [useAI, setUseAI] = useState(isAIEnabled);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Reset state
  const reset = useCallback(() => {
    setResult(null);
    setUploadedFile(null);
    setIsUploading(false);
  }, []);

  // Handle file upload
  const handleUpload = useCallback(
    async (file: File) => {
      setUploadedFile(file);
      setIsUploading(true);
      setResult(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("use_ai", String(useAI && isAIEnabled));

        const response = await api.post<ExtractionResult>(
          "/api/v1/document-upload/upload",
          formData
        );

        setResult(response.data);

        if (response.data.success) {
          toast.success("Dokument analysiert", {
            description: `${response.data.extracted_fields.length} Felder erkannt`,
          });
        }
      } catch (err) {
        console.error("Upload failed:", err);
        toast.error("Upload fehlgeschlagen");
        setResult({
          success: false,
          document_type_guess: null,
          document_type_confidence: 0,
          extracted_fields: [],
          raw_text_preview: null,
          page_count: 0,
          file_type: "",
          provider: "error",
          error: "Analyse fehlgeschlagen. Bitte versuchen Sie es erneut.",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [useAI, isAIEnabled]
  );

  // Dropzone with file size limit (25MB)
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleUpload(acceptedFiles[0]);
      }
    },
    onDropRejected: (rejectedFiles) => {
      const rejection = rejectedFiles[0];
      if (rejection?.errors?.[0]?.code === "file-too-large") {
        toast.error("Datei zu groß", {
          description: "Maximale Dateigröße: 25 MB",
        });
      } else if (rejection?.errors?.[0]?.code === "file-invalid-type") {
        toast.error("Ungültiges Format", {
          description: "Nur PDF und DOCX Dateien werden unterstützt",
        });
      }
    },
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx",
      ],
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled: isUploading,
  });

  // Use extracted data to create document
  const handleUseData = useCallback(() => {
    if (!result || !result.success) return;

    // Build initial data from extracted fields
    const initialData: Record<string, string> = {};
    result.extracted_fields.forEach((field) => {
      initialData[field.field_name] = field.field_value;
    });

    // Navigate to generator with pre-filled data
    const params = new URLSearchParams();
    if (result.document_type_guess) {
      params.set("type", result.document_type_guess);
    }
    if (Object.keys(initialData).length > 0) {
      params.set("data", JSON.stringify(initialData));
    }

    onOpenChange(false);
    navigate(`/generate?${params.toString()}`);
  }, [result, navigate, onOpenChange]);

  if (!isUploadEnabled) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Dokument hochladen
          </DialogTitle>
          <DialogDescription>
            Laden Sie ein bestehendes Dokument hoch und extrahieren Sie Daten
            automatisch
          </DialogDescription>
        </DialogHeader>

        {/* Result View */}
        {result ? (
          <div className="space-y-4">
            {/* Status */}
            <div
              className={`p-4 rounded-lg border ${
                result.success
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {result.success
                      ? "Analyse erfolgreich"
                      : "Analyse fehlgeschlagen"}
                  </p>
                  {result.error && (
                    <p className="text-sm text-red-600 mt-1">{result.error}</p>
                  )}
                  {result.success && (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {result.document_type_guess || "Unbekannt"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(result.document_type_confidence * 100)}%
                        Konfidenz
                      </span>
                      <span className="text-xs text-muted-foreground">
                        • {result.page_count} Seite(n)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Extracted Fields */}
            {result.success && result.extracted_fields.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Erkannte Felder ({result.extracted_fields.length})
                </h4>
                <div className="grid gap-2">
                  {result.extracted_fields.map((field, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <span className="text-sm font-medium">
                        {FIELD_LABELS[field.field_name] || field.field_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{field.field_value}</span>
                        <Badge
                          variant="outline"
                          className={
                            field.confidence > 0.8
                              ? "bg-green-50 text-green-700"
                              : field.confidence > 0.5
                              ? "bg-yellow-50 text-yellow-700"
                              : "bg-gray-50 text-gray-700"
                          }
                        >
                          {Math.round(field.confidence * 100)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provider Info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {result.provider === "ollama" ? (
                <>
                  <Shield className="w-3 h-3" />
                  Lokal verarbeitet (Ollama)
                </>
              ) : result.provider === "mistral" ? (
                <>
                  <Shield className="w-3 h-3" />
                  EU-hosted (Mistral AI)
                </>
              ) : result.provider === "pattern" ? (
                <>
                  <Zap className="w-3 h-3" />
                  Musterbasiert extrahiert
                </>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Zurück
              </Button>
              {/* Retry button for failed uploads */}
              {!result.success && uploadedFile && (
                <Button
                  onClick={() => handleUpload(uploadedFile)}
                  className="flex-1 gap-2"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  Erneut versuchen
                </Button>
              )}
              {result.success && result.extracted_fields.length > 0 && (
                <Button onClick={handleUseData} className="flex-1 gap-2">
                  Daten verwenden
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Upload View */
          <div className="space-y-4">
            {/* AI Toggle */}
            {isAIEnabled && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <Label htmlFor="use-ai" className="font-medium">
                    KI-Extraktion verwenden
                  </Label>
                </div>
                <Switch
                  id="use-ai"
                  checked={useAI}
                  onCheckedChange={setUseAI}
                  disabled={isUploading}
                />
              </div>
            )}

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }
                ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <input {...getInputProps()} />

              {isUploading ? (
                <div className="space-y-3">
                  <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
                  <p className="font-medium">Dokument wird analysiert...</p>
                  <Progress value={66} className="w-48 mx-auto" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {isDragActive
                        ? "Dokument hier ablegen"
                        : "Dokument hierher ziehen"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      oder klicken zum Auswählen
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="gap-1">
                        <FileIcon className="w-3 h-3" />
                        PDF
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <FileText className="w-3 h-3" />
                        DOCX
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Max. 25 MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Privacy Note */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                Ihre Dokumente werden datenschutzkonform verarbeitet.{" "}
                {useAI
                  ? "KI-Analyse über EU-hosted Mistral AI oder lokales Ollama."
                  : "Nur musterbasierte Extraktion ohne externe Dienste."}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DocumentUploadDialog;
