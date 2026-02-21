/**
 * PageTransition — GSAP-powered route transition wrapper.
 *
 * Fades in + slides up the content on every route change.
 * Replaces the CSS `animate-enter` class with hardware-accelerated
 * GSAP tweens for smoother 60fps transitions.
 * Respects prefers-reduced-motion.
 */

import { useRef } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useGSAP(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ref.current) return;

    if (prefersReduced) {
      gsap.set(ref.current, { opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(ref.current,
      { opacity: 0, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: "power3.out",
        clearProps: "transform",
      }
    );
  }, { scope: ref, dependencies: [location.pathname] });

  return (
    <div ref={ref} className="w-full">
      {children}
    </div>
  );
}
