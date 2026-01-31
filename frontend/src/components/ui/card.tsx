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
                // Base styles with refined glass effect
                "rounded-lg text-card-foreground",
                // Frosted glass styling - subtle & performant
                "glass-card",
                // Interactive state
                interactive && "cursor-pointer",
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
