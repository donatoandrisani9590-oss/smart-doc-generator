/**
 * DocumentPreviewPanel - HTML-Rendering des generierten Dokuments
 *
 * Rendert das gespeicherte content_html in einem DIN A4 "Floating Paper" Container.
 * Nutzt die bestehenden preview.css Styles (.preview-container, .document-preview).
 * Bietet Zoom-Controls und einen Fallback für ältere Dokumente ohne HTML.
 * Unterstützt Inline-Kommentare: Text-Highlights und schwebender Kommentieren-Button.
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    ZoomIn,
    ZoomOut,
    Download,
    FileText,
    Maximize2,
    Minimize2,
} from "lucide-react";
import { InlineCommentHighlighter } from "./InlineCommentHighlighter";
import type { CommentThread, SelectionRange } from "@/hooks/useComments";

interface DocumentPreviewPanelProps {
    contentHtml: string | null;
    documentTitle: string;
    filePath: string;
    comments?: CommentThread[];
    onCreateInlineComment?: (range: SelectionRange) => void;
    onHighlightClick?: (commentId: number) => void;
    activeCommentId?: number | null;
}

const ZOOM_STEPS = [0.5, 0.6, 0.75, 0.85, 1.0, 1.15, 1.3, 1.5];
const DEFAULT_ZOOM_INDEX = 3; // 0.85 = slightly smaller to fit well

export const DocumentPreviewPanel = ({
    contentHtml,
    documentTitle,
    filePath,
    comments = [],
    onCreateInlineComment,
    onHighlightClick,
    activeCommentId = null,
}: DocumentPreviewPanelProps) => {
    const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const zoom = ZOOM_STEPS[zoomIndex];

    const handleZoomIn = () => {
        setZoomIndex((prev) => Math.min(prev + 1, ZOOM_STEPS.length - 1));
    };

    const handleZoomOut = () => {
        setZoomIndex((prev) => Math.max(prev - 1, 0));
    };

    const handleZoomReset = () => {
        setZoomIndex(DEFAULT_ZOOM_INDEX);
    };

    const handleToggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!isFullscreen) {
            containerRef.current.requestFullscreen?.();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    // Fallback: Kein HTML verfügbar (ältere Dokumente)
    if (!contentHtml) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[500px] bg-warm-50/50 rounded-xl border border-warm-200/50">
                <div className="text-center space-y-4 p-8">
                    <div className="w-16 h-16 mx-auto rounded-full bg-warm-100 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-warm-500" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground mb-1">
                            Vorschau nicht verfügbar
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Dieses Dokument wurde vor der Vorschau-Funktion erstellt.
                            Sie können es herunterladen, um den Inhalt zu sehen.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => window.open(filePath, "_blank")}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {documentTitle} herunterladen
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative flex flex-col h-full rounded-xl border border-warm-200/50 overflow-hidden bg-warm-50/30"
        >
            {/* Preview Area */}
            <div ref={scrollContainerRef} className="relative flex-1 overflow-auto">
                <div className="preview-container" style={{ minHeight: "100%", position: "relative" }}>
                    <div
                        ref={previewRef}
                        className="document-preview"
                        style={{
                            transform: `scale(${zoom})`,
                            transformOrigin: "top center",
                            marginBottom: zoom < 1 ? `${(1 - zoom) * -297}mm` : 0,
                        }}
                        dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                </div>

                {/* Inline Comment Highlighter */}
                {onCreateInlineComment && onHighlightClick && (
                    <InlineCommentHighlighter
                        previewRef={previewRef}
                        scrollContainerRef={scrollContainerRef}
                        comments={comments}
                        onCreateComment={onCreateInlineComment}
                        onHighlightClick={onHighlightClick}
                        activeCommentId={activeCommentId}
                    />
                )}
            </div>

            {/* Zoom Controls - Bottom Right */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-warm-200/50 p-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleZoomOut}
                    disabled={zoomIndex === 0}
                    title="Verkleinern"
                >
                    <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <button
                    className="text-xs font-medium text-muted-foreground px-1.5 min-w-[3rem] text-center hover:text-foreground transition-colors"
                    onClick={handleZoomReset}
                    title="Zoom zurücksetzen"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleZoomIn}
                    disabled={zoomIndex === ZOOM_STEPS.length - 1}
                    title="Vergrößern"
                >
                    <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <div className="w-px h-4 bg-warm-200 mx-0.5" />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleToggleFullscreen}
                    title={isFullscreen ? "Vollbild beenden" : "Vollbild"}
                >
                    {isFullscreen ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                    )}
                </Button>
            </div>
        </div>
    );
};
