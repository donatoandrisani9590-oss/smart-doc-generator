/**
 * ClauseSwapButton - Inline clause swap on hover
 *
 * When hovering over a clause section in the document preview,
 * a small "Klausel wechseln" button appears. Clicking it opens
 * a popover with alternative clauses from the same category.
 *
 * UX: "Ich bin der Pilot, die KI hat nur die Bausteine gereicht."
 */

import { useState } from "react";
import {
  ArrowLeftRight,
  Check,
  Library,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ClauseAlternative {
  id: number;
  title: string;
  category: string;
  preview: string;
  tone?: string;
  is_current?: boolean;
}

interface ClauseSwapButtonProps {
  /** Current clause info */
  currentClauseId: number;
  currentClauseTitle: string;
  category: string;
  /** Alternative clauses (same category) */
  alternatives: ClauseAlternative[];
  /** Loading state */
  isLoading?: boolean;
  /** Called when a swap is requested */
  onSwap: (newClauseId: number) => void;
  /** Called when popover opens (to load alternatives) */
  onLoadAlternatives?: () => void;
  className?: string;
}

export function ClauseSwapButton({
  currentClauseId,
  currentClauseTitle,
  category,
  alternatives,
  isLoading = false,
  onSwap,
  onLoadAlternatives,
  className,
}: ClauseSwapButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (open && onLoadAlternatives) {
      onLoadAlternatives();
    }
  };

  const handleSwap = (newClauseId: number) => {
    onSwap(newClauseId);
    setIsOpen(false);
  };

  const toneLabel = (tone?: string) => {
    switch (tone) {
      case "streng": return "Streng";
      case "arbeitnehmerfreundlich": return "AN-freundlich";
      case "moderat": return "Moderat";
      default: return "Neutral";
    }
  };

  const toneColor = (tone?: string) => {
    switch (tone) {
      case "streng": return "bg-red-100 text-red-700";
      case "arbeitnehmerfreundlich": return "bg-green-100 text-green-700";
      case "moderat": return "bg-blue-100 text-blue-700";
      default: return "bg-warm-100 text-foreground";
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity",
            "bg-background/90 backdrop-blur-sm shadow-sm",
            "hover:bg-primary/5 hover:border-primary/30",
            isOpen && "opacity-100",
            className
          )}
        >
          <ArrowLeftRight className="w-3 h-3" />
          Textbaustein wechseln
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Alternativen: {category}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aktuell: {currentClauseTitle}
          </p>
        </div>

        <ScrollArea className="max-h-64">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : alternatives.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Keine Alternativen in dieser Kategorie verfuegbar.
            </div>
          ) : (
            <div className="p-1">
              {alternatives.map((alt) => {
                const isCurrent = alt.id === currentClauseId;
                return (
                  <button
                    key={alt.id}
                    onClick={() => !isCurrent && handleSwap(alt.id)}
                    disabled={isCurrent}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-colors",
                      isCurrent
                        ? "bg-primary/5 border border-primary/20 cursor-default"
                        : "hover:bg-muted/50 cursor-pointer"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {alt.title}
                          </span>
                          {isCurrent && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {alt.preview}
                        </p>
                      </div>
                      {alt.tone && (
                        <Badge
                          variant="secondary"
                          className={cn("text-[10px] flex-shrink-0", toneColor(alt.tone))}
                        >
                          {toneLabel(alt.tone)}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
