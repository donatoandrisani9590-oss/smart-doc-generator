/**
 * GhostwriterCard - KI-Entwurfsvorschlag über dem Editor.
 *
 * Zeigt einen von der KI generierten Einleitungsabsatz als Vorschlag an.
 * Folgt dem ComplianceRiskBanner/ConsistencyBanner UI-Pattern.
 */

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Check, RefreshCw, X, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GhostwriterCardProps {
  draftHtml: string;
  isStreaming: boolean;
  streamedText: string;
  isGenerating: boolean;
  error: string | null;
  onAccept: () => void;
  onDismiss: () => void;
  onRegenerate: () => void;
  className?: string;
}

export const GhostwriterCard = ({
  draftHtml,
  isStreaming,
  streamedText,
  isGenerating,
  error,
  onAccept,
  onDismiss,
  onRegenerate,
  className,
}: GhostwriterCardProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-collapse after 10 seconds of inactivity (only when not streaming)
  useEffect(() => {
    if (isStreaming || isGenerating) {
      // Clear timer while active
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: expand card while streaming/generating is active
      setIsCollapsed(false);
      return;
    }

    if (draftHtml && !isCollapsed) {
      collapseTimerRef.current = setTimeout(() => {
        setIsCollapsed(true);
      }, 10000);
    }

    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, [draftHtml, isStreaming, isGenerating, isCollapsed]);

  // Auto-scroll streaming content
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamedText, isStreaming]);

  // Reset collapse timer on user interaction
  const handleInteraction = () => {
    setIsCollapsed(false);
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      setIsCollapsed(true);
    }, 10000);
  };

  const displayContent = isStreaming ? streamedText : draftHtml;

  return (
    <div
      className={cn(
        "bg-primary/[0.04] dark:bg-[hsl(225_16%_22%/0.5)] rounded-2xl overflow-hidden transition-all duration-300 ease-out",
        !isCollapsed && "shadow-[var(--shadow-elevated)]",
        className
      )}
      onClick={isCollapsed ? handleInteraction : undefined}
    >
      {/* Header — collapsed: single-line hint */}
      <div className="flex items-center gap-2 px-3.5 py-2 cursor-pointer select-none hover:bg-primary/[0.06] dark:hover:bg-white/[0.04] transition-colors rounded-2xl"
        onClick={() => {
          handleInteraction();
          if (!isStreaming) setIsCollapsed(!isCollapsed);
        }}
      >
        {isGenerating ? (
          <Loader2 className="w-3.5 h-3.5 text-primary/60 animate-spin shrink-0" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-primary/70 dark:text-primary/70 shrink-0" />
        )}
        <span className="text-[12px] font-medium text-foreground/70 dark:text-foreground/70 flex-1">
          {isCollapsed ? "KI-Entwurf verfügbar" : "KI-Entwurf"}
          {isStreaming && (
            <span className="text-xs text-primary/70 dark:text-primary/80 ml-2 font-normal">wird generiert...</span>
          )}
        </span>
        {!isStreaming && isCollapsed && (
          <span className="text-[11px] text-primary/70 dark:text-primary/70 hover:text-primary dark:hover:text-primary/90 transition-colors">
            Anzeigen
          </span>
        )}
        {!isStreaming && !isCollapsed && (
          <button className="p-1 hover:bg-primary/[0.06] dark:hover:bg-white/10 rounded-full transition-colors">
            <ChevronUp className="w-3.5 h-3.5 text-foreground/30 dark:text-foreground/50" />
          </button>
        )}
      </div>

      {/* Content (collapsible with slide-down) */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        )}
      >
        <div className="overflow-hidden">
          {/* Error state */}
          {error && (
            <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50/60 dark:bg-red-900/20">
              {error}
            </div>
          )}

          {/* Draft preview */}
          {displayContent && (
            <div
              ref={contentRef}
              className="px-4 py-3 max-h-[240px] overflow-y-auto"
            >
              <div
                className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: displayContent }}
              />
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
              disabled={isStreaming || !draftHtml}
              className="h-8 text-xs gap-1.5 font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              Einfügen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              disabled={isGenerating}
              className="h-8 text-xs gap-1.5 text-muted-foreground dark:text-foreground/60"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Neu generieren
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20"
            >
              <X className="w-3.5 h-3.5" />
              Verwerfen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GhostwriterCard;
