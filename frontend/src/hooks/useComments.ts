/**
 * useComments - React Query Hooks für das Comment-System
 *
 * Hooks:
 * - useComments: Lädt alle Kommentare für eine Entität
 * - useCreateComment: Erstellt neuen Kommentar
 * - useResolveComment: Markiert Thread als gelöst
 * - useDeleteComment: Löscht Kommentar
 * - useMentionSuggestions: Autocomplete für @mentions
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CommentAuthor {
    id: number;
    email: string;
    name?: string;
    avatar_url?: string;
}

export interface CommentMention {
    id: number;
    mentioned_user_id: number;
    mentioned_user_email?: string;
    mentioned_user_name?: string;
    seen_at?: string | null;
}

export interface Comment {
    id: number;
    anchor_type: string;
    anchor_id: number;
    parent_id?: number | null;
    content: string;
    content_html?: string | null;
    is_resolved: boolean;
    resolved_at?: string | null;
    created_at: string;
    updated_at?: string | null;
    author?: CommentAuthor | null;
    mentions: CommentMention[];
    reply_count: number;
}

export interface CommentThread {
    root: Comment;
    replies: Comment[];
    total_replies: number;
}

export interface CommentListResponse {
    comments: CommentThread[];
    total: number;
    unresolved_count: number;
}

export interface CreateCommentRequest {
    anchor_type: string;
    anchor_id: number;
    parent_id?: number;
    content: string;
}

export interface UserSuggestion {
    id: number;
    email: string;
    name?: string;
    avatar_url?: string;
}

export interface ActivityEvent {
    id: number;
    event_type: string;
    actor_name?: string;
    entity_type: string;
    entity_id: number;
    entity_name?: string;
    description?: string;
    created_at: string;
}

export interface ActivityFeedResponse {
    events: ActivityEvent[];
    total: number;
    has_more: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════════════

export const commentKeys = {
    all: ["comments"] as const,
    list: (anchorType: string, anchorId: number) =>
        [...commentKeys.all, "list", anchorType, anchorId] as const,
    mentions: (query: string) =>
        [...commentKeys.all, "mentions", query] as const,
    activity: (entityType: string, entityId: number) =>
        [...commentKeys.all, "activity", entityType, entityId] as const,
};

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lädt alle Kommentare für eine Entität
 */
export function useComments(
    anchorType: string,
    anchorId: number,
    options?: {
        includeResolved?: boolean;
        enabled?: boolean;
    }
) {
    const includeResolved = options?.includeResolved ?? true;
    const enabled = options?.enabled ?? true;

    return useQuery({
        queryKey: commentKeys.list(anchorType, anchorId),
        queryFn: async (): Promise<CommentListResponse> => {
            const response = await api.get<CommentListResponse>(
                `/api/v1/comments/${anchorType}/${anchorId}`,
                { params: { include_resolved: includeResolved } }
            );
            return response.data;
        },
        staleTime: 30 * 1000, // 30 Sekunden
        refetchInterval: enabled ? 60 * 1000 : false, // Alle 60 Sekunden refreshen (für "Near-Realtime")
        enabled: enabled && anchorId > 0,
    });
}

/**
 * Erstellt einen neuen Kommentar oder Antwort
 */
export function useCreateComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateCommentRequest): Promise<Comment> => {
            const response = await api.post<Comment>("/api/v1/comments/", data);
            return response.data;
        },
        onSuccess: (_, variables) => {
            // Invalidiere die Kommentar-Liste
            queryClient.invalidateQueries({
                queryKey: commentKeys.list(variables.anchor_type, variables.anchor_id),
            });
        },
    });
}

/**
 * Aktualisiert einen Kommentar
 */
export function useUpdateComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            commentId,
            content,
        }: {
            commentId: number;
            content: string;
        }): Promise<Comment> => {
            const response = await api.put<Comment>(`/api/v1/comments/${commentId}`, {
                content,
            });
            return response.data;
        },
        onSuccess: () => {
            // Invalidiere alle Kommentar-Listen
            queryClient.invalidateQueries({
                queryKey: commentKeys.all,
            });
        },
    });
}

/**
 * Markiert einen Kommentar-Thread als gelöst/ungelöst
 */
export function useResolveComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            commentId,
            isResolved,
        }: {
            commentId: number;
            isResolved: boolean;
        }): Promise<{ message: string; id: number; is_resolved: boolean }> => {
            const response = await api.post<{ message: string; id: number; is_resolved: boolean }>(`/api/v1/comments/${commentId}/resolve`, {
                is_resolved: isResolved,
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: commentKeys.all,
            });
        },
    });
}

/**
 * Löscht einen Kommentar (Soft Delete)
 */
export function useDeleteComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (commentId: number): Promise<{ message: string; id: number }> => {
            const response = await api.delete<{ message: string; id: number }>(`/api/v1/comments/${commentId}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: commentKeys.all,
            });
        },
    });
}

/**
 * Autocomplete für @mentions
 */
export function useMentionSuggestions(
    query: string,
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: commentKeys.mentions(query),
        queryFn: async (): Promise<UserSuggestion[]> => {
            if (!query || query.length < 1) return [];

            const response = await api.get<UserSuggestion[]>(
                "/api/v1/comments/mentions/suggest",
                { params: { query, limit: 10 } }
            );
            return response.data;
        },
        enabled: query.length >= 1,
        staleTime: 5 * 60 * 1000, // 5 Minuten cachen
        ...options,
    });
}

/**
 * Activity Feed für eine Entität
 */
export function useActivityFeed(
    entityType: string,
    entityId: number,
    options?: { limit?: number; offset?: number }
) {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    return useQuery({
        queryKey: commentKeys.activity(entityType, entityId),
        queryFn: async (): Promise<ActivityFeedResponse> => {
            const response = await api.get<ActivityFeedResponse>(
                `/api/v1/comments/activity/${entityType}/${entityId}`,
                { params: { limit, offset } }
            );
            return response.data;
        },
        staleTime: 30 * 1000,
    });
}

/**
 * Kommentar-Count für Badge
 */
export function useCommentCount(anchorType: string, anchorId: number) {
    const { data } = useComments(anchorType, anchorId);
    return {
        total: data?.total ?? 0,
        unresolved: data?.unresolved_count ?? 0,
    };
}
