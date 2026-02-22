import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * §60.5 — Stagger animation for lists.
 *
 * Pflicht-Einsatzorte:
 * - Dashboard Stat-Cards, Recent-Docs
 * - Kanban-Karten pro Spalte
 * - Dokument-Timeline, Settings-Listen
 * - Suchergebnisse, Wizard Klausel-Liste
 */

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
}

const itemVariants: Variants = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export function StaggerList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  )
}
