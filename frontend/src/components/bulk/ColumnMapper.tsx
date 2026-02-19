/**
 * ColumnMapper - AI-assisted column mapping for bulk wizard Step 2
 *
 * Two-column layout: Left = CSV columns, Right = Form field dropdowns
 * Each mapping shows AI confidence badge + optional transform notes.
 */

import { ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ColumnSuggestion {
  csv_column: string;
  suggested_field: string | null;
  confidence: number;
  transform_note?: string;
}

export interface FormFieldOption {
  key: string;
  label: string;
  required: boolean;
}

export interface ColumnMapping {
  csv_column: string;
  form_field: string; // "ignore" = skip
}

interface ColumnMapperProps {
  suggestions: ColumnSuggestion[];
  formFields: FormFieldOption[];
  mappings: ColumnMapping[];
  onMappingChange: (csvColumn: string, formField: string) => void;
}

// ─── Confidence Badge ────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) {
    return (
      <Badge className="text-[10px] px-1.5 py-0 border-0 bg-secondary/10 text-secondary">
        Erkannt
      </Badge>
    );
  }
  if (confidence >= 0.5) {
    return (
      <Badge className="text-[10px] px-1.5 py-0 border-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        Vorschlag
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] px-1.5 py-0 border-0 bg-muted text-muted-foreground">
      Unbekannt
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ColumnMapper({
  suggestions,
  formFields,
  mappings,
  onMappingChange,
}: ColumnMapperProps) {
  // Find the current mapping value for a CSV column
  const getMappingValue = (csvColumn: string): string => {
    const mapping = mappings.find((m) => m.csv_column === csvColumn);
    return mapping?.form_field ?? "";
  };

  // Already-mapped form fields (to show which are taken)
  const usedFields = new Set(
    mappings
      .filter((m) => m.form_field && m.form_field !== "ignore")
      .map((m) => m.form_field)
  );

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          CSV-Spalte
        </p>
        <div className="w-6" /> {/* Arrow spacer */}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Formularfeld
        </p>
      </div>

      {/* Mapping rows */}
      {suggestions.map((suggestion) => {
        const currentValue = getMappingValue(suggestion.csv_column);
        const isIgnored = currentValue === "ignore";
        const isMapped = currentValue && !isIgnored;

        return (
          <div
            key={suggestion.csv_column}
            className={cn(
              "grid grid-cols-[1fr_auto_1fr] gap-3 items-center px-3 py-3 rounded-xl transition-colors",
              isMapped
                ? "bg-secondary/5"
                : isIgnored
                ? "bg-muted/30 opacity-60"
                : "bg-warm-50/50 dark:bg-white/[0.02]"
            )}
          >
            {/* Left: CSV column info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {suggestion.csv_column}
                </p>
                <ConfidenceBadge confidence={suggestion.confidence} />
              </div>
              {suggestion.transform_note && (
                <p className="text-xs text-muted-foreground/60 mt-1 truncate">
                  {suggestion.transform_note}
                </p>
              )}
            </div>

            {/* Center: Arrow */}
            <ArrowRight
              className={cn(
                "w-4 h-4 flex-shrink-0",
                isMapped ? "text-secondary" : "text-muted-foreground/30"
              )}
            />

            {/* Right: Field selector */}
            <Select
              value={currentValue}
              onValueChange={(value) =>
                onMappingChange(suggestion.csv_column, value)
              }
            >
              <SelectTrigger
                className={cn(
                  "h-9 text-sm rounded-lg",
                  // Override the borderless style for this specific use case
                  "border border-border/50 shadow-none px-3",
                  !currentValue && "text-muted-foreground/50"
                )}
              >
                <SelectValue placeholder="Feld zuordnen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ignore">
                  <span className="text-muted-foreground">Ignorieren</span>
                </SelectItem>
                {formFields.map((field) => {
                  const isUsedByOther =
                    usedFields.has(field.key) &&
                    getMappingValue(suggestion.csv_column) !== field.key;
                  return (
                    <SelectItem
                      key={field.key}
                      value={field.key}
                      disabled={isUsedByOther}
                    >
                      <span className="flex items-center gap-2">
                        {field.label}
                        {field.required && (
                          <span className="text-destructive text-[10px]">*</span>
                        )}
                        {isUsedByOther && (
                          <span className="text-[10px] text-muted-foreground">
                            (belegt)
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        );
      })}

      {/* Required fields status */}
      <div className="px-3 pt-2">
        <RequiredFieldsStatus
          formFields={formFields}
          mappings={mappings}
        />
      </div>
    </div>
  );
}

// ─── Required Fields Status ──────────────────────────────────────────────────

function RequiredFieldsStatus({
  formFields,
  mappings,
}: {
  formFields: FormFieldOption[];
  mappings: ColumnMapping[];
}) {
  const requiredFields = formFields.filter((f) => f.required);
  const mappedFields = new Set(
    mappings
      .filter((m) => m.form_field && m.form_field !== "ignore")
      .map((m) => m.form_field)
  );

  const missingRequired = requiredFields.filter(
    (f) => !mappedFields.has(f.key)
  );

  if (missingRequired.length === 0) {
    return (
      <p className="text-xs text-secondary font-medium">
        Alle Pflichtfelder zugeordnet
      </p>
    );
  }

  return (
    <p className="text-xs text-destructive/70">
      Fehlende Pflichtfelder:{" "}
      {missingRequired.map((f) => f.label).join(", ")}
    </p>
  );
}

export default ColumnMapper;
