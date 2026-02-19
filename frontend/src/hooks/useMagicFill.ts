/**
 * useMagicFill — RAG-basierte Vorschläge aus Teamhistorie.
 *
 * Ruft POST /api/v1/smart/magic-fill auf und liefert
 * Vorschläge für Formularfelder basierend auf historischen Dokumenten.
 *
 * Verhält sich wie ein "einmaliger" Fetch pro documentTypeId:
 * - Ruft nur einmal pro documentTypeId ab (kein Refetch bei Formänderung)
 * - Gibt Suggestions sortiert nach Konfidenz zurück
 * - Tracks angewendete/verworfene Felder via Sets
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";

export interface MagicFillSuggestion {
    field_key: string;
    value: string;
    confidence: number;
    source_count: number;
    hint: string;
}

interface MagicFillResponse {
    suggestions: MagicFillSuggestion[];
    document_count: number;
}

interface UseMagicFillParams {
    documentTypeId: number | null;
    countryCode: string;
    enabled: boolean;
}

interface UseMagicFillReturn {
    /** Aktive Vorschläge (noch nicht angewendet/verworfen) */
    suggestions: MagicFillSuggestion[];
    /** Alle Vorschläge (auch angewendete/verworfene) */
    allSuggestions: MagicFillSuggestion[];
    /** Welche Felder wurden übernommen */
    appliedFields: Set<string>;
    /** Einzelnes Feld übernehmen */
    applyField: (fieldKey: string) => string | undefined;
    /** Alle Felder übernehmen, gibt Map von field_key -> value zurück */
    applyAll: () => Map<string, string>;
    /** Einzelnes Feld verwerfen */
    dismissField: (fieldKey: string) => void;
    /** Lädt gerade */
    isLoading: boolean;
    /** Gesamtzahl analysierter Dokumente */
    documentCount: number;
}

export function useMagicFill({
    documentTypeId,
    countryCode,
    enabled,
}: UseMagicFillParams): UseMagicFillReturn {
    const [allSuggestions, setAllSuggestions] = useState<MagicFillSuggestion[]>([]);
    const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());
    const [dismissedFields, setDismissedFields] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [documentCount, setDocumentCount] = useState(0);

    // Prevent multiple fetches for the same documentTypeId
    const fetchedRef = useRef<number | null>(null);

    // Reset when documentTypeId changes
    useEffect(() => {
        if (documentTypeId !== fetchedRef.current) {
            setAllSuggestions([]);
            setAppliedFields(new Set());
            setDismissedFields(new Set());
            setDocumentCount(0);
            fetchedRef.current = null;
        }
    }, [documentTypeId]);

    // Fetch suggestions
    useEffect(() => {
        if (!enabled || !documentTypeId || fetchedRef.current === documentTypeId) {
            return;
        }

        let cancelled = false;

        const fetchSuggestions = async () => {
            setIsLoading(true);
            try {
                const { data } = await api.post<MagicFillResponse>(
                    "/api/v1/smart/magic-fill",
                    {
                        document_type_id: documentTypeId,
                        country_code: countryCode,
                    }
                );

                if (!cancelled) {
                    setAllSuggestions(data.suggestions);
                    setDocumentCount(data.document_count);
                    fetchedRef.current = documentTypeId;
                }
            } catch {
                // Silently fail — Magic Fill is a nice-to-have, not critical
                if (!cancelled) {
                    setAllSuggestions([]);
                    setDocumentCount(0);
                    fetchedRef.current = documentTypeId;
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchSuggestions();

        return () => {
            cancelled = true;
        };
    }, [documentTypeId, countryCode, enabled]);

    // Active suggestions = all minus applied/dismissed
    const suggestions = allSuggestions.filter(
        (s) => !appliedFields.has(s.field_key) && !dismissedFields.has(s.field_key)
    );

    const applyField = useCallback(
        (fieldKey: string): string | undefined => {
            const suggestion = allSuggestions.find((s) => s.field_key === fieldKey);
            if (!suggestion) return undefined;

            setAppliedFields((prev) => {
                const next = new Set(prev);
                next.add(fieldKey);
                return next;
            });

            return suggestion.value;
        },
        [allSuggestions]
    );

    const applyAll = useCallback((): Map<string, string> => {
        const values = new Map<string, string>();
        const activeKeys = new Set<string>();

        for (const s of suggestions) {
            values.set(s.field_key, s.value);
            activeKeys.add(s.field_key);
        }

        setAppliedFields((prev) => {
            const next = new Set(prev);
            for (const key of activeKeys) {
                next.add(key);
            }
            return next;
        });

        return values;
    }, [suggestions]);

    const dismissField = useCallback((fieldKey: string) => {
        setDismissedFields((prev) => {
            const next = new Set(prev);
            next.add(fieldKey);
            return next;
        });
    }, []);

    return {
        suggestions,
        allSuggestions,
        appliedFields,
        applyField,
        applyAll,
        dismissField,
        isLoading,
        documentCount,
    };
}
