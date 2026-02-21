/**
 * useScrollReveal — Reusable GSAP ScrollTrigger reveal animations.
 *
 * Provides a container ref and auto-animates elements with data-reveal attributes.
 * Respects prefers-reduced-motion. Cleans up automatically via useGSAP.
 *
 * Usage:
 *   const containerRef = useScrollReveal();
 *   <div ref={containerRef}>
 *     <h1 data-reveal="fade-up">Hello</h1>
 *     <div data-reveal="stagger" data-reveal-stagger="0.08">
 *       <Card data-reveal-child>...</Card>
 *       <Card data-reveal-child>...</Card>
 *     </div>
 *   </div>
 */

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export type RevealPreset = "fade-up" | "fade-down" | "fade-left" | "scale" | "stagger";

const PRESETS: Record<RevealPreset, gsap.TweenVars> = {
  "fade-up": { y: 30, opacity: 0, duration: 0.7, ease: "power2.out" },
  "fade-down": { y: -20, opacity: 0, duration: 0.6, ease: "power2.out" },
  "fade-left": { x: -30, opacity: 0, duration: 0.6, ease: "power2.out" },
  "scale": { scale: 0.95, opacity: 0, duration: 0.6, ease: "power2.out" },
  "stagger": { y: 24, opacity: 0, duration: 0.5, ease: "power2.out" },
};

interface ScrollRevealOptions {
  /** ScrollTrigger start position (default: "top 88%") */
  start?: string;
  /** Delay before animation starts (default: 0) */
  delay?: number;
  /** Whether to animate on page load without scroll trigger (default: false) */
  immediate?: boolean;
}

export function useScrollReveal(options: ScrollRevealOptions = {}) {
  const { start = "top 88%", delay = 0, immediate = false } = options;
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const container = containerRef.current;
    if (!container) return;

    // Single-element reveals
    container.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      const preset = (el.dataset.reveal as RevealPreset) || "fade-up";
      const vars = { ...PRESETS[preset] };

      if (preset === "stagger") {
        // Stagger children instead of the container itself
        const children = el.querySelectorAll<HTMLElement>("[data-reveal-child]");
        if (children.length === 0) return;

        const staggerDelay = parseFloat(el.dataset.revealStagger || "0.08");
        const fromVars: gsap.TweenVars = {
          ...vars,
          stagger: staggerDelay,
          delay: delay + parseFloat(el.dataset.revealDelay || "0"),
        };

        if (immediate) {
          gsap.from(children, fromVars);
        } else {
          gsap.from(children, {
            ...fromVars,
            scrollTrigger: { trigger: el, start, once: true },
          });
        }
      } else {
        const fromVars: gsap.TweenVars = {
          ...vars,
          delay: delay + parseFloat(el.dataset.revealDelay || "0"),
        };

        if (immediate) {
          gsap.from(el, fromVars);
        } else {
          gsap.from(el, {
            ...fromVars,
            scrollTrigger: { trigger: el, start, once: true },
          });
        }
      }
    });
  }, { scope: containerRef });

  return containerRef;
}
