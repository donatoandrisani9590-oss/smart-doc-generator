import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import type { VariantGroup } from "./types";

const API_BASE = "/api/v1";

export const useVariantGroups = (countryCode?: string) => {
    const [data, setData] = useState<VariantGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const url = countryCode
                    ? `${API_BASE}/clause-variants/groups?country_code=${countryCode}`
                    : `${API_BASE}/clause-variants/groups`;
                const res = await apiFetch(url);
                if (!res.ok) throw new Error("Failed to fetch variant groups");
                const groups = await res.json();
                setData(groups);
            } catch (err) {
                setError(err as Error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGroups();
    }, [countryCode]);

    const refetch = async () => {
        setIsLoading(true);
        try {
            const url = countryCode
                ? `${API_BASE}/clause-variants/groups?country_code=${countryCode}`
                : `${API_BASE}/clause-variants/groups`;
            const res = await apiFetch(url);
            if (!res.ok) throw new Error("Failed to fetch variant groups");
            const groups = await res.json();
            setData(groups);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    };

    return { data, isLoading, error, refetch };
};
