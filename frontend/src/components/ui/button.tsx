import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                outline:
                    "border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground",
                secondary:
                    "border-2 border-secondary bg-transparent text-secondary hover:bg-secondary hover:text-secondary-foreground",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                // Niederwieser Corporate variants
                success:
                    "border-2 border-secondary bg-transparent text-secondary hover:bg-secondary hover:text-secondary-foreground",
                warning:
                    "border-2 border-amber-500 bg-transparent text-amber-600 hover:bg-amber-500 hover:text-white",
            },
            size: {
                default: "h-10 px-5 py-2",
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {
                onDrag, onDragStart, onDragEnd,
                onAnimationStart, onAnimationEnd,
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

export { Button, buttonVariants }
