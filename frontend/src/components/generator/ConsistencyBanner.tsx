/**
 * ConsistencyBanner - Cross-document contradiction detection
 *
 * Detects inconsistencies when creating a new document for an employee
 * who already has finalized documents (e.g., different Gerichtsstand
 * in NDA vs. Arbeitsvertrag).
 *
 * Scans automatically when form data changes (debounced).
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

// Types
type IssueSeverity = "info" | "warning" | "conflict";

interface ConsistencyIssue {
  id: string;
  severity: IssueSeverity;
  field_name: string;
  field_label: string;
  current_value: string;
  previous_value: string;
  previous_document_title: string;
  previous_document_id: number;
  previous_document_date: string;
  description: string;
  suggestion?: string;
}

interface ConsistencyCheckResult {
  issues: ConsistencyIssue[];
  documents_checked: number;
  overall_status: "consistent" | "warnings" | "conflicts";
  checked_at: string;
  employee_name: string;
}

interface ConsistencyBannerProps {
  /** Full employee name (Vorname + Nachname) */
  employeeName: string;
  /** Employee ID / Personalnummer */
  employeeId?: string;
  /** Current document form data */
  currentFormData: Record<string, unknown>;
  /** Country code */
  countryCode: string;
  /** Document type ID */
  documentTypeId?: number;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Custom class name */
  className?: string;
}

// Severity visual configuration
const severityConfig: Record<
  IssueSeverity,
  {
    icon: typeof AlertTriangle;
    color: string;
    bg: string;
    badge: string;
    labelDe: string;
  }
> = {
  conflict: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-800 border-red-200",
    labelDe: "Konflikt",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    labelDe: "Warnung",
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    labelDe: "Hinweis",
  },
};

