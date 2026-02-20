/**
 * DynamicFieldsSection — Dokumenttyp-spezifische Zusatzfelder
 *
 * Rendert die aus documentTypeFields.ts gelesene Feldkonfiguration
 * für den aktuell gewählten Dokumenttyp. Werte werden über
 * updateDynamicField() im WizardContext persistiert und automatisch
 * an die Generation-API übergeben.
 *
 * Unterstützte Feldtypen: text, textarea, select, checkbox, date, number
 */

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, SlidersHorizontal } from "lucide-react";
import { useWizardContext } from "../WizardContext";
import { getFieldsForDocumentType, type DynamicFieldDefinition } from "@/config/documentTypeFields";

interface DynamicFieldsSectionProps {
    documentTypeName: string;
    /** DE or IT — used for potential future i18n */
    countryCode?: string;
}

export function DynamicFieldsSection({ documentTypeName }: DynamicFieldsSectionProps) {
    const { state, actions } = useWizardContext();
    const fields = useMemo(() => getFieldsForDocumentType(documentTypeName), [documentTypeName]);

    // Nothing to show for this document type
    if (fields.length === 0) return null;

    const getValue = (field: DynamicFieldDefinition): string | boolean | number => {
        const stored = state.dynamicFormValues[field.key];
        if (stored !== undefined) return stored;
        return field.defaultValue ?? (field.type === "checkbox" ? false : "");
    };

    return (
        <TooltipProvider>
            <div className="space-y-4 pt-5 mt-2 border-t border-border/40">
                {/* Section header */}
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {documentTypeName}-spezifisch
                    </h4>
                </div>

                {fields.map((field) => (
                    <DynamicField
                        key={field.key}
                        field={field}
                        value={getValue(field)}
                        onChange={actions.updateDynamicField}
                    />
                ))}
            </div>
        </TooltipProvider>
    );
}

// ── Individual Field Renderer ──────────────────────────────────────────────

interface DynamicFieldProps {
    field: DynamicFieldDefinition;
    value: string | boolean | number;
    onChange: (key: string, value: string | boolean | number) => void;
}

function DynamicField({ field, value, onChange }: DynamicFieldProps) {
    const labelEl = (
        <div className="flex items-center gap-1.5">
            <Label htmlFor={`dyn-${field.key}`} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {field.hint && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-56 text-xs">
                        {field.hint}
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );

    // ── Checkbox ───────────────────────────────────────────────────────────
    if (field.type === "checkbox") {
        return (
            <div className="flex items-center gap-2.5">
                <Checkbox
                    id={`dyn-${field.key}`}
                    checked={Boolean(value)}
                    onCheckedChange={(checked) => onChange(field.key, Boolean(checked))}
                />
                <Label
                    htmlFor={`dyn-${field.key}`}
                    className="text-sm font-medium cursor-pointer leading-none"
                >
                    {field.label}
                    {field.hint && (
                        <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                            {field.hint}
                        </span>
                    )}
                </Label>
            </div>
        );
    }

    // ── Select ─────────────────────────────────────────────────────────────
    if (field.type === "select" && field.options) {
        return (
            <div className="space-y-1.5">
                {labelEl}
                <Select
                    value={String(value)}
                    onValueChange={(v) => onChange(field.key, v)}
                >
                    <SelectTrigger id={`dyn-${field.key}`} className="h-9 text-sm">
                        <SelectValue placeholder={field.placeholder ?? "Bitte wählen..."} />
                    </SelectTrigger>
                    <SelectContent>
                        {field.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    }

    // ── Textarea ───────────────────────────────────────────────────────────
    if (field.type === "textarea") {
        return (
            <div className="space-y-1.5">
                {labelEl}
                <Textarea
                    id={`dyn-${field.key}`}
                    value={String(value)}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="resize-none text-sm"
                />
            </div>
        );
    }

    // ── Date ───────────────────────────────────────────────────────────────
    if (field.type === "date") {
        return (
            <div className="space-y-1.5">
                {labelEl}
                <Input
                    id={`dyn-${field.key}`}
                    type="date"
                    value={String(value)}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className="h-9 text-sm"
                />
            </div>
        );
    }

    // ── Number ─────────────────────────────────────────────────────────────
    if (field.type === "number") {
        return (
            <div className="space-y-1.5">
                {labelEl}
                <Input
                    id={`dyn-${field.key}`}
                    type="number"
                    value={String(value)}
                    onChange={(e) => onChange(field.key, e.target.value ? Number(e.target.value) : "")}
                    placeholder={field.placeholder}
                    className="h-9 text-sm"
                />
            </div>
        );
    }

    // ── Text (default) ─────────────────────────────────────────────────────
    return (
        <div className="space-y-1.5">
            {labelEl}
            <Input
                id={`dyn-${field.key}`}
                type="text"
                value={String(value)}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="h-9 text-sm"
            />
        </div>
    );
}
