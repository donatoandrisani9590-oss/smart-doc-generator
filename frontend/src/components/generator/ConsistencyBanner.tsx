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
  ChevronDown,
  ChevronUp,
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
    dot: string;
    badge: string;
    labelDe: string;
  }
> = {
  conflict: {
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-700 border-transparent",
    labelDe: "Konflikt",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 border-transparent",
    labelDe: "Warnung",
  },
  info: {
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-700 border-transparent",
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
          "flex items-center gap-2 px-3 py-2",
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin text-foreground/30" />
        <span className="text-[12px] text-foreground/40">
          Konsistenzprüfung...
        </span>
      </div>
    );
  }

  // Error state
  if (error && !result) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-foreground/20 shrink-0" />
        <span className="text-[12px] text-foreground/40">{error}</span>
      </div>
    );
  }

  // No related documents found or consistent — show compact inline or hide
  if (result && result.overall_status === "consistent") {
    // No previous documents found at all — hide completely
    if (result.documents_checked === 0) return null;
    // Everything consistent — compact dot + text
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
        <span className="text-[12px] text-foreground/50 font-medium">
          Konsistent mit {result.documents_checked} Dokument{result.documents_checked !== 1 ? "en" : ""}
        </span>
        {isLoading && (
          <Loader2 className="h-3 w-3 animate-spin text-foreground/30" />
        )}
      </div>
    );
  }

  // Issues found
  if (!result || result.issues.length === 0) return null;

  const config = severityConfig[highestSeverity];
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
          "rounded-2xl overflow-hidden transition-all",
          isExpanded && "shadow-[var(--shadow-elevated)] bg-card dark:bg-card",
          className
        )}
      >
        {/* Header — dot + text, minimal */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-foreground/[0.03] active:bg-foreground/[0.05] transition-colors text-left">
            <span className={cn("w-2 h-2 rounded-full shrink-0", config.dot)} />

            <span className="text-[12px] font-medium text-foreground/60 flex-1">
              {result.issues.length} Inkonsistenz{result.issues.length !== 1 ? "en" : ""}
              {conflictCount > 0 && (
                <span className="text-red-600/70 ml-1.5">
                  {conflictCount} Konflikt{conflictCount !== 1 ? "e" : ""}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-amber-600/70 ml-1.5">
                  {warningCount} Warnung{warningCount !== 1 ? "en" : ""}
                </span>
              )}
            </span>

            <span className="text-[11px] text-foreground/30 shrink-0">
              {result.documents_checked} Dok.
            </span>

            {isLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-foreground/30 shrink-0" />
            )}

            <div className="shrink-0">
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-foreground/25" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-foreground/25" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expandable content */}
        <CollapsibleContent>
          <div className="divide-y divide-foreground/[0.04] max-h-[400px] overflow-y-auto">
            {result.issues.map((issue) => {
              const issueConfig = severityConfig[issue.severity];

              return (
                <div
                  key={issue.id}
                  className="px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", issueConfig.dot)} />

                    <div className="flex-1 min-w-0">
                      {/* Field label + severity badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-foreground">
                          {issue.field_label}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0", issueConfig.badge)}
                        >
                          {issueConfig.labelDe}
                        </Badge>
                      </div>

                      {/* Value comparison */}
                      {issue.previous_value && issue.current_value && (
                        <div className="mt-2 flex items-center gap-3 px-3 py-2 bg-foreground/[0.02] rounded-xl text-sm">
                          <span className="line-through text-foreground/30">
                            {issue.previous_value}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-foreground/20 shrink-0" />
                          <span className="font-medium text-foreground">
                            {issue.current_value}
                          </span>
                        </div>
                      )}

                      {/* Description */}
                      <p className="text-[12px] text-foreground/50 mt-1.5">
                        {issue.description}
                      </p>

                      {/* Previous document reference */}
                      {issue.previous_document_title && issue.previous_document_date && (
                        <p className="text-[11px] text-foreground/35 mt-1">
                          Letztes Dokument: {issue.previous_document_title}
                          {issue.previous_document_date && (
                            <> vom {new Date(issue.previous_document_date).toLocaleDateString("de-DE")}</>
                          )}
                        </p>
                      )}

                      {/* Suggestion */}
                      {issue.suggestion && (
                        <div className="mt-2 flex items-start gap-2">
                          <span className="text-[11px] font-medium text-foreground/40 shrink-0">
                            Empfehlung:
                          </span>
                          <span className="text-[12px] text-foreground/60">
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
          <div className="px-4 py-2 flex items-center justify-between text-[11px] text-foreground/30">
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
