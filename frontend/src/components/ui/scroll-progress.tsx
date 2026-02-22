/**
 * ScrollProgress — Thin animated progress bar at the top of the viewport.
 *
 * Uses a native scroll event listener to track scroll position with
 * hardware-accelerated scaleX transform for zero-jank rendering.
 * Only visible when the page is scrollable.
 */

import { useEffect, useRef, useCallback } from "react";

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    if (!barRef.current) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;

    barRef.current.style.transform = `scaleX(${progress})`;
  }, []);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateProgress);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Initial measurement
    updateProgress();

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateProgress]);

  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 right-0 h-[2px] z-50 origin-left"
      style={{
        transform: "scaleX(0)",
        background: "linear-gradient(90deg, var(--nw-blue-500), var(--nw-green-500))",
        willChange: "transform",
      }}
      aria-hidden="true"
    />
  );
}
