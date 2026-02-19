import * as React from "react"
import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

/**
 * Motion variants for interactive cards
 * - Subtle lift on hover
 * - Press feedback on tap
 */
const cardMotionVariants = {
    initial: { scale: 1, y: 0 },
    hover: { scale: 1.01, y: -2 },
    tap: { scale: 0.99, y: 0 },
}

const cardTransition = {
    type: "spring",
    stiffness: 300,
    damping: 20,
}

export interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
    children?: React.ReactNode
    /** Make card interactive with hover/tap animations */
    interactive?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, interactive = false, ...props }, ref) => (
        <motion.div
            ref={ref}
            className={cn(
                // Ive Surface & Depth — borderless, shadow-elevated, rounded-2xl
                "rounded-2xl text-card-foreground bg-card border-0",
                "shadow-[0_1px_3px_rgba(36,49,134,0.04),0_4px_12px_rgba(36,49,134,0.03)]",
                // Interactive state
                interactive && "cursor-pointer hover:shadow-[0_2px_8px_rgba(36,49,134,0.06),0_8px_24px_rgba(36,49,134,0.04)] hover:-translate-y-px transition-all duration-200",
                className
            )}
            variants={interactive ? cardMotionVariants : undefined}
            initial="initial"
            whileHover={interactive ? "hover" : undefined}
            whileTap={interactive ? "tap" : undefined}
            transition={cardTransition}
            {...props}
        />
    )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            "text-lg font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
