/**
 * useApiQuery - Enhanced API Query Hooks
 *
 * Wraps TanStack Query with centralized error handling, logging,
 * and integration with the API client.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { api, isApiError, getErrorMessage } from "@/lib/api-client";
import type { ApiError, RequestConfig } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { logError, logAction } from "@/lib/logger";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

// ============================================================================
// Enhanced Query Hook
// ============================================================================

interface UseApiQueryOptions<T> extends Omit<UseQueryOptions<T, ApiError>, "queryFn"> {
    /** API endpoint */
    endpoint: string;
    /** Request configuration */
    requestConfig?: RequestConfig;
    /** Show toast on error */
    showErrorToast?: boolean;
    /** Custom error message */
    errorMessage?: string;
}

export function useApiQuery<T>({
    endpoint,
    requestConfig,
    showErrorToast = true,
    errorMessage,
    ...options
}: UseApiQueryOptions<T>) {
    const toast = useToast();
    const { isOnline } = useOnlineStatus();

    return useQuery<T, ApiError>({
        ...options,
        queryFn: async () => {
            const response = await api.get<T>(endpoint, requestConfig);
            return response.data;
        },
        enabled: isOnline && (options.enabled ?? true),
        retry: (failureCount, error) => {
            // Don't retry on 4xx errors (client errors)
            if (isApiError(error) && error.status >= 400 && error.status < 500) {
                return false;
            }
            return failureCount < 2;
        },
        meta: {
            ...options.meta,
            onError: (error: ApiError) => {
                if (showErrorToast) {
                    toast.error(
                        "Fehler beim Laden",
                        errorMessage || getErrorMessage(error)
                    );
                }
                logError("Query failed", {
                    endpoint,
                    error: error.message,
                    status: error.status,
                });
            },
        },
    });
}

// ============================================================================
// Enhanced Mutation Hook
// ============================================================================

interface UseApiMutationOptions<TData, TVariables> extends Omit<UseMutationOptions<TData, ApiError, TVariables>, "mutationFn"> {
    /** HTTP method */
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    /** Get endpoint from variables */
    getEndpoint: (variables: TVariables) => string;
    /** Get request body from variables (optional for DELETE) */
    getBody?: (variables: TVariables) => unknown;
    /** Request configuration */
    requestConfig?: RequestConfig;
    /** Query keys to invalidate on success */
    invalidateKeys?: string[][];
    /** Show toast on success */
    showSuccessToast?: boolean;
    /** Success message */
    successMessage?: string;
    /** Show toast on error */
    showErrorToast?: boolean;
    /** Custom error message */
    errorMessage?: string;
    /** Action name for logging */
    actionName?: string;
}

export function useApiMutation<TData, TVariables>({
    method,
    getEndpoint,
    getBody,
    requestConfig,
    invalidateKeys = [],
    showSuccessToast = true,
    successMessage,
    showErrorToast = true,
    errorMessage,
    actionName,
    ...options
}: UseApiMutationOptions<TData, TVariables>) {
    const queryClient = useQueryClient();
    const toast = useToast();

    return useMutation<TData, ApiError, TVariables>({
        ...options,
        mutationFn: async (variables) => {
            const endpoint = getEndpoint(variables);
            const body = getBody?.(variables);

            let response;
            switch (method) {
                case "POST":
                    response = await api.post<TData>(endpoint, body, requestConfig);
                    break;
                case "PUT":
                    response = await api.put<TData>(endpoint, body, requestConfig);
                    break;
                case "PATCH":
                    response = await api.patch<TData>(endpoint, body, requestConfig);
                    break;
                case "DELETE":
                    response = await api.delete<TData>(endpoint, requestConfig);
                    break;
            }

            return response.data;
        },
        onSuccess: () => {
            // Invalidate queries
            invalidateKeys.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: key });
            });

            // Show success toast
            if (showSuccessToast && successMessage) {
                toast.success("Erfolg", successMessage);
            }

            // Log action
            if (actionName) {
                logAction(actionName, { success: true });
            }

        },
        onError: (error) => {
            // Show error toast
            if (showErrorToast) {
                toast.error(
                    "Fehler",
                    errorMessage || getErrorMessage(error)
                );
            }

            // Log error
            logError("Mutation failed", {
                action: actionName,
                error: error.message,
                status: error.status,
            });
        },
    });
}

// ============================================================================
// Convenience Hooks for Common Operations
// ============================================================================

type UseFetchOptions<T> = Omit<UseApiQueryOptions<T>, "endpoint">;

/**
 * Simple fetch hook for a single endpoint
 */
export function useFetch<T>(
    endpoint: string,
    queryKey: string[],
    options?: UseFetchOptions<T>
) {
    return useApiQuery<T>({
        queryKey,
        endpoint,
        ...options,
    });
}

interface UseCreateOptions {
    endpoint: string;
    invalidateKeys?: string[][];
    successMessage?: string;
    errorMessage?: string;
}

/**
 * Create mutation hook (POST)
 */
export function useCreate<TData, TInput>({
    endpoint,
    invalidateKeys,
    successMessage,
    errorMessage,
}: UseCreateOptions) {
    return useApiMutation<TData, TInput>({
        method: "POST",
        getEndpoint: () => endpoint,
        getBody: (data) => data,
        invalidateKeys,
        successMessage,
        errorMessage,
        actionName: `Create at ${endpoint}`,
    });
}

interface UseUpdateOptions {
    getEndpoint: (id: number | string) => string;
    invalidateKeys?: string[][];
    successMessage?: string;
    errorMessage?: string;
}

/**
 * Update mutation hook (PUT)
 */
export function useUpdate<TData, TInput extends { id: number | string }>({
    getEndpoint,
    invalidateKeys,
    successMessage,
    errorMessage,
}: UseUpdateOptions) {
    return useApiMutation<TData, TInput>({
        method: "PUT",
        getEndpoint: (data) => getEndpoint(data.id),
        getBody: (data) => data,
        invalidateKeys,
        successMessage,
        errorMessage,
        actionName: "Update",
    });
}

interface UseDeleteOptions<TId extends number | string> {
    getEndpoint: (id: TId) => string;
    invalidateKeys?: string[][];
    successMessage?: string;
    errorMessage?: string;
}

/**
 * Delete mutation hook (DELETE)
 */
export function useDelete<TId extends number | string>({
    getEndpoint,
    invalidateKeys,
    successMessage,
    errorMessage,
}: UseDeleteOptions<TId>) {
    return useApiMutation<void, TId>({
        method: "DELETE",
        getEndpoint: (id) => getEndpoint(id),
        invalidateKeys,
        successMessage,
        errorMessage,
        actionName: "Delete",
    });
}

// ============================================================================
// Re-exports
// ============================================================================

export { isApiError, getErrorMessage } from "@/lib/api-client";
export type { ApiError } from "@/lib/api-client";
