/**
 * OnboardingRing — Circular progress widget for first-time setup.
 * SVG ring shows completion progress, step list below with links.
 * Hidden when all steps complete or dismissed.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Building2, Palette, FileText, LayoutTemplate, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingRingProps {
  clauseCount: number;
  documentTypeCount: number;
  hasCompanyData: boolean;
  hasLogo: boolean;
  onDismiss: () => void;
  className?: string;
}

interface Step {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  isComplete: boolean;
}

export function OnboardingRing({
  clauseCount,
  documentTypeCount,
  hasCompanyData,
  hasLogo,
  onDismiss,
  className,
}: OnboardingRingProps) {
  const steps: Step[] = useMemo(
    () => [
      { id: "company", label: "Firmendaten", icon: Building2, href: "/settings?tab=general", isComplete: hasCompanyData },
      { id: "branding", label: "Branding", icon: Palette, href: "/settings?tab=design", isComplete: hasLogo },
      { id: "clauses", label: "Textbausteine", icon: FileText, href: "/settings?tab=clauses", isComplete: clauseCount > 0 },
      { id: "templates", label: "Vorlage erstellen", icon: LayoutTemplate, href: "/templates", isComplete: documentTypeCount > 0 },
    ],
    [hasCompanyData, hasLogo, clauseCount, documentTypeCount]
  );

  const completedCount = steps.filter((s) => s.isComplete).length;
  const total = steps.length;

  if (completedCount === total) return null;

  // SVG ring geometry
  const size = 64;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (completedCount / total) * circumference;

  return (
    <div className={cn("widget-card relative", className)}>
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] dark:hover:text-foreground transition-colors p-1 rounded-lg hover:bg-[var(--bg-hover)] dark:hover:bg-muted"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Ring + count */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <svg width={size} height={size} className="-rotate-90">
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(220 13% 91%)"
              strokeWidth={strokeWidth}
              className="dark:stroke-[hsl(225,12%,20%)]"
            />
            {/* Progress ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(228 58% 33%)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="dark:stroke-primary transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-[var(--text-primary)] dark:text-foreground">
            {completedCount}/{total}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)] dark:text-foreground">Einrichtung</p>
          <p className="text-xs text-[var(--text-tertiary)] dark:text-muted-foreground">
            {total - completedCount} {total - completedCount === 1 ? "Schritt" : "Schritte"} verbleibend
          </p>
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-1.5">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.id}
              to={step.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                step.isComplete
                  ? "text-secondary"
                  : "text-[var(--text-tertiary)] dark:text-muted-foreground hover:text-[var(--text-primary)] dark:hover:text-foreground hover:bg-[var(--bg-hover)] dark:hover:bg-muted"
              )}
            >
              {step.isComplete ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              {step.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
