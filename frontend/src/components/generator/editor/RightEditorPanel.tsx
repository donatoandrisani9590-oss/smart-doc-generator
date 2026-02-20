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
import { useNavigate } from "react-router-dom";
import { Loader2, MessageSquarePlus, MessagesSquare, AlertTriangle, Sparkles, RefreshCw, Check, Undo2, CheckCircle2, Download, Send, ArrowRight } from "lucide-react";
import type { Editor as TinyMCEEditor } from "tinymce";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { StationeryCanvas } from "./StationeryCanvas";
import { AIToolbar } from "./AIToolbar";
import { GhostwriterCard } from "../GhostwriterCard";
import { useWizardContext } from "../WizardContext";
import { useCountry } from "@/hooks/useCountry";
import { useGhostwriterDraft } from "@/hooks/useGhostwriterDraft";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";
import { WorkflowStepper } from "../WorkflowStepper";
import { ComplianceRiskBanner } from "../ComplianceRiskBanner";
import { ConsistencyBanner } from "../ConsistencyBanner";
import { GapAnalysisCard } from "../GapAnalysisCard";
import { TONE_LEVELS, type ToneLevel } from "../ToneCards";
import { apiStreamSSE } from "@/lib/api-stream";
import { FullDocumentPreview, type DocumentZones } from "@/components/editor/FullDocumentPreview";
import { useDesignSettings } from "@/hooks/api/useDocumentTypeQueries";

