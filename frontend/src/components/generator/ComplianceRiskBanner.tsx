/**
 * ComplianceRiskBanner - Proactive compliance risk display
 *
 * Shows real-time compliance risks detected in the document editor.
 * Scans content on change (debounced) and displays warnings.
 *
 * Privacy: Uses Mistral AI (EU) or Ollama (local) - no US data transfer.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Shield,
  Scale,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

// Types
type RiskSeverity = "low" | "medium" | "high" | "critical";

interface ComplianceRisk {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  affected_text: string;
  start_position: number;
  end_position: number;
  suggestion?: string;
  legal_reference?: string;
  category: string;
}

interface ComplianceScanResult {
  risks: ComplianceRisk[];
  overall_score: number;
  scanned_at: string;
  provider: string;
  scan_duration_ms: number;
  content_hash: string;
}

interface ComplianceRiskBannerProps {
  /** HTML content to scan */
  contentHtml: string;
  /** Country code for jurisdiction (DE, AT, CH, IT) */
  countryCode?: string;
  /** Callback when user clicks on a risk (for editor highlighting) */
  onRiskClick?: (risk: ComplianceRisk) => void;
  /** Enable deep LLM analysis (slower but more thorough) */
  useLlm?: boolean;
  /** Minimum content length before scanning */
  minContentLength?: number;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Custom class name */
  className?: string;
}

// Severity configuration
const severityConfig: Record<
  RiskSeverity,
  {
    icon: typeof AlertTriangle;
    color: string;
    bg: string;
    badge: string;
    label: string;
    labelDe: string;
  }
> = {
  critical: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-800 border-red-200",
    label: "Critical",
    labelDe: "Kritisch",
  },
  high: {
    icon: AlertTriangle,
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    label: "High",
    labelDe: "Hoch",
  },
  medium: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
    label: "Medium",
    labelDe: "Mittel",
  },
  low: {
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    label: "Low",
    labelDe: "Hinweis",
  },
};

// Score color based on compliance level
function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 50) return "text-orange-600";
  return "text-red-600";
}

function getScoreBg(score: number): string {
  if (score >= 90) return "bg-green-100";
  if (score >= 70) return "bg-yellow-100";
  if (score >= 50) return "bg-orange-100";
  return "bg-red-100";
}

