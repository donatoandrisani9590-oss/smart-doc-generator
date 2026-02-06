/**
 * Team API Hooks
 * TEAMS (including Team Members and Team Shares) + TEAM TEMPLATES
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

const API_BASE = "/api/v1";

// Use apiFetch for all API calls to automatically include auth token
const fetch = apiFetch;

// ═══════════════════════════════════════════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════════════════════════════════════════

export interface Team {
    id: number;
    name: string;
    description: string | null;
    country_code: string;
    is_active: boolean;
    allow_member_invites: boolean;
    created_by: string;
    created_at: string;
    member_count: number;
    my_role: "owner" | "admin" | "member" | "viewer" | null;
}

export interface TeamMember {
    id: number;
    user_id: string;
    role: "owner" | "admin" | "member" | "viewer";
    joined_at: string;
    invited_by: string | null;
}

export interface TeamShare {
    id: number;
    document_id: number | null;
    draft_id: number | null;
    can_view: boolean;
    can_edit: boolean;
    can_download: boolean;
    shared_by: string;
    shared_at: string;
    note: string | null;
}

export interface CreateTeamRequest {
    name: string;
    description?: string;
    country_code?: string;
    allow_member_invites?: boolean;
}

export interface UpdateTeamRequest {
    name?: string;
    description?: string;
    is_active?: boolean;
    allow_member_invites?: boolean;
}

export interface AddMemberRequest {
    user_id: string;
    role?: "admin" | "member" | "viewer";
}

export interface ShareDocumentRequest {
    document_id?: number;
    draft_id?: number;
    can_view?: boolean;
    can_edit?: boolean;
    can_download?: boolean;
    note?: string;
}

export const useMyTeams = (countryCode?: string) => {
    return useQuery({
        queryKey: ["teams", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/teams${params}`);
            if (!res.ok) throw new Error("Failed to fetch teams");
            return res.json() as Promise<Team[]>;
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
};

export const useTeam = (teamId: number) => {
    return useQuery({
        queryKey: ["team", teamId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/teams/${teamId}`);
            if (!res.ok) throw new Error("Failed to fetch team");
            return res.json() as Promise<Team>;
        },
        enabled: !!teamId,
    });
};

export const useCreateTeam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateTeamRequest) => {
            const res = await fetch(`${API_BASE}/teams`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to create team" }));
                throw new Error(error.detail || "Failed to create team");
            }
            return res.json() as Promise<Team>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["teams"] });
        },
    });
};

export const useUpdateTeam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, data }: { teamId: number; data: UpdateTeamRequest }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to update team" }));
                throw new Error(error.detail || "Failed to update team");
            }
            return res.json() as Promise<Team>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            queryClient.invalidateQueries({ queryKey: ["team", teamId] });
        },
    });
};

export const useDeleteTeam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (teamId: number) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to delete team" }));
                throw new Error(error.detail || "Failed to delete team");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["teams"] });
        },
    });
};

// Team Members
export const useTeamMembers = (teamId: number) => {
    return useQuery({
        queryKey: ["team-members", teamId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/members`);
            if (!res.ok) throw new Error("Failed to fetch team members");
            return res.json() as Promise<TeamMember[]>;
        },
        enabled: !!teamId,
    });
};

export const useAddTeamMember = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, data }: { teamId: number; data: AddMemberRequest }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to add member" }));
                throw new Error(error.detail || "Failed to add member");
            }
            return res.json() as Promise<TeamMember>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
            queryClient.invalidateQueries({ queryKey: ["team", teamId] });
        },
    });
};

export const useUpdateMemberRole = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            teamId,
            userId,
            role,
        }: {
            teamId: number;
            userId: string;
            role: string;
        }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/members/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to update role" }));
                throw new Error(error.detail || "Failed to update role");
            }
            return res.json() as Promise<TeamMember>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
        },
    });
};

export const useRemoveTeamMember = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, userId }: { teamId: number; userId: string }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/members/${userId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to remove member" }));
                throw new Error(error.detail || "Failed to remove member");
            }
            return res.json();
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
            queryClient.invalidateQueries({ queryKey: ["team", teamId] });
        },
    });
};

// Team Shares
export const useTeamShares = (teamId: number) => {
    return useQuery({
        queryKey: ["team-shares", teamId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/shares`);
            if (!res.ok) throw new Error("Failed to fetch team shares");
            return res.json() as Promise<TeamShare[]>;
        },
        enabled: !!teamId,
    });
};

export const useShareWithTeam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, data }: { teamId: number; data: ShareDocumentRequest }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/shares`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to share" }));
                throw new Error(error.detail || "Failed to share");
            }
            return res.json() as Promise<TeamShare>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-shares", teamId] });
        },
    });
};

export const useRemoveTeamShare = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, shareId }: { teamId: number; shareId: number }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/shares/${shareId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to remove share" }));
                throw new Error(error.detail || "Failed to remove share");
            }
            return res.json();
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-shares", teamId] });
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// TEAM TEMPLATES (v4.4 Feature)
// ═══════════════════════════════════════════════════════════════════════════

export interface TeamTemplate {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    country_code: string;
    visibility: string;
    team_id: number | null;
    is_own_template: boolean;
    can_use: boolean;
    can_duplicate: boolean;
}

export interface CreateTeamTemplateRequest {
    name: string;
    description?: string;
    category?: string;
    country_code?: string;
    source_template_id?: number;
}

export interface TeamTemplateShare {
    id: number;
    document_type_id: number;
    template_name: string;
    team_id: number;
    team_name: string;
    can_use: boolean;
    can_duplicate: boolean;
    shared_by: string;
    shared_at: string;
    note: string | null;
}

export const useTeamTemplates = (teamId: number) => {
    return useQuery({
        queryKey: ["team-templates", teamId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/templates`);
            if (!res.ok) throw new Error("Failed to fetch team templates");
            return res.json() as Promise<TeamTemplate[]>;
        },
        enabled: !!teamId,
    });
};

export const useCreateTeamTemplate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, data }: { teamId: number; data: CreateTeamTemplateRequest }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/templates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to create template" }));
                throw new Error(error.detail || "Failed to create template");
            }
            return res.json() as Promise<TeamTemplate>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-templates", teamId] });
        },
    });
};

export const useTeamTemplateShares = (teamId: number) => {
    return useQuery({
        queryKey: ["team-template-shares", teamId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/templates/shares`);
            if (!res.ok) throw new Error("Failed to fetch template shares");
            return res.json() as Promise<TeamTemplateShare[]>;
        },
        enabled: !!teamId,
    });
};

export const useShareTemplateWithTeam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            teamId,
            documentTypeId,
            canUse = true,
            canDuplicate = false,
            note,
        }: {
            teamId: number;
            documentTypeId: number;
            canUse?: boolean;
            canDuplicate?: boolean;
            note?: string;
        }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/templates/share`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document_type_id: documentTypeId,
                    can_use: canUse,
                    can_duplicate: canDuplicate,
                    note,
                }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to share template" }));
                throw new Error(error.detail || "Failed to share template");
            }
            return res.json() as Promise<TeamTemplateShare>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-template-shares", teamId] });
            queryClient.invalidateQueries({ queryKey: ["team-templates", teamId] });
        },
    });
};

export const useRemoveTemplateShare = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, shareId }: { teamId: number; shareId: number }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/templates/shares/${shareId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to remove share" }));
                throw new Error(error.detail || "Failed to remove share");
            }
            return res.json();
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-template-shares", teamId] });
            queryClient.invalidateQueries({ queryKey: ["team-templates", teamId] });
        },
    });
};