export function ConsistencyBanner({
  employeeName,
  employeeId,
  currentFormData,
  countryCode,
  documentTypeId,
  debounceMs = 2000,
  className,
}: ConsistencyBannerProps) {
  const [result, setResult] = useState<ConsistencyCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const lastCheckHashRef = useRef<string>("");

  // Compute a simple hash of form data to detect changes
  const formDataHash = useMemo(() => {
    try {
      return JSON.stringify(currentFormData);
    } catch {
      return "";
    }
  }, [currentFormData]);

  // Perform the consistency check
  const performCheck = useCallback(async () => {
    if (!employeeName || !currentFormData) return;

    // Skip if nothing changed
    const newHash = `${employeeName}:${employeeId || ""}:${formDataHash}`;
    if (newHash === lastCheckHashRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<ConsistencyCheckResult>(
        "/api/v1/smart/consistency/check",
        {
          employee_name: employeeName,
          employee_id: employeeId || null,
          form_data: currentFormData,
          country_code: countryCode,
          document_type_id: documentTypeId || null,
          use_llm: false,
        }
      );

      setResult(response.data);
      lastCheckHashRef.current = newHash;
    } catch (err) {
      console.error("Consistency check failed:", err);
      setError("Konsistenzprüfung fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  }, [employeeName, employeeId, currentFormData, countryCode, documentTypeId, formDataHash]);

  // Debounced check on data change
  useEffect(() => {
    if (!employeeName) return;

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    checkTimeoutRef.current = setTimeout(performCheck, debounceMs);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [employeeName, formDataHash, debounceMs, performCheck]);

  // Compute highest severity for banner display
  const highestSeverity = useMemo<IssueSeverity>(() => {
    if (!result?.issues.length) return "info";
    const severityOrder: IssueSeverity[] = ["info", "warning", "conflict"];
    return result.issues.reduce((max, issue) => {
      return severityOrder.indexOf(issue.severity) >
        severityOrder.indexOf(max)
        ? issue.severity
        : max;
    }, "info" as IssueSeverity);
  }, [result?.issues]);

  // No employee data - don't render
  if (!employeeName) return null;

  // Loading state (first check)
  if (isLoading && !result) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 bg-warm-50 border border-warm-200 rounded-lg",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Konsistenzprüfung läuft...
        </span>
      </div>
    );
  }

  // Error state
  if (error && !result) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 bg-warm-50 border border-warm-200 rounded-lg",
          className
        )}
      >
        <Info className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{error}</span>
      </div>
    );
  }

  // No related documents found or consistent — show compact inline or hide
  if (result && result.overall_status === "consistent") {
    // No previous documents found at all — hide completely
    if (result.documents_checked === 0) return null;
    // Everything consistent — compact one-liner (less visual weight than warnings)
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg",
          className
        )}
      >
        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
        <span className="text-sm text-green-700 font-medium">
          Konsistent mit {result.documents_checked} bisherigen Dokument{result.documents_checked !== 1 ? "en" : ""}
        </span>
        {isLoading && (
          <Loader2 className="h-3 w-3 animate-spin text-green-500" />
        )}
      </div>
    );
  }

  // Issues found
  if (!result || result.issues.length === 0) return null;

  const config = severityConfig[highestSeverity];
  const Icon = config.icon;
  const conflictCount = result.issues.filter(
    (i) => i.severity === "conflict"
  ).length;
  const warningCount = result.issues.filter(
    (i) => i.severity === "warning"
  ).length;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          "border rounded-lg overflow-hidden transition-all",
          config.bg,
          className
        )}
      >
        {/* Header */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/5 active:bg-black/10 transition-colors text-left">
            <Icon className={cn("h-5 w-5 flex-shrink-0", config.color)} />

            <div className="flex-1 min-w-0">
              <span className={cn("font-medium", config.color)}>
                {result.issues.length} Inkonsistenz
                {result.issues.length !== 1 ? "en" : ""} gefunden
              </span>

              <div className="flex gap-2 mt-0.5">
                {conflictCount > 0 && (
                  <span className="text-xs text-red-600">
                    {conflictCount} Konflikt{conflictCount !== 1 ? "e" : ""}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="text-xs text-amber-600">
                    {warningCount} Warnung{warningCount !== 1 ? "en" : ""}
                  </span>
                )}
              </div>
            </div>

            <Badge
              variant="outline"
              className="flex-shrink-0 bg-warm-100 text-warm-800 border-warm-200"
            >
              <FileSearch className="h-3 w-3 mr-1" />
              {result.documents_checked} Dok.
            </Badge>

            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
            )}

            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expandable content */}
        <CollapsibleContent>
          <div className="border-t border-warm-200 divide-y divide-warm-100 max-h-[400px] overflow-y-auto">
            {result.issues.map((issue) => {
              const issueConfig = severityConfig[issue.severity];
              const IssueIcon = issueConfig.icon;

              return (
                <div
                  key={issue.id}
                  className="px-4 py-3 bg-white/50"
                >
                  <div className="flex items-start gap-3">
                    <IssueIcon
                      className={cn(
                        "h-4 w-4 mt-0.5 flex-shrink-0",
                        issueConfig.color
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      {/* Field label + severity badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {issue.field_label}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", issueConfig.badge)}
                        >
                          {issueConfig.labelDe}
                        </Badge>
                      </div>

                      {/* Value comparison */}
                      {issue.previous_value && issue.current_value && (
                        <div className="mt-2 flex items-center gap-3 px-3 py-2.5 bg-warm-50 border border-warm-200 rounded-md text-sm">
                          <span className="line-through text-muted-foreground">
                            {issue.previous_value}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-semibold text-foreground">
                            {issue.current_value}
                          </span>
                        </div>
                      )}

                      {/* Description */}
                      <p className="text-sm text-muted-foreground mt-1.5">
                        {issue.description}
                      </p>

                      {/* Previous document reference */}
                      {issue.previous_document_title && issue.previous_document_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Letztes Dokument: {issue.previous_document_title}
                          {issue.previous_document_date && (
                            <> vom {new Date(issue.previous_document_date).toLocaleDateString("de-DE")}</>
                          )}
                        </p>
                      )}

                      {/* Suggestion */}
                      {issue.suggestion && (
                        <div className="mt-2 flex items-start gap-2">
                          <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                            Empfehlung:
                          </span>
                          <span className="text-sm text-foreground">
                            {issue.suggestion}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-warm-50 border-t border-warm-200 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Geprüft:{" "}
              {new Date(result.checked_at).toLocaleTimeString("de-DE")}
              {" \u2022 "}
              {result.documents_checked} Dokument{result.documents_checked !== 1 ? "e" : ""} verglichen
            </span>
            <span>
              {result.employee_name}
            </span>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default ConsistencyBanner;
