/**
 * ActionStatWidget — DS v2.1 conditional action-stat card.
 * Only renders when count > 0. Colored accent dot for urgency.
 */

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionStatWidgetProps {
  value: number;
  label: string;
  icon: LucideIcon;
  accentColor: string;
  onClick: () => void;
  className?: string;
}

export function ActionStatWidget({ value, label, icon: Icon, accentColor, onClick, className }: ActionStatWidgetProps) {
  if (value === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-card text-left cursor-pointer hover:-translate-y-[1px] hover:shadow-[0_8px_32px_rgba(36,49,134,0.08)] transition-all duration-200",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("w-1.5 h-1.5 rounded-full", accentColor)} />
        <Icon className="w-4 h-4 text-[var(--text-tertiary)]" />
      </div>
      <p className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
        {value}
      </p>
      <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mt-1">
        {label}
      </p>
    </button>
  );
}
