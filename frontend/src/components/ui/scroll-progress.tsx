/**
 * ScrollProgress — Thin animated progress bar at the top of the viewport.
 *
 * Uses GSAP ScrollTrigger to track scroll position with
 * hardware-accelerated scaleX transform for zero-jank rendering.
 * Only visible when the page is scrollable.
 */

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!barRef.current) return;

    gsap.to(barRef.current, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
      },
    });
  });

  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 right-0 h-[2px] z-50 origin-left"
      style={{
        transform: "scaleX(0)",
        background: "linear-gradient(90deg, var(--nw-blue-500), var(--nw-green-500))",
      }}
      aria-hidden="true"
    />
  );
}
