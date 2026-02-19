/**
 * EmailDraftsWidget - Dashboard card showing recent email-to-draft ingests
 *
 * Displays the last 5 email ingests with status badges, employee name, and timestamps.
 * Completed items link to the draft. Respects feature toggle: enable_email_ingest.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Mail, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailIngest {
  id: number;
  subject: string;
  status: "processing" | "completed" | "failed" | "rejected";
  employee_name: string | null;
  draft_id: number | null;
  created_at: string;
}

interface EmailHistoryResponse {
  items: EmailIngest[];
  total: number;
}

// ─── Status Badge Config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  EmailIngest["status"],
  { label: string; className: string; pulse?: boolean }
> = {
  processing: {
    label: "Verarbeitung",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    pulse: true,
  },
  completed: {
    label: "Fertig",
    className: "bg-secondary/10 text-secondary",
  },
  failed: {
    label: "Fehler",
    className: "bg-destructive/10 text-destructive",
  },
  rejected: {
    label: "Abgelehnt",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function EmailDraftsWidget() {
  const {
    data,
    isLoading,
    error,
  } = useQuery<EmailHistoryResponse>({
    queryKey: ["email-ingest-history"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/ingest/email/history?limit=5");
      if (!res.ok) throw new Error("Failed to fetch email ingest history");
      return res.json();
    },
    staleTime: 30_000, // 30s
    refetchInterval: 60_000, // refresh every minute
  });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return null; // Silently hide on error — not a critical widget
  }

  const items = data?.items ?? [];

  // Empty state
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            E-Mail-Entwürfe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-6 text-center">
            <Mail className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Noch keine E-Mail-Entwürfe.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Leiten Sie E-Mails weiter an{" "}
              <span className="font-mono text-primary/70">bot@niederwieser-docs.ai</span>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            E-Mail-Entwürfe
          </CardTitle>
          {(data?.total ?? 0) > 5 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {data?.total} gesamt
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => {
          const statusCfg = STATUS_CONFIG[item.status];
          const isLinked = item.status === "completed" && item.draft_id;

          const content = (
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isLinked && "hover:bg-warm-50/60 dark:hover:bg-white/[0.03] cursor-pointer group"
              )}
            >
              {/* Status indicator */}
              <div className="flex-shrink-0">
                {statusCfg.pulse ? (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                ) : (
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      item.status === "completed" && "bg-green-500",
                      item.status === "failed" && "bg-red-500",
                      item.status === "rejected" && "bg-amber-500"
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isLinked && "group-hover:text-primary transition-colors"
                  )}>
                    {item.subject || "Ohne Betreff"}
                  </p>
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0 border-0 flex-shrink-0",
                      statusCfg.className,
                      statusCfg.pulse && "animate-pulse"
                    )}
                  >
                    {statusCfg.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground/50 mt-0.5 truncate">
                  {item.employee_name && (
                    <span className="text-foreground/70">{item.employee_name}</span>
                  )}
                  {item.employee_name && item.created_at && (
                    <span className="mx-1.5 text-border">·</span>
                  )}
                  {item.created_at && formatDistanceToNow(item.created_at)}
                </p>
              </div>

              {/* Arrow for linked items */}
              {isLinked && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all -translate-x-1 group-hover:translate-x-0 flex-shrink-0" />
              )}
            </div>
          );

          if (isLinked) {
            return (
              <Link key={item.id} to={`/generate?draft=${item.draft_id}`}>
                {content}
              </Link>
            );
          }

          return <div key={item.id}>{content}</div>;
        })}
      </CardContent>
    </Card>
  );
}

export default EmailDraftsWidget;
