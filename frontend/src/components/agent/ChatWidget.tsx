/**
 * ChatWidget — Renders interactive inline widgets in the agent chat.
 *
 * Supports 4 widget types for the Dynamic Interview feature:
 * - chips: Quick-choice rounded buttons
 * - input: Inline form field (text, date, number, currency)
 * - multi_select: Checkbox options with confirm button
 * - slider: Numeric range with live value display
 *
 * After user interaction, widgets collapse to show the selected value.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

// ── Types ──

export interface ChatWidgetData {
  id: string;
  widget_type: "chips" | "input" | "multi_select" | "slider";
  field_key: string;
  label: string;
  options?: Array<{
    value: string;
    label: string;
    is_default?: boolean;
  }>;
  placeholder?: string;
  input_type?: "text" | "date" | "number" | "currency";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
}

interface ChatWidgetProps {
  widget: ChatWidgetData;
  onSubmit: (fieldKey: string, value: string | string[]) => void;
  disabled?: boolean;
}

// ── Main Component ──

export function ChatWidget({ widget, onSubmit, disabled = false }: ChatWidgetProps) {
  const [answered, setAnswered] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  const handleSubmit = useCallback(
    (value: string | string[]) => {
      if (disabled || answered) return;
      const display = Array.isArray(value) ? value.join(", ") : value;
      setDisplayValue(display);
      setAnswered(true);
      onSubmit(widget.field_key, value);
    },
    [disabled, answered, onSubmit, widget.field_key]
  );

  // Answered state: compact badge
  if (answered) {
    return (
      <div className="animate-in fade-in duration-200 pl-1">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 text-[13px] text-foreground/70">
          <Check className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium">{widget.label}:</span>
          <span>{displayValue}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-2 fade-in duration-300 pl-1">
      <div className="rounded-2xl shadow-[var(--shadow-elevated)] bg-background p-4 max-w-md">
        {/* Label */}
        <p className="text-[13px] text-foreground/70 mb-3">{widget.label}</p>

        {/* Widget Content */}
        {widget.widget_type === "chips" && (
          <ChipsWidget widget={widget} onSubmit={handleSubmit} disabled={disabled} />
        )}
        {widget.widget_type === "input" && (
          <InputWidget widget={widget} onSubmit={handleSubmit} disabled={disabled} />
        )}
        {widget.widget_type === "multi_select" && (
          <MultiSelectWidget widget={widget} onSubmit={handleSubmit} disabled={disabled} />
        )}
        {widget.widget_type === "slider" && (
          <SliderWidget widget={widget} onSubmit={handleSubmit} disabled={disabled} />
        )}

        {/* Hint */}
        {widget.hint && (
          <p className="text-[12px] text-muted-foreground/50 italic mt-3">
            {widget.hint}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Chips Widget ──

function ChipsWidget({
  widget,
  onSubmit,
  disabled,
}: {
  widget: ChatWidgetData;
  onSubmit: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {widget.options?.map((option) => (
        <button
          key={option.value}
          onClick={() => onSubmit(option.value)}
          disabled={disabled}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-[13px] transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            option.is_default
              ? "bg-background ring-1 ring-primary/30 text-primary hover:bg-primary/5"
              : "bg-background border border-foreground/10 text-foreground hover:bg-primary/5 hover:border-primary/20"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ── Input Widget ──

function InputWidget({
  widget,
  onSubmit,
  disabled,
}: {
  widget: ChatWidgetData;
  onSubmit: (value: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus the input on mount
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const inputType = widget.input_type === "date"
    ? "date"
    : widget.input_type === "number" || widget.input_type === "currency"
      ? "number"
      : "text";

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            type={inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (value.trim()) handleSubmit();
            }}
            placeholder={widget.placeholder || "Eingabe..."}
            disabled={disabled}
            className={cn(
              "text-sm",
              widget.input_type === "currency" && "pr-8"
            )}
            showOverflowTooltip={false}
          />
          {widget.input_type === "currency" && (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground/50 pointer-events-none">
              &euro;
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Multi-Select Widget ──

function MultiSelectWidget({
  widget,
  onSubmit,
  disabled,
}: {
  widget: ChatWidgetData;
  onSubmit: (value: string[]) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    const defaults = new Set<string>();
    widget.options?.forEach((opt) => {
      if (opt.is_default) defaults.add(opt.value);
    });
    return defaults;
  });

  const toggleOption = (value: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onSubmit(Array.from(selected));
  };

  return (
    <div className="space-y-2">
      {widget.options?.map((option) => (
        <button
          key={option.value}
          onClick={() => toggleOption(option.value)}
          disabled={disabled}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            selected.has(option.value)
              ? "bg-primary/5 shadow-[var(--shadow-elevated)]"
              : "bg-background hover:bg-warm-50"
          )}
        >
          <Checkbox
            checked={selected.has(option.value)}
            onCheckedChange={() => toggleOption(option.value)}
            disabled={disabled}
            className="pointer-events-none"
          />
          <span className="text-[13px] text-foreground">{option.label}</span>
        </button>
      ))}

      <Button
        size="sm"
        onClick={handleConfirm}
        disabled={disabled || selected.size === 0}
        className="mt-1 rounded-xl text-[13px]"
      >
        Übernehmen
      </Button>
    </div>
  );
}

// ── Slider Widget ──

function SliderWidget({
  widget,
  onSubmit,
  disabled,
}: {
  widget: ChatWidgetData;
  onSubmit: (value: string) => void;
  disabled: boolean;
}) {
  const min = widget.min ?? 0;
  const max = widget.max ?? 100;
  const step = widget.step ?? 1;
  const unit = widget.unit ?? "";

  // Default to midpoint
  const [value, setValue] = useState(Math.round((min + max) / 2));
  const [committed, setCommitted] = useState(false);

  const handleValueChange = (values: number[]) => {
    if (committed) return;
    setValue(values[0]);
  };

  const handleValueCommit = (values: number[]) => {
    if (committed || disabled) return;
    setValue(values[0]);
    setCommitted(true);
    onSubmit(String(values[0]));
  };

  return (
    <div className="space-y-3">
      {/* Current value display */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-foreground tabular-nums">
          {value.toLocaleString("de-DE")}
        </span>
        {unit && (
          <span className="text-[13px] text-muted-foreground/60">{unit}</span>
        )}
      </div>

      {/* Slider */}
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
        disabled={disabled || committed}
        className="w-full"
      />

      {/* Range labels */}
      <div className="flex justify-between text-[11px] text-muted-foreground/40">
        <span>
          {min.toLocaleString("de-DE")}
          {unit ? ` ${unit}` : ""}
        </span>
        <span>
          {max.toLocaleString("de-DE")}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
    </div>
  );
}
