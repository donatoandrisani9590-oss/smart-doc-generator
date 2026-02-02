/**
 * CommentThread - Kommentar-Thread Komponente
 *
 * Features:
 * - Thread-basierte Kommentare (Google Docs Style)
 * - @Mentions mit Autocomplete
 * - Resolve/Unresolve Threads
 * - Inline-Replies
 * - Optimistic UI Updates
 *
 * Verwendung:
 * <CommentThread
 *   anchorType="document"
 *   anchorId={docId}
 *   onCommentCountChange={(count) => setBadgeCount(count)}
 * />
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare,
    Send,
    MoreVertical,
    Check,
    CheckCheck,
    Trash2,
    Edit3,
    Reply,
    Loader2,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { MentionInput } from "./MentionInput";
import { useComments, useCreateComment, useResolveComment, useDeleteComment } from "@/hooks/useComments";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CommentAuthor {
    id: number;
    email: string;
    name?: string;
    avatar_url?: string;
}

export interface Comment {
    id: number;
    anchor_type: string;
    anchor_id: number;
    parent_id?: number | null;
    content: string;
    is_resolved: boolean;
    resolved_at?: string | null;
    created_at: string;
    updated_at?: string | null;
    author?: CommentAuthor | null;
    reply_count: number;
}

export interface CommentThread {
    root: Comment;
    replies: Comment[];
    total_replies: number;
}

export interface CommentThreadProps {
    anchorType: "document" | "draft" | "clause_instance" | "clause";
    anchorId: number;
    onCommentCountChange?: (count: number) => void;
    className?: string;
    /** Kompakter Modus für Sidebars */
    compact?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════════════════════

const getInitials = (email: string): string => {
    const name = email.split("@")[0];
    return name.slice(0, 2).toUpperCase();
};

const getAvatarColor = (email: string): string => {
    const colors = [
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-orange-500",
        "bg-pink-500",
        "bg-indigo-500",
        "bg-teal-500",
    ];
    const index = email.charCodeAt(0) % colors.length;
    return colors[index];
};

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE COMMENT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface SingleCommentProps {
    comment: Comment;
    isReply?: boolean;
    onReply?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onResolve?: () => void;
    isResolvable?: boolean;
    currentUserId?: number;
}

