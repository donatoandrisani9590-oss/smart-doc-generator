/**
 * RightEditorPanel - Rechte Seite des Split-Screen Editors
 *
 * Enthält den TinyMCE WYSIWYG Editor mit:
 * - A4-Papier Styling (wie Microsoft Word)
 * - Live-Aktualisierung aus dem Preview
 * - Direkte Bearbeitung möglich (Fett, Listen, etc.)
 * - Toolbar mit Word-ähnlichen Funktionen
 */

import { useState, useCallback } from "react";
import { Loader2, MessageSquarePlus, MessagesSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { useWizardContext } from "../WizardContext";
import { WorkflowStepper } from "../WorkflowStepper";
import { ComplianceRiskBanner } from "../ComplianceRiskBanner";

export const RightEditorPanel = () => {
    const { state, actions } = useWizardContext();
    const {
        previewHtml,
        editorContent,
        hasLocalEdits,
        isPreviewLoading,
        showCommentSidebar,
    } = state;

    // Quick comment popover state
    const [isAddCommentOpen, setIsAddCommentOpen] = useState(false);
    const [quickCommentText, setQuickCommentText] = useState("");

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

    return (
        <div className="h-full flex flex-col">
            {/* Workflow Stepper - zeigt Dokumenten-Lifecycle */}
            <WorkflowStepper />

            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center gap-2">
                    {/* Local edits warning - NUR anzeigen wenn User wirklich manuell editiert hat */}
                    {/* hasLocalEdits wird nur noch bei echten manuellen Änderungen gesetzt */}
                    {hasLocalEdits && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
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

            {/* Editor Container - A4 Paper in gray background */}
            <div className="flex-1 overflow-auto bg-slate-200 p-4 md:p-6">
                {isPreviewLoading && !displayContent ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                            <p className="text-sm text-muted-foreground">Dokument wird geladen...</p>
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto" style={{ maxWidth: "210mm" }}>
                        {/* Compliance Risk Banner - proaktive Risikoerkennung */}
                        <ComplianceRiskBanner
                            contentHtml={displayContent}
                            countryCode="DE"
                            className="mb-4"
                        />

                        {/* A4 Paper Container with shadow */}
                        <div
                            className="bg-white rounded shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
                        >
                            <DocumentEditor
                                value={displayContent}
                                onChange={handleEditorChange}
                                onUserEdit={handleUserEdit}
                                isLoading={isPreviewLoading}
                                className="split-screen-editor"
                                compact
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RightEditorPanel;
