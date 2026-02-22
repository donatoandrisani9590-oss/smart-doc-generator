/**
 * ComplianceDashboard - Compliance Score Dashboard (§8.5)
 *
 * Full-page compliance overview with:
 * - 4-column stat cards (Konform, Warnungen, Kritisch, Score %)
 * - Stacked compliance status bar
 * - Critical items table
 * - Quick actions: Run audit, navigate to settings
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api, isApiError } from "@/lib/api-client";
import { TextReveal } from "@/components/ui/text-reveal";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  TrendingUp,
  RefreshCw,
  Loader2,
  Settings,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface ComplianceStats {
  total_checked: number;
  ok_count: number;
  warning_count: number;
  deprecated_count: number;
  unchecked_count: number;
}

interface AuditResult {
  id: number;
  clause_id: number;
  clause_title: string;
  status: string;
  risk_level?: string;
  affected_law?: string;
  reasoning?: string;
  suggestion?: string;
}

interface AuditResultsResponse {
  items: AuditResult[];
  total: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const statusVisuals: Record<string, { bg: string; dot: string; label: string }> = {
  ok:         { bg: "bg-green-500",  dot: "bg-green-500",  label: "Aktuell" },
  warning:    { bg: "bg-amber-500",  dot: "bg-amber-500",  label: "Warnung" },
  deprecated: { bg: "bg-red-500",    dot: "bg-red-500",    label: "Veraltet" },
  unchecked:  { bg: "bg-warm-300",   dot: "bg-warm-300",   label: "Ungeprüft" },
};

function calcScore(stats: ComplianceStats): number {
  const total = stats.ok_count + stats.warning_count + stats.deprecated_count;
  if (total === 0) return 100;
  return Math.round((stats.ok_count / total) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// Stat Card
// ═══════════════════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="shadow-[var(--shadow-elevated)]">
        <CardContent className="p-5">
          <Skeleton className="h-4 w-20 mb-3" />
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-[var(--shadow-elevated)] hover:shadow-[var(--shadow-card-hover)] transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
          <div className={cn("p-2 rounded-lg", color)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function ComplianceDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [items, setItems] = useState<AuditResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, itemsRes] = await Promise.all([
        api.get<ComplianceStats>("/api/v1/admin/legal-audit/stats"),
        api.get<AuditResultsResponse>(
          "/api/v1/admin/legal-audit/results?limit=20"
        ),
      ]);
      setStats(statsRes.data);
      setItems(itemsRes.data.items);
      setError(null);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Compliance-Daten konnten nicht geladen werden");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunAudit = useCallback(async () => {
    setIsRunning(true);
    try {
      await api.post("/api/v1/admin/legal-audit/run");
      await loadData();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Prüfung konnte nicht gestartet werden");
      }
    } finally {
      setIsRunning(false);
    }
  }, [loadData]);

  const score = stats ? calcScore(stats) : 0;
  const total = stats
    ? stats.ok_count + stats.warning_count + stats.deprecated_count + stats.unchecked_count
    : 0;
  const pct = (count: number) => (total > 0 ? (count / total) * 100 : 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <TextReveal as="h1" className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]" stagger={0.04} duration={0.6}>Compliance</TextReveal>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Rechtliche Konformität aller Textbausteine und Dokumenttypen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/settings?tab=legal-audit")}
          >
            <Settings className="w-4 h-4 mr-1.5" />
            Einstellungen
          </Button>
          <Button
            size="sm"
            onClick={handleRunAudit}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            {isRunning ? "Prüfung läuft..." : "Alle prüfen"}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-red-600 hover:text-red-700 dark:text-red-400"
            onClick={loadData}
          >
            Erneut versuchen
          </Button>
        </div>
      )}

      {/* 4-Column Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Konform"
          value={stats?.ok_count ?? 0}
          icon={CheckCircle2}
          color="bg-green-500"
          loading={isLoading}
        />
        <StatCard
          label="Warnungen"
          value={stats?.warning_count ?? 0}
          icon={ShieldAlert}
          color="bg-amber-500"
          loading={isLoading}
        />
        <StatCard
          label="Kritisch"
          value={stats?.deprecated_count ?? 0}
          icon={ShieldX}
          color="bg-red-500"
          loading={isLoading}
        />
        <StatCard
          label="Score"
          value={isLoading ? "—" : `${score}%`}
          icon={TrendingUp}
          color="bg-primary"
          loading={isLoading}
        />
      </div>

      {/* Stacked Progress Bar */}
      {!isLoading && stats && (
        <Card className="shadow-[var(--shadow-elevated)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Gesamtübersicht</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-3 rounded-full overflow-hidden flex bg-warm-100">
              {stats.ok_count > 0 && (
                <div
                  className="bg-green-500 transition-all duration-500"
                  style={{ width: `${pct(stats.ok_count)}%` }}
                />
              )}
              {stats.warning_count > 0 && (
                <div
                  className="bg-amber-500 transition-all duration-500"
                  style={{ width: `${pct(stats.warning_count)}%` }}
                />
              )}
              {stats.deprecated_count > 0 && (
                <div
                  className="bg-red-500 transition-all duration-500"
                  style={{ width: `${pct(stats.deprecated_count)}%` }}
                />
              )}
              {stats.unchecked_count > 0 && (
                <div
                  className="bg-warm-300 transition-all duration-500"
                  style={{ width: `${pct(stats.unchecked_count)}%` }}
                />
              )}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {(
                [
                  { key: "ok", count: stats.ok_count },
                  { key: "warning", count: stats.warning_count },
                  { key: "deprecated", count: stats.deprecated_count },
                  { key: "unchecked", count: stats.unchecked_count },
                ] as const
              ).map(({ key, count }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", statusVisuals[key].bg)} />
                  <span className="text-[12px] text-muted-foreground">
                    {count} {statusVisuals[key].label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {!isLoading && (
        <Card className="shadow-[var(--shadow-elevated)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Prüfergebnisse</CardTitle>
              <span className="text-xs text-muted-foreground">
                {items.length} von {total} Einträgen
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="empty-state py-12">
                <div className="w-14 h-14 rounded-2xl bg-[var(--nw-warm-100)] flex items-center justify-center mb-4">
                  <ShieldCheck className="w-7 h-7 text-[var(--nw-warm-500)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  Noch keine Prüfergebnisse
                </p>
                <p className="text-[13px] text-[var(--text-secondary)] max-w-[280px] leading-relaxed mb-5">
                  Starte eine Prüfung, um die Compliance deiner Textbausteine zu analysieren.
                </p>
                <Button size="sm" variant="outline" onClick={handleRunAudit} disabled={isRunning} className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Erste Prüfung starten
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item) => {
                  const visual = statusVisuals[item.status] ?? statusVisuals.unchecked;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-3 px-2 hover:bg-foreground/[0.02] rounded-lg transition-colors group cursor-default"
                    >
                      <span className={cn("w-2 h-2 rounded-full shrink-0", visual.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {item.clause_title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.affected_law && (
                            <span className="text-[11px] text-muted-foreground/60">
                              {item.affected_law}
                            </span>
                          )}
                          {item.risk_level && (
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded",
                              item.risk_level === "high" || item.risk_level === "critical"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                : item.risk_level === "medium"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                : "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                            )}>
                              {item.risk_level}
                            </span>
                          )}
                        </div>
                        {item.reasoning && (
                          <p className="text-[11px] text-muted-foreground/50 mt-1 line-clamp-1">
                            {item.reasoning}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info hint */}
      {!isLoading && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-primary/70">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Pattern- &amp; KI-basierte Prüfungen</p>
            <p className="text-xs mt-0.5 text-primary/50">
              Schnelle Pattern-Checks (DIN 5008, ArbZG, TzBfG, KSchG) werden sofort ausgeführt.
              KI-gestützte Tiefenanalyse (Mistral EU) erkennt nuancierte rechtliche Risiken.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ComplianceDashboard;
