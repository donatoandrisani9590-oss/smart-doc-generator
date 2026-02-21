/**
 * RecentDrafts — DS v2.1 horizontal scroll draft cards.
 * Each card: status badge, title, employee name, time, progress bar.
 * Glass card container with "Alle anzeigen" link.
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyActivity, type RecentDraft } from "@/hooks/api/useDashboardQueries";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

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

  // Stagger-reveal draft items
  useGSAP(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !listRef.current || isLoading) return;

    const items = listRef.current.querySelectorAll("[data-draft-item]");
    if (items.length === 0) return;

    gsap.from(items, {
      x: -12,
      opacity: 0,
      duration: 0.35,
      stagger: 0.06,
      ease: "power2.out",
      scrollTrigger: {
        trigger: listRef.current,
        start: "top 92%",
        once: true,
      },
    });
  }, { scope: listRef, dependencies: [isLoading, drafts] });

  if (!isLoading && drafts.length === 0) return null;

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
          {drafts.map((draft: RecentDraft) => (
            <Link
              key={draft.id}
              to={`/generate?draft=${draft.id}`}
              data-draft-item
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
          ))}
        </div>
      )}
    </div>
  );
}
