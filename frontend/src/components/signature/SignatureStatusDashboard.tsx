'use client';

/**
 * SignatureStatusDashboard Component
 * Dashboard for managing and tracking signature requests
 */

import { useState, useEffect, useMemo } from 'react';
import { useSignature } from '@/hooks/useSignature';
import type {
  SignatureRequest,
  SignatureRequestStatus,
  AuditEvent,
  SignerWithStatus,
} from '@/types/signature';

// shadcn/ui Components
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Icons (using Lucide React)
import {
  FileText,
  Download,
  ClipboardList,
  Bell,
  XCircle,
  CheckCircle2,
  Clock,
  Send,
  FileEdit,
  AlertTriangle,
  CalendarClock,
  Mail,
  Eye,
  Ban,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type FilterStatus = 'all' | 'pending' | 'completed';
type SortOrder = 'newest' | 'oldest';

interface SignatureStatusDashboardProps {
  className?: string;
}

// =============================================================================
// Status Configuration
// =============================================================================

const STATUS_CONFIG: Record<
  SignatureRequestStatus,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  draft: {
    label: 'Entwurf',
    color: 'text-warm-600',
    bgColor: 'bg-warm-100',
    icon: FileEdit,
  },
  sent: {
    label: 'Gesendet',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: Send,
  },
  partially_signed: {
    label: 'Teilweise unterschrieben',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: Clock,
  },
  completed: {
    label: 'Abgeschlossen',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle2,
  },
  declined: {
    label: 'Abgelehnt',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
  expired: {
    label: 'Abgelaufen',
    color: 'text-warm-500',
    bgColor: 'bg-warm-100',
    icon: CalendarClock,
  },
  voided: {
    label: 'Storniert',
    color: 'text-warm-500',
    bgColor: 'bg-warm-100',
    icon: Ban,
  },
};

const AUDIT_EVENT_LABELS: Record<string, string> = {
  created: 'Anfrage erstellt',
  sent: 'Anfrage gesendet',
  delivered: 'E-Mail zugestellt',
  viewed: 'hat geoeffnet',
  signed: 'hat unterschrieben',
  declined: 'hat abgelehnt',
  voided: 'Anfrage storniert',
  expired: 'Anfrage abgelaufen',
  reminder_sent: 'Erinnerung gesendet',
  downloaded: 'Dokument heruntergeladen',
  correction_requested: 'Korrektur angefordert',
  delegated: 'Signatur delegiert',
};

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSignerStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case 'signed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'declined':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'viewed':
      return <Eye className="h-4 w-4 text-blue-600" />;
    case 'sent':
    case 'delivered':
      return <Mail className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-warm-400" />;
  }
}

function getSignerStatusText(signer: SignerWithStatus): string {
  const status = signer.status;
  if (status.signedAt) {
    return `Unterschrieben am ${formatDate(status.signedAt)}`;
  }
  if (status.declinedAt) {
    return `Abgelehnt am ${formatDate(status.declinedAt)}`;
  }
  if (status.viewedAt) {
    return `Geoeffnet am ${formatDate(status.viewedAt)}`;
  }
  if (status.sentAt) {
    return 'Warten auf Unterschrift';
  }
  return 'Ausstehend';
}

// =============================================================================
// Sub-Components
// =============================================================================

interface StatusBadgeProps {
  status: SignatureRequestStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0 gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

interface SignerListProps {
  signers: SignerWithStatus[];
}

function SignerList({ signers }: SignerListProps) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-foreground">Unterzeichner:</span>
      {signers.map((signer) => (
        <div key={signer.id} className="flex items-center gap-2 text-sm">
          {getSignerStatusIcon(signer.status.status)}
          <span className="font-medium">{signer.name}</span>
          <span className="text-muted-foreground">- {getSignerStatusText(signer)}</span>
        </div>
      ))}
    </div>
  );
}

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: AuditEvent[];
  documentTitle: string;
  isLoading: boolean;
}

