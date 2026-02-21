import { useState, useCallback, useMemo } from "react";
import Mustache from "mustache";

interface ClauseTemplate {
  html: string;
  title: string;
  clause_type: string;
  is_mandatory: boolean;
  is_default_selected: boolean;
  condition: Record<string, unknown> | null;
  display_order: number;
}

interface TemplateData {
  html_template: string;
  clause_templates: Record<number, ClauseTemplate>;
  document_type_name: string;
  category: string;
  country_code: string;
}

interface DocumentClause {
  id: number;
  is_enabled: boolean;
  order_index: number;
}

const FIELD_LABELS: Record<string, string> = {
  vorname: "Vorname",
  nachname: "Nachname",
  strasse: "Straße",
  plz: "PLZ",
  ort: "Ort",
  geburtsdatum: "Geburtsdatum",
  position: "Position",
  gehalt: "Gehalt",
  eintrittsdatum: "Eintrittsdatum",
  wochenstunden: "Wochenstunden",
  urlaubstage: "Urlaubstage",
  probezeit: "Probezeit",
  kuendigungsfrist: "Kündigungsfrist",
  vertragsart: "Vertragsart",
  signatory_name: "Unterzeichner",
  document_title: "Dokumenttitel",
};

/**
 * Format a date string for German locale display.
 */
function formatDateDE(value: unknown): string {
  if (!value) return "";
  try {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return String(value);
  }
}

/**
 * Format a number as German currency (e.g., "3.500,00 €").
 */
function formatCurrencyDE(value: unknown): string {
  if (!value) return "";
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

/**
 * Client-side template renderer using Mustache for instant form-to-document binding.
 * Replaces the debounced server preview for immediate feedback.
 */
export function useClientRenderer() {
  const [templateData, setTemplateData] = useState<TemplateData | null>(null);

  const render = useCallback((
    formData: Record<string, unknown>,
    clauses: DocumentClause[],
    dynamicFormValues: Record<string, string | number | boolean> = {},
  ): string => {
    if (!templateData) return "";

    // Build view data — format special fields for German locale
    const view: Record<string, unknown> = {
      ...formData,
      ...dynamicFormValues,
    };

    // Format currency fields
    if (view.gehalt) view.gehalt = formatCurrencyDE(view.gehalt);
    // Format date fields
    if (view.eintrittsdatum) view.eintrittsdatum = formatDateDE(view.eintrittsdatum);
    if (view.geburtsdatum) view.geburtsdatum = formatDateDE(view.geburtsdatum);

    // Assemble enabled clauses in order
    const enabledClauses = clauses
      .filter((c) => c.is_enabled)
      .sort((a, b) => a.order_index - b.order_index);

    // Build template from enabled clause templates
    const clauseHtml = enabledClauses
      .map((c) => {
        const tmpl = templateData.clause_templates[c.id];
        return tmpl ? tmpl.html : "";
      })
      .filter(Boolean)
      .join("\n");

    // Render the assembled clause template with Mustache
    return Mustache.render(clauseHtml, view);
  }, [templateData]);

  // Replace unfilled placeholders with skeleton spans
  const renderWithPlaceholders = useCallback((
    formData: Record<string, unknown>,
    clauses: DocumentClause[],
    dynamicFormValues?: Record<string, string | number | boolean>,
  ): string => {
    if (!templateData) return "";

    // First render with actual values
    let html = render(formData, clauses, dynamicFormValues);

    // Then find any remaining {{placeholders}} and replace with skeletons
    html = html.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => {
        const label = FIELD_LABELS[key] || key;
        return `<span class="template-placeholder">${label}</span>`;
      }
    );

    return html;
  }, [templateData, render]);

  const isReady = useMemo(() => templateData !== null, [templateData]);

  return {
    templateData,
    setTemplateData,
    render,
    renderWithPlaceholders,
    isReady,
  };
}
