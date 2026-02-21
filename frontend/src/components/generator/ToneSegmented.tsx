import { cn } from "@/lib/utils";
import type { ToneLevel } from "./ToneCards";

interface ToneSegmentedProps {
  value: ToneLevel;
  onChange: (value: ToneLevel) => void;
}

const TONES: { value: ToneLevel; label: string }[] = [
  { value: 1, label: "Formal" },
  { value: 2, label: "Profess." },
  { value: 3, label: "Warm" },
  { value: 4, label: "Persönl." },
  { value: 5, label: "Empath." },
];

export function ToneSegmented({ value, onChange }: ToneSegmentedProps) {
  return (
    <div className="flex items-center rounded-lg bg-[var(--canvas-input-fill)] p-0.5 gap-0.5">
      {TONES.map((tone) => (
        <button
          key={tone.value}
          onClick={() => onChange(tone.value)}
          className={cn(
            "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
            "hover:bg-background/60",
            value === tone.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground"
          )}
        >
          {tone.label}
        </button>
      ))}
    </div>
  );
}
