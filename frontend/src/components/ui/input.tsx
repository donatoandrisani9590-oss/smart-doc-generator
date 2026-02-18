import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    /** Show full value as tooltip on hover when text overflows */
    showOverflowTooltip?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, showOverflowTooltip = true, value, ...props }, ref) => {
        const inputRef = React.useRef<HTMLInputElement>(null);
        const [showTooltip, setShowTooltip] = React.useState(false);
        const [isOverflowing, setIsOverflowing] = React.useState(false);

        // Merge refs
        React.useImperativeHandle(ref, () => inputRef.current!);

        // Check if text is overflowing
        React.useEffect(() => {
            const input = inputRef.current;
            if (input && showOverflowTooltip) {
                setIsOverflowing(input.scrollWidth > input.clientWidth);
            }
        }, [value, showOverflowTooltip]);

        const displayValue = value ?? props.defaultValue;
        const shouldShowTooltip = showOverflowTooltip && isOverflowing && showTooltip && displayValue;

        return (
            <div className="relative w-full">
                <input
                    type={type}
                    className={cn(
                        "flex h-9 w-full rounded-lg border border-border/60 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/40 hover:border-border focus-visible:outline-none focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10 focus-visible:shadow-sm transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                    ref={inputRef}
                    value={value}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    {...props}
                />
                {shouldShowTooltip && (
                    <div
                        className="absolute z-50 left-0 -top-8 max-w-md px-2 py-1 text-xs bg-popover text-popover-foreground border border-border rounded shadow-md whitespace-nowrap overflow-hidden text-ellipsis"
                        role="tooltip"
                    >
                        {String(displayValue)}
                    </div>
                )}
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }
