/**
 * ActionStatWidget — Conditional action-stat card.
 * Only renders when count > 0. Shows colored accent dot for urgency.
 * Clicking navigates to filtered document list.
 */

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionStatWidgetProps {
  value: number;
  label: string;
  icon: LucideIcon;
  accentColor: string; // e.g. "bg-amber-500"
  onClick: () => void;
  className?: string;
}

export function ActionStatWidget({ value, label, icon: Icon, accentColor, onClick, className }: ActionStatWidgetProps) {
  // Core design rule: zero-value action stats are never rendered
  if (value === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("widget-card widget-card-interactive text-left cursor-pointer", className)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("w-1.5 h-1.5 rounded-full", accentColor)} />
        <Icon className="w-4 h-4 text-[#86868B] dark:text-muted-foreground" />
      </div>
      <p className="text-2xl font-light tracking-tight text-[#1D1D1F] dark:text-foreground">
        {value}
      </p>
      <p className="text-xs text-[#86868B] dark:text-muted-foreground uppercase tracking-wider mt-1">
        {label}
      </p>
    </button>
  );
}
