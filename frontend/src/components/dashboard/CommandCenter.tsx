/**
 * CommandCenter — Unified search + AI input for the dashboard.
 * Merges document search and KI-Dokumentassistent into one field.
 * Routes to /search for text queries, /agent for AI intents.
 */

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandCenterProps {
  className?: string;
}

const AI_PREFIXES = ["erstelle", "generiere", "schreibe", "verfasse", "entwirf", "mach"];

export function CommandCenter({ className }: CommandCenterProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Detect AI intent by prefix
    const lowerQuery = trimmed.toLowerCase();
    const isAiIntent = AI_PREFIXES.some((p) => lowerQuery.startsWith(p));

    if (isAiIntent) {
      navigate(`/agent?prompt=${encodeURIComponent(trimmed)}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("widget-card !p-0 overflow-hidden", className)}
    >
      <div className={cn(
        "flex items-center gap-3 px-5 py-4 transition-shadow duration-200",
        isFocused && "shadow-[0_0_0_2px_hsl(228_58%_33%/0.15)]  rounded-2xl"
      )}>
        <Search className="w-5 h-5 text-[#86868B] dark:text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Dokument suchen oder KI bitten, eines zu entwerfen..."
          className="flex-1 bg-transparent text-[#1D1D1F] dark:text-foreground placeholder:text-[#86868B]/60 dark:placeholder:text-muted-foreground/40 text-base outline-none border-none"
        />
        <Sparkles className={cn(
          "w-5 h-5 shrink-0 transition-colors",
          isFocused ? "text-primary" : "text-[#86868B]/40 dark:text-muted-foreground/30"
        )} />
      </div>
    </form>
  );
}
