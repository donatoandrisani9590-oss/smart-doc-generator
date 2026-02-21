/**
 * useCountUp — GSAP-powered animated number counter.
 *
 * Counts from 0 (or a custom start) to a target value using
 * GSAP's tweening engine for silky 60fps interpolation.
 * Supports ScrollTrigger to start counting when element scrolls into view.
 *
 * Usage:
 *   const { ref, value } = useCountUp(42);
 *   <span ref={ref}>{value}</span>
 */

import { useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

interface CountUpOptions {
  /** Starting number (default: 0) */
  from?: number;
  /** Animation duration in seconds (default: 1.2) */
  duration?: number;
  /** Easing function (default: "power2.out") */
  ease?: string;
  /** Delay before starting (default: 0) */
  delay?: number;
  /** Only start when element is in viewport (default: true) */
  scrollTriggered?: boolean;
  /** ScrollTrigger start position (default: "top 85%") */
  start?: string;
}

export function useCountUp(to: number, options: CountUpOptions = {}) {
  const {
    from = 0,
    duration = 1.2,
    ease = "power2.out",
    delay = 0,
    scrollTriggered = true,
    start = "top 85%",
  } = options;

  const ref = useRef<HTMLElement>(null);
  const [value, setValue] = useState(from);
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const obj = { val: from };
    gsap.to(obj, {
      val: to,
      duration,
      ease,
      delay,
      onUpdate: () => setValue(Math.round(obj.val)),
    });
  }, [from, to, duration, ease, delay]);

  useGSAP(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

    ScrollTrigger.create({
      trigger: ref.current,
      start,
      once: true,
      onEnter: animate,
    });
  }, { scope: ref, dependencies: [to] });

  return { ref, value };
}
