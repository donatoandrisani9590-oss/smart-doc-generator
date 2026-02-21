/**
 * CompanySettingsPage - Stammdaten-Verwaltung
 *
 * v5.0 True-Fidelity Redesign:
 * - Debounced auto-save (1.5s) with visual indicator
 * - Enclosed input fields (bg + border + focus ring)
 * - Auto-resize textarea for AI instructions
 * - White-on-gray floating card layout
 *
 * v4.2 Feature (Kapitel 15.5.7):
 * - Firmendaten zentral pflegen
 * - Automatisches Ausfüllen in Dokumenten
 *
 * HINWEIS: Vertrags-Standardwerte (Probezeit, Kündigungsfrist, etc.) wurden
 * in den Dokumenttyp verschoben, da diese pro Dokumenttyp unterschiedlich sein können.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator";
import type { SaveStatus } from "@/hooks/useAutoSave";
import {
    Building2,
    MapPin,
    User,
    FileText,
    AlertCircle,
    Bot,
    Info,
    ArrowRight,
    Loader2,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/api-client";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface CompanySettings {
    id: number;
    country_code: string;
    company_name: string | null;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    managing_director: string | null;
    commercial_register: string | null;
    tax_id: string | null;
    ai_instructions: string | null;
    updated_at: string | null;
    updated_by: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Enclosed-field style — overrides default bottom-line Ive inputs
// ═══════════════════════════════════════════════════════════════════════════

const fieldClass = [
    "border border-warm-200/60 rounded-xl bg-muted/40 px-3.5",
    "shadow-none focus-visible:shadow-none",
    "focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40",
    "transition-all duration-200",
].join(" ");

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function CompanySettingsPage() {
    const [, setSearchParams] = useSearchParams();
    const [country, setCountry] = useState<"DE" | "IT">("DE");
    const [settings, setSettings] = useState<CompanySettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // ─── Auto-Save State ──────────────────────────────────────────
    const [autoSaveStatus, setAutoSaveStatus] = useState<SaveStatus>("idle");
    const lastSavedDataRef = useRef("");
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const countryRef = useRef(country);

    // ─── Auto-Resize Textarea ─────────────────────────────────────
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ─── Form State ───────────────────────────────────────────────
    const [formData, setFormData] = useState({
        company_name: "",
        street: "",
        postal_code: "",
        city: "",
        managing_director: "",
        commercial_register: "",
        tax_id: "",
        ai_instructions: "",
    });

    // Keep country ref in sync for auto-save closures
    useEffect(() => {
        countryRef.current = country;
    }, [country]);

    // Fetch settings on country change
    useEffect(() => {
        fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch only on mount and when country changes
    }, [country]);

    const fetchSettings = async () => {
        setIsLoading(true);
        setFetchError(null);
        setAutoSaveStatus("idle");
        // Cancel any pending auto-save when switching countries
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        try {
            const response = await apiFetch(`/api/v1/company-settings/${country}`);
            if (!response.ok) throw new Error("Einstellungen konnten nicht geladen werden");
            const data: CompanySettings = await response.json();
            setSettings(data);
            const newFormData = {
                company_name: data.company_name || "",
                street: data.street || "",
                postal_code: data.postal_code || "",
                city: data.city || "",
                managing_director: data.managing_director || "",
                commercial_register: data.commercial_register || "",
                tax_id: data.tax_id || "",
                ai_instructions: data.ai_instructions || "",
            };
            setFormData(newFormData);
            // Sync baseline so auto-save doesn't fire for fetched data
            lastSavedDataRef.current = JSON.stringify(newFormData);
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Debounced Auto-Save (1.5s after last keystroke) ──────────
    useEffect(() => {
        const serialized = JSON.stringify(formData);
        if (serialized === lastSavedDataRef.current) return;

        setAutoSaveStatus("pending");

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
            setAutoSaveStatus("saving");
            try {
                const response = await apiFetch(
                    `/api/v1/company-settings/${countryRef.current}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(formData),
                    }
                );
                if (!response.ok) throw new Error("Speichern fehlgeschlagen");
                const result = await response.json();
                setSettings((prev) =>
                    prev
                        ? { ...prev, updated_at: result.updated_at, updated_by: result.updated_by }
                        : prev
                );
                lastSavedDataRef.current = JSON.stringify(formData);
                setAutoSaveStatus("saved");
                statusTimeoutRef.current = setTimeout(() => setAutoSaveStatus("idle"), 3000);
            } catch {
                setAutoSaveStatus("error");
                statusTimeoutRef.current = setTimeout(() => setAutoSaveStatus("idle"), 5000);
            }
        }, 1500);

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-run when form data changes
    }, [formData]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        };
    }, []);

    // ─── Auto-Resize Textarea ─────────────────────────────────────
    const resizeTextarea = useCallback(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = "auto";
            el.style.height = `${Math.max(el.scrollHeight, 120)}px`;
        }
    }, []);

    useEffect(() => {
        resizeTextarea();
    }, [formData.ai_instructions, resizeTextarea]);

    // ─── Helpers ──────────────────────────────────────────────────
    const updateField = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // ─── Loading State ────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Render
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <div className="space-y-6 max-w-[900px]">
            {/* ─── Header Row ──────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">
                        Stammdaten
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Zentrale Firmendaten für automatisches Ausfüllen
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {/* Auto-Save Indicator */}
                    <AutoSaveIndicator status={autoSaveStatus} size="sm" />

                    {/* Country Selector */}
                    <Select value={country} onValueChange={(v) => setCountry(v as "DE" | "IT")}>
                        <SelectTrigger
                            className={`w-[180px] ${fieldClass} h-10 bg-white hover:bg-muted/20`}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DE">🇩🇪 Deutschland</SelectItem>
                            <SelectItem value="IT">🇮🇹 Italien</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ─── Fetch Error ──────────────────────────────────────── */}
            {fetchError && (
                <div className="bg-destructive/10 text-destructive rounded-xl p-4 flex items-center gap-2 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {fetchError}
                </div>
            )}

            {/* ─── Two-Column Card Grid ────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ═══ Company Data Card ═══ */}
                <Card>
                    <CardContent className="p-6 space-y-5">
                        {/* Card Header */}
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Building2 className="w-[18px] h-[18px] text-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-foreground">
                                    Unternehmensdaten
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Werden automatisch in Dokumente eingefügt
                                </p>
                            </div>
                        </div>

                        {/* Fields */}
                        <div className="space-y-4">
                            <FieldGroup
                                id="company-name"
                                icon={Building2}
                                label="Firmenname"
                                value={formData.company_name}
                                onChange={(v) => updateField("company_name", v)}
                                placeholder="Niederwieser GmbH"
                            />

                            <FieldGroup
                                id="company-street"
                                icon={MapPin}
                                label="Straße"
                                value={formData.street}
                                onChange={(v) => updateField("street", v)}
                                placeholder="Musterstraße 123"
                            />

                            <div className="grid grid-cols-3 gap-3">
                                <FieldGroup
                                    id="company-plz"
                                    label="PLZ"
                                    value={formData.postal_code}
                                    onChange={(v) => updateField("postal_code", v)}
                                    placeholder="80333"
                                />
                                <div className="col-span-2">
                                    <FieldGroup
                                        id="company-city"
                                        label="Ort"
                                        value={formData.city}
                                        onChange={(v) => updateField("city", v)}
                                        placeholder="München"
                                    />
                                </div>
                            </div>

                            <FieldGroup
                                id="company-director"
                                icon={User}
                                label="Geschäftsführer"
                                value={formData.managing_director}
                                onChange={(v) => updateField("managing_director", v)}
                                placeholder="Hans Niederwieser"
                            />

                            <FieldGroup
                                id="company-register"
                                icon={FileText}
                                label="Handelsregister"
                                value={formData.commercial_register}
                                onChange={(v) => updateField("commercial_register", v)}
                                placeholder="HRB 12345, Amtsgericht München"
                            />

                            <FieldGroup
                                id="company-tax-id"
                                label="USt-IdNr."
                                value={formData.tax_id}
                                onChange={(v) => updateField("tax_id", v)}
                                placeholder="DE123456789"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* ═══ AI Instructions Card ═══ */}
                <Card>
                    <CardContent className="p-6 space-y-5">
                        {/* Card Header */}
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Bot className="w-[18px] h-[18px] text-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-foreground">
                                    Unternehmensweite KI-Anweisungen
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Globale Anweisungen für alle KI-Aktionen
                                </p>
                            </div>
                        </div>

                        {/* Dynamic Textarea */}
                        <div className="space-y-2">
                            <label
                                htmlFor="ai-instructions"
                                className="text-sm font-medium text-foreground flex items-center gap-2"
                            >
                                <Bot className="w-3.5 h-3.5 text-muted-foreground/60" />
                                Anweisungen für die KI
                            </label>
                            <textarea
                                ref={textareaRef}
                                id="ai-instructions"
                                value={formData.ai_instructions}
                                onChange={(e) => {
                                    updateField("ai_instructions", e.target.value);
                                    // Resize immediately on input for fluid feel
                                    requestAnimationFrame(resizeTextarea);
                                }}
                                placeholder={
                                    "z.B. Verwende österreichisches Arbeitsrecht.\n" +
                                    "Alle Dokumente per 'Sie'.\n" +
                                    "Firmensitz Wien."
                                }
                                className={[
                                    "w-full min-h-[120px] text-sm py-3",
                                    "ring-offset-background placeholder:text-muted-foreground/30",
                                    "focus-visible:outline-none",
                                    "disabled:cursor-not-allowed disabled:opacity-50",
                                    "resize-none overflow-hidden",
                                    fieldClass,
                                ].join(" ")}
                            />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Diese Anweisungen werden bei jeder KI-Aktion berücksichtigt:
                                Compliance-Check, Textbaustein-Auswahl, Chat-Assistent, Smart
                                Mode und Dokument-Upload-Analyse.
                            </p>
                        </div>

                        {/* Info Box */}
                        <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3.5">
                            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            <div className="text-xs text-muted-foreground leading-relaxed">
                                Diese Anweisungen gelten unternehmensweit. Team-spezifische
                                Anweisungen können unter{" "}
                                <button
                                    type="button"
                                    onClick={() => setSearchParams({ tab: "ai-instructions" })}
                                    className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium underline-offset-2 hover:underline transition-colors"
                                >
                                    Einstellungen &rarr; KI-Anweisungen
                                    <ArrowRight className="w-3 h-3" />
                                </button>{" "}
                                konfiguriert werden.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Timestamp Footer ────────────────────────────────── */}
            {settings?.updated_at && (
                <p className="text-xs text-muted-foreground/60 pt-2">
                    Zuletzt aktualisiert:{" "}
                    {new Date(settings.updated_at).toLocaleString("de-DE")}
                    {settings.updated_by && ` von ${settings.updated_by}`}
                </p>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// FieldGroup — Reusable enclosed input with label
// ═══════════════════════════════════════════════════════════════════════════

interface FieldGroupProps {
    id: string;
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

function FieldGroup({ id, icon: Icon, label, value, onChange, placeholder }: FieldGroupProps) {
    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="text-sm font-medium text-foreground flex items-center gap-2"
            >
                {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />}
                {label}
            </label>
            <Input
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`${fieldClass} h-10`}
            />
        </div>
    );
}
