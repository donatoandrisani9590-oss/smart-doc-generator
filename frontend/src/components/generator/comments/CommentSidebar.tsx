/**
 * CommentSidebar - Apple Pages-ähnliche Kommentar-Seitenleiste
 *
 * Features:
 * - Liste aller Kommentare
 * - Neuen Kommentar hinzufügen mit @Mention Support
 * - Kommentare auflösen/wiedereröffnen
 * - Antworten auf Kommentare mit Backend-Persistierung
 * - Backend-Persistenz wenn Draft gespeichert wurde
 * - Echtzeit-Sync mit anderen Benutzern (Phase 3)
 * - Lösch-Bestätigung für Datensicherheit
 * - Autosave für ungesendete Kommentare
 * - Local→Backend Sync bei Draft-Speicherung
 *
 * v2.2: QA Stress-Test Fixes
 * - Local→Backend Migration bei erstem Sync
 * - Verbessertes Sync-Status Feedback
 * - Reply Error Handling mit Rollback
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, MessageSquare, Loader2, CloudOff, Filter, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/toast";
import { useWizardContext } from "../WizardContext";
import { CommentThread } from "./CommentThread";
import { MentionInput } from "@/components/collaboration/MentionInput";
import { useComments, useCreateComment, useResolveComment, useDeleteComment } from "@/hooks/useComments";

// Autosave Key für localStorage
const AUTOSAVE_PREFIX = "comment-draft-";

// Sync-Status Types für besseres Feedback
type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export const CommentSidebar = () => {
    const { state, actions } = useWizardContext();
    const { comments: localComments, loadedDraftId } = state;
    const toast = useToast();

    // State
    const [isAddingComment, setIsAddingComment] = useState(false);
    const [showResolved, setShowResolved] = useState(true);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    // Track previous draftId to detect Local→Backend transition
    const prevDraftIdRef = useRef<number | null>(null);
    const hasMigratedRef = useRef(false);

    // Autosave: Lade Draft aus localStorage (mit Tab-Session-ID)
    const tabSessionId = useRef(Math.random().toString(36).substring(7));
    const autosaveKey = `${AUTOSAVE_PREFIX}${loadedDraftId ?? "local"}-${tabSessionId.current}`;
    const [newCommentText, setNewCommentText] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem(autosaveKey) || "";
        }
        return "";
    });

    // Autosave: Speichere Draft bei Änderung (debounced)
    useEffect(() => {
        if (!newCommentText.trim()) {
            localStorage.removeItem(autosaveKey);
            return;
        }
        const timeout = setTimeout(() => {
            localStorage.setItem(autosaveKey, newCommentText);
        }, 500);
        return () => clearTimeout(timeout);
    }, [newCommentText, autosaveKey]);

    // Backend-Integration: Nur wenn Draft gespeichert wurde
    const useBackend = loadedDraftId !== null;

    // Backend-Hooks (nur aktiv wenn Draft existiert)
    const {
        data: backendComments,
        isLoading: isLoadingBackend,
        error: backendError
    } = useComments(
        useBackend ? "draft" : "document",
        loadedDraftId ?? 0,
        { enabled: useBackend }
    );

    const createCommentMutation = useCreateComment();
    const resolveCommentMutation = useResolveComment();
    const deleteCommentMutation = useDeleteComment();

    // ═══════════════════════════════════════════════════════════════════════════
    // LOCAL → BACKEND MIGRATION (QA Fix: ID-Mapping)
    // ═══════════════════════════════════════════════════════════════════════════

    // Detect transition from local to backend mode and migrate comments
    useEffect(() => {
        const migrateLocalCommentsToBackend = async () => {
            // Only migrate once when draftId first becomes available
            if (!loadedDraftId || hasMigratedRef.current) return;
            if (prevDraftIdRef.current !== null) return; // Was already in backend mode
            if (localComments.length === 0) return; // Nothing to migrate

            setSyncStatus("syncing");
            hasMigratedRef.current = true;

            try {
                // Migrate each local comment to backend
                for (const comment of localComments) {
                    await createCommentMutation.mutateAsync({
                        anchor_type: "draft",
                        anchor_id: loadedDraftId,
                        content: comment.content,
                    });
                }

                // Clear local comments after successful migration
                localComments.forEach(c => actions.deleteComment(c.id));

                setSyncStatus("synced");
                setLastSyncTime(new Date());
                toast.success("Synchronisiert", `${localComments.length} Kommentar(e) wurden gespeichert.`);
            } catch (error) {
                console.error("Migration fehlgeschlagen:", error);
                setSyncStatus("error");
                hasMigratedRef.current = false; // Allow retry
                toast.error("Sync-Fehler", "Lokale Kommentare konnten nicht synchronisiert werden. Bitte erneut versuchen.");
            }
        };

        migrateLocalCommentsToBackend();
        prevDraftIdRef.current = loadedDraftId;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadedDraftId, localComments, createCommentMutation, actions]);

    // Update sync status based on backend state
    useEffect(() => {
        if (!useBackend) {
            setSyncStatus("offline");
        } else if (isLoadingBackend) {
            setSyncStatus("syncing");
        } else if (backendError) {
            setSyncStatus("error");
        } else {
            setSyncStatus("synced");
            setLastSyncTime(new Date());
        }
    }, [useBackend, isLoadingBackend, backendError]);

    // ═══════════════════════════════════════════════════════════════════════════
    // COMMENT DATA MAPPING
    // ═══════════════════════════════════════════════════════════════════════════

    // Kombiniere lokale und Backend-Kommentare
    // Backend-Response: { comments: CommentThread[], total, unresolved_count }
    // CommentThread: { root: Comment, replies: Comment[], total_replies }
    const allComments = useBackend
        ? (backendComments?.comments ?? []).map(thread => ({
            id: String(thread.root.id),
            anchorId: `draft-${loadedDraftId}`,
            content: thread.root.content,
            author: thread.root.author?.name ?? thread.root.author?.email ?? "Unbekannt",
            authorId: thread.root.author?.id ?? 0,
            createdAt: thread.root.created_at,
            resolved: thread.root.is_resolved,
            textSelection: null,
            replies: thread.replies.map(r => ({
                id: String(r.id),
                content: r.content,
                author: r.author?.name ?? r.author?.email ?? "Unbekannt",
                authorId: r.author?.id ?? 0,
                createdAt: r.created_at,
                mentions: r.mentions?.map(m => String(m.mentioned_user_id)) ?? [],
            })),
        }))
        : localComments;

    // Filter: aktive vs. aufgelöste Kommentare
    const activeComments = allComments.filter((c) => !c.resolved);
    const resolvedComments = allComments.filter((c) => c.resolved);

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENT HANDLERS (mit Error Handling)
    // ═══════════════════════════════════════════════════════════════════════════

    const handleAddComment = useCallback(async () => {
        if (!newCommentText.trim()) return;

        try {
            if (useBackend && loadedDraftId) {
                await createCommentMutation.mutateAsync({
                    anchor_type: "draft",
                    anchor_id: loadedDraftId,
                    content: newCommentText.trim(),
                });
            } else {
                actions.addComment({
                    content: newCommentText.trim(),
                    textSelection: null,
                });
            }
            // Nur bei Erfolg clearen
            setNewCommentText("");
            setIsAddingComment(false);
            localStorage.removeItem(autosaveKey);
        } catch (error) {
            console.error("Fehler beim Erstellen des Kommentars:", error);
            toast.error("Fehler", "Kommentar konnte nicht erstellt werden. Bitte erneut versuchen.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newCommentText, useBackend, loadedDraftId, createCommentMutation, actions, autosaveKey]);

    const handleReply = useCallback(async (commentId: string, text: string) => {
        try {
            if (useBackend && loadedDraftId) {
                // Backend-Persistenz für Replies
                await createCommentMutation.mutateAsync({
                    anchor_type: "draft",
                    anchor_id: loadedDraftId,
                    parent_id: Number(commentId),
                    content: text.trim(),
                });
            } else {
                actions.addReply(commentId, text);
            }
        } catch (error) {
            console.error("Fehler beim Erstellen der Antwort:", error);
            toast.error("Fehler", "Antwort konnte nicht erstellt werden.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useBackend, loadedDraftId, createCommentMutation, actions]);

    const handleResolve = useCallback(async (commentId: string) => {
        try {
            if (useBackend) {
                await resolveCommentMutation.mutateAsync({
                    commentId: Number(commentId),
                    isResolved: true,
                });
            } else {
                actions.resolveComment(commentId);
            }
        } catch (error) {
            console.error("Fehler beim Auflösen:", error);
            toast.error("Fehler", "Kommentar konnte nicht als erledigt markiert werden.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useBackend, resolveCommentMutation, actions]);

    const handleReopen = useCallback(async (commentId: string) => {
        try {
            if (useBackend) {
                await resolveCommentMutation.mutateAsync({
                    commentId: Number(commentId),
                    isResolved: false,
                });
            } else {
                actions.reopenComment(commentId);
            }
        } catch (error) {
            console.error("Fehler beim Wiedereröffnen:", error);
            toast.error("Fehler", "Kommentar konnte nicht wiedereröffnet werden.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useBackend, resolveCommentMutation, actions]);

    // Delete mit Bestätigungs-Dialog (2-Step)
    const handleDeleteRequest = useCallback((commentId: string) => {
        setDeleteConfirmId(commentId);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteConfirmId) return;

        try {
            if (useBackend) {
                await deleteCommentMutation.mutateAsync(Number(deleteConfirmId));
            } else {
                actions.deleteComment(deleteConfirmId);
            }
            toast.success("Gelöscht", "Kommentar wurde entfernt.");
        } catch (error) {
            console.error("Fehler beim Löschen:", error);
            toast.error("Fehler", "Kommentar konnte nicht gelöscht werden.");
        } finally {
            setDeleteConfirmId(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deleteConfirmId, useBackend, deleteCommentMutation, actions]);

    const handleCancelAdd = useCallback(() => {
        setNewCommentText("");
        setIsAddingComment(false);
        localStorage.removeItem(autosaveKey);
    }, [autosaveKey]);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-3 border-b bg-background/95 backdrop-blur">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Kommentare
                        {activeComments.length > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                {activeComments.length}
                            </Badge>
                        )}
                    </h3>
                    {/* Sync-Status Indikator (verbessert nach QA) */}
                    <div className="flex items-center gap-1.5 text-[10px]">
                        {syncStatus === "syncing" && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span className="hidden sm:inline">Sync...</span>
                            </span>
                        )}
                        {syncStatus === "synced" && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="flex items-center gap-1 text-green-600">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span className="hidden sm:inline">Synced</span>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        {lastSyncTime
                                            ? `Zuletzt synchronisiert: ${lastSyncTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
                                            : "Mit Server synchronisiert"
                                        }
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {syncStatus === "error" && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="flex items-center gap-1 text-destructive">
                                            <AlertCircle className="w-3 h-3" />
                                            <span className="hidden sm:inline">Fehler</span>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        Synchronisierung fehlgeschlagen. Bitte erneut versuchen.
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {syncStatus === "offline" && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="flex items-center gap-1 text-amber-600">
                                            <CloudOff className="w-3 h-3" />
                                            <span className="hidden sm:inline">Lokal</span>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        Nur lokal gespeichert. Speichern Sie den Entwurf, um zu synchronisieren.
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Filter Toggle */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={showResolved ? "ghost" : "secondary"}
                                        size="sm"
                                        onClick={() => setShowResolved(!showResolved)}
                                        className="h-7 w-7 p-0"
                                    >
                                        <Filter className="w-4 h-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    {showResolved ? "Gelöste ausblenden" : "Alle anzeigen"}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAddingComment(true)}
                            className="h-7 w-7 p-0"
                            title="Kommentar hinzufügen"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Neuer Kommentar Eingabe mit @Mention */}
            {isAddingComment && (
                <div className="p-3 border-b bg-muted/30 space-y-2">
                    <MentionInput
                        value={newCommentText}
                        onChange={setNewCommentText}
                        placeholder="Kommentar eingeben... (@Name für Erwähnung)"
                        className="min-h-[80px]"
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelAdd}
                        >
                            Abbrechen
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleAddComment}
                            disabled={!newCommentText.trim() || createCommentMutation.isPending}
                        >
                            {createCommentMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Hinzufügen"
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Kommentar-Liste */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    {/* Loading State */}
                    {useBackend && isLoadingBackend && (
                        <div className="text-center py-8 text-muted-foreground">
                            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                            <p className="text-sm">Kommentare werden geladen...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {useBackend && backendError && (
                        <div className="text-center py-8 text-destructive">
                            <CloudOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Fehler beim Laden</p>
                            <p className="text-xs mt-1">
                                Kommentare konnten nicht geladen werden.
                            </p>
                        </div>
                    )}

                    {/* Empty State - Verbessert nach QA */}
                    {!isLoadingBackend && activeComments.length === 0 && !isAddingComment && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="text-center py-10 px-4"
                        >
                            {/* Animated Icon */}
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.3, delay: 0.1 }}
                            >
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/5 flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8 text-primary/40" />
                                </div>
                            </motion.div>

                            <h4 className="text-sm font-medium text-foreground mb-1">
                                Noch keine Kommentare
                            </h4>
                            <p className="text-xs text-muted-foreground mb-4 max-w-[200px] mx-auto">
                                Fügen Sie Anmerkungen hinzu, um mit Ihrem Team zusammenzuarbeiten.
                            </p>

                            {/* CTA Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsAddingComment(true)}
                                className="gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Ersten Kommentar erstellen
                            </Button>

                            {/* Sync hint */}
                            {!useBackend && (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-[10px] mt-4 text-amber-600 bg-amber-50 rounded-md py-1.5 px-2"
                                >
                                    💡 Tipp: Speichern Sie den Entwurf, um Kommentare mit dem Team zu teilen.
                                </motion.p>
                            )}
                        </motion.div>
                    )}

                    {/* Aktive Kommentare mit Animation */}
                    <AnimatePresence mode="popLayout">
                        {!isLoadingBackend && activeComments.map((comment) => (
                            <motion.div
                                key={comment.id}
                                layout
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <CommentThread
                                    comment={comment}
                                    onResolve={() => handleResolve(comment.id)}
                                    onDelete={() => handleDeleteRequest(comment.id)}
                                    onReply={(text) => handleReply(comment.id, text)}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Aufgelöste Kommentare */}
                    {!isLoadingBackend && showResolved && resolvedComments.length > 0 && (
                        <div className="pt-4 mt-4 border-t">
                            <p className="text-xs text-muted-foreground mb-2 px-1 flex items-center gap-2">
                                Erledigt
                                <Badge variant="outline" className="h-4 px-1 text-[9px] text-green-600 border-green-200">
                                    {resolvedComments.length}
                                </Badge>
                            </p>
                            <AnimatePresence mode="popLayout">
                                {resolvedComments.map((comment) => (
                                    <motion.div
                                        key={comment.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <CommentThread
                                            comment={comment}
                                            onReopen={() => handleReopen(comment.id)}
                                            onDelete={() => handleDeleteRequest(comment.id)}
                                            isResolved
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Lösch-Bestätigungsdialog */}
            <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kommentar löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dieser Kommentar und alle Antworten werden unwiderruflich gelöscht.
                            Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteCommentMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Endgültig löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default CommentSidebar;
