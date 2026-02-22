/**
 * ActionStatWidget — DS v5.0 compact action-stat pill.
 * Only renders when count > 0. Inline layout with accent dot.
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
        "flex items-center gap-2.5 px-4 py-2.5 rounded-[var(--radius-lg)]",
        "bg-[var(--bg-surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]",
        "text-left cursor-pointer transition-all duration-150",
        "hover:shadow-[var(--shadow-md)] hover:-translate-y-[2px]",
        className
      )}
    >
      <span className={cn("w-2 h-2 rounded-full shrink-0", accentColor)} />
      <Icon className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
      <span className="text-lg font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
        {value}
      </span>
      <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
        {label}
      </span>
    </button>
  );
}
