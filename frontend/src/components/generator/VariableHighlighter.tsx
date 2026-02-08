/**
 * VariableHighlighter - Highlights filled variables in document preview
 *
 * Makes inserted data (name, date, salary) visually distinct
 * so the HR manager can verify at a glance that all values are correct.
 *
 * Design: Light blue background for filled values, amber for missing/placeholder.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface VariableHighlighterProps {
  /** Raw HTML content from document preview */
  html: string;
  /** Form data used to fill variables */
  formData: Record<string, string | number | undefined>;
  /** Field labels for tooltips */
  fieldLabels?: Record<string, string>;
  className?: string;
}

/**
 * Label mappings for common form fields
 */
const DEFAULT_LABELS: Record<string, string> = {
  vorname: "Vorname",
  nachname: "Nachname",
  position: "Position",
  gehalt: "Gehalt",
  eintrittsdatum: "Eintrittsdatum",
  wochenstunden: "Wochenstunden",
  urlaubstage: "Urlaubstage",
  probezeit: "Probezeit",
  kuendigungsfrist: "Kuendigungsfrist",
  signatory_name: "Unterzeichner",
  abteilung: "Abteilung",
  geburtsdatum: "Geburtsdatum",
  strasse: "Strasse",
  plz: "PLZ",
  ort: "Ort",
};

/**
 * Takes HTML preview content and wraps filled variable values in
 * highlighted spans for visual identification.
 *
 * Strategy:
 * 1. Find all filled values in the HTML (e.g., "Max Mustermann", "60.000")
 * 2. Wrap them in <mark> tags with appropriate styling
 * 3. Unfilled {{placeholders}} get a warning highlight
 */
export function highlightVariables(
  html: string,
  formData: Record<string, string | number | undefined>,
  fieldLabels: Record<string, string> = DEFAULT_LABELS
): string {
  if (!html) return "";

  let result = html;

  // Step 1: Highlight unfilled {{placeholders}} with warning style
  result = result.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (match, fieldName) => {
      const label = fieldLabels[fieldName] || fieldName;
      return `<mark class="variable-highlight variable-missing" data-field="${fieldName}" title="Noch nicht ausgefuellt: ${label}">${match}</mark>`;
    }
  );

  // Step 2: Highlight filled values
  // Sort by value length (longest first) to avoid partial replacements
  const filledEntries = Object.entries(formData)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => ({
      key,
      value: String(value).trim(),
      label: fieldLabels[key] || key,
    }))
    .sort((a, b) => b.value.length - a.value.length);

  for (const entry of filledEntries) {
    // Skip very short values (single chars) to avoid false matches
    if (entry.value.length < 2) continue;

    // Escape for regex
    const escaped = entry.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Only replace values that appear in text content (not in HTML tags)
    // Use a negative lookbehind/lookahead to avoid replacing inside tags
    const regex = new RegExp(
      `(?<![<\\w/="'-])${escaped}(?![\\w"'>])`,
      "g"
    );

    result = result.replace(
      regex,
      `<mark class="variable-highlight variable-filled" data-field="${entry.key}" title="${entry.label}">${entry.value}</mark>`
    );
  }

  return result;
}

/**
 * CSS styles for variable highlighting.
 * Can be imported in preview.css or injected inline.
 */
export const VARIABLE_HIGHLIGHT_STYLES = `
  .variable-highlight {
    border-radius: 3px;
    padding: 1px 4px;
    font-weight: inherit;
    cursor: default;
    transition: background-color 0.2s;
  }

  .variable-filled {
    background-color: rgba(59, 130, 246, 0.12);
    border-bottom: 2px solid rgba(59, 130, 246, 0.4);
    color: inherit;
  }

  .variable-filled:hover {
    background-color: rgba(59, 130, 246, 0.22);
  }

  .variable-missing {
    background-color: rgba(245, 158, 11, 0.15);
    border-bottom: 2px dashed rgba(245, 158, 11, 0.6);
    color: rgba(180, 83, 9, 1);
  }

  .variable-missing:hover {
    background-color: rgba(245, 158, 11, 0.25);
  }
`;

/**
 * React component wrapper that applies variable highlighting
 * to HTML content and renders it safely.
 */
export function VariableHighlighter({
  html,
  formData,
  fieldLabels,
  className,
}: VariableHighlighterProps) {
  const highlightedHtml = useMemo(
    () => highlightVariables(html, formData, { ...DEFAULT_LABELS, ...fieldLabels }),
    [html, formData, fieldLabels]
  );

  return (
    <>
      <style>{VARIABLE_HIGHLIGHT_STYLES}</style>
      <div
        className={cn("variable-highlighted-preview", className)}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    </>
  );
}
