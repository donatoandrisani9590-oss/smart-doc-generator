/**
 * GapAnalysisCard - Proactive document completeness check
 *
 * Displays a "Review Card" showing missing clauses, recommendations,
 * and best-practice confirmations before the user exports.
 *
 * Auto-fetches on mount (debounced) and re-fetches when
 * enabled clauses or key form fields change.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Sparkles, Check, Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, isApiError } from "@/lib/api-client";

// =============================================================================
// Types
// =============================================================================

interface GapAnalysisItem {
    id: string;
    severity: "success" | "recommendation" | "warning";
    title: string;
    description: string;
    clause_id?: number;
    action_type?: "add_clause" | "change_field" | "review";
    action_label?: string;
}

interface GapAnalysisResponse {
    items: GapAnalysisItem[];
    summary: string;
}

interface GapAnalysisCardProps {
    documentTypeId: number;
    countryCode: string;
    enabledClauseIds: number[];
    formData: Record<string, unknown>;
    documentTitle: string;
    onAddClause?: (clauseId: number) => void;
    className?: string;
}

// =============================================================================
// Severity config
// =============================================================================

const SEVERITY_DOT: Record<string, string> = {
    success: "bg-green-500",
    recommendation: "bg-amber-500",
    warning: "bg-red-500",
};

// =============================================================================
// Component
// =============================================================================

export function GapAnalysisCard({
    documentTypeId,
    countryCode,
    enabledClauseIds,
    formData,
    documentTitle,
    onAddClause,
    className,
}: GapAnalysisCardProps) {
    const [items, setItems] = useState<GapAnalysisItem[]>([]);
    const [summary, setSummary] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [actedItems, setActedItems] = useState<Set<string>>(new Set());

    // Refs for debounce
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    // Stable hash of inputs for change detection
    const inputHash = useMemo(() => {
        const clauseKey = [...enabledClauseIds].sort().join(",");
        const formKey = JSON.stringify({
            gehalt: formData.gehalt,
            wochenstunden: formData.wochenstunden,
            vertragsart: formData.vertragsart,
            firmenwagen: formData.firmenwagen,
            homeoffice: formData.homeoffice,
            probezeit: formData.probezeit,
            eintrittsdatum: formData.eintrittsdatum,
            kuendigungsfrist: formData.kuendigungsfrist,
        });
        return `${documentTypeId}:${clauseKey}:${formKey}`;
    }, [documentTypeId, enabledClauseIds, formData]);

    // Fetch gap analysis
    const fetchAnalysis = useCallback(async () => {
        // Cancel any in-flight request
        if (abortRef.current) {
            abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            setIsLoading(true);
            const { data } = await api.post<GapAnalysisResponse>(
                "/api/v1/smart/gap-analysis",
                {
                    document_type_id: documentTypeId,
                    country_code: countryCode,
                    enabled_clause_ids: enabledClauseIds,
                    form_data: formData,
                    document_title: documentTitle,
                },
                { signal: controller.signal, skipErrorHandling: true }
            );

            if (!mountedRef.current) return;

            setItems(data.items || []);
            setSummary(data.summary || "");
            setHasLoaded(true);
        } catch (err) {
            if (!mountedRef.current) return;
            // AbortError is expected on cancel
            if (err instanceof DOMException && err.name === "AbortError") return;
            if (isApiError(err) && err.code === "TIMEOUT") return;
            // Graceful degradation: just hide the card
            setItems([]);
            setSummary("");
            setHasLoaded(true);
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [documentTypeId, countryCode, enabledClauseIds, formData, documentTitle]);

    // Debounced fetch on input changes
    useEffect(() => {
        mountedRef.current = true;

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Initial fetch: 1s delay, subsequent: 2s
        const delay = hasLoaded ? 2000 : 1000;

        timerRef.current = setTimeout(() => {
            fetchAnalysis();
        }, delay);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputHash]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            if (abortRef.current) {
                abortRef.current.abort();
            }
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    // Handle action button click
    const handleAction = useCallback((item: GapAnalysisItem) => {
        if (item.action_type === "add_clause" && item.clause_id && onAddClause) {
            onAddClause(item.clause_id);
        }
        // Mark as acted on
        setActedItems((prev) => new Set([...prev, item.id]));
    }, [onAddClause]);

    // Don't render if still loading initially or no items
    const visibleItems = items.filter((i) => i.severity !== "success" || !actedItems.has(i.id));
    if (!hasLoaded || (visibleItems.length === 0 && !isLoading)) {
        return null;
    }

    return (
        <div
            className={cn(
                "rounded-2xl shadow-[var(--shadow-elevated)] bg-background overflow-hidden",
                className
            )}
        >
            {/* Header */}
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-foreground/30" />
                    <span className="text-[11px] uppercase tracking-wider text-foreground/40 font-semibold">
                        Lückenanalyse
                    </span>
                </div>
                {isLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground/30" />
                )}
            </div>

            {/* Items */}
            <div className="px-5 pb-2 space-y-0.5">
                {visibleItems.map((item) => {
                    const isActed = actedItems.has(item.id);

                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "flex items-start gap-3 py-2.5 transition-all duration-200",
                                isActed && "opacity-50"
                            )}
                        >
                            {/* Severity dot */}
                            <div className="mt-1.5 shrink-0">
                                {isActed ? (
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                ) : (
                                    <div
                                        className={cn(
                                            "w-2 h-2 rounded-full",
                                            SEVERITY_DOT[item.severity] || "bg-gray-400"
                                        )}
                                    />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    {item.severity === "success" && !isActed && (
                                        <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                    )}
                                    {isActed && (
                                        <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                    )}
                                    <span className="text-sm font-medium leading-tight">
                                        {item.title}
                                    </span>
                                </div>
                                <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">
                                    {item.description}
                                </p>
                            </div>

                            {/* Action button */}
                            {item.action_label && !isActed && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAction(item)}
                                    className="shrink-0 h-7 px-2.5 text-xs font-medium gap-1 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                                >
                                    {item.action_type === "add_clause" && (
                                        <Plus className="w-3 h-3" />
                                    )}
                                    {item.action_type === "review" && (
                                        <Search className="w-3 h-3" />
                                    )}
                                    {item.action_type === "change_field" && (
                                        <Search className="w-3 h-3" />
                                    )}
                                    {item.action_label}
                                </Button>
                            )}

                            {/* Acted confirmation */}
                            {isActed && item.action_label && (
                                <span className="shrink-0 text-xs text-green-600 font-medium flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    Erledigt
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            {summary && (
                <div className="px-5 pb-4 pt-1">
                    <p className="text-[12px] text-muted-foreground/50">
                        {summary}
                    </p>
                </div>
            )}
        </div>
    );
}

export default GapAnalysisCard;
