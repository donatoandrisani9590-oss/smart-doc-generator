/**
 * TextReveal — Framer Motion-powered word-by-word text reveal animation.
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

import { useRef, useEffect, useState, type ElementType, type ReactNode } from "react";
import { motion, useInView, type Variants } from "framer-motion";

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
  const isInView = useInView(containerRef, { once: true, margin: "-12% 0px" });
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    setPrefersReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Split children text into words
  const text = typeof children === "string" ? children : String(children);
  const words = text.split(/\s+/).filter(Boolean);

  // Determine whether to animate
  const shouldAnimate = scrollTriggered ? isInView : true;

  const wordVariants: Variants = {
    hidden: { y: 18, opacity: 0 },
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: {
        duration,
        delay: delay + i * stagger,
        ease: [0.33, 1, 0.68, 1], // power3.out equivalent
      },
    }),
  };

  // Create the MotionTag dynamically from the `as` prop
  const MotionTag = motion.create(Tag as "span");

  return (
    <MotionTag
      ref={containerRef}
      className={className}
      aria-label={text}
      initial={false}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          custom={i}
          initial={prefersReduced ? "visible" : "hidden"}
          animate={prefersReduced || shouldAnimate ? "visible" : "hidden"}
          variants={wordVariants}
          className="inline-block"
          style={{ marginRight: "0.25em" }}
          aria-hidden="true"
        >
          {word}
        </motion.span>
      ))}
    </MotionTag>
  );
}
