/**
 * useOptimisticMutation - Optimistic Updates mit Rollback
 *
 * Ermöglicht sofortige UI-Updates mit automatischem Rollback bei Fehlern.
 * Verbessert die wahrgenommene Performance und UX.
 */

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { logError } from "@/lib/logger";

interface OptimisticMutationOptions<TData, TVariables> {
    /** Query key(s) to update optimistically */
    queryKey: QueryKey;

    /** Function to perform the actual mutation */
    mutationFn: (variables: TVariables) => Promise<TData>;

    /** Function to optimistically update the cache */
    optimisticUpdate: (
        oldData: TData | undefined,
        variables: TVariables
    ) => TData;

    /** Optional: custom rollback logic */
    onRollback?: (error: Error, variables: TVariables) => void;

    /** Optional: success callback */
    onSuccess?: (data: TData, variables: TVariables) => void;

    /** Optional: error callback */
    onError?: (error: Error, variables: TVariables) => void;

    /** Success message for toast */
    successMessage?: string;

    /** Error message for toast */
    errorMessage?: string;

    /** Show toast notifications */
    showToast?: boolean;
}

interface OptimisticMutationResult<TData, TVariables> {
    mutate: (variables: TVariables) => Promise<TData | null>;
    mutateAsync: (variables: TVariables) => Promise<TData>;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    reset: () => void;
}

export function useOptimisticMutation<TData, TVariables>({
    queryKey,
    mutationFn,
    optimisticUpdate,
    onRollback,
    onSuccess,
    onError,
    successMessage,
    errorMessage = "Aktion fehlgeschlagen",
    showToast = true,
}: OptimisticMutationOptions<TData, TVariables>): OptimisticMutationResult<TData, TVariables> {
    const queryClient = useQueryClient();
    const toast = useToast();

    const [isPending, setIsPending] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Store previous data for rollback
    const previousDataRef = useRef<TData | undefined>(undefined);

    const reset = useCallback(() => {
        setIsPending(false);
        setIsError(false);
        setError(null);
    }, []);

    const mutateAsync = useCallback(
        async (variables: TVariables): Promise<TData> => {
            setIsPending(true);
            setIsError(false);
            setError(null);

            // Save current data for potential rollback
            previousDataRef.current = queryClient.getQueryData<TData>(queryKey);

            // Apply optimistic update
            queryClient.setQueryData<TData>(queryKey, (oldData) =>
                optimisticUpdate(oldData, variables)
            );

            try {
                // Perform actual mutation
                const result = await mutationFn(variables);

                // Update cache with server response (in case it differs)
                queryClient.setQueryData<TData>(queryKey, result);

                // Success callback
                onSuccess?.(result, variables);

                // Success toast
                if (showToast && successMessage) {
                    toast.success("Erfolg", successMessage);
                }

                setIsPending(false);
                return result;

            } catch (err) {
                const mutationError = err instanceof Error ? err : new Error(String(err));

                // Rollback to previous data
                queryClient.setQueryData<TData>(queryKey, previousDataRef.current);

                // Custom rollback logic
                onRollback?.(mutationError, variables);

                // Error callback
                onError?.(mutationError, variables);

                // Log error
                logError("Optimistic mutation failed", {
                    queryKey: String(queryKey),
                    error: mutationError.message,
                });

                // Error toast
                if (showToast) {
                    toast.error("Fehler", errorMessage);
                }

                setIsError(true);
                setError(mutationError);
                setIsPending(false);

                throw mutationError;
            }
        },
        [
            queryClient,
            queryKey,
            mutationFn,
            optimisticUpdate,
            onRollback,
            onSuccess,
            onError,
            successMessage,
            errorMessage,
            showToast,
            toast,
        ]
    );

    const mutate = useCallback(
        async (variables: TVariables): Promise<TData | null> => {
            try {
                return await mutateAsync(variables);
            } catch {
                return null;
            }
        },
        [mutateAsync]
    );

    return {
        mutate,
        mutateAsync,
        isPending,
        isError,
        error,
        reset,
    };
}

