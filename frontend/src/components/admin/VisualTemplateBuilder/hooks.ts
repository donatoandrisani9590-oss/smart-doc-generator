// ============================================================================
// Hooks for VisualTemplateBuilder
// ============================================================================

import { useState, useEffect } from "react";
import type {
    VisualTemplateBuilderProps,
    VisualTemplateBuilderPropsWithSections,
} from "./types";

// ============================================================================
// Debounce Hook
// ============================================================================

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// ============================================================================
// Type Guard: Check if using sections mode
// ============================================================================

export function useSectionsMode(
    props: VisualTemplateBuilderProps
): props is VisualTemplateBuilderPropsWithSections {
    return "sections" in props && props.sections !== undefined;
}
