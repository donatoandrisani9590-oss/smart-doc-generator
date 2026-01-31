/**
 * HTML-Sanitization Utility
 *
 * Schützt vor XSS-Angriffen durch Entfernen gefährlicher HTML-Tags und Attribute.
 * MUSS vor jedem dangerouslySetInnerHTML verwendet werden!
 */

import DOMPurify from "dompurify";

// Erlaubte Tags für Dokument-Vorschau
const ALLOWED_TAGS = [
  // Text-Formatierung
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "sub",
  "sup",
  "span",
  // Überschriften
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  // Listen
  "ul",
  "ol",
  "li",
  // Tabellen
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  // Struktur
  "div",
  "section",
  "article",
  "header",
  "footer",
  // Sonstiges
  "hr",
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
];

// Erlaubte Attribute
const ALLOWED_ATTR = [
  "class",
  "style",
  "id",
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "colspan",
  "rowspan",
  "align",
  "valign",
];

// Verbotene Tags (werden komplett entfernt)
const FORBID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "meta",
  "link",
  "base",
  "svg",
  "math",
];

// Verbotene Attribute (Event-Handler etc.)
const FORBID_ATTR = [
  "onclick",
  "onerror",
  "onload",
  "onmouseover",
  "onmouseout",
  "onfocus",
  "onblur",
  "onsubmit",
  "onchange",
  "onkeydown",
  "onkeyup",
  "onkeypress",
];

/**
 * Sanitiert HTML-Content für sichere Anzeige.
 *
 * @param dirty - Unsicherer HTML-String (z.B. vom Server)
 * @returns Bereinigter HTML-String ohne XSS-Risiken
 *
 * @example
 * ```tsx
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }} />
 * ```
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    // Links müssen noopener/noreferrer haben
    ADD_ATTR: ["target"],
    // Alle Links auf _blank mit rel=noopener
    ALLOW_DATA_ATTR: false,
    // Keine data-* Attribute
  });
}

/**
 * Sanitiert HTML für Druck-Ausgabe.
 * Etwas permissiver, da Print-Fenster isoliert ist.
 */
export function sanitizeHtmlForPrint(dirty: string): string {
  if (!dirty) return "";

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [...ALLOWED_TAGS, "style"],
    ALLOWED_ATTR: [...ALLOWED_ATTR, "media"],
    FORBID_TAGS,
    FORBID_ATTR,
  });
}

/**
 * Sanitiert Text (entfernt ALLE HTML-Tags).
 * Für reine Text-Anzeige ohne Formatierung.
 */
export function sanitizeText(dirty: string): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Sichere Print-Funktion.
 * Öffnet ein neues Fenster mit sanitiertem HTML.
 */
export function printSanitizedHtml(html: string, title: string = "Dokument") {
  const sanitized = sanitizeHtmlForPrint(html);
  const sanitizedTitle = sanitizeText(title);

  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    console.error("Popup blocked - bitte Popup-Blocker deaktivieren");
    return false;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${sanitizedTitle}</title>
      <meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline';">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>${sanitized}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();

  return true;
}
