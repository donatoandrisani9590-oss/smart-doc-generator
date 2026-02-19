/**
 * ClauseApprovalWorkflow - 4-Augen-Prinzip für Textbausteine
 *
 * v4.2 Feature (Kapitel 15.3):
 * - HRBP erstellt Entwurf
 * - Rechtsabteilung prüft
 * - HR-Leitung gibt frei
 * - Textbaustein wird aktiv
 */

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
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
    FileEdit,
    Clock,
    CheckCircle,
    XCircle,
    Zap,
    Send,
    Loader2,
    RotateCcw,
    AlertCircle,
    ThumbsUp,
    ThumbsDown,
} from "lucide-react";

type ApprovalStatus = "draft" | "pending" | "approved" | "rejected" | "active";

interface ApprovalStatusInfo {
    clause_id: number;
    clause_title: string;
    approval_status: ApprovalStatus;
    approval_requested_at: string | null;
    approval_requested_by: string | null;
    approval_reviewed_at: string | null;
    approval_reviewed_by: string | null;
    approval_comment: string | null;
}

const STATUS_CONFIG: Record<ApprovalStatus, {
    label: string;
    icon: typeof FileEdit;
    color: string;
    bgColor: string;
}> = {
    draft: {
        label: "Entwurf",
        icon: FileEdit,
        color: "text-slate-500",
        bgColor: "bg-slate-100 dark:bg-slate-800",
    },
    pending: {
        label: "Zur Prüfung",
        icon: Clock,
        color: "text-amber-500",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    approved: {
        label: "Freigegeben",
        icon: CheckCircle,
        color: "text-green-500",
        bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    rejected: {
        label: "Abgelehnt",
        icon: XCircle,
        color: "text-red-500",
        bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    active: {
        label: "Aktiv",
        icon: Zap,
        color: "text-blue-500",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
};

interface ClauseApprovalWorkflowProps {
    clauseId: number;
    clauseTitle: string;
    currentStatus: ApprovalStatus;
    statusInfo?: ApprovalStatusInfo;
    isAdmin?: boolean;
    onStatusChange?: () => void;
}

export function ClauseApprovalWorkflow({
    clauseId,
    clauseTitle,
    currentStatus,
    statusInfo,
    isAdmin = false,
    onStatusChange,
}: ClauseApprovalWorkflowProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showRequestDialog, setShowRequestDialog] = useState(false);
    const [showReviewDialog, setShowReviewDialog] = useState(false);
    const [comment, setComment] = useState("");
    const [error, setError] = useState<string | null>(null);

    const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.active;
    const StatusIcon = config.icon;

    const requestApproval = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiFetch(`/api/v1/clause-approval/${clauseId}/request-approval`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ comment }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Anforderung fehlgeschlagen");
            }
            setShowRequestDialog(false);
            setComment("");
            onStatusChange?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    const submitReview = async (approved: boolean) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiFetch(`/api/v1/clause-approval/${clauseId}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approved, comment }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Prüfung fehlgeschlagen");
            }
            setShowReviewDialog(false);
            setComment("");
            onStatusChange?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    const resetToDraft = async () => {
        setIsLoading(true);
        try {
            await apiFetch(`/api/v1/clause-approval/${clauseId}/reset-to-draft`, {
                method: "POST",
            });
            onStatusChange?.();
        } catch (err) {
            console.error("Reset failed:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Status Badge with Workflow Steps */}
            <div className={`rounded-lg p-4 ${config.bgColor}`}>
                {/* Current Status */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <StatusIcon className={`w-5 h-5 ${config.color}`} />
                        <span className="font-medium">{config.label}</span>
                    </div>
                    <Badge variant="outline" className={config.color}>
                        {currentStatus.toUpperCase()}
                    </Badge>
                </div>

                {/* Workflow Timeline */}
                <div className="flex items-center justify-between text-xs mb-4">
                    <div className={`flex flex-col items-center ${currentStatus === "draft" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStatus === "draft" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <FileEdit className="w-4 h-4" />
                        </div>
                        <span className="mt-1">Entwurf</span>
                    </div>
                    <div className="flex-1 h-0.5 bg-muted mx-2" />
                    <div className={`flex flex-col items-center ${currentStatus === "pending" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStatus === "pending" ? "bg-amber-500 text-white" : "bg-muted"}`}>
                            <Clock className="w-4 h-4" />
                        </div>
                        <span className="mt-1">Prüfung</span>
                    </div>
                    <div className="flex-1 h-0.5 bg-muted mx-2" />
                    <div className={`flex flex-col items-center ${currentStatus === "active" ? "text-primary font-medium" : currentStatus === "rejected" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStatus === "active" ? "bg-green-500 text-white" : currentStatus === "rejected" ? "bg-destructive text-destructive-foreground" : "bg-muted"}`}>
                            {currentStatus === "rejected" ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </div>
                        <span className="mt-1">{currentStatus === "rejected" ? "Abgelehnt" : "Aktiv"}</span>
                    </div>
                </div>

                {/* Status Details */}
                {statusInfo && (
                    <div className="text-sm space-y-1 border-t pt-3">
                        {statusInfo.approval_requested_by && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Angefordert von:</span>
                                <span>{statusInfo.approval_requested_by}</span>
                            </div>
                        )}
                        {statusInfo.approval_requested_at && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Angefordert am:</span>
                                <span>{new Date(statusInfo.approval_requested_at).toLocaleDateString("de-DE")}</span>
                            </div>
                        )}
                        {statusInfo.approval_reviewed_by && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Geprüft von:</span>
                                <span>{statusInfo.approval_reviewed_by}</span>
                            </div>
                        )}
                        {statusInfo.approval_comment && (
                            <div className="mt-2 p-2 bg-background/50 rounded text-sm">
                                <span className="text-muted-foreground">Kommentar: </span>
                                {statusInfo.approval_comment}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                {/* Request Approval Button (for non-pending clauses) */}
                {(currentStatus === "draft" || currentStatus === "active" || currentStatus === "rejected") && (
                    <Button
                        variant="outline"
                        onClick={() => setShowRequestDialog(true)}
                        disabled={isLoading}
                    >
                        <Send className="w-4 h-4 mr-2" />
                        Zur Prüfung einreichen
                    </Button>
                )}

                {/* Review Buttons (for admins on pending clauses) */}
                {currentStatus === "pending" && isAdmin && (
                    <Button
                        onClick={() => setShowReviewDialog(true)}
                        disabled={isLoading}
                    >
                        Prüfen & Entscheiden
                    </Button>
                )}

                {/* Reset to Draft (for rejected clauses) */}
                {currentStatus === "rejected" && (
                    <Button
                        variant="ghost"
                        onClick={resetToDraft}
                        disabled={isLoading}
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Zurück zu Entwurf
                    </Button>
                )}
            </div>

            {/* Request Approval Dialog */}
            <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Freigabe anfordern</DialogTitle>
                        <DialogDescription>
                            Reiche den Textbaustein "{clauseTitle}" zur Prüfung ein.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Textarea
                            placeholder="Optionaler Kommentar für den Prüfer..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                        />

                        {error && (
                            <div className="bg-destructive/10 text-destructive rounded p-3 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
                            Abbrechen
                        </Button>
                        <Button onClick={requestApproval} disabled={isLoading}>
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Einreichen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Review Dialog */}
            <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Textbaustein prüfen</DialogTitle>
                        <DialogDescription>
                            Prüfe den Textbaustein "{clauseTitle}" und triff eine Entscheidung.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Textarea
                            placeholder="Begründung / Feedback..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                        />

                        {error && (
                            <div className="bg-destructive/10 text-destructive rounded p-3 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => submitReview(false)}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ThumbsDown className="w-4 h-4 mr-2" />}
                            Ablehnen
                        </Button>
                        <Button
                            onClick={() => submitReview(true)}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ThumbsUp className="w-4 h-4 mr-2" />}
                            Freigeben
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
