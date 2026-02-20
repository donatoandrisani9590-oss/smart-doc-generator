/**
 * PipelineStageBadge — Farbkodiertes Stage-Badge für die Listen-Ansicht.
 *
 * Ersetzt die binären "Entwurf"/"Fertig" Badges durch differenzierte
 * Pipeline-Stages mit Icon und Farbe.
 */

import {
    Edit3,
    ShieldCheck,
    Send,
    RotateCcw,
    CheckCircle,
    Archive,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Stage Configuration ──────────────────────────────────────────────────

export type PipelineStage =
    | "entwurf"
    | "freigabe"
    | "versendet"
    | "ruecklauf"
    | "abgeschlossen"
    | "archiv";

interface StageConfig {
    label: string;
    icon: LucideIcon;
    textColor: string;
    bgColor: string;
    iconBgColor: string;
}

const STAGE_CONFIG: Record<PipelineStage, StageConfig> = {
    entwurf: {
        label: "Entwurf",
        icon: Edit3,
        textColor: "text-amber-800 dark:text-amber-300",
        bgColor: "bg-amber-100 dark:bg-amber-900/40",
        iconBgColor: "bg-amber-100 dark:bg-amber-900/40",
    },
    freigabe: {
        label: "Freigabe",
        icon: ShieldCheck,
        textColor: "text-purple-800 dark:text-purple-300",
        bgColor: "bg-purple-100 dark:bg-purple-900/40",
        iconBgColor: "bg-purple-100 dark:bg-purple-900/40",
    },
    versendet: {
        label: "Versendet",
        icon: Send,
        textColor: "text-blue-800 dark:text-blue-300",
        bgColor: "bg-blue-100 dark:bg-blue-900/40",
        iconBgColor: "bg-blue-100 dark:bg-blue-900/40",
    },
    ruecklauf: {
        label: "Rücklauf",
        icon: RotateCcw,
        textColor: "text-orange-800 dark:text-orange-300",
        bgColor: "bg-orange-100 dark:bg-orange-900/40",
        iconBgColor: "bg-orange-100 dark:bg-orange-900/40",
    },
    abgeschlossen: {
        label: "Abgeschlossen",
        icon: CheckCircle,
        textColor: "text-green-800 dark:text-green-300",
        bgColor: "bg-green-100 dark:bg-green-900/40",
        iconBgColor: "bg-green-100 dark:bg-green-900/40",
    },
    archiv: {
        label: "Archiv",
        icon: Archive,
        textColor: "text-warm-600 dark:text-warm-300",
        bgColor: "bg-warm-100 dark:bg-warm-600/20",
        iconBgColor: "bg-warm-200 dark:bg-warm-600/30",
    },
};

// ── Component ────────────────────────────────────────────────────────────

interface PipelineStageBadgeProps {
    stage: string;
    className?: string;
}

export function PipelineStageBadge({ stage, className }: PipelineStageBadgeProps) {
    const config = STAGE_CONFIG[stage as PipelineStage] ?? STAGE_CONFIG.entwurf;
    const Icon = config.icon;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                config.bgColor,
                config.textColor,
                className,
            )}
        >
            <Icon className="w-3 h-3" />
            {config.label}
        </span>
    );
}

// ── Icon-only variant for compact views ──────────────────────────────────

interface PipelineStageIconProps {
    stage: string;
    className?: string;
}

export function PipelineStageIcon({ stage, className }: PipelineStageIconProps) {
    const config = STAGE_CONFIG[stage as PipelineStage] ?? STAGE_CONFIG.entwurf;
    const Icon = config.icon;

    return (
        <div
            className={cn(
                "p-2 rounded-lg transition-colors",
                config.iconBgColor,
                className,
            )}
            title={config.label}
        >
            <Icon className={cn("w-5 h-5", config.textColor)} />
        </div>
    );
}

export { STAGE_CONFIG };
