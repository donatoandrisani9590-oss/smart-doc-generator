/**
 * RecentDrafts — List of recently edited drafts in a widget card.
 * Each row: FileText icon | Name + subtitle | Timestamp | ChevronRight
 * Row hover: subtle bg change. Click navigates to editor.
 */

import { Link } from "react-router-dom";
import { FileText, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyActivity, type RecentDraft } from "@/hooks/api/useDashboardQueries";
import { cn } from "@/lib/utils";

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Minuten`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `vor ${diffHours} ${diffHours === 1 ? "Stunde" : "Stunden"}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays} ${diffDays === 1 ? "Tag" : "Tagen"}`;
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

interface RecentDraftsProps {
  className?: string;
  limit?: number;
}

export function RecentDrafts({ className, limit = 5 }: RecentDraftsProps) {
  const { data, isLoading } = useMyActivity(limit);
  const drafts = data?.recent_drafts ?? [];

  if (!isLoading && drafts.length === 0) return null;

  return (
    <div className={cn("widget-card", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <p className="text-xs font-semibold text-[#86868B] dark:text-muted-foreground uppercase tracking-wider">
            Offene Entwürfe
          </p>
          {!isLoading && drafts.length > 0 && (
            <span className="text-xs text-[#86868B] dark:text-muted-foreground bg-[#F5F5F7] dark:bg-muted px-2 py-0.5 rounded-full tabular-nums">
              {drafts.length}
            </span>
          )}
        </div>
        <Link
          to="/documents?status=draft"
          className="text-xs text-primary hover:underline font-medium"
        >
          Alle anzeigen
        </Link>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {drafts.map((draft: RecentDraft) => (
            <Link
              key={draft.id}
              to={`/generate?draft=${draft.id}`}
              className="flex items-center gap-3 px-3 py-3 -mx-1 rounded-xl transition-colors hover:bg-[#F5F5F7] dark:hover:bg-muted group"
            >
              <FileText className="w-4 h-4 text-[#86868B] dark:text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1D1D1F] dark:text-foreground truncate">
                  {draft.document_type_name}
                </p>
                <p className="text-xs text-[#86868B] dark:text-muted-foreground truncate">
                  {draft.name || "Unbenannter Entwurf"}
                  {draft.updated_at && (
                    <> &middot; {formatRelativeTime(draft.updated_at)}</>
                  )}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#86868B]/40 dark:text-muted-foreground/30 group-hover:text-[#86868B] dark:group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
