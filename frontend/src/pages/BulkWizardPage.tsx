/**
 * BulkWizardPage - Smart 5-Step Bulk Operations Wizard
 *
 * Replaces/complements the simple BulkUpload with an AI-powered wizard:
 * 1. Upload   - Drag & Drop CSV/Excel file
 * 2. Mapping  - AI-suggested column mapping
 * 3. Preview  - First 3 rows validation
 * 4. Execute  - SSE-streamed progress
 * 5. Results  - Summary + error report
 *
 * Jony Ive aesthetic: border-0 rounded-2xl shadow-[var(--shadow-elevated)]
 */

import { useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Upload,
  FileSpreadsheet,
  Columns3,
  Eye,
  Play,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  X,
  AlertCircle,
  Loader2,
  Download,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDocumentTypes, type DocumentType } from "@/hooks/useApi";
import { apiFetch } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { apiStreamSSE } from "@/lib/api-stream";
import { cn } from "@/lib/utils";
import {
  ColumnMapper,
  type ColumnSuggestion,
  type FormFieldOption,
  type ColumnMapping,
} from "@/components/bulk/ColumnMapper";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UploadResponse {
  job_id: string;
  row_count: number;
  columns: string[];
  suggestions: ColumnSuggestion[];
  form_fields: FormFieldOption[];
}

interface PreviewRow {
  row_number: number;
  mapped_values: Record<string, string>;
  errors: Array<{ field: string; message: string }>;
}

interface PreviewResponse {
  rows: PreviewRow[];
  valid_count: number;
  error_count: number;
}

interface RowError {
  row: number;
  field?: string;
  message: string;
  employee_name?: string;
}

