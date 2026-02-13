/**
 * useTextSelection - Erfasst Textauswahl innerhalb eines Containers
 *
 * Berechnet Character-Offsets relativ zum textContent des Containers.
 * Für Inline-Kommentare in der Dokumentvorschau.
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface TextSelectionInfo {
    text: string;
    start: number;
    end: number;
    rect: DOMRect;
}

/**
 * Berechnet den Character-Offset eines Knotens relativ zum Container.
 */
function getCharOffset(
    container: HTMLElement,
    targetNode: Node,
    targetOffset: number
): number {
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT
    );
    let charCount = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
        if (node === targetNode) {
            return charCount + targetOffset;
        }
        charCount += node.textContent?.length ?? 0;
    }
    return charCount;
}

/**
 * Prüft ob ein Node innerhalb des Containers liegt.
 */
function isNodeWithin(container: HTMLElement, node: Node | null): boolean {
    if (!node) return false;
    return container.contains(node);
}

export function useTextSelection(
    containerRef: React.RefObject<HTMLDivElement | null>
): {
    selection: TextSelectionInfo | null;
    clearSelection: () => void;
} {
    const [selection, setSelection] = useState<TextSelectionInfo | null>(null);
    const isMouseDownRef = useRef(false);

    const clearSelection = useCallback(() => {
        window.getSelection()?.removeAllRanges();
        setSelection(null);
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseDown = () => {
            isMouseDownRef.current = true;
            setSelection(null);
        };

        const handleMouseUp = () => {
            if (!isMouseDownRef.current) return;
            isMouseDownRef.current = false;

            // Kurze Verzögerung damit der Browser die Selection finalisiert
            requestAnimationFrame(() => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed || !sel.rangeCount) {
                    setSelection(null);
                    return;
                }

                const range = sel.getRangeAt(0);
                const text = sel.toString().trim();

                if (!text || text.length < 3) {
                    setSelection(null);
                    return;
                }

                // Sicherstellen dass die Auswahl innerhalb des Containers liegt
                if (
                    !isNodeWithin(container, range.startContainer) ||
                    !isNodeWithin(container, range.endContainer)
                ) {
                    setSelection(null);
                    return;
                }

                const start = getCharOffset(
                    container,
                    range.startContainer,
                    range.startOffset
                );
                const end = getCharOffset(
                    container,
                    range.endContainer,
                    range.endOffset
                );

                const rect = range.getBoundingClientRect();

                setSelection({
                    text,
                    start: Math.min(start, end),
                    end: Math.max(start, end),
                    rect,
                });
            });
        };

        container.addEventListener("mousedown", handleMouseDown);
        container.addEventListener("mouseup", handleMouseUp);

        return () => {
            container.removeEventListener("mousedown", handleMouseDown);
            container.removeEventListener("mouseup", handleMouseUp);
        };
    }, [containerRef]);

    return { selection, clearSelection };
}