export const RightEditorPanel = () => {
    const { state, actions } = useWizardContext();
    const { country } = useCountry();
    const navigate = useNavigate();
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
        hasLocalEdits,
        isPreviewLoading,
        showCommentSidebar,
        showChatSidebar,
        userTemplateId,
        stationeryZones,
    } = state;

    // Only show compliance/consistency banners after user has meaningfully started
    const hasFilledFields = useMemo(() => {
        const { vorname, nachname, position, gehalt, eintrittsdatum } = state.formData || {};
        const filled = [vorname, nachname, position, gehalt, eintrittsdatum]
            .filter(v => v !== undefined && v !== null && v !== "");
        return filled.length >= 2;
    }, [state.formData]);

    // Employee name for consistency check
    const employeeName = useMemo(() => {
        const { vorname, nachname } = state.formData || {};
        if (!nachname) return "";
        return `${vorname || ""} ${nachname}`.trim();
    }, [state.formData]);

    // Ghostwriter draft suggestion
    const ghostwriterEnabled = useFeatureEnabled("enable_ghostwriter");
    const ghostwriter = useGhostwriterDraft({
        documentTypeId: state.documentTypeId,
        formData: (state.formData || {}) as unknown as Record<string, unknown>,
        countryCode: country,
        enabled: ghostwriterEnabled,
        toneOfVoice: state.toneOfVoice,
    });

    // Quick comment popover state
    const [isAddCommentOpen, setIsAddCommentOpen] = useState(false);
    const [quickCommentText, setQuickCommentText] = useState("");

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

    // Reset to preview (discard local edits)
    const handleResetToPreview = useCallback(() => {
        actions.resetEditorToPreview();
    }, [actions]);

    // Add quick comment
    const handleAddQuickComment = useCallback(() => {
        if (!quickCommentText.trim()) return;
        actions.addComment({
            content: quickCommentText.trim(),
            textSelection: null,
        });
        setQuickCommentText("");
        setIsAddCommentOpen(false);
        // Auto-open sidebar to show the new comment
        if (!showCommentSidebar) {
            actions.toggleCommentSidebar();
        }
    }, [quickCommentText, actions, showCommentSidebar]);

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
        <div className="h-full flex flex-col">
            {/* Unified Toolbar — Workflow Stepper (left) + AI Tools (right) on one line */}
            <div className="flex items-center justify-between px-3 py-2 bg-card/80 dark:bg-[hsl(225_14%_22%/0.8)] backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    {/* Workflow Stepper — integrated inline */}
                    <WorkflowStepper compact />

                    {/* Local edits warning - NUR anzeigen wenn User wirklich manuell editiert hat */}
                    {hasLocalEdits && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50/80 rounded-full">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span className="text-xs text-amber-700">
                                Manuelle Änderungen vorhanden
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleResetToPreview}
                                className="h-6 text-xs text-amber-700 hover:text-amber-800"
                            >
                                Zurücksetzen
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <div className="hidden">
                        {/* Hidden in header, now we show it as floating or keep it here as fallback? Let's just remove from header or keep it hidden. */}
                    </div>

                    {/* Toggle Chat-Assistent Sidebar */}
                    <Button
                        variant={showChatSidebar ? "default" : "outline"}
                        size="sm"
                        onClick={handleToggleChat}
                        className="gap-1.5"
                    >
                        <Sparkles className="w-4 h-4" />
                        KI-Chat
                    </Button>

                    {/* Separator */}
                    <div className="w-px h-4 bg-foreground/10 mx-1.5" />

                    {/* Add comment button with popover */}
                    <Popover open={isAddCommentOpen} onOpenChange={setIsAddCommentOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5"
                                title="Kommentar hinzufügen"
                            >
                                <MessageSquarePlus className="w-4 h-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72" align="end">
                            <div className="space-y-3">
                                <p className="text-sm font-medium">Neuer Kommentar</p>
                                <Textarea
                                    value={quickCommentText}
                                    onChange={(e) => setQuickCommentText(e.target.value)}
                                    placeholder="Kommentar eingeben..."
                                    className="min-h-[80px] text-sm resize-none"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setQuickCommentText("");
                                            setIsAddCommentOpen(false);
                                        }}
                                    >
                                        Abbrechen
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleAddQuickComment}
                                        disabled={!quickCommentText.trim()}
                                    >
                                        Hinzufügen
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Toggle comment sidebar */}
                    <Button
                        variant={showCommentSidebar ? "secondary" : "ghost"}
                        size="sm"
                        onClick={handleToggleComments}
                        className="gap-1.5"
                        title={showCommentSidebar ? "Kommentare ausblenden" : "Kommentare einblenden"}
                    >
                        <MessagesSquare className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Editor Container - A4 Paper on subtle canvas */}
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
                        {/* Compliance Risk Banner — only show after user has started filling form
                            (at least 3 fields filled) to avoid "screaming at an empty room" */}
                        {hasFilledFields && (
                            <ComplianceRiskBanner
                                contentHtml={displayContent}
                                countryCode={country}
                                className="mb-4"
                            />
                        )}

                        {/* Consistency Banner — only after user has started filling */}
                        {hasFilledFields && employeeName && displayContent && (
                            <ConsistencyBanner
                                employeeName={employeeName}
                                currentFormData={state.formData as unknown as Record<string, unknown>}
                                countryCode={country}
                                documentTypeId={state.documentTypeId ?? undefined}
                                className="mb-4"
                            />
                        )}

                        {/* Gap Analysis — proactive completeness check */}
                        {hasFilledFields && state.documentTypeId && (
                            <GapAnalysisCard
                                documentTypeId={state.documentTypeId}
                                countryCode={country}
                                enabledClauseIds={state.documentClauses.filter(c => c.is_enabled).map(c => c.id)}
                                formData={state.formData as unknown as Record<string, unknown>}
                                documentTitle={state.documentTitle}
                                onAddClause={(clauseId) => {
                                    const clause = state.documentClauses.find(c => c.id === clauseId);
                                    if (clause) actions.toggleClause(clause.unique_id);
                                }}
                                className="mb-4"
                            />
                        )}

                        {/* Ghostwriter Draft Suggestion */}
                        {(ghostwriter.draftHtml || ghostwriter.isStreaming) && !ghostwriter.isDismissed && (
                            <GhostwriterCard
                                draftHtml={ghostwriter.draftHtml}
                                isStreaming={ghostwriter.isStreaming}
                                streamedText={ghostwriter.streamedText}
                                isGenerating={ghostwriter.isGenerating}
                                error={ghostwriter.error}
                                onAccept={() => {
                                    const html = ghostwriter.accept();
                                    if (editorRef.current && html) {
                                        const currentContent = editorRef.current.getContent();
                                        editorRef.current.setContent(html + currentContent);
                                        actions.setEditorContent(editorRef.current.getContent(), true);
                                    }
                                }}
                                onDismiss={ghostwriter.dismiss}
                                onRegenerate={ghostwriter.regenerate}
                                className="mb-4"
                            />
                        )}

                        {/* Post-Export Success Banner */}
                        {state.hasExported && state.lastExportedDocumentId && (
                            <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 space-y-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <span className="font-medium text-green-900 text-sm">Dokument erfolgreich generiert!</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5"
                                        onClick={() => window.open(`/api/v1/repository/${state.lastExportedDocumentId}/download`, "_blank")}
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Herunterladen
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={() => navigate(`/documents/${state.lastExportedDocumentId}?tab=freigabe`)}
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        Zur Freigabe senden
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="gap-1.5 ml-auto"
                                        onClick={() => navigate(`/documents/${state.lastExportedDocumentId}`)}
                                    >
                                        In Bibliothek öffnen
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Tone Preview Banner */}
                        {tonePreview && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs mb-4">
                                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 shrink-0 ${tonePreview.isStreaming ? "animate-spin" : ""}`} />
                                <span className="text-blue-700 flex-1">
                                    Vorschau: „{tonePreview.toneLabel}" Tonalität
                                </span>
                                <Button
                                    size="sm"
                                    onClick={handleAcceptTonePreview}
                                    disabled={tonePreview.isStreaming}
                                    className="h-6 gap-1 text-[10px] bg-blue-600 hover:bg-blue-700"
                                >
                                    <Check className="w-3 h-3" />
                                    Übernehmen
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleRevertTonePreview}
                                    className="h-6 gap-1 text-[10px] border-blue-300 text-blue-700 hover:bg-blue-100"
                                >
                                    <Undo2 className="w-3 h-3" />
                                    Original
                                </Button>
                            </div>
                        )}

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
