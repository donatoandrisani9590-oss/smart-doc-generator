/**
 * useMagneticHover — Premium magnetic hover effect.
 *
 * The element subtly follows the cursor when hovered,
 * creating an Awwwards-style "magnetic" feel on buttons/CTAs.
 * Uses GSAP for smooth spring-like tweening.
 * Respects prefers-reduced-motion.
 *
 * Usage:
 *   const magnetRef = useMagneticHover();
 *   <button ref={magnetRef}>Click me</button>
 */

import { useRef, useEffect } from "react";
import gsap from "gsap";

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
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !ref.current) return;

    const el = ref.current;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) * strength;
      const deltaY = (e.clientY - centerY) * strength;

      gsap.to(el, {
        x: deltaX,
        y: deltaY,
        duration: 0.25,
        ease: "power2.out",
      });
    };

    const onLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: returnDuration,
        ease: "elastic.out(1, 0.5)",
      });
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength, returnDuration]);

  return ref;
}
