/**
 * useGsapHover — Attaches CSS-powered hover micro-interactions to elements.
 *
 * Scans for [data-hover] elements within a container and adds
 * mouse-enter/leave animations (lift, scale, shadow).
 * Respects prefers-reduced-motion.
 *
 * Usage:
 *   const ref = useGsapHover();
 *   <div ref={ref}>
 *     <div data-hover="lift">Card content</div>
 *     <div data-hover="glow">Shiny element</div>
 *   </div>
 */

import { useRef, useEffect } from "react";

export type HoverPreset = "lift" | "scale" | "glow";

interface HoverStyles {
  enter: Record<string, string>;
  leave: Record<string, string>;
}

const HOVER_STYLES: Record<HoverPreset, HoverStyles> = {
  lift: {
    enter: {
      transform: "translateY(-4px)",
      boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
    },
    leave: {
      transform: "translateY(0px)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    },
  },
  scale: {
    enter: {
      transform: "scale(1.03)",
    },
    leave: {
      transform: "scale(1)",
    },
  },
  glow: {
    enter: {
      boxShadow: "0 0 20px rgba(36,49,134,0.12)",
    },
    leave: {
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    },
  },
};

function applyStyles(el: HTMLElement, styles: Record<string, string>) {
  for (const [key, value] of Object.entries(styles)) {
    el.style.setProperty(
      key.replace(/([A-Z])/g, "-$1").toLowerCase(),
      value
    );
  }
}

export function useGsapHover<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced || !containerRef.current) return;

    const elements =
      containerRef.current.querySelectorAll<HTMLElement>("[data-hover]");
    const cleanups: Array<() => void> = [];

    elements.forEach((el) => {
      const preset = (el.dataset.hover as HoverPreset) || "lift";
      const styles = HOVER_STYLES[preset];

      if (!styles) return;

      // Set CSS transition for smooth animation
      el.style.transition =
        "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

      const onEnter = () => applyStyles(el, styles.enter);
      const onLeave = () => applyStyles(el, styles.leave);

      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);

      cleanups.push(() => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return containerRef;
}
