/**
 * useCountUp — Animated number counter using requestAnimationFrame.
 *
 * Counts from 0 (or a custom start) to a target value with
 * smooth 60fps interpolation using an easeOutQuad curve.
 * Uses IntersectionObserver to start counting when element scrolls into view.
 *
 * Usage:
 *   const { ref, value } = useCountUp(42);
 *   <span ref={ref}>{value}</span>
 */

import { useRef, useState, useEffect, useCallback } from "react";

interface CountUpOptions {
  /** Starting number (default: 0) */
  from?: number;
  /** Animation duration in seconds (default: 1.2) */
  duration?: number;
  /** Easing function name — only "power2.out" style easing is used (default: "power2.out") */
  ease?: string;
  /** Delay before starting in seconds (default: 0) */
  delay?: number;
  /** Only start when element is in viewport (default: true) */
  scrollTriggered?: boolean;
  /** IntersectionObserver rootMargin equivalent of ScrollTrigger start (default: "top 85%") */
  start?: string;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function useCountUp(to: number, options: CountUpOptions = {}) {
  const {
    from = 0,
    duration = 1.2,
    delay = 0,
    scrollTriggered = true,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const [value, setValue] = useState(from);
  const hasAnimated = useRef(false);
  const rafId = useRef<number | null>(null);
  const prevTo = useRef(to);

  const animate = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now() + delay * 1000;
    const durationMs = duration * 1000;

    const tick = (now: number) => {
      const elapsed = now - startTime;

      if (elapsed < 0) {
        // Still in delay phase
        rafId.current = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = easeOutQuad(progress);
      const currentValue = from + (to - from) * easedProgress;

      setValue(Math.round(currentValue));

      if (progress < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        rafId.current = null;
      }
    };

    rafId.current = requestAnimationFrame(tick);
  }, [from, to, duration, delay]);

  useEffect(() => {
    // Reset animation guard when target value changes
    if (prevTo.current !== to) {
      hasAnimated.current = false;
      prevTo.current = to;

      // Cancel any running animation
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    }

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      setValue(to);
      return;
    }

    if (!scrollTriggered) {
      animate();
      return;
    }

    if (!ref.current) {
      animate();
      return;
    }

    // IntersectionObserver replaces ScrollTrigger
    // "top 85%" means trigger when element's top crosses 85% of viewport height
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animate();
            observer.disconnect();
          }
        }
      },
      {
        rootMargin: "0px 0px -15% 0px", // triggers at ~85% viewport height
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [to, scrollTriggered, animate]);

  return { ref, value };
}
