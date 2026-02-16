/**
 * useEmployeeAutocomplete — Searches employees by name and returns form_data
 * from their most recent document for auto-filling.
 *
 * Debounced search (300ms) with minimum 2-char query.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";

export interface EmployeeResult {
  employee_name: string;
  employee_id: string;
  latest_document_title: string;
  latest_document_date: string;
  document_type_id: number | null;
  form_data: Record<string, string>;
}

interface UseEmployeeAutocompleteReturn {
  query: string;
  setQuery: (q: string) => void;
  results: EmployeeResult[];
  isLoading: boolean;
  clear: () => void;
}

export function useEmployeeAutocomplete(
  countryCode: string,
): UseEmployeeAutocompleteReturn {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmployeeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // Cancel previous request
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          country_code: countryCode,
        });
        const res = await apiFetch(
          `/api/v1/smart/autocomplete/employees?${params}`,
          { signal: abortRef.current.signal },
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.employees || []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Employee autocomplete failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, countryCode]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { query, setQuery, results, isLoading, clear };
}
