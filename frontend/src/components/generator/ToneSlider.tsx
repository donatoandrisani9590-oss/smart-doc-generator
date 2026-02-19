/**
 * ToneSlider — 5-step segmented "Tone of Voice" control.
 *
 * Allows the user to select between 5 tones that influence
 * all AI-generated text (agent, ghostwriter, refine).
 *
 * Jony Ive design: minimal dots on a line, active dot highlighted.
 */

import { useCallback } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ── Tone Definitions ──────────────────────────────────────────────────

export const TONE_LEVELS = [
    { value: 1, label: "Streng formal", description: "Juristisch exakt, sachlich, Passivkonstruktionen" },
    { value: 2, label: "Professionell", description: "Klar und höflich, sachliche Standardsprache" },
    { value: 3, label: "Warm-professionell", description: "Wertschätzend, der Mitarbeiter fühlt sich willkommen" },
    { value: 4, label: "Persönlich", description: "Warme Ansprache mit menschlicher Nähe" },
    { value: 5, label: "Empathisch", description: "Einfühlsam, ideal für sensible Themen" },
] as const;

export type ToneLevel = 1 | 2 | 3 | 4 | 5;

interface ToneSliderProps {
    value: ToneLevel;
    onChange: (tone: ToneLevel) => void;
    disabled?: boolean;
    className?: string;
}

export function ToneSlider({ value, onChange, disabled = false, className }: ToneSliderProps) {
    const handleSelect = useCallback(
        (tone: ToneLevel) => {
            if (!disabled) onChange(tone);
        },
        [disabled, onChange]
    );

    const activeIndex = value - 1;

    return (
        <TooltipProvider delayDuration={150}>
            <div className={cn("space-y-1", className)}>
                {/* Label */}
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                        Tonalität
                    </span>
                    <span className="text-[11px] text-muted-foreground/40">
                        {TONE_LEVELS[activeIndex].label}
                    </span>
                </div>

                {/* Track with dots */}
                <div className="relative flex items-center justify-between h-6 px-1">
                    {/* Background track line */}
                    <div className="absolute left-1 right-1 h-[2px] rounded-full bg-foreground/[0.06]" />

                    {/* Active segment fill */}
                    <div
                        className="absolute left-1 h-[2px] rounded-full bg-primary/30 transition-all duration-300 ease-out"
                        style={{ width: `${(activeIndex / 4) * 100}%` }}
                    />

                    {/* Dots */}
                    {TONE_LEVELS.map((tone) => {
                        const isActive = tone.value === value;
                        return (
                            <Tooltip key={tone.value}>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(tone.value as ToneLevel)}
                                        disabled={disabled}
                                        className={cn(
                                            "relative z-10 rounded-full transition-all duration-300 ease-out",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                            isActive
                                                ? "w-4 h-4 bg-primary shadow-[0_1px_4px_rgba(36,49,134,0.3)]"
                                                : "w-2.5 h-2.5 bg-foreground/[0.12] hover:bg-foreground/[0.2]",
                                            disabled && "opacity-40 cursor-not-allowed"
                                        )}
                                        aria-label={tone.label}
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-[180px]">
                                    <p className="font-medium">{tone.label}</p>
                                    <p className="text-muted-foreground">{tone.description}</p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>
            </div>
        </TooltipProvider>
    );
}

export default ToneSlider;