// ============================================================================
// Specialized Optimistic Hooks
// ============================================================================

/**
 * Hook for optimistic list item deletion
 */
export function useOptimisticDelete<TItem extends { id: number | string }>(options: {
    queryKey: QueryKey;
    deleteFn: (id: TItem["id"]) => Promise<void>;
    successMessage?: string;
    errorMessage?: string;
}) {
    return useOptimisticMutation<TItem[], TItem["id"]>({
        queryKey: options.queryKey,
        mutationFn: async (id) => {
            await options.deleteFn(id);
            return []; // Return value doesn't matter for delete
        },
        optimisticUpdate: (oldData, id) => {
            if (!oldData) return [];
            return oldData.filter((item) => item.id !== id);
        },
        successMessage: options.successMessage,
        errorMessage: options.errorMessage || "Löschen fehlgeschlagen",
    });
}

/**
 * Hook for optimistic list item update
 */
export function useOptimisticUpdate<TItem extends { id: number | string }>(options: {
    queryKey: QueryKey;
    updateFn: (item: TItem) => Promise<TItem>;
    successMessage?: string;
    errorMessage?: string;
}) {
    return useOptimisticMutation<TItem[], TItem>({
        queryKey: options.queryKey,
        mutationFn: async (item) => {
            await options.updateFn(item);
            return []; // Return value is replaced by optimistic update
        },
        optimisticUpdate: (oldData, updatedItem) => {
            if (!oldData) return [updatedItem];
            return oldData.map((item) =>
                item.id === updatedItem.id ? updatedItem : item
            );
        },
        successMessage: options.successMessage,
        errorMessage: options.errorMessage || "Aktualisierung fehlgeschlagen",
    });
}

/**
 * Hook for optimistic list item addition
 */
export function useOptimisticAdd<TItem extends { id: number | string }>(options: {
    queryKey: QueryKey;
    addFn: (item: Omit<TItem, "id">) => Promise<TItem>;
    /** Generate temporary ID for optimistic update */
    generateTempId?: () => TItem["id"];
    successMessage?: string;
    errorMessage?: string;
}) {
    const tempIdCounter = useRef(0);

    return useOptimisticMutation<TItem[], Omit<TItem, "id">>({
        queryKey: options.queryKey,
        mutationFn: async (item) => {
            const newItem = await options.addFn(item);
            return [newItem];
        },
        optimisticUpdate: (oldData, newItem) => {
            const tempId = options.generateTempId?.() ?? `temp-${++tempIdCounter.current}`;
            const optimisticItem = { ...newItem, id: tempId } as TItem;

            if (!oldData) return [optimisticItem];
            return [...oldData, optimisticItem];
        },
        successMessage: options.successMessage,
        errorMessage: options.errorMessage || "Hinzufügen fehlgeschlagen",
    });
}

/**
 * Hook for optimistic toggle (e.g., favorite, active status)
 */
export function useOptimisticToggle<TItem extends { id: number | string }>(options: {
    queryKey: QueryKey;
    toggleFn: (id: TItem["id"], newValue: boolean) => Promise<void>;
    /** Field to toggle */
    field: keyof TItem;
    successMessage?: string;
    errorMessage?: string;
}) {
    return useOptimisticMutation<TItem[], { id: TItem["id"]; value: boolean }>({
        queryKey: options.queryKey,
        mutationFn: async ({ id, value }) => {
            await options.toggleFn(id, value);
            return [];
        },
        optimisticUpdate: (oldData, { id, value }) => {
            if (!oldData) return [];
            return oldData.map((item) =>
                item.id === id ? { ...item, [options.field]: value } : item
            );
        },
        successMessage: options.successMessage,
        errorMessage: options.errorMessage || "Änderung fehlgeschlagen",
    });
}