export function ComplianceRiskBanner({
  contentHtml,
  countryCode = "DE",
  onRiskClick,
  useLlm = false,
  minContentLength = 50,
  debounceMs = 2000,
  className,
}: ComplianceRiskBannerProps) {
  const [result, setResult] = useState<ComplianceScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastScannedHash, setLastScannedHash] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Scan content for compliance risks
  const scanContent = useCallback(async () => {
    // Skip if content too short
    if (contentHtml.length < minContentLength) {
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<ComplianceScanResult>(
        "/api/v1/compliance/scan",
        {
          content_html: contentHtml,
          country_code: countryCode,
          use_llm: useLlm,
        }
      );

      // Only update if hash changed (avoid unnecessary re-renders)
      if (response.data.content_hash !== lastScannedHash) {
        setResult(response.data);
        setLastScannedHash(response.data.content_hash);

        // Auto-expand if critical risks found
        if (response.data.risks.some((r: ComplianceRisk) => r.severity === "critical")) {
          setIsExpanded(true);
        }
      }
    } catch (err) {
      console.error("Compliance scan failed:", err);
      setError("Compliance-Prüfung fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  }, [contentHtml, countryCode, useLlm, minContentLength, lastScannedHash]);

  // Debounced scan on content change
  useEffect(() => {
    const timer = setTimeout(scanContent, debounceMs);
    return () => clearTimeout(timer);
  }, [contentHtml, debounceMs, scanContent]);

  // Compute highest severity for banner display
  const highestSeverity = useMemo<RiskSeverity>(() => {
    if (!result?.risks.length) return "low";
    const severityOrder: RiskSeverity[] = ["low", "medium", "high", "critical"];
    return result.risks.reduce((max, risk) => {
      return severityOrder.indexOf(risk.severity) >
        severityOrder.indexOf(max)
        ? risk.severity
        : max;
    }, "low" as RiskSeverity);
  }, [result?.risks]);

  // No content or too short
  if (contentHtml.length < minContentLength) {
    return null;
  }

  // Loading state (first scan)
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
          Compliance-Prüfung läuft...
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

  // No risks found - success state
  if (result && result.risks.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg",
          className
        )}
      >
        <CheckCircle className="h-5 w-5 text-green-600" />
        <div className="flex-1">
          <span className="text-sm font-medium text-green-800">
            Keine Compliance-Risiken gefunden
          </span>
          {result.provider !== "pattern" && (
            <span className="ml-2 text-xs text-green-600">
              (inkl. KI-Analyse)
            </span>
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="bg-green-100 text-green-800 border-green-200"
              >
                <Shield className="h-3 w-3 mr-1" />
                {result.overall_score}/100
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Compliance Score: Je höher, desto besser</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-green-600" />
        )}
      </div>
    );
  }

  // Risks found - warning/error state
  if (!result) return null;

  const config = severityConfig[highestSeverity];
  const Icon = config.icon;
  const riskCount = result.risks.length;
  const criticalCount = result.risks.filter(
    (r) => r.severity === "critical"
  ).length;
  const highCount = result.risks.filter((r) => r.severity === "high").length;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          "border rounded-lg overflow-hidden transition-all",
          config.bg,
          className
        )}
      >
        {/* Header - Always visible */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-opacity-80 transition-colors text-left">
            <Icon className={cn("h-5 w-5 flex-shrink-0", config.color)} />

            <div className="flex-1 min-w-0">
              <span className={cn("font-medium", config.color)}>
                {riskCount} Compliance-
                {riskCount === 1 ? "Risiko" : "Risiken"} gefunden
              </span>

              {/* Quick stats */}
              <div className="flex gap-2 mt-0.5">
                {criticalCount > 0 && (
                  <span className="text-xs text-red-600">
                    {criticalCount} kritisch
                  </span>
                )}
                {highCount > 0 && (
                  <span className="text-xs text-orange-600">
                    {highCount} hoch
                  </span>
                )}
              </div>
            </div>

            {/* Score Badge */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={cn(
                      "flex-shrink-0",
                      getScoreBg(result.overall_score),
                      getScoreColor(result.overall_score)
                    )}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {result.overall_score}/100
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Compliance Score (100 = perfekt)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Loading indicator */}
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
            )}

            {/* Expand/collapse icon */}
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expandable content - Risk details */}
        <CollapsibleContent>
          <div className="border-t border-warm-200 divide-y divide-warm-100 max-h-[400px] overflow-y-auto">
            {result.risks.map((risk) => {
              const riskConfig = severityConfig[risk.severity];
              const RiskIcon = riskConfig.icon;

              return (
                <div
                  key={risk.id}
                  className={cn(
                    "px-4 py-3 bg-white/50 hover:bg-white cursor-pointer transition-colors",
                    onRiskClick && "hover:bg-white"
                  )}
                  onClick={() => onRiskClick?.(risk)}
                  role={onRiskClick ? "button" : undefined}
                  tabIndex={onRiskClick ? 0 : undefined}
                >
                  <div className="flex items-start gap-3">
                    <RiskIcon
                      className={cn(
                        "h-4 w-4 mt-0.5 flex-shrink-0",
                        riskConfig.color
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      {/* Title + Severity Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {risk.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", riskConfig.badge)}
                        >
                          {riskConfig.labelDe}
                        </Badge>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground mt-1">
                        {risk.description}
                      </p>

                      {/* Affected Text */}
                      <div className="mt-2 px-3 py-2 bg-warm-100 rounded text-sm font-mono text-foreground break-words">
                        „{risk.affected_text}"
                      </div>

                      {/* Suggestion */}
                      {risk.suggestion && (
                        <div className="mt-2 flex items-start gap-2">
                          <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                            💡 Empfehlung:
                          </span>
                          <span className="text-sm text-foreground">
                            {risk.suggestion}
                          </span>
                        </div>
                      )}

                      {/* Legal Reference */}
                      {risk.legal_reference && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Scale className="h-3 w-3" />
                          <span>Rechtsgrundlage: {risk.legal_reference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer with metadata */}
          <div className="px-4 py-2 bg-warm-50 border-t border-warm-200 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Geprüft:{" "}
              {new Date(result.scanned_at).toLocaleTimeString("de-DE")}
              {result.provider !== "pattern" && ` • KI: ${result.provider}`}
            </span>
            <span>{result.scan_duration_ms}ms</span>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default ComplianceRiskBanner;
