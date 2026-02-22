/**
 * useMagneticHover — Premium magnetic hover effect.
 *
 * The element subtly follows the cursor when hovered,
 * creating an Awwwards-style "magnetic" feel on buttons/CTAs.
 * Uses CSS transforms with a spring-like transition on leave.
 * Respects prefers-reduced-motion.
 *
 * Usage:
 *   const magnetRef = useMagneticHover();
 *   <button ref={magnetRef}>Click me</button>
 */

import { useRef, useEffect } from "react";

interface MagneticOptions {
  /** How strongly the element follows the cursor (default: 0.3) */
  strength?: number;
  /** Spring-back duration in seconds (default: 0.4) */
  returnDuration?: number;
}

export function useMagneticHover<T extends HTMLElement = HTMLButtonElement>(
  options: MagneticOptions = {}
) {
  const { strength = 0.3, returnDuration = 0.4 } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced || !ref.current) return;

    const el = ref.current;
    let rafId: number | null = null;

    const onMove = (e: MouseEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = (e.clientX - centerX) * strength;
        const deltaY = (e.clientY - centerY) * strength;

        // Fast follow with a short ease-out transition
        el.style.transition = "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)";
        el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        rafId = null;
      });
    };

    const onLeave = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // Elastic-like spring-back using a custom cubic-bezier approximation
      el.style.transition = `transform ${returnDuration}s cubic-bezier(0.34, 1.56, 0.64, 1)`;
      el.style.transform = "translate(0px, 0px)";
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength, returnDuration]);

  return ref;
}
