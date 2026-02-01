/**
 * CommentThread - Einzelner Kommentar mit Antworten
 *
 * Apple Pages-ähnliches Design:
 * - Autor und Zeitstempel
 * - Kommentar-Text mit @Mention Highlighting
 * - Auflösen/Wiedereröffnen Button
 * - Antworten-Thread
 *
 * v2.1: Bug-Fixes für Edge Cases (Invalid Date, Empty Names)
 */

import { useState, useMemo } from "react";
import { Check, RotateCcw, Trash2, Reply, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (Edge-Case-sicher)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formatiert ein Datum relativ zur aktuellen Zeit
 * Handles: Invalid dates, future dates, edge cases
 */
const formatDate = (dateString: string): string => {
    if (!dateString) return "Unbekannt";

    const date = new Date(dateString);

    // Check for invalid date
    if (isNaN(date.getTime())) {
        return "Unbekannt";
    }

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime()); // Keine negativen Werte

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Gerade eben";
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays === 1) return "Gestern";
    if (diffDays < 7) return `vor ${diffDays} Tagen`;

    return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

/**
 * Extrahiert Initialen aus einem Namen
 * Handles: Empty strings, single words, special characters
 */
const getInitials = (name: string): string => {
    if (!name?.trim()) return "??";

    const cleanName = name.trim();
    const parts = cleanName.split(/\s+/).filter(part => part.length > 0);

    if (parts.length === 0) return "??";

    // Einzelner Name: Erste zwei Buchstaben
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    // Mehrere Namen: Erste Buchstaben der ersten zwei Teile
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

/**
 * Rendert Text mit hervorgehobenen @Mentions
 */
const renderContentWithMentions = (content: string): React.ReactNode => {
    const mentionRegex = /@(\w+(?:\.\w+)?(?:@[\w.]+)?)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
        // Text vor dem Match
        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index));
        }
        // @Mention hervorheben
        parts.push(
            <span
                key={match.index}
                className="text-primary font-medium bg-primary/10 px-1 rounded"
            >
                @{match[1]}
            </span>
        );
        lastIndex = match.index + match[0].length;
    }

    // Rest des Textes
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

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

    // Memoize rendered content
    const renderedContent = useMemo(
        () => renderContentWithMentions(comment.content),
        [comment.content]
    );

    return (
        <div
            className={cn(
                "rounded-lg border p-3 transition-all duration-200",
                isResolved
                    ? "bg-muted/20 border-dashed border-muted-foreground/30"
                    : "bg-background hover:bg-muted/10 hover:shadow-sm"
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    {/* Avatar */}
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                        isResolved
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                    )}>
                        {getInitials(comment.author)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none truncate">
                                {comment.author || "Unbekannt"}
                            </p>
                            {isResolved && (
                                <Badge
                                    variant="outline"
                                    className="h-4 px-1 text-[9px] text-green-600 border-green-200 gap-0.5"
                                >
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Erledigt
                                </Badge>
                            )}
                        </div>
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
                            className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                            aria-label="Kommentar-Aktionen"
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {!isResolved && onResolve && (
                            <DropdownMenuItem onClick={onResolve}>
                                <Check className="w-4 h-4 mr-2 text-green-600" />
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
                <div className="mb-2 px-2 py-1 bg-primary/5 border-l-2 border-primary/30 text-xs text-muted-foreground italic rounded-r">
                    "{comment.textSelection.text.slice(0, 50)}
                    {comment.textSelection.text.length > 50 ? "..." : ""}"
                </div>
            )}

            {/* Kommentar-Text mit @Mention Highlighting */}
            <p className={cn(
                "text-sm whitespace-pre-wrap break-words",
                isResolved && "text-muted-foreground"
            )}>
                {renderedContent}
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
