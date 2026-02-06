/**
 * useWizardComments - Comment CRUD operations (Apple Pages Style)
 *
 * Manages in-memory comments with add, delete, resolve, reopen,
 * and reply actions. Comments are persisted via auto-save in the parent.
 */

import { useState, useCallback } from "react";
import type { Comment, AddCommentParams } from "@/components/generator/WizardContext";

// ══════════════════════════════════════════════════════════════════════════════
// PARAMS
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardCommentsParams {
    /** Callback to mark unsaved changes in the parent */
    markUnsaved: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// RETURN TYPE
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardCommentsReturn {
    comments: Comment[];
    setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
    addComment: (params: AddCommentParams) => void;
    deleteComment: (commentId: string) => void;
    resolveComment: (commentId: string) => void;
    reopenComment: (commentId: string) => void;
    addReply: (commentId: string, content: string) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useWizardComments({ markUnsaved }: UseWizardCommentsParams): UseWizardCommentsReturn {
    const [comments, setComments] = useState<Comment[]>([]);

    const addComment = useCallback((params: AddCommentParams) => {
        const newComment: Comment = {
            id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            anchorId: "",
            content: params.content,
            author: "Aktueller Benutzer", // TODO: echten Benutzer aus Auth
            authorId: 1,
            createdAt: new Date().toISOString(),
            resolved: false,
            textSelection: params.textSelection,
            replies: [],
        };
        setComments(prev => [newComment, ...prev]);
        markUnsaved();
    }, [markUnsaved]);

    const deleteComment = useCallback((commentId: string) => {
        setComments(prev => prev.filter(c => c.id !== commentId));
        markUnsaved();
    }, [markUnsaved]);

    const resolveComment = useCallback((commentId: string) => {
        setComments(prev => prev.map(c =>
            c.id === commentId ? { ...c, resolved: true } : c
        ));
        markUnsaved();
    }, [markUnsaved]);

    const reopenComment = useCallback((commentId: string) => {
        setComments(prev => prev.map(c =>
            c.id === commentId ? { ...c, resolved: false } : c
        ));
        markUnsaved();
    }, [markUnsaved]);

    const addReply = useCallback((commentId: string, content: string) => {
        const newReply = {
            id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content,
            author: "Aktueller Benutzer", // TODO: echten Benutzer aus Auth
            authorId: 1,
            createdAt: new Date().toISOString(),
            mentions: [],
        };
        setComments(prev => prev.map(c =>
            c.id === commentId
                ? { ...c, replies: [...c.replies, newReply] }
                : c
        ));
        markUnsaved();
    }, [markUnsaved]);

    return {
        comments,
        setComments,
        addComment,
        deleteComment,
        resolveComment,
        reopenComment,
        addReply,
    };
}
