/* eslint-disable react-refresh/only-export-components */
/**
 * Accessibility Hooks and Utilities
 *
 * Provides helpers for:
 * - Focus management
 * - Screen reader announcements
 * - Keyboard navigation
 * - ARIA live regions
 */

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Hook for managing focus trap within a container
 * Useful for modals, dropdowns, and other overlays
 */
export function useFocusTrap(isActive: boolean = true) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<Element | null>(null);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        // Store currently focused element
        previousActiveElement.current = document.activeElement;

        // Get focusable elements
        const getFocusableElements = () => {
            if (!containerRef.current) return [];
            return Array.from(
                containerRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            );
        };

        // Focus first element
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }

        // Handle tab key
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;

            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                // Shift + Tab: move to previous
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: move to next
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);

            // Restore focus
            if (previousActiveElement.current instanceof HTMLElement) {
                previousActiveElement.current.focus();
            }
        };
    }, [isActive]);

    return containerRef;
}

/**
 * Hook for screen reader announcements
 * Uses ARIA live regions to announce messages
 */
export function useAnnounce() {
    const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
        // Create or get live region
        let liveRegion = document.getElementById(`sr-announce-${priority}`);

        if (!liveRegion) {
            liveRegion = document.createElement("div");
            liveRegion.id = `sr-announce-${priority}`;
            liveRegion.setAttribute("aria-live", priority);
            liveRegion.setAttribute("aria-atomic", "true");
            liveRegion.className = "sr-only";
            document.body.appendChild(liveRegion);
        }

        // Clear and set message (triggers announcement)
        liveRegion.textContent = "";
        // Use timeout to ensure DOM update triggers announcement
        setTimeout(() => {
            liveRegion!.textContent = message;
        }, 50);
    }, []);

    return announce;
}

/**
 * Hook for keyboard navigation in lists
 * Supports arrow keys, home, end, and type-ahead
 */
export function useListNavigation<T extends HTMLElement>(
    items: number,
    options: {
        orientation?: "vertical" | "horizontal";
        loop?: boolean;
        onSelect?: (index: number) => void;
    } = {}
) {
    const { orientation = "vertical", loop = true, onSelect } = options;
    const [activeIndex, setActiveIndex] = useState(0);
    const itemRefs = useRef<(T | null)[]>([]);

    const setItemRef = useCallback((index: number) => (el: T | null) => {
        itemRefs.current[index] = el;
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
            const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

            let newIndex = activeIndex;

            switch (e.key) {
                case prevKey:
                    e.preventDefault();
                    newIndex = activeIndex - 1;
                    if (newIndex < 0) {
                        newIndex = loop ? items - 1 : 0;
                    }
                    break;
                case nextKey:
                    e.preventDefault();
                    newIndex = activeIndex + 1;
                    if (newIndex >= items) {
                        newIndex = loop ? 0 : items - 1;
                    }
                    break;
                case "Home":
                    e.preventDefault();
                    newIndex = 0;
                    break;
                case "End":
                    e.preventDefault();
                    newIndex = items - 1;
                    break;
                case "Enter":
                case " ":
                    e.preventDefault();
                    onSelect?.(activeIndex);
                    return;
                default:
                    return;
            }

            setActiveIndex(newIndex);
            itemRefs.current[newIndex]?.focus();
        },
        [activeIndex, items, loop, orientation, onSelect]
    );

    return {
        activeIndex,
        setActiveIndex,
        setItemRef,
        handleKeyDown,
        getItemProps: (index: number) => ({
            ref: setItemRef(index),
            tabIndex: index === activeIndex ? 0 : -1,
            "aria-selected": index === activeIndex,
            onKeyDown: handleKeyDown,
            onFocus: () => setActiveIndex(index),
        }),
    };
}

/**
 * Hook for skip links (skip to main content)
 */
export function useSkipLink(targetId: string = "main-content") {
    const skipToContent = useCallback(() => {
        const target = document.getElementById(targetId);
        if (target) {
            target.setAttribute("tabindex", "-1");
            target.focus();
            target.removeAttribute("tabindex");
        }
    }, [targetId]);

    return skipToContent;
}

/**
 * Hook for reduced motion preference
 */
export function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync state from media query on mount
        setPrefersReducedMotion(mediaQuery.matches);

        const handler = (e: MediaQueryListEvent) => {
            setPrefersReducedMotion(e.matches);
        };

        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, []);

    return prefersReducedMotion;
}

/**
 * Hook for high contrast mode detection
 */
export function usePrefersHighContrast() {
    const [prefersHighContrast, setPrefersHighContrast] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-contrast: more)");
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync state from media query on mount
        setPrefersHighContrast(mediaQuery.matches);

        const handler = (e: MediaQueryListEvent) => {
            setPrefersHighContrast(e.matches);
        };

        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, []);

    return prefersHighContrast;
}

/**
 * Component: Screen reader only text
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
    return <span className="sr-only">{children}</span>;
}

/**
 * Component: Skip to main content link
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
    const skipToContent = useSkipLink(targetId);

    return (
        <a
            href={`#${targetId}`}
            onClick={(e) => {
                e.preventDefault();
                skipToContent();
            }}
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
            Zum Hauptinhalt springen
        </a>
    );
}

/**
 * Component: Live region for dynamic announcements
 */
export function LiveRegion({
    message,
    priority = "polite",
}: {
    message: string;
    priority?: "polite" | "assertive";
}) {
    return (
        <div
            aria-live={priority}
            aria-atomic="true"
            className="sr-only"
        >
            {message}
        </div>
    );
}
