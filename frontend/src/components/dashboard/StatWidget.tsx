/**
 * StatWidget — DS v2.1 KPI stat card with glass surface.
 * Large bold number + small caps label. Optional blue accent stripe.
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
}

export function StatWidget({ value, label, icon: Icon, loading, accent, onClick, className }: StatWidgetProps) {
  const Wrapper = onClick ? "button" : "div";
  const { ref: countRef, value: displayValue } = useCountUp(value, {
    duration: 1.4,
    delay: 0.1,
    scrollTriggered: true,
  });

  return (
    <Wrapper
      className={cn(
        "glass-card text-left relative overflow-hidden",
        onClick && "cursor-pointer hover:-translate-y-[1px] hover:shadow-[0_8px_32px_rgba(36,49,134,0.08)] transition-all duration-200",
        className
      )}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      {/* Blue accent stripe for primary KPI */}
      {accent && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--nw-blue-700)] rounded-l-[var(--radius-2xl)]" />
      )}

      <div className={cn("flex items-start justify-between", accent && "pl-2")}>
        <div>
          {loading ? (
            <Skeleton className="h-9 w-16 rounded-lg" />
          ) : (
            <p ref={countRef as React.Ref<HTMLParagraphElement>} className="text-3xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
              {displayValue}
            </p>
          )}
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mt-1">
            {label}
          </p>
        </div>
        {Icon && (
          <Icon className="w-4 h-4 text-[var(--text-tertiary)] opacity-60" />
        )}
      </div>
    </Wrapper>
  );
}
