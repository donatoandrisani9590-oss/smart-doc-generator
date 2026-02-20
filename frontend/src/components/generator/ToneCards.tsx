/**
 * ToneCards — 5 visual icon cards for "Tone of Voice" selection.
 *
 * Replaces ToneSlider with a more visual, scannable card layout.
 * Each card shows an icon + label. Active card is highlighted with
 * primary color and subtle scale.
 *
 * Same exported types (TONE_LEVELS, ToneLevel) as ToneSlider for
 * drop-in compatibility.
 */

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Scale, Briefcase, Handshake, Hand, Heart } from "lucide-react";
import { RefreshCw } from "lucide-react";

export const TONE_LEVELS = [
    { value: 1, label: "Formal", icon: Scale, description: "Juristisch exakt, sachlich" },
    { value: 2, label: "Professionell", icon: Briefcase, description: "Klar und höflich, Standard" },
    { value: 3, label: "Warm", icon: Handshake, description: "Wertschätzend, willkommen" },
    { value: 4, label: "Persönlich", icon: Hand, description: "Warme, menschliche Nähe" },
    { value: 5, label: "Empathisch", icon: Heart, description: "Einfühlsam, sensibel" },
] as const;

export type ToneLevel = 1 | 2 | 3 | 4 | 5;

interface ToneCardsProps {
    value: ToneLevel;
    onChange: (tone: ToneLevel) => void;
    disabled?: boolean;
    className?: string;
    // Preview system
    isPreviewActive?: boolean;
    previewTone?: string;
    onPreviewRequest?: (tone: ToneLevel) => void;
    onAcceptPreview?: () => void;
    onRevertPreview?: () => void;
    isStreaming?: boolean;
}

export function ToneCards({
    value,
    onChange,
    disabled = false,
    className,
    isPreviewActive,
    previewTone,
    onAcceptPreview,
    onRevertPreview,
    isStreaming,
}: ToneCardsProps) {
    const handleSelect = useCallback(
        (tone: ToneLevel) => {
            if (!disabled) onChange(tone);
        },
        [disabled, onChange]
    );

    return (
        <div className={cn("space-y-1.5", className)}>
            <span className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                Tonalität
            </span>
            <div className="grid grid-cols-5 gap-1.5">
                {TONE_LEVELS.map((tone) => {
                    const isActive = tone.value === value;
                    const Icon = tone.icon;
                    return (
                        <button
                            key={tone.value}
                            type="button"
                            onClick={() => handleSelect(tone.value as ToneLevel)}
                            disabled={disabled}
                            className={cn(
                                "flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all duration-200",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                isActive
                                    ? "border-primary bg-primary/5 scale-[1.02] shadow-sm"
                                    : "border-warm-200 hover:border-warm-300 hover:bg-warm-50",
                                disabled && "opacity-40 cursor-not-allowed"
                            )}
                            aria-label={tone.label}
                        >
                            <Icon className={cn(
                                "w-4 h-4",
                                isActive ? "text-primary" : "text-muted-foreground/60"
                            )} />
                            <span className={cn(
                                "text-[10px] font-medium leading-tight",
                                isActive ? "text-primary" : "text-muted-foreground/70"
                            )}>
                                {tone.label}
                            </span>
                        </button>
                    );
                })}
            </div>
            <p className="text-[10px] text-muted-foreground/40 text-center">
                {TONE_LEVELS[value - 1].description}
            </p>

            {/* Tone Preview Banner */}
            {isPreviewActive && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs">
                    <RefreshCw className={cn("w-3.5 h-3.5 text-blue-600 shrink-0", isStreaming && "animate-spin")} />
                    <span className="text-blue-700 flex-1 truncate">
                        Vorschau: „{previewTone}"
                    </span>
                    <button
                        onClick={onAcceptPreview}
                        disabled={isStreaming}
                        className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] hover:bg-blue-700 disabled:opacity-50 shrink-0"
                    >
                        Übernehmen
                    </button>
                    <button
                        onClick={onRevertPreview}
                        className="px-2 py-0.5 rounded border border-blue-300 text-blue-700 text-[10px] hover:bg-blue-100 shrink-0"
                    >
                        Original
                    </button>
                </div>
            )}
        </div>
    );
}

export default ToneCards;
