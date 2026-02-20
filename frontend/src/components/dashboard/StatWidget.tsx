/**
 * StatWidget — Single stat metric card for the Ive dashboard grid.
 * Large number + small label on a floating white surface.
 */

import { type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatWidgetProps {
  value: number;
  label: string;
  icon?: LucideIcon;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StatWidget({ value, label, icon: Icon, loading, onClick, className }: StatWidgetProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      className={cn(
        "widget-card text-left",
        onClick && "widget-card-interactive cursor-pointer",
        className
      )}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          {loading ? (
            <Skeleton className="h-9 w-16 rounded" />
          ) : (
            <p className="text-3xl font-light tracking-tight text-[#1D1D1F] dark:text-foreground">
              {value}
            </p>
          )}
          <p className="text-xs text-[#86868B] dark:text-muted-foreground uppercase tracking-wider mt-1">
            {label}
          </p>
        </div>
        {Icon && (
          <Icon className="w-4 h-4 text-[#86868B] dark:text-muted-foreground opacity-60" />
        )}
      </div>
    </Wrapper>
  );
}
