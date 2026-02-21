/**
 * CommandCenter — DS v2.1 Glass Level 2 hero search bar.
 * Centered glass pill with search + AI sparkle icons.
 * GSAP-powered focus glow ring + sparkle pulse.
 * Routes to /search for text queries, /agent for AI intents.
 */

import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

interface CommandCenterProps {
  className?: string;
}

const AI_PREFIXES = ["erstelle", "generiere", "schreibe", "verfasse", "entwirf", "mach"];

export function CommandCenter({ className }: CommandCenterProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sparkleRef = useRef<SVGSVGElement>(null);
  const glowTween = useRef<gsap.core.Tween | null>(null);
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
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    // Glow ring expansion
    if (formRef.current) {
      gsap.to(formRef.current, {
        boxShadow: "0 0 0 3px rgba(36, 49, 134, 0.12), 0 20px 60px rgba(36, 49, 134, 0.10)",
        duration: 0.4,
        ease: "power2.out",
      });
    }

    // Sparkle icon pulse
    if (sparkleRef.current) {
      glowTween.current = gsap.to(sparkleRef.current, {
        scale: 1.15,
        opacity: 1,
        duration: 0.8,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    }
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    if (formRef.current) {
      gsap.to(formRef.current, {
        boxShadow: "0 0 0 0px rgba(36, 49, 134, 0), 0 16px 48px rgba(36, 49, 134, 0.08)",
        duration: 0.3,
        ease: "power2.inOut",
      });
    }

    if (glowTween.current) {
      glowTween.current.kill();
      glowTween.current = null;
    }
    if (sparkleRef.current) {
      gsap.to(sparkleRef.current, {
        scale: 1,
        opacity: 0.6,
        duration: 0.25,
        ease: "power2.out",
      });
    }
  }, []);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={cn("hero-search", className)}
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
      <Sparkles
        ref={sparkleRef}
        className={cn(
          "hero-search-ai-icon transition-colors",
          isFocused && "!color-[var(--nw-blue-500)]"
        )}
      />
    </form>
  );
}
