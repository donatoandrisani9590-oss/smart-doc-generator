/**
 * useScrollReveal — Reusable IntersectionObserver-based reveal animations.
 *
 * Provides a container ref and auto-animates elements with data-reveal attributes.
 * Respects prefers-reduced-motion. Cleans up automatically.
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

import { useRef, useEffect } from "react";

export type RevealPreset = "fade-up" | "fade-down" | "fade-left" | "scale" | "stagger";

interface PresetConfig {
  /** Initial transform value */
  transform: string;
  /** Initial opacity */
  opacity: string;
  /** Transition duration in seconds */
  duration: number;
}

const PRESETS: Record<RevealPreset, PresetConfig> = {
  "fade-up": { transform: "translateY(30px)", opacity: "0", duration: 0.7 },
  "fade-down": { transform: "translateY(-20px)", opacity: "0", duration: 0.6 },
  "fade-left": { transform: "translateX(-30px)", opacity: "0", duration: 0.6 },
  "scale": { transform: "scale(0.95)", opacity: "0", duration: 0.6 },
  "stagger": { transform: "translateY(24px)", opacity: "0", duration: 0.5 },
};

interface ScrollRevealOptions {
  /** Equivalent to ScrollTrigger start (default: "top 88%") — maps to rootMargin */
  start?: string;
  /** Delay before animation starts in seconds (default: 0) */
  delay?: number;
  /** Whether to animate on page load without scroll trigger (default: false) */
  immediate?: boolean;
}

function applyInitialState(el: HTMLElement, config: PresetConfig) {
  el.style.transform = config.transform;
  el.style.opacity = config.opacity;
}

function revealElement(el: HTMLElement, config: PresetConfig, delaySeconds: number) {
  // Use a minimal rAF to ensure the initial state is painted before transitioning
  requestAnimationFrame(() => {
    el.style.transition = [
      `transform ${config.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${delaySeconds}s`,
      `opacity ${config.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${delaySeconds}s`,
    ].join(", ");
    el.style.transform = "translate(0, 0) scale(1)";
    el.style.opacity = "1";
  });
}

export function useScrollReveal(options: ScrollRevealOptions = {}) {
  const { delay = 0, immediate = false } = options;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const container = containerRef.current;
    if (!container) return;

    const observers: IntersectionObserver[] = [];
    const revealElements = container.querySelectorAll<HTMLElement>("[data-reveal]");

    revealElements.forEach((el) => {
      const preset = (el.dataset.reveal as RevealPreset) || "fade-up";
      const config = PRESETS[preset];
      if (!config) return;

      const elementDelay = delay + parseFloat(el.dataset.revealDelay || "0");

      if (preset === "stagger") {
        // Stagger children instead of the container itself
        const children = el.querySelectorAll<HTMLElement>("[data-reveal-child]");
        if (children.length === 0) return;

        const staggerDelay = parseFloat(el.dataset.revealStagger || "0.08");

        // Set initial hidden state on each child
        children.forEach((child) => applyInitialState(child, config));

        const triggerReveal = () => {
          children.forEach((child, index) => {
            revealElement(child, config, elementDelay + index * staggerDelay);
          });
        };

        if (immediate) {
          triggerReveal();
        } else {
          const observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  triggerReveal();
                  observer.disconnect();
                }
              }
            },
            { rootMargin: "0px 0px -12% 0px" } // ~88% viewport
          );
          observer.observe(el);
          observers.push(observer);
        }
      } else {
        // Single-element reveal
        applyInitialState(el, config);

        const triggerReveal = () => {
          revealElement(el, config, elementDelay);
        };

        if (immediate) {
          triggerReveal();
        } else {
          const observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  triggerReveal();
                  observer.disconnect();
                }
              }
            },
            { rootMargin: "0px 0px -12% 0px" } // ~88% viewport
          );
          observer.observe(el);
          observers.push(observer);
        }
      }
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, [delay, immediate]);

  return containerRef;
}
