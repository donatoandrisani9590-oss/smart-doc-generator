/**
 * useSignature Hook
 * React hook for managing e-signature workflows
 */

import { useState, useCallback, useMemo } from "react";
import { signatureService } from "@/lib/signature-service";
import type {
  SignatureRequest,
  CreateSignatureRequestInput,
  UpdateSignatureRequestInput,
  SignatureRequestQuery,
  AuditTrail,
  AuditEvent,
  SignatureTemplate,
  Signer,
  SignatureRequestStatus,
  SignatureProvider,
} from "@/types/signature";

// =============================================================================
// Types
// =============================================================================

interface UseSignatureState {
  requests: SignatureRequest[];
  currentRequest: SignatureRequest | null;
  auditTrail: AuditTrail | null;
  templates: SignatureTemplate[];
  isLoading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
}

interface UseSignatureActions {
  // Request Management
  createRequest: (input: CreateSignatureRequestInput) => Promise<SignatureRequest>;
  updateRequest: (
    requestId: string,
    input: UpdateSignatureRequestInput
  ) => Promise<SignatureRequest>;
  sendRequest: (requestId: string) => Promise<SignatureRequest>;
  cancelRequest: (requestId: string, reason?: string) => Promise<SignatureRequest>;
  deleteRequest: (requestId: string) => Promise<void>;
  sendReminder: (requestId: string, signerId: string) => Promise<void>;

  // Fetching
  fetchRequest: (requestId: string) => Promise<SignatureRequest>;
  fetchRequests: (query?: SignatureRequestQuery) => Promise<void>;
  refreshCurrentRequest: () => Promise<void>;

  // Document
  downloadSignedDocument: (requestId: string) => Promise<void>;
  getSigningUrl: (requestId: string, signerId: string) => Promise<string>;

  // Audit
  fetchAuditTrail: (requestId: string) => Promise<AuditTrail>;

  // Signer Actions
  markAsViewed: (requestId: string, signerId: string) => Promise<void>;
  submitSignature: (
    requestId: string,
    signerId: string,
    data: { signature: string; initials?: string }
  ) => Promise<SignatureRequest>;
  declineSignature: (
    requestId: string,
    signerId: string,
    reason: string
  ) => Promise<SignatureRequest>;

  // Templates
  fetchTemplates: () => Promise<SignatureTemplate[]>;
  createFromTemplate: (
    templateId: string,
    documentId: number,
    signers: Omit<Signer, "id">[]
  ) => Promise<SignatureRequest>;

  // Utilities
  clearError: () => void;
  setCurrentRequest: (request: SignatureRequest | null) => void;
}

