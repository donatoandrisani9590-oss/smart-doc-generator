/**
 * DocumentApprovalPanel - Freigabe-Workflow UI für Dokumente
 *
 * Zeigt den Freigabe-Status an und bietet kontextabhängige Aktionen:
 * - Kein Approval: "Freigabe anfordern" Button → Dialog
 * - Pending + Approver: Freigeben / Änderungen anfordern / Ablehnen
 * - Changes Requested + Ersteller: "Erneut einreichen"
 * - Approved/Rejected: Nur Status-Anzeige
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Shield,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Send,
    RotateCcw,
    User,
    Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useMentionSuggestions } from "@/hooks/useComments";
import type { UserSuggestion } from "@/hooks/useComments";
import {
    useDocumentApproval,
    useRequestApproval,
    useApproveDocument,
    useRejectDocument,
    useRequestChanges,
    useResubmitApproval,
} from "@/hooks/useDocumentApproval";
import type { ApprovalPriority, ApprovalStatus } from "@/hooks/useDocumentApproval";

// ═══════════════════════════════════════════════════════════════════════════
// STATUS CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<
    ApprovalStatus,
    { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
    pending_approval: {
        label: "Ausstehend",
        color: "text-amber-700",
        bgColor: "bg-amber-50 border-amber-200",
        icon: Clock,
    },
    approved: {
        label: "Freigegeben",
        color: "text-green-700",
        bgColor: "bg-green-50 border-green-200",
        icon: CheckCircle2,
    },
    changes_requested: {
        label: "Änderungen angefordert",
        color: "text-orange-700",
        bgColor: "bg-orange-50 border-orange-200",
        icon: AlertTriangle,
    },
    rejected: {
        label: "Abgelehnt",
        color: "text-red-700",
        bgColor: "bg-red-50 border-red-200",
        icon: XCircle,
    },
};

const PRIORITY_CONFIG: Record<ApprovalPriority, { label: string; color: string }> = {
    low: { label: "Niedrig", color: "text-muted-foreground" },
    normal: { label: "Normal", color: "text-foreground" },
    high: { label: "Hoch", color: "text-amber-600" },
    urgent: { label: "Dringend", color: "text-red-600" },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface DocumentApprovalPanelProps {
    documentId: number;
}

export const DocumentApprovalPanel = ({ documentId }: DocumentApprovalPanelProps) => {
    const { user } = useAuth();
    const { data: approval, isLoading } = useDocumentApproval(documentId);

    // Mutations
    const requestApproval = useRequestApproval();
    const approveDocument = useApproveDocument();
    const rejectDocument = useRejectDocument();
    const requestChanges = useRequestChanges();
    const resubmitApproval = useResubmitApproval();

    // Dialog State
    const [showRequestDialog, setShowRequestDialog] = useState(false);
    const [showDecisionDialog, setShowDecisionDialog] = useState<
        "approve" | "reject" | "changes" | "resubmit" | null
    >(null);
    const [comment, setComment] = useState("");
    const [priority, setPriority] = useState<ApprovalPriority>("normal");

    // Approver-Suche
    const [approverQuery, setApproverQuery] = useState("");
    const [selectedApprover, setSelectedApprover] = useState<UserSuggestion | null>(null);
    const { data: approverSuggestions = [] } = useMentionSuggestions(approverQuery, {
        enabled: approverQuery.length >= 1,
    });

    // Berechtigungen
    const isApprover = approval && user && approval.approver_id === user.id;
    const isRequester = approval && user && approval.requested_by_id === user.id;

    // ── Request Approval ────────────────────────────────────────────────

    const handleRequestApproval = useCallback(async () => {
        if (!selectedApprover) return;

        try {
            await requestApproval.mutateAsync({
                document_id: documentId,
                approver_id: selectedApprover.id,
                priority,
                comment: comment || undefined,
            });
            toast.success("Freigabe angefordert");
            setShowRequestDialog(false);
            // eslint-disable-next-line react-hooks/immutability -- variable referenced in callback, not during render
            resetDialogState();
        } catch {
            toast.error("Freigabe-Anfrage fehlgeschlagen");
        }
    }, [selectedApprover, documentId, priority, comment, requestApproval]);

    // ── Decision Handlers ───────────────────────────────────────────────

    const handleDecision = useCallback(async () => {
        if (!approval) return;

        try {
            switch (showDecisionDialog) {
                case "approve":
                    await approveDocument.mutateAsync({
                        approvalId: approval.id,
                        comment: comment || undefined,
                    });
                    toast.success("Dokument freigegeben");
                    break;
                case "reject":
                    if (!comment.trim()) return;
                    await rejectDocument.mutateAsync({
                        approvalId: approval.id,
                        comment,
                    });
                    toast.success("Dokument abgelehnt");
                    break;
                case "changes":
                    if (!comment.trim()) return;
                    await requestChanges.mutateAsync({
                        approvalId: approval.id,
                        comment,
                    });
                    toast.success("Änderungen angefordert");
                    break;
                case "resubmit":
                    await resubmitApproval.mutateAsync({
                        approvalId: approval.id,
                        comment: comment || undefined,
                    });
                    toast.success("Erneut eingereicht");
                    break;
            }
            setShowDecisionDialog(null);
            resetDialogState();
        } catch {
            toast.error("Aktion fehlgeschlagen");
        }
    }, [
        approval,
        showDecisionDialog,
        comment,
        approveDocument,
        rejectDocument,
        requestChanges,
        resubmitApproval,
    ]);

    const resetDialogState = () => {
        setComment("");
        setPriority("normal");
        setApproverQuery("");
        setSelectedApprover(null);
    };

    const isMutating =
        requestApproval.isPending ||
        approveDocument.isPending ||
        rejectDocument.isPending ||
        requestChanges.isPending ||
        resubmitApproval.isPending;

    // ── Loading State ───────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ── Kein Approval vorhanden ─────────────────────────────────────────

    if (!approval) {
        return (
            <div className="space-y-4">
                <div className="card-soft p-0 overflow-hidden">
                    <div className="px-4 py-2.5 info-card-header">
                        <h3 className="text-xs font-medium flex items-center gap-2 uppercase tracking-wide">
                            <Shield className="w-3.5 h-3.5 text-primary" />
                            Freigabe-Status
                        </h3>
                    </div>
                    <div className="p-4 text-center space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Noch keine Freigabe angefordert
                        </p>
                        <Button
                            size="sm"
                            onClick={() => setShowRequestDialog(true)}
                        >
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                            Freigabe anfordern
                        </Button>
                    </div>
                </div>

                {/* Request Dialog */}
                <RequestApprovalDialog
                    open={showRequestDialog}
                    onOpenChange={(open) => {
                        setShowRequestDialog(open);
                        if (!open) resetDialogState();
                    }}
                    approverQuery={approverQuery}
                    onApproverQueryChange={setApproverQuery}
                    approverSuggestions={approverSuggestions}
                    selectedApprover={selectedApprover}
                    onSelectApprover={setSelectedApprover}
                    priority={priority}
                    onPriorityChange={setPriority}
                    comment={comment}
                    onCommentChange={setComment}
                    onSubmit={handleRequestApproval}
                    isSubmitting={isMutating}
                />
            </div>
        );
    }

    // ── Approval vorhanden: Status + Aktionen ───────────────────────────

    const statusCfg = STATUS_CONFIG[approval.status];
    const priorityCfg = PRIORITY_CONFIG[approval.priority];
    const StatusIcon = statusCfg.icon;

    return (
        <div className="space-y-4">
            {/* Status Card */}
            <div className="card-soft p-0 overflow-hidden">
                <div className="px-4 py-2.5 info-card-header">
                    <h3 className="text-xs font-medium flex items-center gap-2 uppercase tracking-wide">
                        <Shield className="w-3.5 h-3.5 text-primary" />
                        Freigabe-Status
                    </h3>
                </div>
                <div className="p-4 space-y-3">
                    {/* Status Badge */}
                    <div
                        className={`flex items-center gap-2 p-3 rounded-lg border ${statusCfg.bgColor}`}
                    >
                        <StatusIcon className={`w-5 h-5 ${statusCfg.color}`} />
                        <span className={`font-medium text-sm ${statusCfg.color}`}>
                            {statusCfg.label}
                        </span>
                        <Badge
                            variant="outline"
                            className={`ml-auto text-[10px] ${priorityCfg.color}`}
                        >
                            {priorityCfg.label}
                        </Badge>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                        {approval.approver_email && (
                            <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Prüfer:</span>
                                <span className="font-medium">
                                    {approval.approver_email}
                                </span>
                            </div>
                        )}
                        {approval.requested_by_email && (
                            <div className="flex items-center gap-2">
                                <Send className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Angefordert von:</span>
                                <span className="font-medium">
                                    {approval.requested_by_email}
                                </span>
                            </div>
                        )}
                        {approval.requested_at && (
                            <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Angefordert:</span>
                                <span className="font-medium">
                                    vor{" "}
                                    {formatDistanceToNow(new Date(approval.requested_at), {
                                        locale: de,
                                    })}
                                </span>
                            </div>
                        )}
                        {approval.decided_at && (
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Entschieden:</span>
                                <span className="font-medium">
                                    vor{" "}
                                    {formatDistanceToNow(new Date(approval.decided_at), {
                                        locale: de,
                                    })}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Decision Comment */}
                    {approval.decision_comment && (
                        <div className="p-3 bg-warm-50 rounded-lg border border-warm-200/50">
                            <p className="text-xs text-muted-foreground mb-1 font-medium">
                                Kommentar
                            </p>
                            <p className="text-sm">{approval.decision_comment}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Aktionen */}
            {approval.status === "pending_approval" && isApprover && (
                <div className="card-soft p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                        Aktionen
                    </p>
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="sm"
                        onClick={() => setShowDecisionDialog("approve")}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Freigeben
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                        size="sm"
                        onClick={() => setShowDecisionDialog("changes")}
                    >
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                        Änderungen anfordern
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full border-red-300 text-red-700 hover:bg-red-50"
                        size="sm"
                        onClick={() => setShowDecisionDialog("reject")}
                    >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        Ablehnen
                    </Button>
                </div>
            )}

            {approval.status === "changes_requested" && isRequester && (
                <div className="card-soft p-4">
                    <Button
                        className="w-full"
                        size="sm"
                        onClick={() => setShowDecisionDialog("resubmit")}
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Erneut einreichen
                    </Button>
                </div>
            )}

            {/* Decision Dialog */}
            <DecisionDialog
                open={showDecisionDialog !== null}
                type={showDecisionDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowDecisionDialog(null);
                        resetDialogState();
                    }
                }}
                comment={comment}
                onCommentChange={setComment}
                onSubmit={handleDecision}
                isSubmitting={isMutating}
            />
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST DIALOG
// ═══════════════════════════════════════════════════════════════════════════

interface RequestApprovalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    approverQuery: string;
    onApproverQueryChange: (query: string) => void;
    approverSuggestions: UserSuggestion[];
    selectedApprover: UserSuggestion | null;
    onSelectApprover: (user: UserSuggestion | null) => void;
    priority: ApprovalPriority;
    onPriorityChange: (priority: ApprovalPriority) => void;
    comment: string;
    onCommentChange: (comment: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
}

function RequestApprovalDialog({
    open,
    onOpenChange,
    approverQuery,
    onApproverQueryChange,
    approverSuggestions,
    selectedApprover,
    onSelectApprover,
    priority,
    onPriorityChange,
    comment,
    onCommentChange,
    onSubmit,
    isSubmitting,
}: RequestApprovalDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Freigabe anfordern</DialogTitle>
                    <DialogDescription>
                        Wähle einen Prüfer, der dieses Dokument freigeben soll.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Approver Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Prüfer *</label>
                        {selectedApprover ? (
                            <div className="flex items-center gap-2 p-2 bg-warm-50 rounded-lg border border-warm-200/50">
                                <User className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium flex-1">
                                    {selectedApprover.name || selectedApprover.email}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => onSelectApprover(null)}
                                >
                                    Ändern
                                </Button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 text-sm border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    placeholder="Name oder E-Mail eingeben..."
                                    value={approverQuery}
                                    onChange={(e) => onApproverQueryChange(e.target.value)}
                                />
                                {approverSuggestions.length > 0 && approverQuery.length >= 1 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-warm-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                        {approverSuggestions.map((suggestion) => (
                                            <button
                                                key={suggestion.id}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-warm-50 flex items-center gap-2"
                                                onClick={() => {
                                                    onSelectApprover(suggestion);
                                                    onApproverQueryChange("");
                                                }}
                                            >
                                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                <div>
                                                    {suggestion.name && (
                                                        <span className="font-medium">
                                                            {suggestion.name}
                                                        </span>
                                                    )}
                                                    <span className="text-muted-foreground ml-1">
                                                        {suggestion.email}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Priorität</label>
                        <Select value={priority} onValueChange={(v) => onPriorityChange(v as ApprovalPriority)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Niedrig</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">Hoch</SelectItem>
                                <SelectItem value="urgent">Dringend</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Comment */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nachricht (optional)</label>
                        <Textarea
                            placeholder="Nachricht an den Prüfer..."
                            value={comment}
                            onChange={(e) => onCommentChange(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        onClick={onSubmit}
                        disabled={!selectedApprover || isSubmitting}
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Freigabe anfordern
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// DECISION DIALOG
// ═══════════════════════════════════════════════════════════════════════════

interface DecisionDialogProps {
    open: boolean;
    type: "approve" | "reject" | "changes" | "resubmit" | null;
    onOpenChange: (open: boolean) => void;
    comment: string;
    onCommentChange: (comment: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
}

const DECISION_CONFIG = {
    approve: {
        title: "Dokument freigeben?",
        description: "Das Dokument wird als freigegeben markiert.",
        buttonLabel: "Freigeben",
        buttonClass: "bg-green-600 hover:bg-green-700",
        commentRequired: false,
        commentPlaceholder: "Optionaler Kommentar...",
    },
    reject: {
        title: "Dokument ablehnen?",
        description: "Das Dokument wird als abgelehnt markiert. Bitte begründe deine Entscheidung.",
        buttonLabel: "Ablehnen",
        buttonClass: "bg-red-600 hover:bg-red-700",
        commentRequired: true,
        commentPlaceholder: "Begründung für die Ablehnung (erforderlich)",
    },
    changes: {
        title: "Änderungen anfordern?",
        description:
            "Der Ersteller wird benachrichtigt, dass Änderungen erforderlich sind.",
        buttonLabel: "Änderungen anfordern",
        buttonClass: "bg-orange-600 hover:bg-orange-700",
        commentRequired: true,
        commentPlaceholder: "Beschreibe die erforderlichen Änderungen (erforderlich)",
    },
    resubmit: {
        title: "Erneut einreichen?",
        description: "Das Dokument wird erneut zur Freigabe eingereicht.",
        buttonLabel: "Erneut einreichen",
        buttonClass: "",
        commentRequired: false,
        commentPlaceholder: "Optionaler Kommentar zu den Änderungen...",
    },
};

function DecisionDialog({
    open,
    type,
    onOpenChange,
    comment,
    onCommentChange,
    onSubmit,
    isSubmitting,
}: DecisionDialogProps) {
    if (!type) return null;

    const config = DECISION_CONFIG[type];
    const isDisabled =
        isSubmitting || (config.commentRequired && !comment.trim());

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{config.title}</DialogTitle>
                    <DialogDescription>{config.description}</DialogDescription>
                </DialogHeader>

                <Textarea
                    placeholder={config.commentPlaceholder}
                    value={comment}
                    onChange={(e) => onCommentChange(e.target.value)}
                    rows={3}
                />

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        className={config.buttonClass}
                        onClick={onSubmit}
                        disabled={isDisabled}
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : null}
                        {config.buttonLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