// ─── Wizard Steps Config ─────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: "upload", label: "Hochladen", icon: Upload },
  { id: "mapping", label: "Zuordnung", icon: Columns3 },
  { id: "preview", label: "Vorschau", icon: Eye },
  { id: "execute", label: "Generierung", icon: Play },
  { id: "results", label: "Ergebnis", icon: CheckCircle2 },
] as const;

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 py-6">
      {WIZARD_STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  isCompleted &&
                    "bg-secondary text-white shadow-sm",
                  isCurrent &&
                    "bg-primary text-white shadow-md scale-110",
                  !isCompleted &&
                    !isCurrent &&
                    "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium transition-colors",
                  isCurrent
                    ? "text-primary"
                    : isCompleted
                    ? "text-secondary"
                    : "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting line */}
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "w-12 lg:w-20 h-0.5 mx-1 mt-[-18px] transition-colors duration-300",
                  index < currentStep
                    ? "bg-secondary"
                    : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BulkWizardPage() {
  const navigate = useNavigate();
  const { data: documentTypes, isLoading: docTypesLoading } = useDocumentTypes();

  // ── Wizard State ──────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>("");

  // Step 1: Upload
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Mapping
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  // Step 3: Preview
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Step 4: Execute
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionCurrent, setExecutionCurrent] = useState(0);
  const [executionTotal, setExecutionTotal] = useState(0);
  const [currentEmployeeName, setCurrentEmployeeName] = useState("");
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Step 5: Results
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setUploadError(null);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        setFile(selected);
        setUploadError(null);
      }
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (!file || !selectedDocTypeId) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type_id", selectedDocTypeId);

      const response = await apiFetch("/api/v1/smart/bulk/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({
          detail: "Upload fehlgeschlagen",
        }));
        throw new Error(errorBody.detail || "Upload fehlgeschlagen");
      }

      const data: UploadResponse = await response.json();
      setUploadResult(data);

      // Initialize mappings from AI suggestions
      const initialMappings: ColumnMapping[] = data.suggestions.map((s) => ({
        csv_column: s.csv_column,
        form_field: s.suggested_field ?? "",
      }));
      setMappings(initialMappings);

      // Move to Step 2
      setCurrentStep(1);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload fehlgeschlagen"
      );
    } finally {
      setIsUploading(false);
    }
  }, [file, selectedDocTypeId]);

  const handleMappingChange = useCallback(
    (csvColumn: string, formField: string) => {
      setMappings((prev) =>
        prev.map((m) =>
          m.csv_column === csvColumn ? { ...m, form_field: formField } : m
        )
      );
    },
    []
  );

  const handlePreview = useCallback(async () => {
    if (!uploadResult) return;

    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      const { data } = await api.post<PreviewResponse>(
        "/api/v1/smart/bulk/preview",
        {
          job_id: uploadResult.job_id,
          column_mapping: mappings.reduce(
            (acc, m) => {
              if (m.form_field && m.form_field !== "ignore") {
                acc[m.csv_column] = m.form_field;
              }
              return acc;
            },
            {} as Record<string, string>
          ),
          document_type_id: parseInt(selectedDocTypeId),
        }
      );
      setPreview(data);
      setCurrentStep(2);
    } catch (err) {
      setPreviewError(
        err instanceof Error
          ? err.message
          : "Vorschau konnte nicht geladen werden"
      );
    } finally {
      setIsPreviewLoading(false);
    }
  }, [uploadResult, mappings, selectedDocTypeId]);

  const handleExecute = useCallback(async () => {
    if (!uploadResult) return;

    setIsExecuting(true);
    setRowErrors([]);
    setExecutionProgress(0);
    setExecutionCurrent(0);
    setCurrentEmployeeName("");
    setCurrentStep(3);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      for await (const event of apiStreamSSE(
        "/api/v1/smart/bulk/execute",
        { job_id: uploadResult.job_id },
        controller.signal
      )) {
        if (event.type === "progress") {
          setExecutionProgress(event.percent ?? 0);
          setExecutionCurrent(event.current ?? 0);
          setExecutionTotal(event.total ?? 0);
          if (event.employee_name) {
            setCurrentEmployeeName(event.employee_name);
          }
        }

        if (event.type === "row_error") {
          setRowErrors((prev) => [
            ...prev,
            {
              row: event.row ?? 0,
              field: event.field,
              message: event.message ?? "Unbekannter Fehler",
              employee_name: event.employee_name,
            },
          ]);
        }

        if (event.type === "done") {
          setSuccessCount(event.success_count ?? 0);
          setErrorCount(event.error_count ?? 0);
          setCurrentStep(4);
          setIsExecuting(false);
        }

        if (event.type === "error") {
          throw new Error(event.message || "Generierung fehlgeschlagen");
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // Cancelled by user
        setCurrentStep(4);
      } else {
        setRowErrors((prev) => [
          ...prev,
          {
            row: 0,
            message:
              err instanceof Error
                ? err.message
                : "Generierung fehlgeschlagen",
          },
        ]);
        setCurrentStep(4);
      }
      setIsExecuting(false);
    }
  }, [uploadResult]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsExecuting(false);
  }, []);

  const handleDownloadErrorReport = useCallback(() => {
    if (rowErrors.length === 0) return;

    const header = "Zeile;Feld;Mitarbeiter;Fehler\n";
    const rows = rowErrors
      .map(
        (e) =>
          `${e.row};${e.field ?? ""};${e.employee_name ?? ""};${e.message}`
      )
      .join("\n");

    const blob = new Blob([header + rows], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fehler-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [rowErrors]);

  // ── Derived State ─────────────────────────────────────────────────────────

  const requiredFieldsMapped = uploadResult
    ? uploadResult.form_fields
        .filter((f) => f.required)
        .every((f) =>
          mappings.some(
            (m) => m.form_field === f.key && m.form_field !== "ignore"
          )
        )
    : false;

  const canProceedToPreview = requiredFieldsMapped;
  const canProceedToExecute =
    preview && preview.valid_count > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Smart Massen-Generierung
          </h1>
          <p className="text-muted-foreground text-lg">
            KI-gestützte Zuordnung und Validierung
          </p>
        </div>
        <Link to="/bulk">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Einfacher Modus
          </Button>
        </Link>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* ── Step 1: Upload ── */}
      {currentStep === 0 && (
        <Card className="border-0 rounded-2xl shadow-[var(--shadow-elevated)]">
          <CardContent className="p-8 space-y-6">
            {/* Document type selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Dokumenttyp <span className="text-destructive">*</span>
              </label>
              <Select
                value={selectedDocTypeId}
                onValueChange={setSelectedDocTypeId}
                disabled={docTypesLoading}
              >
                <SelectTrigger className="h-11 text-sm border border-border/50 rounded-xl px-4 shadow-none">
                  <SelectValue placeholder="Dokumenttyp auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes?.map((dt: DocumentType) => (
                    <SelectItem key={dt.id} value={String(dt.id)}>
                      {dt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200",
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : file
                  ? "border-secondary/50 bg-secondary/5"
                  : "border-border/50 hover:border-primary/30 hover:bg-warm-50/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file ? (
                <div className="space-y-3">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Andere Datei
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      CSV oder Excel-Datei hierher ziehen
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      oder klicken zum Auswählen
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="muted" className="text-[10px]">
                      CSV
                    </Badge>
                    <Badge variant="muted" className="text-[10px]">
                      XLSX
                    </Badge>
                    <Badge variant="muted" className="text-[10px]">
                      XLS
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground/50">
                    Maximal 500 Zeilen
                  </p>
                </div>
              )}
            </div>

            {/* Upload error */}
            {uploadError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/5 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {uploadError}
              </div>
            )}

            {/* Upload button */}
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={!file || !selectedDocTypeId || isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    KI analysiert...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Hochladen & Analysieren
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Column Mapping ── */}
      {currentStep === 1 && uploadResult && (
        <Card className="border-0 rounded-2xl shadow-[var(--shadow-elevated)]">
          <CardContent className="p-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Spalten-Zuordnung
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Die KI hat {uploadResult.columns.length} Spalten aus deiner
                Datei erkannt. Überprüfe die Zuordnung.
              </p>
            </div>

            <ColumnMapper
              suggestions={uploadResult.suggestions}
              formFields={uploadResult.form_fields}
              mappings={mappings}
              onMappingChange={handleMappingChange}
            />

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setCurrentStep(0)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Zurück
              </Button>
              <Button
                onClick={handlePreview}
                disabled={!canProceedToPreview || isPreviewLoading}
                className="gap-2"
              >
                {isPreviewLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Vorschau wird geladen...
                  </>
                ) : (
                  <>
                    Weiter
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>

            {previewError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/5 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {previewError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Preview ── */}
      {currentStep === 2 && preview && (
        <Card className="border-0 rounded-2xl shadow-[var(--shadow-elevated)]">
          <CardContent className="p-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Vorschau
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Erste Zeilen deiner Datei mit den zugeordneten Feldern.
              </p>
            </div>

            {/* Summary line */}
            <div className="flex items-center gap-3">
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {preview.valid_count} Zeilen gültig
              </Badge>
              {preview.error_count > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {preview.error_count} Zeilen mit Fehlern
                </Badge>
              )}
            </div>

            {/* Preview cards */}
            <div className="space-y-3">
              {preview.rows.map((row) => (
                <div
                  key={row.row_number}
                  className={cn(
                    "p-4 rounded-xl transition-colors",
                    row.errors.length > 0
                      ? "bg-destructive/5 border border-destructive/20"
                      : "bg-warm-50/50 dark:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Zeile {row.row_number}
                    </span>
                    {row.errors.length > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {row.errors.length} Fehler
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(row.mapped_values).map(
                      ([field, value]) => (
                        <div key={field}>
                          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">
                            {field}
                          </p>
                          <p className="text-sm text-foreground truncate">
                            {value || (
                              <span className="text-muted-foreground/40 italic">
                                leer
                              </span>
                            )}
                          </p>
                        </div>
                      )
                    )}
                  </div>

                  {row.errors.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {row.errors.map((error, i) => (
                        <p
                          key={i}
                          className="text-xs text-destructive flex items-center gap-1"
                        >
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="font-medium">{error.field}:</span>{" "}
                          {error.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setCurrentStep(1)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Zuordnung anpassen
              </Button>
              <Button
                onClick={handleExecute}
                disabled={!canProceedToExecute}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                {preview.valid_count} Dokumente generieren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Execution ── */}
      {currentStep === 3 && (
        <Card className="border-0 rounded-2xl shadow-[var(--shadow-elevated)]">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Dokumente werden generiert
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Bitte schließe diese Seite nicht.
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-3 max-w-md mx-auto">
              <Progress value={executionProgress} className="h-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {executionCurrent} von {executionTotal} verarbeitet
                </span>
                <span className="font-medium text-primary tabular-nums">
                  {Math.round(executionProgress)}%
                </span>
              </div>
              {currentEmployeeName && (
                <p className="text-xs text-muted-foreground/60 text-center truncate">
                  Aktuell: {currentEmployeeName}
                </p>
              )}
            </div>

            {/* Live errors */}
            {rowErrors.length > 0 && (
              <div className="max-w-md mx-auto space-y-1">
                {rowErrors.slice(-3).map((error, i) => (
                  <p
                    key={i}
                    className="text-xs text-destructive/70 flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    Zeile {error.row}: {error.message}
                  </p>
                ))}
              </div>
            )}

            {/* Cancel button */}
            {isExecuting && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="text-destructive hover:text-destructive gap-2"
                >
                  <X className="w-4 h-4" />
                  Abbrechen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Results ── */}
      {currentStep === 4 && (
        <Card className="border-0 rounded-2xl shadow-[var(--shadow-elevated)]">
          <CardContent className="p-8 space-y-6">
            {/* Success card */}
            <div className="text-center space-y-4">
              <div
                className={cn(
                  "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center",
                  errorCount === 0 && successCount > 0
                    ? "bg-secondary/10"
                    : successCount > 0
                    ? "bg-amber-50"
                    : "bg-destructive/10"
                )}
              >
                {successCount > 0 ? (
                  <CheckCircle2
                    className={cn(
                      "w-8 h-8",
                      errorCount === 0
                        ? "text-secondary"
                        : "text-amber-600"
                    )}
                  />
                ) : (
                  <AlertCircle className="w-8 h-8 text-destructive" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {successCount > 0
                    ? `${successCount} Entwürfe erstellt`
                    : "Generierung fehlgeschlagen"}
                </h2>
                {errorCount > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {errorCount} Fehler aufgetreten
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              {successCount > 0 && (
                <Button onClick={() => navigate("/documents")} className="gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Alle anzeigen
                </Button>
              )}
              {rowErrors.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleDownloadErrorReport}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Fehler-Report
                </Button>
              )}
            </div>

            {/* Error details */}
            {rowErrors.length > 0 && (
              <Collapsible open={errorsExpanded} onOpenChange={setErrorsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full gap-2 text-sm text-muted-foreground"
                  >
                    {errorsExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {rowErrors.length} Fehler anzeigen
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-3 max-h-64 overflow-y-auto">
                    {rowErrors.map((error, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 text-sm"
                      >
                        <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              Zeile {error.row}
                            </span>
                            {error.field && (
                              <Badge variant="muted" className="text-[10px]">
                                {error.field}
                              </Badge>
                            )}
                            {error.employee_name && (
                              <span className="text-xs text-muted-foreground">
                                {error.employee_name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-destructive/80 mt-0.5">
                            {error.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Start over */}
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setCurrentStep(0);
                  setFile(null);
                  setSelectedDocTypeId("");
                  setUploadResult(null);
                  setMappings([]);
                  setPreview(null);
                  setRowErrors([]);
                  setSuccessCount(0);
                  setErrorCount(0);
                }}
                className="text-xs text-muted-foreground"
              >
                Neue Massen-Generierung starten
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BulkWizardPage;