const SingleComment = ({
    comment,
    isReply = false,
    onReply,
    onEdit,
    onDelete,
    onResolve,
    isResolvable = false,
    currentUserId,
}: SingleCommentProps) => {
    const isAuthor = comment.author?.id === currentUserId;
    const authorEmail = comment.author?.email || "Unbekannt";

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
                "group relative",
                isReply && "ml-8 mt-2"
            )}
        >
            <div className={cn(
                "flex gap-3 p-3 rounded-lg transition-colors",
                comment.is_resolved ? "bg-green-50/50" : "hover:bg-muted/50"
            )}>
                {/* Avatar */}
                <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={cn("text-white text-xs", getAvatarColor(authorEmail))}>
                        {getInitials(authorEmail)}
                    </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                            {authorEmail.split("@")[0]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(comment.created_at)}
                        </span>
                        {comment.is_resolved && (
                            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                                <CheckCheck className="w-3 h-3" />
                                Gelöst
                            </span>
                        )}
                    </div>

                    {/* Comment Text with @mention highlighting */}
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {comment.content.split(/(@\w+(?:\.\w+)?|@\[[^\]]+\])/).map((part, i) => {
                            if (part.startsWith("@")) {
                                return (
                                    <span
                                        key={i}
                                        className="text-primary font-medium bg-primary/10 px-1 rounded"
                                    >
                                        {part}
                                    </span>
                                );
                            }
                            return part;
                        })}
                    </p>

                    {/* Reply count for root comments */}
                    {!isReply && comment.reply_count > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            {comment.reply_count} {comment.reply_count === 1 ? "Antwort" : "Antworten"}
                        </div>
                    )}
                </div>

                {/* Actions - show on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {onReply && (
                                <DropdownMenuItem onClick={onReply}>
                                    <Reply className="w-4 h-4 mr-2" />
                                    Antworten
                                </DropdownMenuItem>
                            )}
                            {isResolvable && onResolve && (
                                <DropdownMenuItem onClick={onResolve}>
                                    {comment.is_resolved ? (
                                        <>
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Wieder öffnen
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 mr-2" />
                                            Als gelöst markieren
                                        </>
                                    )}
                                </DropdownMenuItem>
                            )}
                            {isAuthor && onEdit && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={onEdit}>
                                        <Edit3 className="w-4 h-4 mr-2" />
                                        Bearbeiten
                                    </DropdownMenuItem>
                                </>
                            )}
                            {isAuthor && onDelete && (
                                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Löschen
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// THREAD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ThreadProps {
    thread: CommentThread;
    onResolve: (commentId: number, isResolved: boolean) => void;
    onDelete: (commentId: number) => void;
    onReply: (parentId: number, content: string) => void;
    currentUserId?: number;
    isSubmitting?: boolean;
}

const Thread = ({
    thread,
    onResolve,
    onDelete,
    onReply,
    currentUserId,
    isSubmitting,
}: ThreadProps) => {
    const [isExpanded, setIsExpanded] = useState(!thread.root.is_resolved);
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyContent, setReplyContent] = useState("");

    const handleSubmitReply = () => {
        if (!replyContent.trim()) return;
        onReply(thread.root.id, replyContent);
        setReplyContent("");
        setShowReplyInput(false);
    };

    return (
        <div className={cn(
            "border rounded-xl overflow-hidden transition-colors",
            thread.root.is_resolved ? "border-green-200 bg-green-50/30" : "border-border"
        )}>
            {/* Root Comment */}
            <SingleComment
                comment={thread.root}
                isResolvable={true}
                onReply={() => setShowReplyInput(true)}
                onResolve={() => onResolve(thread.root.id, !thread.root.is_resolved)}
                onDelete={() => onDelete(thread.root.id)}
                currentUserId={currentUserId}
            />

            {/* Replies */}
            {thread.replies.length > 0 && (
                <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                    <CollapsibleTrigger asChild>
                        <button
                            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:bg-muted/50 border-t transition-colors"
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="w-3 h-3" />
                                    Antworten ausblenden
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-3 h-3" />
                                    {thread.replies.length} {thread.replies.length === 1 ? "Antwort" : "Antworten"} anzeigen
                                </>
                            )}
                        </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="border-t px-3 pb-3">
                            <AnimatePresence>
                                {thread.replies.map((reply) => (
                                    <SingleComment
                                        key={reply.id}
                                        comment={reply}
                                        isReply={true}
                                        onDelete={() => onDelete(reply.id)}
                                        currentUserId={currentUserId}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}

            {/* Reply Input */}
            {showReplyInput && (
                <div className="border-t p-3 bg-muted/30">
                    <MentionInput
                        value={replyContent}
                        onChange={setReplyContent}
                        placeholder="Antwort schreiben... (@name für Erwähnung)"
                        className="mb-2"
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setShowReplyInput(false);
                                setReplyContent("");
                            }}
                        >
                            Abbrechen
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSubmitReply}
                            disabled={!replyContent.trim() || isSubmitting}
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4 mr-2" />
                            )}
                            Antworten
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const CommentThread = ({
    anchorType,
    anchorId,
    onCommentCountChange,
    className,
    compact: _compact = false,
}: CommentThreadProps) => {
    // Note: _compact is reserved for future compact mode styling
    const [newComment, setNewComment] = useState("");
    const [showNewInput, setShowNewInput] = useState(false);

    // API Hooks
    const { data, isLoading, refetch } = useComments(anchorType, anchorId);
    const createComment = useCreateComment();
    const resolveComment = useResolveComment();
    const deleteComment = useDeleteComment();

    // Notify parent about comment count
    useEffect(() => {
        if (data && onCommentCountChange) {
            onCommentCountChange(data.total);
        }
    }, [data?.total, onCommentCountChange]);

    // TODO: Get from auth context
    const currentUserId = 1;

    const handleCreateComment = async () => {
        if (!newComment.trim()) return;

        try {
            await createComment.mutateAsync({
                anchor_type: anchorType,
                anchor_id: anchorId,
                content: newComment,
            });
            setNewComment("");
            setShowNewInput(false);
            refetch();
        } catch (error) {
            console.error("Failed to create comment:", error);
        }
    };

    const handleReply = async (parentId: number, content: string) => {
        try {
            await createComment.mutateAsync({
                anchor_type: anchorType,
                anchor_id: anchorId,
                parent_id: parentId,
                content,
            });
            refetch();
        } catch (error) {
            console.error("Failed to create reply:", error);
        }
    };

    const handleResolve = async (commentId: number, isResolved: boolean) => {
        try {
            await resolveComment.mutateAsync({ commentId, isResolved });
            refetch();
        } catch (error) {
            console.error("Failed to resolve comment:", error);
        }
    };

    const handleDelete = async (commentId: number) => {
        if (!confirm("Kommentar wirklich löschen?")) return;

        try {
            await deleteComment.mutateAsync(commentId);
            refetch();
        } catch (error) {
            console.error("Failed to delete comment:", error);
        }
    };

    const threads = data?.comments || [];
    const unresolvedCount = data?.unresolved_count || 0;

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Kommentare</h3>
                    {unresolvedCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                            {unresolvedCount}
                        </span>
                    )}
                </div>
                <Button
                    size="sm"
                    onClick={() => setShowNewInput(true)}
                    className="gap-2"
                >
                    <MessageSquare className="w-4 h-4" />
                    Kommentar
                </Button>
            </div>

            {/* New Comment Input */}
            <AnimatePresence>
                {showNewInput && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-b overflow-hidden"
                    >
                        <div className="p-4">
                            <MentionInput
                                value={newComment}
                                onChange={setNewComment}
                                placeholder="Kommentar schreiben... (@name für Erwähnung)"
                                className="mb-3"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowNewInput(false);
                                        setNewComment("");
                                    }}
                                >
                                    Abbrechen
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleCreateComment}
                                    disabled={!newComment.trim() || createComment.isPending}
                                >
                                    {createComment.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4 mr-2" />
                                    )}
                                    Kommentieren
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : threads.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                            <MessageSquare className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">Noch keine Kommentare</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Starten Sie die Diskussion
                        </p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {threads.map((thread) => (
                            <Thread
                                key={thread.root.id}
                                thread={thread}
                                onResolve={handleResolve}
                                onDelete={handleDelete}
                                onReply={handleReply}
                                currentUserId={currentUserId}
                                isSubmitting={createComment.isPending}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default CommentThread;
