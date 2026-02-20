/**
 * useDocumentApproval - React Query Hooks für den Dokument-Freigabe-Workflow
 *
 * Hooks:
 * - useDocumentApproval: Lädt den aktuellen Freigabe-Status eines Dokuments
 * - useRequestApproval: Erstellt eine Freigabe-Anfrage
 * - useApproveDocument: Genehmigt ein Dokument
 * - useRejectDocument: Lehnt ein Dokument ab
 * - useRequestChanges: Fordert Änderungen an
 * - useResubmitApproval: Reicht erneut ein nach Änderungsanforderung
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ApprovalStatus =
    | "pending_approval"
    | "approved"
    | "changes_requested"
    | "rejected";

export type ApprovalPriority = "low" | "normal" | "high" | "urgent";

export interface DocumentApproval {
    id: number;
    document_id: number;
    status: ApprovalStatus;
    approver_id?: number | null;
    approver_email?: string | null;
    approval_group_id?: number | null;
    approval_group_name?: string | null;
    requested_by_id?: number | null;
    requested_by_email?: string | null;
    requested_at?: string | null;
    decided_at?: string | null;
    decision_comment?: string | null;
    priority: ApprovalPriority;
    due_date?: string | null;
}

export interface ApprovalGroup {
    id: number;
    name: string;
    description?: string | null;
    country_code?: string | null;
    member_count: number;
    is_active: boolean;
}

export interface ApprovalGroupListResponse {
    groups: ApprovalGroup[];
    total: number;
}

export interface DocumentApprovalListResponse {
    approvals: DocumentApproval[];
    total: number;
}

export interface RequestApprovalInput {
    document_id: number;
    approver_id?: number;
    approval_group_id?: number;
    priority?: ApprovalPriority;
    due_date?: string;
    comment?: string;
}

export interface ApprovalDecisionInput {
    comment?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════════════

export const approvalKeys = {
    all: ["document-approvals"] as const,
    byDocument: (documentId: number) =>
        [...approvalKeys.all, "document", documentId] as const,
    pending: (role?: string) =>
        [...approvalKeys.all, "pending", role] as const,
};

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lädt alle Freigaben für ein Dokument.
 * Nutzt den /pending Endpoint mit role=all und filtert clientseitig.
 */
export function useDocumentApproval(
    documentId: number,
    options?: { enabled?: boolean }
) {
    const enabled = options?.enabled ?? true;

    return useQuery({
        queryKey: approvalKeys.byDocument(documentId),
        queryFn: async (): Promise<DocumentApproval | null> => {
            const response = await api.get<DocumentApprovalListResponse>(
                "/api/v1/document-approvals/pending",
                { params: { role: "all" } }
            );
            // Finde die Freigabe für dieses Dokument (neueste zuerst)
            const match = response.data.approvals.find(
                (a) => a.document_id === documentId
            );
            return match ?? null;
        },
        staleTime: 30 * 1000,
        refetchInterval: enabled ? 5 * 60 * 1000 : false, // 5 Min Fallback (SSE übernimmt Real-time)
        enabled: enabled && documentId > 0,
    });
}

/**
 * Erstellt eine neue Freigabe-Anfrage
 */
export function useRequestApproval() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: RequestApprovalInput): Promise<DocumentApproval> => {
            const response = await api.post<DocumentApproval>(
                "/api/v1/document-approvals/request",
                data
            );
            return response.data;
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: approvalKeys.byDocument(result.document_id),
            });
            queryClient.invalidateQueries({
                queryKey: approvalKeys.pending(),
            });
        },
    });
}

/**
 * Genehmigt ein Dokument
 */
export function useApproveDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            approvalId,
            comment,
        }: {
            approvalId: number;
            comment?: string;
        }): Promise<DocumentApproval> => {
            const response = await api.post<DocumentApproval>(
                `/api/v1/document-approvals/${approvalId}/approve`,
                { comment }
            );
            return response.data;
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: approvalKeys.byDocument(result.document_id),
            });
            queryClient.invalidateQueries({
                queryKey: approvalKeys.all,
            });
        },
    });
}

/**
 * Lehnt ein Dokument ab
 */
export function useRejectDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            approvalId,
            comment,
        }: {
            approvalId: number;
            comment: string;
        }): Promise<DocumentApproval> => {
            const response = await api.post<DocumentApproval>(
                `/api/v1/document-approvals/${approvalId}/reject`,
                { comment }
            );
            return response.data;
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: approvalKeys.byDocument(result.document_id),
            });
            queryClient.invalidateQueries({
                queryKey: approvalKeys.all,
            });
        },
    });
}

/**
 * Fordert Änderungen an
 */
export function useRequestChanges() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            approvalId,
            comment,
        }: {
            approvalId: number;
            comment: string;
        }): Promise<DocumentApproval> => {
            const response = await api.post<DocumentApproval>(
                `/api/v1/document-approvals/${approvalId}/request-changes`,
                { comment }
            );
            return response.data;
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: approvalKeys.byDocument(result.document_id),
            });
            queryClient.invalidateQueries({
                queryKey: approvalKeys.all,
            });
        },
    });
}

/**
 * Reicht ein Dokument erneut ein (nach Änderungsanforderung)
 */
export function useResubmitApproval() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            approvalId,
            comment,
        }: {
            approvalId: number;
            comment?: string;
        }): Promise<DocumentApproval> => {
            const response = await api.post<DocumentApproval>(
                `/api/v1/document-approvals/${approvalId}/resubmit`,
                { comment }
            );
            return response.data;
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({
                queryKey: approvalKeys.byDocument(result.document_id),
            });
            queryClient.invalidateQueries({
                queryKey: approvalKeys.all,
            });
        },
    });
}


/**
 * Listet verfügbare Genehmigungsgruppen
 */
export function useApprovalGroups(countryCode?: string) {
    return useQuery({
        queryKey: [...approvalKeys.all, "groups", countryCode],
        queryFn: async (): Promise<ApprovalGroup[]> => {
            const params: Record<string, string> = {};
            if (countryCode) params.country_code = countryCode;
            const response = await api.get<ApprovalGroupListResponse>(
                "/api/v1/document-approvals/groups",
                { params }
            );
            return response.data.groups;
        },
        staleTime: 5 * 60 * 1000, // 5 Minuten
    });
}
