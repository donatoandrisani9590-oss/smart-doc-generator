import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * §60.4 — Page-level fade+slide transition.
 * Wrap EVERY page-level component in <PageTransition>.
 */

const pageVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}

/**
 * §60.4 — Glass-Panel entrance animation.
 * For glass containers: wizard panels, settings sections, modals.
 */

const panelVariants: Variants = {
  hidden:  { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
}

export function GlassPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`glass-card ${className}`}
      variants={panelVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}
