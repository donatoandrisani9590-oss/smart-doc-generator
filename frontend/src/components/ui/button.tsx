import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md-ds)] text-sm font-semibold ring-offset-background transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-[var(--nw-blue-700)] text-white shadow-[0_1px_2px_rgba(36,49,134,0.12)] hover:bg-[var(--nw-blue-600)] hover:shadow-[0_2px_8px_rgba(36,49,134,0.18)] hover:-translate-y-[0.5px] active:bg-[var(--nw-blue-800)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(36,49,134,0.12)]",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-[0_1px_2px_rgba(220,38,38,0.12)] hover:bg-destructive/90 hover:shadow-[0_2px_8px_rgba(220,38,38,0.18)]",
                outline:
                    "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[rgba(0,0,0,0.10)] hover:bg-[var(--bg-hover)] hover:border-[rgba(0,0,0,0.15)]",
                secondary:
                    "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[rgba(0,0,0,0.10)] hover:bg-[var(--bg-hover)] hover:border-[rgba(0,0,0,0.15)]",
                ghost: "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                link: "text-primary underline-offset-4 hover:underline",
                ai: "bg-gradient-to-br from-[var(--nw-blue-700)] to-[var(--nw-blue-500)] text-white font-semibold shadow-[0_1px_2px_rgba(36,49,134,0.12)] btn-ai-shimmer hover:shadow-[0_2px_8px_rgba(36,49,134,0.24)]",
                success:
                    "bg-[var(--nw-green-50)] text-[var(--nw-green-700)] border border-[var(--nw-green-200)] hover:bg-[var(--nw-green-100)] hover:border-[var(--nw-green-300)]",
                warning:
                    "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-amber-200 hover:bg-amber-100 hover:border-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/30",
            },
            size: {
                default: "h-[38px] px-5 py-2",
                sm: "h-9 px-4",
                lg: "h-11 px-8",
                icon: "h-10 w-10",
                xs: "h-7 px-3 text-xs",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

/**
 * Micro-interaction animation variants for buttons
 * - Subtle scale on hover (1.02)
 * - Press feedback on tap (0.97)
 * - Smooth spring animation
 */
const buttonMotionVariants = {
    initial: { scale: 1 },
    hover: { scale: 1.02 },
    tap: { scale: 0.97 },
}

const buttonTransition = {
    type: "spring",
    stiffness: 400,
    damping: 17,
}

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
    /** Disable motion animations (useful for icon-only buttons in tight spaces) */
    disableMotion?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, disableMotion = false, ...props }, ref) => {
        // For asChild, use Slot without motion (parent controls animation)
        if (asChild) {
            return (
                <Slot
                    className={cn(buttonVariants({ variant, size, className }))}
                    ref={ref}
                    {...props}
                />
            )
        }

        // For link variant, disable motion to keep underline animation smooth
        const shouldAnimate = !disableMotion && variant !== "link"

        if (shouldAnimate) {
            // Exclude conflicting HTML event handlers when using framer-motion
            const {
                onDrag: _onDrag, onDragStart: _onDragStart, onDragEnd: _onDragEnd,
                onAnimationStart: _onAnimationStart, onAnimationEnd: _onAnimationEnd,
                ...motionSafeProps
            } = props;
            return (
                <motion.button
                    className={cn(buttonVariants({ variant, size, className }))}
                    ref={ref}
                    variants={buttonMotionVariants}
                    initial="initial"
                    whileHover="hover"
                    whileTap="tap"
                    transition={buttonTransition}
                    {...(motionSafeProps as Record<string, unknown>)}
                />
            )
        }

        // Non-animated button
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
