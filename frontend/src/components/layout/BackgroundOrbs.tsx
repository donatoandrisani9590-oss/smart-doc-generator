import { motion } from 'framer-motion'

/**
 * Animierte Hintergrund-Blobs die hinter der gesamten App schweben (§60.3).
 *
 * REGELN:
 * - Render in AppShell/Layout EINMAL (nicht pro Seite)
 * - Immer z-index: 0, pointer-events: none
 * - 20-30s Zyklus, sanftes Skalieren + leichtes Driften
 * - prefers-reduced-motion: keine Animation (CSS already handles this)
 */
export function BackgroundOrbs() {
  return (
    <div className="bg-orbs" aria-hidden="true">
      <motion.div
        className="bg-orb bg-orb-1"
        animate={{
          scale: [1, 1.15, 1],
          x: [0, 30, -20, 0],
          y: [0, -20, 15, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="bg-orb bg-orb-2"
        animate={{
          scale: [1, 1.1, 0.95, 1],
          x: [0, -25, 15, 0],
          y: [0, 20, -10, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="bg-orb bg-orb-3"
        animate={{
          scale: [1, 1.08, 1],
          rotate: [0, 3, -2, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}
