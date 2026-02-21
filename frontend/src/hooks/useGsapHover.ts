/**
 * useGsapHover — Attaches GSAP-powered hover micro-interactions to elements.
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
import gsap from "gsap";

export type HoverPreset = "lift" | "scale" | "glow";

const HOVER_ENTER: Record<HoverPreset, gsap.TweenVars> = {
  lift: { y: -4, boxShadow: "0 8px 25px rgba(0,0,0,0.08)", duration: 0.3, ease: "power2.out" },
  scale: { scale: 1.03, duration: 0.25, ease: "power2.out" },
  glow: { boxShadow: "0 0 20px rgba(36,49,134,0.12)", duration: 0.3, ease: "power2.out" },
};

const HOVER_LEAVE: Record<HoverPreset, gsap.TweenVars> = {
  lift: { y: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", duration: 0.25, ease: "power2.inOut" },
  scale: { scale: 1, duration: 0.2, ease: "power2.inOut" },
  glow: { boxShadow: "0 1px 3px rgba(0,0,0,0.04)", duration: 0.25, ease: "power2.inOut" },
};

export function useGsapHover<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !containerRef.current) return;

    const elements = containerRef.current.querySelectorAll<HTMLElement>("[data-hover]");
    const cleanups: Array<() => void> = [];

    elements.forEach((el) => {
      const preset = (el.dataset.hover as HoverPreset) || "lift";
      const enterVars = HOVER_ENTER[preset];
      const leaveVars = HOVER_LEAVE[preset];

      if (!enterVars) return;

      const onEnter = () => gsap.to(el, enterVars);
      const onLeave = () => gsap.to(el, leaveVars);

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
