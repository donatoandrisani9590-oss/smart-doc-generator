/**
 * ClauseApprovalQueue - Admin-Seite für ausstehende Textbaustein-Freigaben
 *
 * Smart UX Phase 3:
 * - Zeigt alle zur Prüfung eingereichten Textbausteine
 * - Ermöglicht Freigabe oder Ablehnung
 * - Zeigt Vorschau und Kontext
 */

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
    CheckCircle,
    XCircle,
    Clock,
    Eye,
    User,
    FileText,
    Filter,
    Loader2,
    AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { sanitizeHtml } from "@/utils/sanitize";

interface PendingClause {
    id: number;
    title: string;
    content_html: string;
    category: string;
    country_code: string;
    approval_status: string;
    approval_requested_at: string;
    approval_requested_by: string;
    notes?: string;
}

interface ApprovalResponse {
    clauses: PendingClause[];
    total: number;
}

export const ClauseApprovalQueue = () => {
    const toast = useToast();

    const [clauses, setClauses] = useState<PendingClause[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

    // Preview Dialog
    const [previewClause, setPreviewClause] = useState<PendingClause | null>(null);

    // Rejection Dialog
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectingClauseId, setRejectingClauseId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Load pending clauses
    useEffect(() => {
        const loadClauses = async () => {
            setIsLoading(true);
            try {
                const statusParam = filter !== "all" ? `?status=${filter}` : "";
                const response = await api.get<ApprovalResponse>(
                    `/api/v1/clause-approval/pending${statusParam}`
                );
                setClauses(response.data.clauses);
            } catch (error) {
                logError("Failed to load pending clauses", { error });
                toast.error("Fehler", "Ausstehende Textbausteine konnten nicht geladen werden");
            } finally {
                setIsLoading(false);
            }
        };
        loadClauses();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable; only re-fetch when filter changes
    }, [filter]);

    const handleApprove = async (clauseId: number) => {
        setIsProcessing(true);
        try {
            await api.post(`/api/v1/clause-approval/${clauseId}/approve`);
            setClauses((prev) => prev.filter((c) => c.id !== clauseId));
            toast.success("Textbaustein freigegeben", "Der Textbaustein ist jetzt in der Bibliothek verfügbar");
        } catch (error) {
            logError("Failed to approve clause", { error });
            toast.error("Fehler", "Textbaustein konnte nicht freigegeben werden");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRejectClick = (clauseId: number) => {
        setRejectingClauseId(clauseId);
        setRejectReason("");
        setRejectDialogOpen(true);
    };

    const handleRejectConfirm = async () => {
        if (!rejectingClauseId) return;

        setIsProcessing(true);
        try {
            await api.post(`/api/v1/clause-approval/${rejectingClauseId}/reject`, {
                reason: rejectReason,
            });
            setClauses((prev) => prev.filter((c) => c.id !== rejectingClauseId));
            setRejectDialogOpen(false);
            setRejectingClauseId(null);
            toast.success("Textbaustein abgelehnt", "Der Ersteller wurde benachrichtigt");
        } catch (error) {
            logError("Failed to reject clause", { error });
            toast.error("Fehler", "Textbaustein konnte nicht abgelehnt werden");
        } finally {
            setIsProcessing(false);
        }
    };

    const getCategoryLabel = (category: string): string => {
        const labels: Record<string, string> = {
            allgemein: "Allgemeine Bestimmungen",
            arbeitszeit: "Arbeitszeit",
            verguetung: "Vergütung & Zusatzleistungen",
            urlaub: "Urlaub & Freistellung",
            kuendigung: "Kündigung & Beendigung",
            geheimhaltung: "Geheimhaltung & Wettbewerb",
            homeoffice: "Homeoffice & Remote Work",
            sonstiges: "Sonstiges",
        };
        return labels[category] || category;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Textbaustein-Freigaben</h1>
                    <p className="text-sm text-muted-foreground">
                        Prüfen und genehmigen Sie eingereichte Textbausteine für die Bibliothek
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Ausstehend</SelectItem>
                            <SelectItem value="approved">Freigegeben</SelectItem>
                            <SelectItem value="rejected">Abgelehnt</SelectItem>
                            <SelectItem value="all">Alle</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Empty State */}
            {clauses.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Keine ausstehenden Freigaben</h3>
                        <p className="text-muted-foreground text-center">
                            Alle eingereichten Textbausteine wurden bearbeitet.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Clause Cards */}
            <div className="grid gap-4">
                {clauses.map((clause) => (
                    <Card key={clause.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        {clause.title}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-4 mt-2">
                                        <Badge variant="outline">{getCategoryLabel(clause.category)}</Badge>
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {clause.approval_requested_by}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(clause.approval_requested_at), "dd.MM.yyyy HH:mm", { locale: de })}
                                        </span>
                                    </CardDescription>
                                </div>
                                <Badge
                                    variant={
                                        clause.approval_status === "pending"
                                            ? "secondary"
                                            : clause.approval_status === "approved"
                                            ? "default"
                                            : "destructive"
                                    }
                                >
                                    {clause.approval_status === "pending" && "Ausstehend"}
                                    {clause.approval_status === "approved" && "Freigegeben"}
                                    {clause.approval_status === "rejected" && "Abgelehnt"}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {/* Preview */}
                            <div
                                className="p-3 bg-muted rounded-lg text-sm prose prose-sm max-w-none max-h-32 overflow-hidden relative"
                                dangerouslySetInnerHTML={{
                                    __html: sanitizeHtml(clause.content_html?.slice(0, 500) || ""),
                                }}
                            />
                            {(clause.content_html?.length || 0) > 500 && (
                                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted to-transparent" />
                            )}

                            {clause.notes && (
                                <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-800">
                                    <strong>Notizen:</strong> {clause.notes}
                                </div>
                            )}
                        </CardContent>

                        {clause.approval_status === "pending" && (
                            <CardFooter className="flex justify-end gap-2 border-t pt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPreviewClause(clause)}
                                >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Vorschau
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRejectClick(clause.id)}
                                    disabled={isProcessing}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Ablehnen
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleApprove(clause.id)}
                                    disabled={isProcessing}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Freigeben
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                ))}
            </div>

            {/* Preview Dialog */}
            <Dialog open={!!previewClause} onOpenChange={() => setPreviewClause(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>{previewClause?.title}</DialogTitle>
                        <DialogDescription>
                            Vollständige Vorschau des Textbausteins
                        </DialogDescription>
                    </DialogHeader>
                    <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(previewClause?.content_html || ""),
                        }}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewClause(null)}>
                            Schließen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rejection Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Textbaustein ablehnen
                        </DialogTitle>
                        <DialogDescription>
                            Bitte geben Sie einen Grund für die Ablehnung an. Der Ersteller wird benachrichtigt.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reject-reason">Begründung</Label>
                            <Textarea
                                id="reject-reason"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="z.B. Inhalt ist zu spezifisch für die allgemeine Bibliothek..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRejectDialogOpen(false)}
                            disabled={isProcessing}
                        >
                            Abbrechen
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRejectConfirm}
                            disabled={isProcessing || !rejectReason.trim()}
                        >
                            {isProcessing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <XCircle className="w-4 h-4 mr-2" />
                            )}
                            Ablehnen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ClauseApprovalQueue;
