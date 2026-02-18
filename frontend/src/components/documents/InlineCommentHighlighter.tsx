/**
 * InlineCommentHighlighter - Verwaltet Inline-Kommentar-Highlights und Auswahl-Button
 *
 * - Rendert <mark> Highlights für bestehende Inline-Kommentare
 * - Zeigt schwebenden "Kommentieren"-Button bei Textauswahl
 * - Bidirektionale Navigation: Highlight ↔ Sidebar
 */

import { useEffect, useRef, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { useTextSelection } from "@/hooks/useTextSelection";
import type { CommentThread, SelectionRange } from "@/hooks/useComments";

interface InlineCommentHighlighterProps {
    previewRef: React.RefObject<HTMLDivElement | null>;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    comments: CommentThread[];
    onCreateComment: (range: SelectionRange) => void;
    onHighlightClick: (commentId: number) => void;
    activeCommentId: number | null;
}

/**
 * Entfernt alle bestehenden Inline-Highlight-Marks und stellt den Text wieder her.
 */
function removeAllHighlights(container: HTMLElement) {
    const marks = container.querySelectorAll("mark.inline-comment-highlight");
    marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize();
    });
}

/**
 * Wrapped Text-Nodes innerhalb einer Range in <mark> Elemente.
 * Funktioniert auch bei Cross-Element Selections.
 */
function wrapRangeInMark(
    container: HTMLElement,
    start: number,
    end: number,
    commentId: number,
    isResolved: boolean
): void {
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT
    );
    let charCount = 0;
    let node: Node | null;
    const nodesToWrap: { node: Text; wrapStart: number; wrapEnd: number }[] = [];

    while ((node = walker.nextNode())) {
        const nodeLen = node.textContent?.length ?? 0;
        const nodeStart = charCount;
        const nodeEnd = charCount + nodeLen;

        if (nodeEnd > start && nodeStart < end) {
            const wrapStart = Math.max(0, start - nodeStart);
            const wrapEnd = Math.min(nodeLen, end - nodeStart);
            nodesToWrap.push({ node: node as Text, wrapStart, wrapEnd });
        }

        charCount += nodeLen;
        if (charCount >= end) break;
    }

    // Von hinten nach vorne wrappen um Offsets nicht zu verschieben
    for (let i = nodesToWrap.length - 1; i >= 0; i--) {
        const { node: textNode, wrapStart, wrapEnd } = nodesToWrap[i];
        const parent = textNode.parentNode;
        if (!parent) continue;

        // Nicht innerhalb eines bereits existierenden Marks wrappen
        if (parent instanceof HTMLElement && parent.tagName === "MARK") continue;

        const before = textNode.textContent?.slice(0, wrapStart) ?? "";
        const highlighted = textNode.textContent?.slice(wrapStart, wrapEnd) ?? "";
        const after = textNode.textContent?.slice(wrapEnd) ?? "";

        const mark = document.createElement("mark");
        mark.className = `inline-comment-highlight${isResolved ? " inline-comment-highlight--resolved" : ""}`;
        mark.dataset.commentId = String(commentId);
        mark.textContent = highlighted;

        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));
        fragment.appendChild(mark);
        if (after) fragment.appendChild(document.createTextNode(after));

        parent.replaceChild(fragment, textNode);
    }
}

export const InlineCommentHighlighter = ({
    previewRef,
    scrollContainerRef,
    comments,
    onCreateComment,
    onHighlightClick,
    activeCommentId,
}: InlineCommentHighlighterProps) => {
    const { selection, clearSelection } = useTextSelection(previewRef);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // ── Highlights rendern ──────────────────────────────────────────────
    useEffect(() => {
        const container = previewRef.current;
        if (!container) return;

        removeAllHighlights(container);

        // Inline-Kommentare nach start sortiert, von hinten nach vorne anwenden
        const inlineComments = comments
            .filter((t) => t.root.selection_range)
            .sort(
                (a, b) =>
                    (b.root.selection_range!.start) - (a.root.selection_range!.start)
            );

        for (const thread of inlineComments) {
            const sr = thread.root.selection_range!;
            wrapRangeInMark(
                container,
                sr.start,
                sr.end,
                thread.root.id,
                thread.root.is_resolved
            );
        }

        // Click-Handler auf Marks
        const handleMarkClick = (e: Event) => {
            const target = e.target as HTMLElement;
            if (
                target.tagName === "MARK" &&
                target.classList.contains("inline-comment-highlight")
            ) {
                const commentId = target.dataset.commentId;
                if (commentId) {
                    onHighlightClick(Number(commentId));
                }
            }
        };

        container.addEventListener("click", handleMarkClick);
        return () => {
            container.removeEventListener("click", handleMarkClick);
        };
    }, [comments, previewRef, onHighlightClick]);

    // ── Active Highlight Pulsing ────────────────────────────────────────
    useEffect(() => {
        const container = previewRef.current;
        if (!container || !activeCommentId) return;

        const marks = container.querySelectorAll(
            `mark[data-comment-id="${activeCommentId}"]`
        );
        if (marks.length === 0) return;

        marks.forEach((m) => m.classList.add("inline-comment-highlight--active"));
        marks[0].scrollIntoView({ behavior: "smooth", block: "center" });

        const timeout = setTimeout(() => {
            marks.forEach((m) =>
                m.classList.remove("inline-comment-highlight--active")
            );
        }, 3000);

        return () => {
            clearTimeout(timeout);
            marks.forEach((m) =>
                m.classList.remove("inline-comment-highlight--active")
            );
        };
    }, [activeCommentId, previewRef]);

    // ── Schwebender Button ──────────────────────────────────────────────
    const handleCreateClick = useCallback(() => {
        if (!selection) return;
        onCreateComment({
            start: selection.start,
            end: selection.end,
            text: selection.text,
        });
        clearSelection();
    }, [selection, onCreateComment, clearSelection]);

    if (!selection) return null;

    // Button-Position berechnen relativ zum Scroll-Container
    const scrollContainer = scrollContainerRef.current;
    // eslint-disable-next-line react-hooks/refs -- ref access needed for DOM measurement in render
    if (!scrollContainer) return null;

    // eslint-disable-next-line react-hooks/refs -- ref access needed for DOM measurement in render
    const containerRect = scrollContainer.getBoundingClientRect();
    const top =
        selection.rect.top -
        containerRect.top +
        // eslint-disable-next-line react-hooks/refs -- ref access needed for DOM measurement in render
        scrollContainer.scrollTop -
        36;
    const left =
        selection.rect.left +
        selection.rect.width / 2 -
        containerRect.left;

    return (
        <button
            ref={buttonRef}
            className="absolute z-20 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg shadow-lg hover:bg-primary/90 transition-colors"
            style={{
                top: Math.max(4, top),
                left: Math.max(40, Math.min(left, containerRect.width - 40)),
                transform: "translateX(-50%)",
            }}
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCreateClick();
            }}
        >
            <MessageSquare className="w-3.5 h-3.5" />
            Kommentieren
        </button>
    );
};
