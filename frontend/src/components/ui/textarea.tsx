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
                    "flex min-h-[80px] w-full rounded-lg border border-border/60 bg-white px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground/40 hover:border-border focus-visible:outline-none focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10 focus-visible:shadow-sm transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50",
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
