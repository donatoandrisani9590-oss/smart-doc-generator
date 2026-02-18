/**
 * GhostwriterCard - KI-Entwurfsvorschlag über dem Editor.
 *
 * Zeigt einen von der KI generierten Einleitungsabsatz als Vorschlag an.
 * Folgt dem ComplianceRiskBanner/ConsistencyBanner UI-Pattern.
 */

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Check, RefreshCw, X, ChevronDown, ChevronUp } from "lucide-react";
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
        "bg-primary/[0.03] border border-primary/10 rounded-xl overflow-hidden transition-all duration-300",
        className
      )}
      onClick={isCollapsed ? handleInteraction : undefined}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none hover:bg-primary/[0.05] transition-colors"
        onClick={() => {
          handleInteraction();
          if (!isStreaming) setIsCollapsed(!isCollapsed);
        }}
      >
        {isGenerating ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
        )}
        <span className="text-sm font-medium text-primary flex-1">
          KI-Entwurf
          {isStreaming && (
            <span className="text-xs text-primary/70 ml-2 font-normal">wird generiert...</span>
          )}
        </span>
        {!isStreaming && (
          <button className="p-1 hover:bg-primary/10 rounded transition-colors">
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-primary/60" />
            ) : (
              <ChevronUp className="w-4 h-4 text-primary/60" />
            )}
          </button>
        )}
      </div>

      {/* Content (collapsible) */}
      {!isCollapsed && (
        <>
          {/* Error state */}
          {error && (
            <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
              {error}
            </div>
          )}

          {/* Draft preview */}
          {displayContent && (
            <div
              ref={contentRef}
              className="px-4 py-3 border-t border-primary/10 max-h-[240px] overflow-y-auto"
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
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-primary/10 bg-primary/[0.03]">
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
              className="h-8 text-xs gap-1.5 text-muted-foreground"
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
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50"
            >
              <X className="w-3.5 h-3.5" />
              Verwerfen
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default GhostwriterCard;
