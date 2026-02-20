/**
 * RightEditorPanel - Rechte Seite des Split-Screen Editors
 *
 * Enthält den TinyMCE WYSIWYG Editor mit:
 * - A4-Papier Styling (wie Microsoft Word)
 * - Live-Aktualisierung aus dem Preview
 * - Direkte Bearbeitung möglich (Fett, Listen, etc.)
 * - Toolbar mit Word-ähnlichen Funktionen
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Loader2, MessagesSquare, Sparkles } from "lucide-react";
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

        // Listen for selections to show floating AI toolbar
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
                        // Position above the selection, centered
                        setFloatingPos({
                            top: iframeRect.top + rect.top - 45,
                            left: iframeRect.left + rect.left + (rect.width / 2) - 20, // offset half button width
                        });
                    }
                } catch (e) {
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
        // Verify there's actually a selection to replace
        const currentSelection = editorRef.current.selection.getContent({ format: "text" });
        if (!currentSelection) {
            // No selection — insert at cursor position instead
            editorRef.current.insertContent(newText);
        } else {
            editorRef.current.selection.setContent(newText);
        }
        // Trigger content change
        const content = editorRef.current.getContent();
        actions.setEditorContent(content, true);
    }, [actions]);

    // Content to display: use editorContent if available, otherwise previewHtml
    const displayContent = editorContent || previewHtml || "";

    // Handle all editor content changes (for tracking content state)
    // This is called for both programmatic and user-initiated changes
    const handleEditorChange = useCallback((content: string) => {
        // Just update the content without marking as manual edit
        // This keeps the content in sync but doesn't trigger the banner
        actions.setEditorContent(content, false);
    }, [actions]);

    // Handle user-initiated edits specifically
    // This is only called when user types, pastes, or uses toolbar
    const handleUserEdit = useCallback((content: string) => {
        // This is a genuine user edit - mark it as such
        actions.setEditorContent(content, true);
    }, [actions]);

    // Toggle comment sidebar
    const handleToggleComments = useCallback(() => {
        actions.toggleCommentSidebar();
    }, [actions]);

    // Toggle chat sidebar
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

        // Cancel any in-flight preview
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

    // Cleanup abort controller on unmount
    useEffect(() => {
        return () => { toneAbortRef.current?.abort(); };
    }, []);

    // Auto-trigger tone preview when user changes tone (only if content exists)
    const prevToneRef = useRef(state.toneOfVoice);
    useEffect(() => {
        if (state.toneOfVoice !== prevToneRef.current && displayContent) {
            prevToneRef.current = state.toneOfVoice;
            handleTonePreview(state.toneOfVoice);
        }
    }, [state.toneOfVoice, displayContent, handleTonePreview]);

    // Show preview content in editor while preview is active
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
