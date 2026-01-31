/**
 * CommentSidebar - Apple Pages-ähnliche Kommentar-Seitenleiste
 *
 * Features:
 * - Liste aller Kommentare
 * - Neuen Kommentar hinzufügen
 * - Kommentare auflösen/wiedereröffnen
 * - Antworten auf Kommentare (Phase 5)
 */

import { useState } from "react";
import { Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWizardContext } from "../WizardContext";
import { CommentThread } from "./CommentThread";

export const CommentSidebar = () => {
    const { state, actions } = useWizardContext();
    const { comments } = state;

    const [isAddingComment, setIsAddingComment] = useState(false);
    const [newCommentText, setNewCommentText] = useState("");

    // Filter: aktive vs. aufgelöste Kommentare
    const activeComments = comments.filter((c) => !c.resolved);
    const resolvedComments = comments.filter((c) => c.resolved);

    const handleAddComment = () => {
        if (!newCommentText.trim()) return;

        actions.addComment({
            content: newCommentText.trim(),
            // Ohne Text-Selektion - generischer Kommentar
            textSelection: null,
        });

        setNewCommentText("");
        setIsAddingComment(false);
    };

    const handleCancelAdd = () => {
        setNewCommentText("");
        setIsAddingComment(false);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-3 border-b bg-background/95 backdrop-blur">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Kommentare
                        {activeComments.length > 0 && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                {activeComments.length}
                            </span>
                        )}
                    </h3>
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

            {/* Neuer Kommentar Eingabe */}
            {isAddingComment && (
                <div className="p-3 border-b bg-muted/30 space-y-2">
                    <Textarea
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Kommentar eingeben..."
                        className="min-h-[80px] text-sm resize-none"
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
                            disabled={!newCommentText.trim()}
                        >
                            Hinzufügen
                        </Button>
                    </div>
                </div>
            )}

            {/* Kommentar-Liste */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    {/* Aktive Kommentare */}
                    {activeComments.length === 0 && !isAddingComment && (
                        <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Keine Kommentare</p>
                            <p className="text-xs mt-1">
                                Klicken Sie auf +, um einen Kommentar hinzuzufügen.
                            </p>
                        </div>
                    )}

                    {activeComments.map((comment) => (
                        <CommentThread
                            key={comment.id}
                            comment={comment}
                            onResolve={() => actions.resolveComment(comment.id)}
                            onDelete={() => actions.deleteComment(comment.id)}
                            onReply={(text) => actions.addReply(comment.id, text)}
                        />
                    ))}

                    {/* Aufgelöste Kommentare */}
                    {resolvedComments.length > 0 && (
                        <div className="pt-4 mt-4 border-t">
                            <p className="text-xs text-muted-foreground mb-2 px-1">
                                Aufgelöst ({resolvedComments.length})
                            </p>
                            {resolvedComments.map((comment) => (
                                <CommentThread
                                    key={comment.id}
                                    comment={comment}
                                    onReopen={() => actions.reopenComment(comment.id)}
                                    onDelete={() => actions.deleteComment(comment.id)}
                                    isResolved
                                />
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default CommentSidebar;
