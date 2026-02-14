/**
 * useGhostwriterDraft - Hook for proactive AI draft paragraph generation.
 *
 * Automatically generates an introduction paragraph when enough form fields
 * are filled (>=3 non-empty fields). Uses debouncing (4s) and rate limiting
 * (10s minimum interval) to avoid excessive API calls.
 *
 * Independent from useWizardPreview — separate state, no interference.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { apiStreamSSE } from "@/lib/api-stream";

interface UseGhostwriterDraftParams {
  documentTypeId: number | null;
  formData: Record<string, unknown>;
  countryCode: string;
  enabled: boolean;
}

interface UseGhostwriterDraftReturn {
  draftHtml: string;
  isGenerating: boolean;
  isDismissed: boolean;
  isStreaming: boolean;
  streamedText: string;
  error: string | null;
  dismiss: () => void;
  regenerate: () => void;
  accept: () => string;
}

/** Count non-empty fields in form data. */
function countFilledFields(formData: Record<string, unknown>): number {
  return Object.values(formData).filter(
    (v) => v !== null && v !== undefined && String(v).trim() !== ""
  ).length;
}

/** Create a simple hash of form data for change detection. */
function hashFormData(formData: Record<string, unknown>): string {
  const filled = Object.entries(formData)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${String(v).trim()}`)
    .join("|");
  return filled;
}

const MIN_FIELDS = 3;
const DEBOUNCE_MS = 4000;
const MIN_INTERVAL_MS = 10000;

export function useGhostwriterDraft({
  documentTypeId,
  formData,
  countryCode,
  enabled,
}: UseGhostwriterDraftParams): UseGhostwriterDraftReturn {
  const [draftHtml, setDraftHtml] = useState("");
  const [streamedText, setStreamedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRequestTimeRef = useRef<number>(0);
  const lastHashRef = useRef<string>("");
  const prevDocTypeRef = useRef<number | null>(null);

  // Reset dismissed state when document type changes
  useEffect(() => {
    if (prevDocTypeRef.current !== null && prevDocTypeRef.current !== documentTypeId) {
      setIsDismissed(false);
      setDraftHtml("");
      setStreamedText("");
      setError(null);
    }
    prevDocTypeRef.current = documentTypeId;
  }, [documentTypeId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const generateDraft = useCallback(async () => {
    if (!documentTypeId || !enabled) return;

    const filledCount = countFilledFields(formData);
    if (filledCount < MIN_FIELDS) return;

    // Check if form data actually changed
    const currentHash = hashFormData(formData);
    if (currentHash === lastHashRef.current) return;

    // Rate limit
    const now = Date.now();
    if (now - lastRequestTimeRef.current < MIN_INTERVAL_MS) return;

    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    lastHashRef.current = currentHash;
    lastRequestTimeRef.current = now;
    setIsGenerating(true);
    setIsStreaming(true);
    setStreamedText("");
    setError(null);

    let fullText = "";

    try {
      for await (const event of apiStreamSSE(
        "/api/v1/smart/draft/stream",
        {
          document_type_id: documentTypeId,
          form_data: formData,
          country_code: countryCode,
        },
        controller.signal
      )) {
        if (event.token) {
          fullText += event.token;
          setStreamedText(fullText);
        }
        if (event.error) {
          setError(event.error);
          break;
        }
        if (event.done) {
          break;
        }
      }

      if (fullText.trim()) {
        setDraftHtml(fullText.trim());
      }
    } catch (err: unknown) {
      // AbortError is expected when user changes fields or dismisses
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "KI-Entwurf fehlgeschlagen");
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  }, [documentTypeId, formData, countryCode, enabled]);

  // Debounced trigger on form data changes
  useEffect(() => {
    if (!enabled || isDismissed || !documentTypeId) return;

    const filledCount = countFilledFields(formData);
    if (filledCount < MIN_FIELDS) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      generateDraft();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [formData, enabled, isDismissed, documentTypeId, generateDraft]);

  const dismiss = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsDismissed(true);
    setDraftHtml("");
    setStreamedText("");
    setError(null);
    setIsGenerating(false);
    setIsStreaming(false);
  }, []);

  const regenerate = useCallback(() => {
    lastHashRef.current = ""; // Force regeneration
    lastRequestTimeRef.current = 0;
    setError(null);
    generateDraft();
  }, [generateDraft]);

  const accept = useCallback((): string => {
    const html = draftHtml;
    setDraftHtml("");
    setStreamedText("");
    setIsDismissed(true);
    return html;
  }, [draftHtml]);

  return {
    draftHtml,
    isGenerating,
    isDismissed,
    isStreaming,
    streamedText,
    error,
    dismiss,
    regenerate,
    accept,
  };
}
