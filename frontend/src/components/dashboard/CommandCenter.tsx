/**
 * CommandCenter — DS v2.1 Glass Level 2 hero search bar.
 * Centered glass pill with search + AI sparkle icons.
 * CSS-powered focus glow ring + sparkle pulse.
 * Routes to /search for text queries, /agent for AI intents.
 */

import { useState, useRef, useCallback } from "react";
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

    const lowerQuery = trimmed.toLowerCase();
    const isAiIntent = AI_PREFIXES.some((p) => lowerQuery.startsWith(p));

    if (isAiIntent) {
      navigate(`/agent?prompt=${encodeURIComponent(trimmed)}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("hero-search", className)}
      style={{
        boxShadow: isFocused
          ? "0 0 0 3px rgba(36, 49, 134, 0.12), 0 20px 60px rgba(36, 49, 134, 0.10)"
          : "0 0 0 0px rgba(36, 49, 134, 0), 0 16px 48px rgba(36, 49, 134, 0.08)",
        transition: "box-shadow 0.35s cubic-bezier(0.33, 1, 0.68, 1)",
      }}
    >
      <Search className="hero-search-icon" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Dokument suchen oder KI bitten, eines zu entwerfen..."
        className="hero-search-input"
      />
      <button type="submit" className="hero-search-send" aria-label="Suchen">
        <Sparkles
          className="transition-all duration-300 ease-in-out"
          style={{
            transform: isFocused ? "scale(1.15)" : "scale(1)",
            opacity: isFocused ? 1 : 0.6,
          }}
        />
      </button>
    </form>
  );
}
