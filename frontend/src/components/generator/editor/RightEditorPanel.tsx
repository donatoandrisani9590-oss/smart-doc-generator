/**
 * RightEditorPanel - True-Fidelity Canvas
 *
 * Pure desk + paper surface. No toolbar, no banners.
 * All chrome lives in LeftControlPanel.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Loader2, MessagesSquare, Sparkles, RefreshCw, Check, Undo2 } from "lucide-react";
import type { Editor as TinyMCEEditor } from "tinymce";
import { Button } from "@/components/ui/button";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { StationeryCanvas } from "./StationeryCanvas";
import { AIToolbar } from "./AIToolbar";
import { useWizardContext } from "../WizardContext";
import { useCountry } from "@/hooks/useCountry";
import { TONE_LEVELS, type ToneLevel } from "../ToneCards";
import { apiStreamSSE } from "@/lib/api-stream";
import { FullDocumentPreview, type DocumentZones } from "@/components/editor/FullDocumentPreview";
import { useDesignSettings } from "@/hooks/api/useDocumentTypeQueries";

export const RightEditorPanel = () => {
    const { state, actions } = useWizardContext();
    const { country } = useCountry();
    const { data: designSettings } = useDesignSettings(country);

    // Build document zones from DesignSettings for header/footer preview
    const documentZones = useMemo((): DocumentZones | null => {
        if (!designSettings) return null;
        const ds = designSettings as Record<string, unknown>;
        return {
            logoUrl: ds.logo_path as string | undefined,
            logoPosition: (ds.logo_position as "left" | "center" | "right") || "right",
            logoWidthCm: (ds.logo_width_cm as string) || "5",
            companyName: ds.company_name as string | undefined,
            headerLines: [ds.header_line1, ds.header_line2, ds.header_line3] as (string | null)[],
            footerLines: [ds.footer_line1, ds.footer_line2, ds.footer_line3] as (string | null)[],
            primaryColor: ds.primary_color as string | undefined,
        };
    }, [designSettings]);

    const {
        previewHtml,
        editorContent,
        isPreviewLoading,
        showCommentSidebar,
        userTemplateId,
        stationeryZones,
    } = state;

    // Editor reference for AI toolbar text selection
    const editorRef = useRef<TinyMCEEditor | null>(null);

    // Floating toolbar state
    const [floatingPos, setFloatingPos] = useState<{ top: number; left: number } | null>(null);

    // Callback to capture editor instance from DocumentEditor
    const handleEditorInit = useCallback((editor: TinyMCEEditor) => {
        editorRef.current = editor;

        editor.on("selectionchange NodeChange mouseup keyup", () => {
            const selection = editor.selection;
            if (selection.isCollapsed() || !selection.getContent({ format: 'text' }).trim()) {
                setFloatingPos(null);
            } else {
                try {
                    const rng = selection.getRng();
                    const rect = rng.getBoundingClientRect();
                    const iframe = editor.getContentAreaContainer().querySelector('iframe');

                    if (iframe && rect.width > 0 && rect.height > 0) {
                        const iframeRect = iframe.getBoundingClientRect();
                        setFloatingPos({
                            top: iframeRect.top + rect.top - 45,
                            left: iframeRect.left + rect.left + (rect.width / 2) - 20,
                        });
                    }
                } catch {
                    setFloatingPos(null);
                }
            }
        });
    }, []);

    // AI Toolbar callbacks
    const getSelectedText = useCallback(() => {
        if (!editorRef.current) return "";
        return editorRef.current.selection.getContent({ format: "html" }) ||
            editorRef.current.selection.getContent({ format: "text" }) || "";
    }, []);

    const replaceSelectedText = useCallback((newText: string) => {
        if (!editorRef.current) return;
        const currentSelection = editorRef.current.selection.getContent({ format: "text" });
        if (!currentSelection) {
            editorRef.current.insertContent(newText);
        } else {
            editorRef.current.selection.setContent(newText);
        }
        const content = editorRef.current.getContent();
        actions.setEditorContent(content, true);
    }, [actions]);

    const displayContent = editorContent || previewHtml || "";

    const handleEditorChange = useCallback((content: string) => {
        actions.setEditorContent(content, false);
    }, [actions]);

    const handleUserEdit = useCallback((content: string) => {
        actions.setEditorContent(content, true);
    }, [actions]);

    const handleToggleComments = useCallback(() => {
        actions.toggleCommentSidebar();
    }, [actions]);

    const handleToggleChat = useCallback(() => {
        actions.toggleChatSidebar();
    }, [actions]);

    // ── Tone Preview with AI Refine ──────────────────────────────────────
    const [tonePreview, setTonePreview] = useState<{
        originalContent: string;
        previewContent: string;
        tone: ToneLevel;
        toneLabel: string;
        isStreaming: boolean;
    } | null>(null);
    const toneAbortRef = useRef<AbortController | null>(null);

    const handleTonePreview = useCallback(async (tone: ToneLevel) => {
        const currentContent = editorContent || previewHtml;
        if (!currentContent) return;

        toneAbortRef.current?.abort();
        const controller = new AbortController();
        toneAbortRef.current = controller;

        const toneLabel = TONE_LEVELS[tone - 1].label;
        setTonePreview({ originalContent: currentContent, previewContent: "", tone, toneLabel, isStreaming: true });

        const tonePresets: Record<number, string> = {
            1: "formal", 2: "concise", 3: "friendly", 4: "friendly", 5: "friendly"
        };

        try {
            let accumulated = "";
            for await (const event of apiStreamSSE(
                "/api/v1/smart/refine/stream",
                { text: currentContent, preset: tonePresets[tone], tone_of_voice: tone },
                controller.signal
            )) {
                if (event.token) {
                    accumulated += event.token;
                    setTonePreview(prev => prev ? { ...prev, previewContent: accumulated } : null);
                }
                if (event.done) {
                    setTonePreview(prev => prev ? { ...prev, isStreaming: false } : null);
                }
            }
        } catch {
            if (!controller.signal.aborted) {
                setTonePreview(null);
            }
        }
    }, [editorContent, previewHtml]);

    const handleAcceptTonePreview = useCallback(() => {
        if (tonePreview?.previewContent) {
            actions.setEditorContent(tonePreview.previewContent, true);
            actions.setToneOfVoice(tonePreview.tone);
        }
        setTonePreview(null);
    }, [tonePreview, actions]);

    const handleRevertTonePreview = useCallback(() => {
        toneAbortRef.current?.abort();
        if (tonePreview?.originalContent) {
            actions.setEditorContent(tonePreview.originalContent, false);
        }
        setTonePreview(null);
    }, [tonePreview, actions]);

    useEffect(() => {
        return () => { toneAbortRef.current?.abort(); };
    }, []);

    const prevToneRef = useRef(state.toneOfVoice);
    useEffect(() => {
        if (state.toneOfVoice !== prevToneRef.current && displayContent) {
            prevToneRef.current = state.toneOfVoice;
            handleTonePreview(state.toneOfVoice);
        }
    }, [state.toneOfVoice, displayContent, handleTonePreview]);

    const effectiveDisplayContent = tonePreview?.previewContent || displayContent;

    return (
        <div className="h-full flex flex-col relative">
            {/* Floating controls — KI-Chat & Kommentare */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur-sm shadow-sm"
                    onClick={handleToggleChat}
                    title="KI-Chat"
                >
                    <Sparkles className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur-sm shadow-sm"
                    onClick={handleToggleComments}
                    title={showCommentSidebar ? "Kommentare ausblenden" : "Kommentare einblenden"}
                >
                    <MessagesSquare className="h-4 w-4" />
                </Button>
            </div>

            {/* Tone Preview Floating Banner */}
            {tonePreview && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-2 rounded-full bg-white/90 dark:bg-card/90 backdrop-blur-sm shadow-sm text-xs">
                    <RefreshCw className={`w-3.5 h-3.5 text-primary shrink-0 ${tonePreview.isStreaming ? "animate-spin" : ""}`} />
                    <span className="text-muted-foreground">
                        &bdquo;{tonePreview.toneLabel}&ldquo;
                    </span>
                    <Button
                        size="sm"
                        onClick={handleAcceptTonePreview}
                        disabled={tonePreview.isStreaming}
                        className="h-6 gap-1 text-[10px]"
                    >
                        <Check className="w-3 h-3" />
                        Übernehmen
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRevertTonePreview}
                        className="h-6 gap-1 text-[10px]"
                    >
                        <Undo2 className="w-3 h-3" />
                        Original
                    </Button>
                </div>
            )}

            {/* Editor Container - A4 Paper on clean desk */}
            <div className="flex-1 overflow-auto bg-transparent p-4 md:p-6 lg:p-8 pb-10 md:pb-12 lg:pb-16">
                {isPreviewLoading && !displayContent ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                            <p className="text-sm text-muted-foreground">Dokument wird geladen...</p>
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto w-full" style={{ maxWidth: "min(210mm, 100%)" }}>
                        {/* A4 Paper Container with shadow */}
                        {userTemplateId && stationeryZones ? (
                            <StationeryCanvas
                                zones={stationeryZones}
                                value={effectiveDisplayContent}
                                onChange={handleEditorChange}
                                onUserEdit={handleUserEdit}
                                onEditorInit={handleEditorInit}
                                isLoading={isPreviewLoading}
                            />
                        ) : documentZones ? (
                            <FullDocumentPreview zones={documentZones}>
                                <DocumentEditor
                                    value={effectiveDisplayContent}
                                    onChange={handleEditorChange}
                                    onUserEdit={handleUserEdit}
                                    onEditorInit={handleEditorInit}
                                    isLoading={isPreviewLoading}
                                    className="split-screen-editor"
                                    compact
                                />
                            </FullDocumentPreview>
                        ) : (
                            <div className="bg-white dark:bg-card rounded-2xl shadow-[var(--shadow-elevated)]">
                                <DocumentEditor
                                    value={effectiveDisplayContent}
                                    onChange={handleEditorChange}
                                    onUserEdit={handleUserEdit}
                                    onEditorInit={handleEditorInit}
                                    isLoading={isPreviewLoading}
                                    className="split-screen-editor"
                                    compact
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Floating AI Toolbar */}
                {floatingPos && !isPreviewLoading && (
                    <div
                        className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            top: `${floatingPos.top}px`,
                            left: `${floatingPos.left}px`,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            borderRadius: "var(--radius)"
                        }}
                    >
                        <AIToolbar
                            getSelectedText={getSelectedText}
                            replaceSelectedText={replaceSelectedText}
                            documentContext={state.documentTitle || undefined}
                            countryCode={country}
                            documentTypeId={state.documentTypeId}
                            toneOfVoice={state.toneOfVoice}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default RightEditorPanel;
