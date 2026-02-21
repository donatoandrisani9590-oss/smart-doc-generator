/**
 * useCursorSpotlight — Premium radial glow that follows the cursor.
 *
 * Attaches a CSS custom-property–driven spotlight to elements marked
 * with [data-spotlight]. On hover, a subtle radial gradient tracks
 * the cursor position using pure CSS (no GSAP needed per-frame).
 * Respects prefers-reduced-motion.
 *
 * Usage:
 *   const ref = useCursorSpotlight();
 *   <div ref={ref}>
 *     <div data-spotlight className="glass-card">...</div>
 *   </div>
 *
 * The element needs this CSS (added via index.css):
 *   [data-spotlight] { position: relative; overflow: hidden; }
 *   [data-spotlight]::before { ... radial-gradient using --spot-x, --spot-y ... }
 */

import { useRef, useEffect } from "react";

export function useCursorSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !containerRef.current) return;

    const elements = containerRef.current.querySelectorAll<HTMLElement>("[data-spotlight]");
    const cleanups: Array<() => void> = [];

    elements.forEach((el) => {
      const onMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty("--spot-x", `${x}px`);
        el.style.setProperty("--spot-y", `${y}px`);
        el.style.setProperty("--spot-opacity", "1");
      };

      const onLeave = () => {
        el.style.setProperty("--spot-opacity", "0");
      };

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);

      cleanups.push(() => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return containerRef;
}
