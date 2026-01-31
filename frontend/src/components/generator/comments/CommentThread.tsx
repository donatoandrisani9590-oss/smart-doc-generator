/**
 * CommentThread - Einzelner Kommentar mit Antworten
 *
 * Apple Pages-ähnliches Design:
 * - Autor und Zeitstempel
 * - Kommentar-Text
 * - Auflösen/Wiedereröffnen Button
 * - Antworten-Thread (Phase 5)
 */

import { useState } from "react";
import { Check, RotateCcw, Trash2, Reply, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Comment } from "../WizardContext";

interface CommentThreadProps {
    comment: Comment;
    onResolve?: () => void;
    onReopen?: () => void;
    onDelete: () => void;
    onReply?: (text: string) => void;
    isResolved?: boolean;
}

export const CommentThread = ({
    comment,
    onResolve,
    onReopen,
    onDelete,
    onReply,
    isResolved = false,
}: CommentThreadProps) => {
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState("");

    const handleSubmitReply = () => {
        if (!replyText.trim() || !onReply) return;
        onReply(replyText.trim());
        setReplyText("");
        setIsReplying(false);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Gerade eben";
        if (diffMins < 60) return `vor ${diffMins} Min.`;
        if (diffHours < 24) return `vor ${diffHours} Std.`;
        if (diffDays < 7) return `vor ${diffDays} Tagen`;

        return date.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    // Initialen aus Autor-Name
    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div
            className={`rounded-lg border p-3 transition-colors ${
                isResolved
                    ? "bg-muted/30 opacity-60"
                    : "bg-background hover:bg-muted/20"
            }`}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                        {getInitials(comment.author)}
                    </div>
                    <div>
                        <p className="text-sm font-medium leading-none">
                            {comment.author}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(comment.createdAt)}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {!isResolved && onResolve && (
                            <DropdownMenuItem onClick={onResolve}>
                                <Check className="w-4 h-4 mr-2" />
                                Als erledigt markieren
                            </DropdownMenuItem>
                        )}
                        {isResolved && onReopen && (
                            <DropdownMenuItem onClick={onReopen}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Wiedereröffnen
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                            onClick={onDelete}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Löschen
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Text-Selektion Referenz (wenn vorhanden) */}
            {comment.textSelection && (
                <div className="mb-2 px-2 py-1 bg-amber-50 border-l-2 border-amber-300 text-xs text-amber-800 italic rounded-r">
                    "{comment.textSelection.text.slice(0, 50)}
                    {comment.textSelection.text.length > 50 ? "..." : ""}"
                </div>
            )}

            {/* Kommentar-Text */}
            <p className={`text-sm ${isResolved ? "line-through" : ""}`}>
                {comment.content}
            </p>

            {/* Antworten */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 pt-3 border-t space-y-2">
                    {comment.replies.map((reply) => (
                        <div key={reply.id} className="pl-3 border-l-2 border-muted">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-medium">
                                    {getInitials(reply.author)}
                                </div>
                                <span className="text-xs font-medium">
                                    {reply.author}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {formatDate(reply.createdAt)}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {reply.content}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Antwort-Eingabe */}
            {!isResolved && (
                <div className="mt-2">
                    {isReplying ? (
                        <div className="space-y-2">
                            <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Antwort eingeben..."
                                className="min-h-[60px] text-xs resize-none"
                                autoFocus
                            />
                            <div className="flex justify-end gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => {
                                        setIsReplying(false);
                                        setReplyText("");
                                    }}
                                >
                                    Abbrechen
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={handleSubmitReply}
                                    disabled={!replyText.trim()}
                                >
                                    Antworten
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground"
                            onClick={() => setIsReplying(true)}
                        >
                            <Reply className="w-3 h-3 mr-1" />
                            Antworten
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

export default CommentThread;
