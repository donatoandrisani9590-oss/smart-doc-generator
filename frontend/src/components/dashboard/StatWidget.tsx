/**
 * StatWidget — DS v5.0 KPI stat card with colored icon box.
 * Prototype stat-card: bg-surface, border, radius-lg, colored icon square.
 * Numbers animate with GSAP count-up when scrolling into view.
 */

import { type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

interface StatWidgetProps {
  value: number;
  label: string;
  icon?: LucideIcon;
  loading?: boolean;
  accent?: boolean;
  onClick?: () => void;
  className?: string;
  iconBg?: string;
  iconColor?: string;
}

export function StatWidget({ value, label, icon: Icon, loading, accent, onClick, className, iconBg, iconColor }: StatWidgetProps) {
  const Wrapper = onClick ? "button" : "div";
  const { ref: countRef, value: displayValue } = useCountUp(value, {
    duration: 1.4,
    delay: 0.1,
    scrollTriggered: true,
  });

  const defaultIconBg = accent ? "bg-[var(--nw-blue-50)]" : "bg-[var(--nw-blue-50)]";
  const defaultIconColor = accent ? "text-[var(--nw-blue)]" : "text-[var(--nw-blue)]";

  return (
    <Wrapper
      className={cn(
        "w-full text-left bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5",
        "flex items-center gap-4 transition-all duration-150 shadow-[var(--shadow-sm)]",
        onClick && "cursor-pointer hover:shadow-[var(--shadow-md)] hover:-translate-y-[2px]",
        className
      )}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      {Icon && (
        <div className={cn(
          "w-11 h-11 rounded-[var(--radius-md)] flex items-center justify-center shrink-0",
          iconBg || defaultIconBg
        )}>
          <Icon className={cn("w-5 h-5", iconColor || defaultIconColor)} />
        </div>
      )}
      <div>
        {loading ? (
          <Skeleton className="h-7 w-16 rounded-lg" />
        ) : (
          <p ref={countRef as React.Ref<HTMLParagraphElement>} className="text-[26px] font-extrabold tracking-tight text-[var(--text-primary)] tabular-nums leading-none">
            {displayValue}
          </p>
        )}
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          {label}
        </p>
      </div>
    </Wrapper>
  );
}
