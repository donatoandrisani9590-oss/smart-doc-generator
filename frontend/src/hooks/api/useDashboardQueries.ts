/**
 * Dashboard API Hooks
 * STATISTICS / DASHBOARD + FAVORITES + GLOBAL SEARCH + NOTIFICATIONS + AUDIT LOG + BULK GENERATION
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

const API_BASE = "/api/v1";

// Use apiFetch for all API calls to automatically include auth token
const fetch = apiFetch;

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS / DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export interface DocumentTypeStats {
    document_type_id: number;
    document_type_name: string;
    count: number;
    percentage: number;
}

export interface DashboardStats {
    documents_this_month: number;
    documents_total: number;
    open_drafts: number;
    bulk_jobs_this_month: number;
    bulk_documents_this_month: number;
    documents_change_percent: number | null;
    top_document_types: DocumentTypeStats[];
    unused_clause_count: number;
    team_document_count: number | null;
    team_draft_count: number | null;
}

export interface RecentDocument {
    id: number;
    document_type_id: number;
    document_type_name: string;
    created_at: string | null;
    employee_name: string | null;
}

export interface RecentDraft {
    id: number;
    document_type_id: number;
    document_type_name: string;
    updated_at: string | null;
    name: string | null;
}

export interface MyActivity {
    recent_documents: RecentDocument[];
    recent_drafts: RecentDraft[];
}

export const useDashboardStats = (countryCode?: string) => {
    return useQuery({
        queryKey: ["dashboard-stats", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/statistics/dashboard${params}`);
            if (!res.ok) throw new Error("Failed to fetch dashboard stats");
            return res.json() as Promise<DashboardStats>;
        },
        staleTime: 1000 * 60, // 1 minute
    });
};

export const useMyActivity = (limit: number = 10) => {
    return useQuery({
        queryKey: ["my-activity", limit],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/statistics/my-activity?limit=${limit}`);
            if (!res.ok) throw new Error("Failed to fetch activity");
            return res.json() as Promise<MyActivity>;
        },
        staleTime: 1000 * 30, // 30 seconds
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════════════════════════════════════════

export interface Favorite {
    id: number;
    favorite_type: "document_type" | "document";
    document_type_id: number | null;
    document_id: number | null;
    display_name: string | null;
    display_order: number;
    resolved_name: string;
    category: string | null;
}

export interface ToggleFavoriteRequest {
    favorite_type: "document_type" | "document";
    document_type_id?: number;
    document_id?: number;
    display_name?: string;
}

export const useFavorites = (favoriteType?: "document_type" | "document") => {
    return useQuery({
        queryKey: ["favorites", favoriteType],
        queryFn: async () => {
            const params = favoriteType ? `?favorite_type=${favoriteType}` : "";
            const res = await fetch(`${API_BASE}/favorites${params}`);
            if (!res.ok) throw new Error("Failed to fetch favorites");
            return res.json() as Promise<Favorite[]>;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useToggleFavorite = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (request: ToggleFavoriteRequest) => {
            const res = await fetch(`${API_BASE}/favorites/toggle`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(request),
            });
            if (!res.ok) throw new Error("Failed to toggle favorite");
            return res.json() as Promise<{ is_favorite: boolean; action: string; id?: number }>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["favorites"] });
        },
    });
};

export const useRemoveFavorite = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (favoriteId: number) => {
            const res = await fetch(`${API_BASE}/favorites/${favoriteId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to remove favorite");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["favorites"] });
        },
    });
};

export const useCheckFavorite = (favoriteType: string, itemId: number) => {
    return useQuery({
        queryKey: ["favorite-check", favoriteType, itemId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/favorites/check/${favoriteType}/${itemId}`);
            if (!res.ok) throw new Error("Failed to check favorite");
            return res.json() as Promise<{ is_favorite: boolean }>;
        },
        enabled: !!itemId,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════════════════

export interface SearchResult {
    id: number;
    result_type: "document" | "draft";
    document_type_name: string;
    employee_name: string | null;
    created_at: string | null;
    updated_at: string | null;
    status: "final" | "draft";
    relevance_score: number;
}

export interface SearchResponse {
    query: string;
    total_results: number;
    results: SearchResult[];
    search_time_ms: number;
}

export const useGlobalSearch = (query: string, options?: {
    countryCode?: string;
    resultType?: "document" | "draft";
    limit?: number;
    enabled?: boolean;
}) => {
    const enabled = options?.enabled !== false && query.trim().length >= 2;

    return useQuery({
        queryKey: ["global-search", query, options?.countryCode, options?.resultType],
        queryFn: async () => {
            const params = new URLSearchParams({ q: query });
            if (options?.countryCode) params.append("country_code", options.countryCode);
            if (options?.resultType) params.append("result_type", options.resultType);
            if (options?.limit) params.append("limit", String(options.limit));

            const res = await fetch(`${API_BASE}/search?${params}`);
            if (!res.ok) throw new Error("Search failed");
            return res.json() as Promise<SearchResponse>;
        },
        enabled,
        staleTime: 1000 * 30, // 30 seconds
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// BULK GENERATION
// ═══════════════════════════════════════════════════════════════════════════

export interface BulkFieldError {
    row: number;
    column: string;
    value: string;
    error: string;
}

export interface BulkValidationResult {
    is_valid: boolean;
    row_count: number;
    column_count: number;
    errors: string[];
    warnings: string[];
    field_errors: BulkFieldError[];
    preview_data: Record<string, unknown>[];
    detected_columns: string[];
    missing_required_columns: string[];
    unknown_columns: string[];
}

export interface BulkJob {
    id: number;
    status: "pending" | "processing" | "completed" | "failed" | "cancelled";
    total: number;
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
    download_ready: boolean;
    result_file_path: string | null;
    created_at: string;
}

export const useBulkJobs = () => {
    return useQuery({
        queryKey: ["bulk-jobs"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/bulk/jobs`);
            if (!res.ok) throw new Error("Failed to fetch bulk jobs");
            return res.json() as Promise<BulkJob[]>;
        },
    });
};

export const useBulkJobStatus = (jobId: string | number, enabled: boolean) => {
    return useQuery({
        queryKey: ["bulk-job", jobId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/bulk/jobs/${jobId}`);
            if (!res.ok) throw new Error("Failed to fetch job status");
            return res.json() as Promise<BulkJob>;
        },
        enabled: enabled && !!jobId,
        refetchInterval: 2000, // Poll every 2 seconds for progress
    });
};

export const useValidateBulkUpload = () => {
    return useMutation({
        mutationFn: async ({ documentTypeId, file }: { documentTypeId: number; file: File }) => {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(`${API_BASE}/bulk/validate?document_type_id=${documentTypeId}`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Validation failed" }));
                throw new Error(error.detail || "Failed to validate file");
            }
            return res.json() as Promise<BulkValidationResult>;
        },
    });
};

export const useStartBulkGeneration = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            documentTypeId,
            file,
            outputFormat = "pdf",
        }: {
            documentTypeId: number;
            file: File;
            outputFormat?: "pdf" | "docx";
        }) => {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(
                `${API_BASE}/bulk/generate?document_type_id=${documentTypeId}&output_format=${outputFormat}`,
                {
                    method: "POST",
                    body: formData,
                }
            );
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Generation failed" }));
                throw new Error(error.detail || "Failed to start bulk generation");
            }
            return res.json() as Promise<{ job_id: number; status: string; total_records: number }>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
        },
    });
};

export const useCancelBulkJob = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (jobId: number) => {
            const res = await fetch(`${API_BASE}/bulk/jobs/${jobId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to cancel job");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
        },
    });
};

export const getBulkTemplateUrl = (documentTypeId: number, format: "csv" | "xlsx" = "csv") => {
    return `${API_BASE}/bulk/templates/${documentTypeId}?format=${format}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG (15.5.5)
// ═══════════════════════════════════════════════════════════════════════════

export interface AuditLogEntry {
    id: number;
    timestamp: string;
    user_id: string;
    user_email: string | null;
    user_name: string | null;
    action: string;
    action_category: string;
    entity_type: string | null;
    entity_id: number | null;
    entity_name: string | null;
    description: string | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    country_code: string | null;
    status: string;
}

export interface AuditLogListResponse {
    items: AuditLogEntry[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface AuditLogStats {
    total_entries: number;
    entries_today: number;
    entries_this_week: number;
    entries_this_month: number;
    by_category: Record<string, number>;
    by_action: Record<string, number>;
    by_user: Array<{ user_id: string; user_name: string; count: number }>;
    recent_errors: Array<{
        id: number;
        timestamp: string;
        action: string;
        user_id: string;
        error_message: string | null;
        entity_name: string | null;
    }>;
}

export interface AuditLogFilters {
    page?: number;
    page_size?: number;
    action_category?: string;
    action?: string;
    user_id?: string;
    entity_type?: string;
    entity_id?: number;
    country_code?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
}

export const useAuditLogs = (filters: AuditLogFilters = {}) => {
    return useQuery({
        queryKey: ["audit-logs", filters],
        queryFn: async () => {
            const params = new URLSearchParams();

            if (filters.page) params.append("page", String(filters.page));
            if (filters.page_size) params.append("page_size", String(filters.page_size));
            if (filters.action_category) params.append("action_category", filters.action_category);
            if (filters.action) params.append("action", filters.action);
            if (filters.user_id) params.append("user_id", filters.user_id);
            if (filters.entity_type) params.append("entity_type", filters.entity_type);
            if (filters.entity_id) params.append("entity_id", String(filters.entity_id));
            if (filters.country_code) params.append("country_code", filters.country_code);
            if (filters.status) params.append("status", filters.status);
            if (filters.date_from) params.append("date_from", filters.date_from);
            if (filters.date_to) params.append("date_to", filters.date_to);
            if (filters.search) params.append("search", filters.search);

            const res = await fetch(`${API_BASE}/audit?${params}`);
            if (!res.ok) throw new Error("Failed to fetch audit logs");
            return res.json() as Promise<AuditLogListResponse>;
        },
        staleTime: 1000 * 30, // 30 seconds
    });
};

export const useAuditLogStats = (countryCode?: string, days: number = 30) => {
    return useQuery({
        queryKey: ["audit-stats", countryCode, days],
        queryFn: async () => {
            const params = new URLSearchParams({ days: String(days) });
            if (countryCode) params.append("country_code", countryCode);

            const res = await fetch(`${API_BASE}/audit/stats?${params}`);
            if (!res.ok) throw new Error("Failed to fetch audit stats");
            return res.json() as Promise<AuditLogStats>;
        },
        staleTime: 1000 * 60, // 1 minute
    });
};

export const useAuditLogActions = () => {
    return useQuery({
        queryKey: ["audit-actions"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/audit/actions`);
            if (!res.ok) throw new Error("Failed to fetch action types");
            return res.json() as Promise<Record<string, string[]>>;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const useEntityAuditHistory = (entityType: string, entityId: number, page: number = 1) => {
    return useQuery({
        queryKey: ["entity-audit", entityType, entityId, page],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/audit/entity/${entityType}/${entityId}?page=${page}`);
            if (!res.ok) throw new Error("Failed to fetch entity history");
            return res.json();
        },
        enabled: !!entityType && !!entityId,
    });
};

export const useUserAuditActivity = (userId: string, days: number = 30, page: number = 1) => {
    return useQuery({
        queryKey: ["user-audit", userId, days, page],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/audit/user/${userId}?days=${days}&page=${page}`);
            if (!res.ok) throw new Error("Failed to fetch user activity");
            return res.json();
        },
        enabled: !!userId,
    });
};

export const getAuditExportUrl = (filters: {
    format?: "csv" | "json";
    action_category?: string;
    date_from?: string;
    date_to?: string;
    country_code?: string;
    limit?: number;
}) => {
    const params = new URLSearchParams();
    if (filters.format) params.append("format", filters.format);
    if (filters.action_category) params.append("action_category", filters.action_category);
    if (filters.date_from) params.append("date_from", filters.date_from);
    if (filters.date_to) params.append("date_to", filters.date_to);
    if (filters.country_code) params.append("country_code", filters.country_code);
    if (filters.limit) params.append("limit", String(filters.limit));

    return `${API_BASE}/audit/export?${params}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS (15.5.6)
// ═══════════════════════════════════════════════════════════════════════════

export interface NotificationItem {
    id: number;
    notification_type: string;
    title: string;
    message: string;
    priority: string;
    entity_type: string | null;
    entity_id: number | null;
    action_url: string | null;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
}

export interface NotificationListResponse {
    notifications: NotificationItem[];
    total: number;
    unread_count: number;
    page: number;
    page_size: number;
}

export interface NotificationPreference {
    id: number;
    notification_type: string;
    in_app_enabled: boolean;
    email_enabled: boolean;
    email_digest: string | null;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
}

export interface NotificationType {
    type: string;
    label: string;
    description: string;
    default_enabled: boolean;
}

export const useNotifications = (page: number = 1, unreadOnly: boolean = false) => {
    return useQuery({
        queryKey: ["notifications", page, unreadOnly],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: String(page),
                unread_only: String(unreadOnly),
            });
            const res = await fetch(`${API_BASE}/notifications?${params}`);
            if (!res.ok) throw new Error("Failed to fetch notifications");
            return res.json() as Promise<NotificationListResponse>;
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // Refetch every minute
    });
};

export const useUnreadCount = () => {
    return useQuery({
        queryKey: ["notification-count"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/notifications/count`);
            if (!res.ok) throw new Error("Failed to fetch unread count");
            return res.json() as Promise<{ unread_count: number }>;
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // Refetch every minute
    });
};

export const useMarkAsRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationId: number) => {
            const res = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to mark as read");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        },
    });
};

export const useMarkAllAsRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const res = await fetch(`${API_BASE}/notifications/read-all`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to mark all as read");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        },
    });
};

export const useDismissNotification = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationId: number) => {
            const res = await fetch(`${API_BASE}/notifications/${notificationId}/dismiss`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to dismiss notification");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        },
    });
};

export const useNotificationTypes = () => {
    return useQuery({
        queryKey: ["notification-types"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/notifications/types`);
            if (!res.ok) throw new Error("Failed to fetch notification types");
            return res.json() as Promise<{ types: NotificationType[] }>;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const useNotificationPreferences = () => {
    return useQuery({
        queryKey: ["notification-preferences"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/notifications/preferences`);
            if (!res.ok) throw new Error("Failed to fetch preferences");
            return res.json() as Promise<NotificationPreference[]>;
        },
    });
};

export const useUpdateNotificationPreference = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            notificationType,
            data,
        }: {
            notificationType: string;
            data: Partial<NotificationPreference>;
        }) => {
            const res = await fetch(`${API_BASE}/notifications/preferences/${notificationType}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update preference");
            return res.json() as Promise<NotificationPreference>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
        },
    });
};
