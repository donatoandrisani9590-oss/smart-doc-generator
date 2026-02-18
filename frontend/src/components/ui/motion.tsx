/* eslint-disable react-refresh/only-export-components */
/**
 * Framer Motion Utilities & Components
 *
 * Wiederverwendbare Motion-Komponenten für konsistente Mikro-Interaktionen
 * in der gesamten Anwendung.
 */

import { motion, type HTMLMotionProps, AnimatePresence } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Standard list item animations
 * - Fade in with slight upward motion
 * - Subtle scale on hover
 * - Press feedback on tap
 */
export const listItemVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10, scale: 0.95 },
    hover: { scale: 1.02, x: 4 },
    tap: { scale: 0.98 },
};

/**
 * Card/Panel animations
 * - Lift effect on hover
 * - Subtle press feedback
 */
export const cardVariants = {
    initial: { scale: 1, y: 0 },
    hover: { scale: 1.01, y: -2 },
    tap: { scale: 0.99, y: 0 },
};

/**
 * Button animations
 * - Subtle scale on hover
 * - Press feedback on tap
 */
export const buttonVariants = {
    initial: { scale: 1 },
    hover: { scale: 1.02 },
    tap: { scale: 0.97 },
};

/**
 * Fade animations for modals/dialogs
 */
export const fadeVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

/**
 * Slide animations for sidebars/panels
 */
export const slideVariants = {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
};

/**
 * Scale animations for popups/tooltips
 */
export const scaleVariants = {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Spring transition for interactive elements
 */
export const springTransition = {
    type: "spring" as const,
    stiffness: 400,
    damping: 25,
};

/**
 * Smooth transition for fades/opacity changes
 */
export const smoothTransition = {
    type: "tween" as const,
    duration: 0.2,
    ease: "easeOut" as const,
};

/**
 * Stagger transition for lists
 */
export const staggerTransition = (delay: number = 0.03) => ({
    staggerChildren: delay,
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface MotionListItemProps extends Omit<HTMLMotionProps<"div">, "children"> {
    children?: React.ReactNode;
    /** Index for stagger animation delay */
    index?: number;
    /** Disable hover/tap animations */
    disableInteraction?: boolean;
}

/**
 * Animated list item with hover/tap feedback
 */
export const MotionListItem = forwardRef<HTMLDivElement, MotionListItemProps>(
    ({ className, children, index = 0, disableInteraction = false, ...props }, ref) => (
        <motion.div
            ref={ref}
            className={cn("cursor-pointer", className)}
            variants={listItemVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            whileHover={disableInteraction ? undefined : "hover"}
            whileTap={disableInteraction ? undefined : "tap"}
            transition={{ ...springTransition, delay: index * 0.03 }}
            {...props}
        >
            {children}
        </motion.div>
    )
);
MotionListItem.displayName = "MotionListItem";

interface MotionContainerProps extends Omit<HTMLMotionProps<"div">, "children"> {
    children?: React.ReactNode;
    /** Stagger delay between children */
    staggerDelay?: number;
}

/**
 * Container that staggers its children's animations
 */
export const MotionContainer = forwardRef<HTMLDivElement, MotionContainerProps>(
    ({ className, children, staggerDelay = 0.03, ...props }, ref) => (
        <motion.div
            ref={ref}
            className={className}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={{
                initial: { opacity: 0 },
                animate: {
                    opacity: 1,
                    transition: { staggerChildren: staggerDelay },
                },
                exit: { opacity: 0 },
            }}
            {...props}
        >
            {children}
        </motion.div>
    )
);
MotionContainer.displayName = "MotionContainer";

interface MotionFadeProps extends Omit<HTMLMotionProps<"div">, "children"> {
    children?: React.ReactNode;
}

/**
 * Simple fade animation wrapper
 */
export const MotionFade = forwardRef<HTMLDivElement, MotionFadeProps>(
    ({ className, children, ...props }, ref) => (
        <motion.div
            ref={ref}
            className={className}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={smoothTransition}
            {...props}
        >
            {children}
        </motion.div>
    )
);
MotionFade.displayName = "MotionFade";

/**
 * Re-export AnimatePresence for convenience
 */
export { AnimatePresence, motion };
