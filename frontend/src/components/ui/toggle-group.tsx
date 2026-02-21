import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleGroupVariants = cva(
    "inline-flex items-center rounded-full bg-muted/40 p-0.5 gap-px",
    {
        variants: {
            variant: {
                default: "",
                outline: "bg-transparent border border-input",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

const toggleGroupItemVariants = cva(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer text-foreground/35 hover:text-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-[var(--shadow-elevated)]",
    {
        variants: {
            size: {
                default: "px-3.5 py-1.5 text-xs",
                sm: "px-2.5 py-1 text-xs",
                lg: "px-5 py-2 text-sm",
            },
        },
        defaultVariants: {
            size: "default",
        },
    }
)

type ToggleGroupContextValue = VariantProps<typeof toggleGroupItemVariants>

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
    size: "default",
})

const ToggleGroup = React.forwardRef<
    React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
        VariantProps<typeof toggleGroupVariants> &
        VariantProps<typeof toggleGroupItemVariants>
>(({ className, variant, size, children, ...props }, ref) => (
    <ToggleGroupPrimitive.Root
        ref={ref}
        className={cn(toggleGroupVariants({ variant }), className)}
        {...props}
    >
        <ToggleGroupContext.Provider value={{ size }}>
            {children}
        </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
))
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
    React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
        VariantProps<typeof toggleGroupItemVariants>
>(({ className, size, children, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext)

    return (
        <ToggleGroupPrimitive.Item
            ref={ref}
            className={cn(
                toggleGroupItemVariants({ size: size ?? context.size }),
                className
            )}
            {...props}
        >
            {children}
        </ToggleGroupPrimitive.Item>
    )
})
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
