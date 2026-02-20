/**
 * ActionSummaryCards - Handlungsbedarf-Karten
 *
 * Horizontal scrollable row of compact action-needed cards
 * for the Repository page. Fetches summary from API on mount
 * and allows filtering by clicking individual cards.
 */

import { useState, useEffect } from "react";
import {
  MailX,
  RotateCcw,
  CalendarClock,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ────────────────────────────────────────────────────────────────

interface ActionSummaryResponse {
  ohne_versand: number;
  ruecksendung_ausstehend: number;
  wiedervorlage_faellig: number;
  freigabe_offen: number;
  entwuerfe_ablaufend: number;
  ruecksendung_ueberfaellig?: number;
  freigabe_ueberfaellig?: number;
}

export interface ActionSummaryCardsProps {
  activeFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
  className?: string;
}

// ── Card Definitions ─────────────────────────────────────────────────────

interface CardDef {
  key: keyof ActionSummaryResponse;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  overdueKey?: keyof ActionSummaryResponse;
}

const CARDS: CardDef[] = [
  {
    key: "ohne_versand",
    label: "Ohne Versand",
    icon: MailX,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
  },
  {
    key: "ruecksendung_ausstehend",
    label: "Rücksendung ausstehend",
    icon: RotateCcw,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    overdueKey: "ruecksendung_ueberfaellig",
  },
  {
    key: "wiedervorlage_faellig",
    label: "Wiedervorlage fällig",
    icon: CalendarClock,
    color: "text-red-600",
    bgColor: "bg-red-500/10",
  },
  {
    key: "freigabe_offen",
    label: "Freigabe offen",
    icon: ShieldCheck,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    overdueKey: "freigabe_ueberfaellig",
  },
  {
    key: "entwuerfe_ablaufend",
    label: "Entwürfe ablaufend",
    icon: Timer,
    color: "text-warm-500",
    bgColor: "bg-warm-500/10",
  },
];

// ── Component ────────────────────────────────────────────────────────────

export function ActionSummaryCards({
  activeFilter,
  onFilterChange,
  className,
}: ActionSummaryCardsProps) {
  const [data, setData] = useState<ActionSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      try {
        const response = await api.get<ActionSummaryResponse>(
          "/api/v1/repository/action-summary"
        );
        if (!cancelled) {
          setData(response.data);
        }
      } catch {
        // Silently fail - cards simply won't render counts
        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCardClick = (key: string) => {
    if (!onFilterChange) return;
    // Toggle behavior: clicking the active filter resets it
    onFilterChange(activeFilter === key ? null : key);
  };

  if (loading) {
    return (
      <div className={cn("flex gap-2 overflow-x-auto", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] min-w-[150px] rounded-xl" />
        ))}
      </div>
    );
  }

  // If the API returned nothing, don't render
  if (!data) return null;

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto rounded-xl bg-white p-2 shadow-[var(--shadow-soft)]",
        className
      )}
    >
      {CARDS.map((card) => {
        const count = data[card.key] ?? 0;
        const overdueCount = card.overdueKey ? (data[card.overdueKey] ?? 0) : 0;
        const isActive = activeFilter === card.key;
        const hasItems = count > 0;
        const Icon = card.icon;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => handleCardClick(card.key)}
            className={cn(
              "relative flex items-center gap-2 rounded-xl px-3 py-2 transition-all",
              "min-w-fit cursor-pointer select-none",
              // Base state
              "hover:bg-warm-50",
              // Active/selected state
              isActive && "ring-2 ring-primary/30 bg-primary/5",
              // Muted when count is zero and not active
              !hasItems && !isActive && "opacity-50"
            )}
            aria-label={`${card.label}: ${count}${overdueCount > 0 ? ` (${overdueCount} überfällig)` : ""}`}
            aria-pressed={isActive}
          >
            {/* Overdue badge */}
            {overdueCount > 0 && (
              <span className="absolute -top-1.5 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
                {overdueCount}
              </span>
            )}

            {/* Icon circle */}
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                card.bgColor
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", card.color)} />
            </span>

            {/* Count + Label */}
            <span className="flex flex-col items-start leading-none">
              <span
                className={cn(
                  "text-[15px] font-semibold tabular-nums",
                  hasItems ? "text-foreground" : "text-foreground/40"
                )}
              >
                {count}
              </span>
              <span className="text-[11px] whitespace-nowrap text-foreground/50">
                {card.label}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
