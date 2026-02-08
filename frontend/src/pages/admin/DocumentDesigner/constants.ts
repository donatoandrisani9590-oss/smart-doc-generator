/**
 * Micro-interaction variants for list items
 */
export const listItemVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10, scale: 0.95 },
    hover: { scale: 1.02, x: 4 },
    tap: { scale: 0.98 },
};

export const listTransition = {
    type: "spring",
    stiffness: 400,
    damping: 25,
};
