/**
 * RecentDrafts — DS v2.1 horizontal scroll draft cards.
 * Each card: status badge, title, employee name, time, progress bar.
 * Glass card container with "Alle anzeigen" link.
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { Badge } from "@/components/ui/badge";
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
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `vor ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays}d`;
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

interface RecentDraftsProps {
  className?: string;
  limit?: number;
}

export function RecentDrafts({ className, limit = 5 }: RecentDraftsProps) {
  const { data, isLoading } = useMyActivity(limit);
  const drafts = data?.recent_drafts ?? [];
  const listRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(listRef, { once: true, margin: "-8% 0px" });

  if (!isLoading && drafts.length === 0) {
    return (
      <div ref={listRef} className={cn("glass-card", className)}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
            Offene Entwürfe
          </p>
        </div>
        <div className="empty-state py-10">
          <div className="w-14 h-14 rounded-2xl bg-[var(--nw-warm-100)] flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-[var(--nw-warm-500)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Keine offenen Entwürfe</p>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-[280px] leading-relaxed mb-5">
            Starte ein neues Dokument — deine Entwürfe erscheinen hier.
          </p>
          <Link
            to="/generate"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--nw-blue-700)] text-white text-sm font-semibold shadow-[var(--shadow-blue-sm)] hover:bg-[var(--nw-blue-600)] transition-all hover:-translate-y-px"
          >
            Neues Dokument
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={listRef} className={cn("glass-card", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
            Offene Entwürfe
          </p>
          {!isLoading && drafts.length > 0 && (
            <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full tabular-nums">
              {drafts.length}
            </span>
          )}
        </div>
        <Link
          to="/documents?status=draft"
          className="text-xs text-[var(--nw-blue-700)] hover:text-[var(--nw-blue-600)] font-medium transition-colors"
        >
          Alle anzeigen
        </Link>
      </div>

      {/* Card List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-[var(--radius-md-ds)]" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {drafts.map((draft: RecentDraft, index: number) => (
            <motion.div
              key={draft.id}
              initial={{ x: -12, opacity: 0 }}
              animate={isInView ? { x: 0, opacity: 1 } : { x: -12, opacity: 0 }}
              transition={{
                duration: 0.35,
                delay: index * 0.06,
                ease: [0.33, 1, 0.68, 1],
              }}
            >
              <Link
                to={`/generate?draft=${draft.id}`}
                className="flex items-center gap-3 px-3.5 py-3 rounded-[var(--radius-md-ds)] transition-all duration-150 hover:bg-[var(--bg-hover)] group"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--nw-blue-50)] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[var(--nw-blue-600)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {draft.document_type_name}
                    </p>
                    <Badge variant="draft" className="shrink-0 text-2xs">
                      Entwurf
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {draft.name || "Unbenannter Entwurf"}
                    {draft.updated_at && (
                      <span className="text-[var(--text-tertiary)]"> &middot; {formatRelativeTime(draft.updated_at)}</span>
                    )}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
