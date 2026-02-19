/**
 * A4Preview - DIN A4 Dokumentvorschau mit Zoom und Seitenumbruch-Indikatoren
 *
 * Zeigt HTML-Inhalt in einem A4-proportionalen Container mit:
 * - Zoom-Steuerung (Tastatur + Buttons)
 * - Seitenumbruch-Linien alle ~297mm
 * - Papierschatten auf neutralem Hintergrund
 * - VariableHighlighter-Integration (optional)
 *
 * HINWEIS: html-Prop MUSS bereits sanitized sein (z.B. via sanitizeHtml()).
 * Der Aufrufer ist verantwortlich fuer die Bereinigung.
 *
 * Wiederverwendbar: Nicht an StepReview gebunden.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VariableHighlighter } from "@/components/generator/VariableHighlighter";
import { cn } from "@/lib/utils";

/** A4 dimensions at 96 DPI */
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

/** DIN 5008 margins in pixels (approx.) */
const PAPER_PADDING_TOP = 96;    // ~25mm
const PAPER_PADDING_SIDES = 76;  // ~20mm

/** Zoom constraints */
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const ZOOM_PRESETS = [0.5, 0.75, 1.0] as const;

interface A4PreviewProps {
  /** Already-sanitized HTML to render */
  html: string;
  /** Form data for VariableHighlighter (optional) */
  formData?: Record<string, string | number | undefined>;
  /** Initial zoom level (default: 0.7) */
  zoom?: number;
  /** Show dashed page break lines (default: true) */
  showPageBreaks?: boolean;
  /** Show zoom control toolbar (default: true) */
  showZoomControls?: boolean;
  /** Additional CSS classes for the outer container */
  className?: string;
  /** Max height of the scroll container (default: "600px") */
  maxHeight?: string;
}

export function A4Preview({
  html,
  formData,
  zoom: initialZoom = 0.7,
  showPageBreaks = true,
  showZoomControls = true,
  className,
  maxHeight = "600px",
}: A4PreviewProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const containerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // --- Zoom handlers ---

  const clampZoom = useCallback((value: number) => {
    return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 100) / 100;
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((prev) => clampZoom(prev + ZOOM_STEP));
  }, [clampZoom]);

  const zoomOut = useCallback(() => {
    setZoom((prev) => clampZoom(prev - ZOOM_STEP));
  }, [clampZoom]);

  const setPresetZoom = useCallback(
    (preset: number) => {
      setZoom(clampZoom(preset));
    },
    [clampZoom]
  );

  // --- Keyboard zoom (Ctrl+= / Ctrl+-) ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond when no specific input element has focus
      const activeTag = document.activeElement?.tagName;
      const isInputFocused =
        activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";
      if (isInputFocused) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut]);

  // --- Page break positions ---

  const pageBreaks = useMemo(() => {
    if (!showPageBreaks) return [];
    // Generate page break lines for up to 10 pages
    const breaks: number[] = [];
    for (let i = 1; i <= 10; i++) {
      breaks.push(i * A4_HEIGHT_PX);
    }
    return breaks;
  }, [showPageBreaks]);

  // --- Zoom percentage display ---
  const zoomPercent = Math.round(zoom * 100);

  // --- Scaled paper dimensions for container sizing ---
  const scaledWidth = A4_WIDTH_PX * zoom;

  return (
    <div
      ref={containerRef}
      className={cn(
        "a4-preview-bg relative overflow-auto rounded-xl",
        className
      )}
      style={{ maxHeight }}
      role="region"
      aria-label="Dokumentvorschau"
    >
      {/* Scrollable content area with the A4 paper centered */}
      <div
        className="flex justify-center"
        style={{
          minWidth: scaledWidth + 48,
          padding: "24px 24px 64px",
        }}
      >
        {/* A4 Paper */}
        <div
          ref={paperRef}
          className="a4-paper relative"
          style={{
            width: A4_WIDTH_PX,
            minHeight: A4_HEIGHT_PX,
            padding: `${PAPER_PADDING_TOP}px ${PAPER_PADDING_SIDES}px`,
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
          }}
        >
          {/* Page break indicators */}
          {showPageBreaks &&
            pageBreaks.map((offset, idx) => (
              <div
                key={`break-${idx}`}
                className="a4-page-break pointer-events-none"
                data-page={`Seite ${idx + 2}`}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: offset,
                }}
                aria-hidden="true"
              />
            ))}

          {/* Document content - uses VariableHighlighter when formData provided */}
          {formData ? (
            <VariableHighlighter
              html={html}
              formData={formData}
              className="preview-content document-preview-inner"
            />
          ) : (
            <div
              className="preview-content document-preview-inner"
              // Content is pre-sanitized by the caller (sanitizeHtml)
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>

      {/* Zoom controls - sticky at bottom */}
      {showZoomControls && (
        <div className="sticky bottom-3 flex justify-center pointer-events-none z-10">
          <TooltipProvider delayDuration={300}>
            <div className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.1)] px-2 py-1 pointer-events-auto">
              {/* Zoom out */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={zoomOut}
                    disabled={zoom <= ZOOM_MIN}
                    aria-label="Verkleinern"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Verkleinern (Strg+-)</p>
                </TooltipContent>
              </Tooltip>

              {/* Current zoom percentage */}
              <span className="text-[11px] font-medium text-foreground/60 min-w-[36px] text-center tabular-nums select-none">
                {zoomPercent}%
              </span>

              {/* Zoom in */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={zoomIn}
                    disabled={zoom >= ZOOM_MAX}
                    aria-label="Vergr&ouml;&szlig;ern"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Vergr&ouml;&szlig;ern (Strg++)</p>
                </TooltipContent>
              </Tooltip>

              {/* Separator */}
              <div className="w-px h-4 bg-foreground/10 mx-0.5" aria-hidden="true" />

              {/* Preset buttons */}
              {ZOOM_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-1.5 text-[10px] rounded-full tabular-nums",
                    Math.abs(zoom - preset) < 0.01
                      ? "bg-foreground/8 text-foreground font-semibold"
                      : "text-foreground/50"
                  )}
                  onClick={() => setPresetZoom(preset)}
                  aria-label={`Zoom ${Math.round(preset * 100)}%`}
                >
                  {Math.round(preset * 100)}%
                </Button>
              ))}
            </div>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

export default A4Preview;