interface UseSignatureReturn extends UseSignatureState, UseSignatureActions {
  // Computed values
  pendingRequests: SignatureRequest[];
  completedRequests: SignatureRequest[];
  activeProvider: SignatureProvider;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useSignature(): UseSignatureReturn {
  // State
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<SignatureRequest | null>(
    null
  );
  const [auditTrail, setAuditTrail] = useState<AuditTrail | null>(null);
  const [templates, setTemplates] = useState<SignatureTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Error handler wrapper
  const handleError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : "An error occurred";
    setError(message);
    throw err;
  }, []);

  // ---------------------------------------------------------------------------
  // Request Management
  // ---------------------------------------------------------------------------

  const createRequest = useCallback(
    async (input: CreateSignatureRequestInput): Promise<SignatureRequest> => {
      setIsLoading(true);
      setError(null);
      try {
        const request = await signatureService.createSignatureRequest(input);
        setCurrentRequest(request);
        setRequests((prev) => [request, ...prev]);
        return request;
      } catch (err) {
        return handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const updateRequest = useCallback(
    async (
      requestId: string,
      input: UpdateSignatureRequestInput
    ): Promise<SignatureRequest> => {
      setIsLoading(true);
      setError(null);
      try {
        const request = await signatureService.updateSignatureRequest(
          requestId,
          input
        );
        setCurrentRequest(request);
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? request : r))
        );
        return request;
      } catch (err) {
        return handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const sendRequest = useCallback(
    async (requestId: string): Promise<SignatureRequest> => {
      setIsLoading(true);
      setError(null);
      try {
        const request = await signatureService.sendForSignature(requestId);
        setCurrentRequest(request);
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? request : r))
        );
        return request;
      } catch (err) {
        return handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const cancelRequest = useCallback(
    async (requestId: string, reason?: string): Promise<SignatureRequest> => {
      setIsLoading(true);
      setError(null);
      try {
        const request = await signatureService.cancelSignatureRequest(
          requestId,
          reason
        );
        setCurrentRequest(request);
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? request : r))
        );
        return request;
      } catch (err) {
        return handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const deleteRequest = useCallback(
    async (requestId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await signatureService.deleteSignatureRequest(requestId);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (currentRequest?.id === requestId) {
          setCurrentRequest(null);
        }
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [currentRequest?.id, handleError]
  );

  const sendReminder = useCallback(
    async (requestId: string, signerId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await signatureService.sendReminder(requestId, signerId);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ---------------------------------------------------------------------------
  // Fetching
  // ---------------------------------------------------------------------------

  const fetchRequest = useCallback(
    async (requestId: string): Promise<SignatureRequest> => {
      setIsLoading(true);
      setError(null);
      try {
        const request = await signatureService.getSignatureRequest(requestId);
        setCurrentRequest(request);
        return request;
      } catch (err) {
        return handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const fetchRequests = useCallback(
    async (query: SignatureRequestQuery = {}): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await signatureService.listSignatureRequests(query);
        if (response.success && response.data) {
          setRequests(response.data.requests);
          setTotal(response.data.total);
          setPage(response.data.page);
          setPageSize(response.data.pageSize);
        }
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const refreshCurrentRequest = useCallback(async (): Promise<void> => {
    if (!currentRequest) return;
    await fetchRequest(currentRequest.id);
  }, [currentRequest, fetchRequest]);

  // ---------------------------------------------------------------------------
  // Document
  // ---------------------------------------------------------------------------

  const downloadSignedDocument = useCallback(
    async (requestId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const blob = await signatureService.getSignedDocument(requestId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `signed-document-${requestId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const getSigningUrl = useCallback(
    async (requestId: string, signerId: string): Promise<string> => {
      setError(null);
      try {
        return await signatureService.getSigningUrl(requestId, signerId);
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError]
  );

  // ---------------------------------------------------------------------------
  // Audit
  // ---------------------------------------------------------------------------

  const fetchAuditTrail = useCallback(
    async (requestId: string): Promise<AuditTrail> => {
      setIsLoading(true);
      setError(null);
      try {
        const trail = await signatureService.getAuditTrail(requestId);
        setAuditTrail(trail);
        return trail;
      } catch (err) {
        return handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ---------------------------------------------------------------------------
  // Signer Actions
  // ---------------------------------------------------------------------------

  const markAsViewed = useCallback(
    async (requestId: string, signerId: string): Promise<void> => {
      setError(null);
      try {
        await signatureService.markAsViewed(requestId, signerId);
        await fetchRequest(requestId);
      } catch (err) {
        handleError(err);
      }
    },
    [fetchRequest, handleError]
  );

  const submitSignature = useCallback(
    async (
      requestId: string,
      signerId: string,
      data: { signature: string; initials?: string }
    ): Promise<SignatureRequest> => {
      setIsLoading(true);
      setError(null);
      try {
        const request = await signatureService.submitSignature(
          requestId,
          signerId,
          data
        );
        setCurrentRequest(request);
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? request : r))
        );
        return request;
      } catch (err) {
        return handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const declineSignature = useCallback(
    async (
      requestId: string,
      signerId: string,
      reason: string
    ): Promise<SignatureRequest> => {
      setIsLoading(true);
      setError(null);
      try {
        const request = await signatureService.declineSignature(
          requestId,
          signerId,
          reason
        );
        setCurrentRequest(request);
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? request : r))
        );
        return request;
      } catch (err) {
        return handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  const fetchTemplates = useCallback(async (): Promise<SignatureTemplate[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const templateList = await signatureService.listTemplates();
      setTemplates(templateList);
      return templateList;
    } catch (err) {
      return handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const createFromTemplate = useCallback(
    async (
      templateId: string,
      documentId: number,
      signers: Omit<Signer, "id">[]
    ): Promise<SignatureRequest> => {
      setIsLoading(true);
      setError(null);
      try {
        const request = await signatureService.createFromTemplate(
          templateId,
          documentId,
          signers
        );
        setCurrentRequest(request);
        setRequests((prev) => [request, ...prev]);
        return request;
      } catch (err) {
        return handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === "draft" ||
          r.status === "sent" ||
          r.status === "partially_signed"
      ),
    [requests]
  );

  const completedRequests = useMemo(
    () => requests.filter((r) => r.status === "completed"),
    [requests]
  );

  const activeProvider = signatureService.getActiveProvider();

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // State
    requests,
    currentRequest,
    auditTrail,
    templates,
    isLoading,
    error,
    total,
    page,
    pageSize,

    // Actions
    createRequest,
    updateRequest,
    sendRequest,
    cancelRequest,
    deleteRequest,
    sendReminder,
    fetchRequest,
    fetchRequests,
    refreshCurrentRequest,
    downloadSignedDocument,
    getSigningUrl,
    fetchAuditTrail,
    markAsViewed,
    submitSignature,
    declineSignature,
    fetchTemplates,
    createFromTemplate,
    clearError,
    setCurrentRequest,

    // Computed
    pendingRequests,
    completedRequests,
    activeProvider,
  };
}

// =============================================================================
// Individual Hooks for Specific Use Cases
// =============================================================================

/**
 * Hook for viewing a single signature request
 */
export function useSignatureRequest(requestId: string | null) {
  const [request, setRequest] = useState<SignatureRequest | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!requestId) return;

    setIsLoading(true);
    setError(null);
    try {
      const [req, trail] = await Promise.all([
        signatureService.getSignatureRequest(requestId),
        signatureService.getAuditTrail(requestId),
      ]);
      setRequest(req);
      setAuditEvents(trail.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request");
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  return {
    request,
    auditEvents,
    isLoading,
    error,
    refresh: fetch,
  };
}

/**
 * Hook for signature request statistics
 */
export function useSignatureStatistics() {
  const [statistics, setStatistics] = useState<{
    total: number;
    byStatus: Record<SignatureRequestStatus, number>;
    byProvider: Record<SignatureProvider, number>;
    averageCompletionDays: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stats = await signatureService.getStatistics();
      setStatistics(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load statistics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    statistics,
    isLoading,
    error,
    refresh: fetch,
  };
}

export default useSignature;