function AuditTrailModal({
  isOpen,
  onClose,
  events,
  documentTitle,
  isLoading,
}: AuditTrailModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Signatur-Protokoll
          </DialogTitle>
          <DialogDescription>{documentTitle}</DialogDescription>
        </DialogHeader>

        <Separator />

        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="space-y-3 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Keine Ereignisse vorhanden
            </p>
          ) : (
            <div className="space-y-3 p-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 text-sm border-b border-warm-100 pb-2 last:border-0"
                >
                  <span className="text-muted-foreground whitespace-nowrap min-w-[120px]">
                    {formatDateTime(event.timestamp)}
                  </span>
                  <span className="text-foreground">
                    {event.actorName && (
                      <span className="font-medium">{event.actorName} </span>
                    )}
                    {AUDIT_EVENT_LABELS[event.eventType] || event.eventType}
                    {event.details?.reason ? (
                      <span className="text-muted-foreground">
                        {' '}
                        - {String(event.details.reason as string)}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface CancelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  documentTitle: string;
  isLoading: boolean;
}

function CancelDialog({
  isOpen,
  onClose,
  onConfirm,
  documentTitle,
  isLoading,
}: CancelDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Signatur-Anfrage stornieren
          </AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie die Signatur-Anfrage für &quot;{documentTitle}&quot; wirklich
            stornieren? Alle ausstehenden Unterschriften werden abgebrochen und die
            Unterzeichner werden benachrichtigt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? 'Storniere...' : 'Stornieren'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface SignatureRequestCardProps {
  request: SignatureRequest;
  onDownload: (id: string) => void;
  onShowAuditTrail: (id: string) => void;
  onSendReminder: (id: string, signerId: string) => void;
  onCancel: (id: string) => void;
  isDownloading: boolean;
  isSendingReminder: boolean;
}

function SignatureRequestCard({
  request,
  onDownload,
  onShowAuditTrail,
  onSendReminder,
  onCancel,
  isDownloading,
  isSendingReminder,
}: SignatureRequestCardProps) {
  const isPending =
    request.status === 'draft' ||
    request.status === 'sent' ||
    request.status === 'partially_signed';
  const isCompleted = request.status === 'completed';
  const canCancel = isPending;

  // Find signers who haven't signed yet
  const pendingSigners = request.signers.filter(
    (s) => s.status.status !== 'signed' && s.status.status !== 'declined'
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg font-semibold">
              {request.documentTitle}
            </CardTitle>
          </div>
          <StatusBadge status={request.status} />
        </div>
        <p className="text-sm text-muted-foreground">Erstellt: {formatDate(request.createdAt)}</p>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4">
        <SignerList signers={request.signers} />
      </CardContent>

      <Separator />

      <CardFooter className="pt-4 flex flex-wrap gap-2">
        {/* Download PDF - only for completed */}
        {isCompleted && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownload(request.id)}
                  disabled={isDownloading}
                >
                  <Download className="h-4 w-4 mr-1" />
                  PDF herunterladen
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Unterschriebenes Dokument herunterladen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Send Reminder - only for pending with pending signers */}
        {isPending && pendingSigners.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSendReminder(request.id, pendingSigners[0].id)}
                  disabled={isSendingReminder}
                >
                  <Bell className="h-4 w-4 mr-1" />
                  Erinnerung senden
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Erinnerung an ausstehende Unterzeichner senden</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Audit Trail - always available */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShowAuditTrail(request.id)}
              >
                <ClipboardList className="h-4 w-4 mr-1" />
                Audit-Trail
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Signatur-Protokoll anzeigen</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Cancel - only for pending */}
        {canCancel && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(request.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Stornieren
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Signatur-Anfrage stornieren</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function SignatureRequestCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-32 mt-2" />
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="pt-4 flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SignatureStatusDashboard({ className }: SignatureStatusDashboardProps) {
  // Hook
  const {
    requests,
    auditTrail,
    isLoading,
    error,
    fetchRequests,
    fetchAuditTrail,
    downloadSignedDocument,
    sendReminder,
    cancelRequest,
    clearError,
  } = useSignature();

  // Local State
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Fetch requests on mount
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Filtered and sorted requests
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Apply status filter
    if (filterStatus === 'pending') {
      filtered = filtered.filter(
        (r) =>
          r.status === 'draft' ||
          r.status === 'sent' ||
          r.status === 'partially_signed'
      );
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter((r) => r.status === 'completed');
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [requests, filterStatus, sortOrder]);

  // Selected request for dialogs
  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId),
    [requests, selectedRequestId]
  );

  // Handlers
  const handleDownload = async (requestId: string) => {
    setIsDownloading(true);
    try {
      await downloadSignedDocument(requestId);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShowAuditTrail = async (requestId: string) => {
    setSelectedRequestId(requestId);
    setAuditModalOpen(true);
    setIsLoadingAudit(true);
    try {
      await fetchAuditTrail(requestId);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleSendReminder = async (requestId: string, signerId: string) => {
    setIsSendingReminder(true);
    try {
      await sendReminder(requestId, signerId);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleCancelClick = (requestId: string) => {
    setSelectedRequestId(requestId);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedRequestId) return;
    setIsCancelling(true);
    try {
      await cancelRequest(selectedRequestId);
      setCancelDialogOpen(false);
    } finally {
      setIsCancelling(false);
    }
  };

  // Render
  return (
    <div className={className}>
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-foreground">Signatur-Anfragen</h2>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <Select
            value={filterStatus}
            onValueChange={(value) => setFilterStatus(value as FilterStatus)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="completed">Abgeschlossen</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Order */}
          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as SortOrder)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sortierung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Neueste zuerst</SelectItem>
              <SelectItem value="oldest">Aelteste zuerst</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="ml-auto text-red-600 hover:text-red-700"
            >
              Schließen
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && requests.length === 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <SignatureRequestCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredRequests.length === 0 && (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-warm-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Keine Signatur-Anfragen
          </h3>
          <p className="text-muted-foreground">
            {filterStatus === 'all'
              ? 'Es wurden noch keine Signatur-Anfragen erstellt.'
              : filterStatus === 'pending'
              ? 'Keine ausstehenden Signatur-Anfragen.'
              : 'Keine abgeschlossenen Signatur-Anfragen.'}
          </p>
        </div>
      )}

      {/* Requests Grid */}
      {filteredRequests.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {filteredRequests.map((request) => (
            <SignatureRequestCard
              key={request.id}
              request={request}
              onDownload={handleDownload}
              onShowAuditTrail={handleShowAuditTrail}
              onSendReminder={handleSendReminder}
              onCancel={handleCancelClick}
              isDownloading={isDownloading}
              isSendingReminder={isSendingReminder}
            />
          ))}
        </div>
      )}

      {/* Audit Trail Modal */}
      <AuditTrailModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        events={auditTrail?.events || []}
        documentTitle={selectedRequest?.documentTitle || ''}
        isLoading={isLoadingAudit}
      />

      {/* Cancel Confirmation Dialog */}
      <CancelDialog
        isOpen={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleConfirmCancel}
        documentTitle={selectedRequest?.documentTitle || ''}
        isLoading={isCancelling}
      />
    </div>
  );
}

export default SignatureStatusDashboard;
