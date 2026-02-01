/**
 * DeadlinesWidget - Fristen-Übersicht für Dashboard
 *
 * ContractHero-inspiriert: Zeigt anstehende Fristen auf einen Blick
 * - Überfällig (rot)
 * - Diese Woche (orange)
 * - Demnächst (grün)
 *
 * Respektiert Feature-Toggle: show_deadlines_widget
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  AlertCircle,
  AlertTriangle,
  Calendar,
  ChevronRight,
  User,
  FileText,
  Bell,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { format, formatDistanceToNow, isToday, isTomorrow, isThisWeek } from "date-fns";
import { de } from "date-fns/locale";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";

// Types
interface Deadline {
  id: number;
  country_code: string;
  deadline_type: string;
  deadline_date: string;
  deadline_label: string | null;
  employee_name: string;
  employee_id: string | null;
  status: string;
  notes: string | null;
  days_remaining: number;
  urgency: "overdue" | "urgent" | "soon" | "normal";
  created_at: string;
}

interface DeadlineSummary {
  overdue_count: number;
  this_week_count: number;
  this_month_count: number;
  upcoming_deadlines: Deadline[];
}

// Urgency styles
const URGENCY_STYLES = {
  overdue: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-600",
    badge: "bg-red-100 text-red-700",
    label: "Überfällig",
  },
  urgent: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: "text-orange-600",
    badge: "bg-orange-100 text-orange-700",
    label: "Diese Woche",
  },
  soon: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    icon: "text-yellow-600",
    badge: "bg-yellow-100 text-yellow-700",
    label: "Diesen Monat",
  },
  normal: {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "text-green-600",
    badge: "bg-green-100 text-green-700",
    label: "Geplant",
  },
};

// Deadline type labels
const DEADLINE_TYPE_LABELS: Record<string, string> = {
  probezeit: "Probezeit-Ende",
  befristung: "Vertragsbefristung",
  kuendigungsfrist: "Kündigungsfrist",
  verlaengerung: "Verlängerung",
  other: "Frist",
};

interface DeadlinesWidgetProps {
  /** Maximum number of deadlines to show */
  limit?: number;
  /** Show summary stats */
  showStats?: boolean;
  /** Custom class name */
  className?: string;
}

export function DeadlinesWidget({
  limit = 5,
  showStats = true,
  className,
}: DeadlinesWidgetProps) {
  const navigate = useNavigate();
  const isEnabled = useFeatureEnabled("show_deadlines_widget");

  const [summary, setSummary] = useState<DeadlineSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch deadlines summary
  const fetchDeadlines = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<DeadlineSummary>("/api/v1/deadlines/summary");
      setSummary(response.data);
    } catch (err) {
      console.error("Failed to load deadlines:", err);
      setError("Fristen konnten nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isEnabled) {
      fetchDeadlines();
    }
  }, [fetchDeadlines, isEnabled]);

  // Format deadline date nicely
  const formatDeadlineDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Heute";
    if (isTomorrow(date)) return "Morgen";
    if (isThisWeek(date)) return format(date, "EEEE", { locale: de });
    return format(date, "d. MMM yyyy", { locale: de });
  };

  // Don't render if feature is disabled
  if (!isEnabled) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchDeadlines} className="mt-2">
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasDeadlines = summary && summary.upcoming_deadlines.length > 0;
  const visibleDeadlines = summary?.upcoming_deadlines.slice(0, limit) || [];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Anstehende Fristen
          </CardTitle>
          {hasDeadlines && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate("/deadlines")}
            >
              Alle anzeigen
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        {showStats && summary && (
          <div className="grid grid-cols-3 gap-2">
            <div
              className={`p-3 rounded-lg text-center ${
                summary.overdue_count > 0 ? "bg-red-50" : "bg-muted/50"
              }`}
            >
              <p
                className={`text-2xl font-bold ${
                  summary.overdue_count > 0 ? "text-red-600" : "text-muted-foreground"
                }`}
              >
                {summary.overdue_count}
              </p>
              <p className="text-xs text-muted-foreground">Überfällig</p>
            </div>
            <div
              className={`p-3 rounded-lg text-center ${
                summary.this_week_count > 0 ? "bg-orange-50" : "bg-muted/50"
              }`}
            >
              <p
                className={`text-2xl font-bold ${
                  summary.this_week_count > 0 ? "text-orange-600" : "text-muted-foreground"
                }`}
              >
                {summary.this_week_count}
              </p>
              <p className="text-xs text-muted-foreground">Diese Woche</p>
            </div>
            <div className="p-3 rounded-lg text-center bg-muted/50">
              <p className="text-2xl font-bold text-muted-foreground">
                {summary.this_month_count}
              </p>
              <p className="text-xs text-muted-foreground">Diesen Monat</p>
            </div>
          </div>
        )}

        {/* Deadline List */}
        {!hasDeadlines ? (
          <div className="text-center py-6">
            <Check className="w-10 h-10 mx-auto text-green-500 mb-2" />
            <p className="font-medium text-green-600">Keine offenen Fristen</p>
            <p className="text-sm text-muted-foreground">
              Alle Fristen sind abgearbeitet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleDeadlines.map((deadline) => {
              const style = URGENCY_STYLES[deadline.urgency];
              const typeLabel =
                DEADLINE_TYPE_LABELS[deadline.deadline_type] ||
                deadline.deadline_label ||
                "Frist";

              return (
                <div
                  key={deadline.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${style.bg} ${style.border}`}
                  onClick={() => navigate(`/deadlines?id=${deadline.id}`)}
                >
                  {/* Urgency Icon */}
                  <div className={`p-2 rounded-lg bg-white/50`}>
                    {deadline.urgency === "overdue" ? (
                      <AlertCircle className={`w-4 h-4 ${style.icon}`} />
                    ) : deadline.urgency === "urgent" ? (
                      <AlertTriangle className={`w-4 h-4 ${style.icon}`} />
                    ) : (
                      <Calendar className={`w-4 h-4 ${style.icon}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{typeLabel}</p>
                      <Badge variant="outline" className={`text-xs ${style.badge}`}>
                        {formatDeadlineDate(deadline.deadline_date)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="truncate">{deadline.employee_name}</span>
                      {deadline.employee_id && (
                        <span className="text-xs">#{deadline.employee_id}</span>
                      )}
                    </div>
                  </div>

                  {/* Days remaining */}
                  <div className="text-right">
                    {deadline.days_remaining < 0 ? (
                      <p className="text-sm font-medium text-red-600">
                        {Math.abs(deadline.days_remaining)}d überfällig
                      </p>
                    ) : deadline.days_remaining === 0 ? (
                      <p className="text-sm font-medium text-orange-600">Heute!</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        in {deadline.days_remaining}d
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Show more link */}
        {summary && summary.upcoming_deadlines.length > limit && (
          <Button
            variant="ghost"
            className="w-full text-xs"
            onClick={() => navigate("/deadlines")}
          >
            +{summary.upcoming_deadlines.length - limit} weitere Fristen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default DeadlinesWidget;
