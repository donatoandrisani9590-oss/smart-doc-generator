import * as React from "react"

import { cn } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    "flex min-h-[80px] w-full rounded-none border-0 bg-transparent px-0 py-3 text-sm ring-offset-background shadow-[inset_0_-1px_0_0_hsl(33_12%_78%)] placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:shadow-[inset_0_-2px_0_0_hsl(228_58%_33%)] transition-shadow duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Textarea.displayName = "Textarea"

export { Textarea }
