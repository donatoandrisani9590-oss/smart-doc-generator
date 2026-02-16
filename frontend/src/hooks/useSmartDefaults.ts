/**
 * useSmartDefaults — Fetches smart default values (common field values + clause IDs)
 * for a team + document type combination based on historical patterns.
 */

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

interface SmartDefaultsData {
  field_defaults: Record<string, string>;
  common_clause_ids: number[];
  sample_size: number;
  calculated_at: string | null;
}

interface UseSmartDefaultsReturn {
  defaults: SmartDefaultsData | null;
  isLoading: boolean;
  applyDefaults: () => Record<string, string>;
  refresh: () => void;
}

export function useSmartDefaults(
  teamId: number | null,
  documentTypeId: number | null,
): UseSmartDefaultsReturn {
  const [defaults, setDefaults] = useState<SmartDefaultsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDefaults = useCallback(async () => {
    if (!teamId || !documentTypeId) {
      setDefaults(null);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        team_id: String(teamId),
        document_type_id: String(documentTypeId),
      });
      const res = await apiFetch(
        `/api/v1/smart/patterns/defaults?${params}`,
      );
      if (res.ok) {
        const data = await res.json();
        setDefaults(data);
      }
    } catch (err) {
      console.error("Smart defaults fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, documentTypeId]);

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  const applyDefaults = useCallback((): Record<string, string> => {
    return defaults?.field_defaults || {};
  }, [defaults]);

  return { defaults, isLoading, applyDefaults, refresh: fetchDefaults };
}
