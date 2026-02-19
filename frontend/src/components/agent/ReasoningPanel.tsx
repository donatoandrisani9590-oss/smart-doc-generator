/**
 * ReasoningPanel — "KI-Gedanken" side panel showing agent reasoning entries.
 *
 * Displays decision, warning, suggestion, and context entries from the agent
 * SSE stream in a collapsible panel along the right edge of the chat area.
 *
 * Collapsed: thin 36px vertical bar with entry count badge.
 * Expanded: 320px sliding panel with chronological reasoning list.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Lightbulb,
  AlertTriangle,
  Sparkles,
  MapPin,
  Brain,
  X,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReasoningEntry {
  id: string;
  content: string;
  category: "decision" | "warning" | "suggestion" | "context";
  timestamp: Date;
}

interface ReasoningPanelProps {
  entries: ReasoningEntry[];
  className?: string;
}

// ── Category Configuration ───────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  ReasoningEntry["category"],
  {
    icon: typeof Lightbulb;
    label: string;
    iconColor: string;
    bgColor: string;
  }
> = {
  decision: {
    icon: Lightbulb,
    label: "Entscheidung",
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50/60",
  },
  warning: {
    icon: AlertTriangle,
    label: "Hinweis",
    iconColor: "text-amber-600",
    bgColor: "bg-amber-50/60",
  },
  suggestion: {
    icon: Sparkles,
    label: "Vorschlag",
    iconColor: "text-green-600",
    bgColor: "bg-green-50/60",
  },
  context: {
    icon: MapPin,
    label: "Kontext",
    iconColor: "text-foreground/50",
    bgColor: "bg-foreground/[0.04]",
  },
};

// ── Time Formatting ──────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReasoningPanel({ entries, className }: ReasoningPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevEntryCountRef = useRef(0);

  // Auto-expand when first entry arrives (from zero)
  useEffect(() => {
    if (prevEntryCountRef.current === 0 && entries.length > 0) {
      setIsExpanded(true);
    }
    prevEntryCountRef.current = entries.length;
  }, [entries.length]);

  // Scroll to bottom when new entries arrive
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && isExpanded) {
      // Small delay to allow entry animation to start
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, [entries.length, isExpanded]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Count by category for the collapsed badge
  const decisionCount = entries.filter((e) => e.category === "decision").length;

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative flex-shrink-0 transition-all duration-300 ease-out overflow-hidden",
        isExpanded ? "w-80" : "w-9",
        className
      )}
    >
      {/* ── Collapsed State ─────────────────────────────────────────────── */}
      {!isExpanded && (
        <button
          onClick={toggleExpanded}
          className="h-full w-9 flex flex-col items-center justify-center gap-3 bg-foreground/[0.02] border-l border-foreground/[0.06] hover:bg-foreground/[0.04] transition-colors cursor-pointer"
          title="KI-Gedanken anzeigen"
          aria-label={`KI-Gedanken anzeigen, ${entries.length} Einträge`}
        >
          <Brain className="w-4 h-4 text-foreground/30" />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium text-foreground/50 [writing-mode:vertical-lr] rotate-180">
              {decisionCount > 0
                ? `${decisionCount} ${decisionCount === 1 ? "Entscheidung" : "Entscheidungen"}`
                : `${entries.length} ${entries.length === 1 ? "Eintrag" : "Einträge"}`}
            </span>
          </div>
          <ChevronLeft className="w-3 h-3 text-foreground/20" />
        </button>
      )}

      {/* ── Expanded State ──────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="h-full flex flex-col bg-foreground/[0.02] border-l border-foreground/[0.06]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/[0.06]">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-foreground/40" />
              <span className="text-sm font-medium text-foreground/70">
                KI-Gedanken
              </span>
              <span className="text-[11px] text-foreground/30 tabular-nums">
                {entries.length}
              </span>
            </div>
            <button
              onClick={toggleExpanded}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-foreground/[0.06] transition-colors"
              aria-label="KI-Gedanken ausblenden"
            >
              <X className="w-3.5 h-3.5 text-foreground/40" />
            </button>
          </div>

          {/* Entries List */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
          >
            {entries.map((entry, index) => (
              <ReasoningEntryCard
                key={entry.id}
                entry={entry}
                isNew={index === entries.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Entry Card ───────────────────────────────────────────────────────────────

function ReasoningEntryCard({
  entry,
  isNew,
}: {
  entry: ReasoningEntry;
  isNew: boolean;
}) {
  const config = CATEGORY_CONFIG[entry.category];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        isNew && "animate-in slide-in-from-top-2 fade-in duration-300"
      )}
    >
      {/* Top row: icon + label + timestamp */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
            config.bgColor
          )}
        >
          <Icon className={cn("w-3 h-3", config.iconColor)} />
        </div>
        <span
          className={cn(
            "text-[11px] font-medium",
            config.iconColor
          )}
        >
          {config.label}
        </span>
        <span className="text-[11px] text-foreground/30 ml-auto tabular-nums">
          {formatTime(entry.timestamp)}
        </span>
      </div>

      {/* Content */}
      <p className="text-[13px] text-foreground/80 leading-relaxed">
        {entry.content}
      </p>
    </div>
  );
}
