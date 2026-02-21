/**
 * TextReveal — GSAP-powered word-by-word text reveal animation.
 *
 * Splits text into words, animates each with a staggered fade-up.
 * Supports scroll-triggered or immediate (on-mount) reveal.
 * Respects prefers-reduced-motion.
 *
 * Usage:
 *   <TextReveal as="h1" className="text-4xl font-bold">
 *     Guten Morgen, Donato
 *   </TextReveal>
 */

import { useRef, type ElementType, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

interface TextRevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Delay per word in seconds (default: 0.04) */
  stagger?: number;
  /** Animation duration in seconds (default: 0.6) */
  duration?: number;
  /** Initial delay before animation starts (default: 0) */
  delay?: number;
  /** Use scroll trigger instead of immediate (default: false) */
  scrollTriggered?: boolean;
}

export function TextReveal({
  children,
  as: Tag = "span",
  className,
  stagger = 0.04,
  duration = 0.6,
  delay = 0,
  scrollTriggered = false,
}: TextRevealProps) {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !containerRef.current) return;

    const words = containerRef.current.querySelectorAll<HTMLElement>("[data-word]");
    if (words.length === 0) return;

    const fromVars: gsap.TweenVars = {
      y: 18,
      opacity: 0,
      duration,
      stagger,
      delay,
      ease: "power3.out",
    };

    if (scrollTriggered) {
      gsap.from(words, {
        ...fromVars,
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 88%",
          once: true,
        },
      });
    } else {
      gsap.from(words, fromVars);
    }
  }, { scope: containerRef });

  // Split children text into words
  const text = typeof children === "string" ? children : String(children);
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <Tag ref={containerRef} className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          data-word
          className="inline-block"
          style={{ marginRight: "0.25em" }}
          aria-hidden="true"
        >
          {word}
        </span>
      ))}
    </Tag>
  );
}
