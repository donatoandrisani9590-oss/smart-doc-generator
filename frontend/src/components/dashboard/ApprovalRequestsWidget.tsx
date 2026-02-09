/**
 * ApprovalRequestsWidget - Optional approval workflow UI
 *
 * ContractHero-inspiriert: Zeigt ausstehende Genehmigungen
 * WICHTIG: Dieser Workflow ist FREIWILLIG und nicht verpflichtend!
 *
 * Features:
 * - Pending approvals count
 * - Quick approve/reject actions
 * - Linked to full approval queue
 *
 * Respektiert Feature-Toggle: enable_approval_workflow
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Check,
  ChevronRight,
  FileText,
  AlertCircle,
  User,
  ThumbsUp,
  ThumbsDown,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";

// Types
interface PendingApprovalItem {
  id: number;
  title: string;
  content_html: string | null;
  category: string | null;
  country_code: string | null;
  version: number;
  approval_status: string;
  approval_requested_at: string | null;
  approval_requested_by: string | null;
  notes: string | null;
}

interface PendingApprovalResponse {
  clauses: PendingApprovalItem[];
  total: number;
}

interface ApprovalRequestsWidgetProps {
  /** Maximum number of items to show */
  limit?: number;
  /** Custom class name */
  className?: string;
}

export function ApprovalRequestsWidget({
  limit = 3,
  className,
}: ApprovalRequestsWidgetProps) {
  const navigate = useNavigate();
  const isEnabled = useFeatureEnabled("enable_approval_workflow");

  const [approvals, setApprovals] = useState<PendingApprovalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval dialog state
  const [selectedItem, setSelectedItem] = useState<PendingApprovalItem | null>(null);
  const [dialogType, setDialogType] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch pending approvals
  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<PendingApprovalResponse>(
        "/api/v1/clause-approval/pending"
      );
      setApprovals(response.data.clauses);
      setTotal(response.data.total);
    } catch (err) {
      console.error("Failed to load approvals:", err);
      setError("Genehmigungen konnten nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isEnabled) {
      fetchApprovals();
    }
  }, [fetchApprovals, isEnabled]);

  // Handle approve
  const handleApprove = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/clause-approval/${selectedItem.id}/approve`, {
        comment: comment || undefined,
      });
      toast.success("Textbaustein genehmigt");
      setDialogType(null);
      setSelectedItem(null);
      setComment("");
      fetchApprovals();
    } catch {
      toast.error("Genehmigung fehlgeschlagen");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!selectedItem || !comment.trim()) return;

    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/clause-approval/${selectedItem.id}/reject`, {
        reason: comment,
      });
      toast.success("Textbaustein abgelehnt");
      setDialogType(null);
      setSelectedItem(null);
      setComment("");
      fetchApprovals();
    } catch {
      toast.error("Ablehnung fehlgeschlagen");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open dialog
  const openDialog = (item: PendingApprovalItem, type: "approve" | "reject") => {
    setSelectedItem(item);
    setDialogType(type);
    setComment("");
  };

  // Don't render if feature is disabled
  if (!isEnabled) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchApprovals} className="mt-2">
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No pending approvals
  if (total === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Genehmigungen</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Info className="w-3 h-3" />
                    Optional
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Dieser Workflow ist freiwillig und nicht verpflichtend
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Check className="w-10 h-10 mx-auto text-green-500 mb-2" />
            <p className="font-medium text-green-600">Keine offenen Anfragen</p>
            <p className="text-sm text-muted-foreground">
              Alle Genehmigungen wurden bearbeitet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleItems = approvals.slice(0, limit);

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Genehmigungen</CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Info className="w-3 h-3" />
                    Optional
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Dieser Workflow ist freiwillig und nicht verpflichtend
                </TooltipContent>
              </Tooltip>
              {total > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                  {total} offen
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate("/settings?tab=advanced&section=approvals")}
            >
              Alle anzeigen
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50/50 border-amber-200"
            >
              {/* Icon */}
              <div className="p-2 rounded-lg bg-amber-100">
                <FileText className="w-4 h-4 text-amber-600" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.approval_requested_by && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {item.approval_requested_by}
                    </span>
                  )}
                  {item.approval_requested_at && (
                    <span>
                      vor{" "}
                      {formatDistanceToNow(new Date(item.approval_requested_at), {
                        locale: de,
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700"
                      onClick={() => openDialog(item, "approve")}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Genehmigen</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700"
                      onClick={() => openDialog(item, "reject")}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ablehnen</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}

          {total > limit && (
            <Button
              variant="ghost"
              className="w-full text-xs"
              onClick={() => navigate("/settings?tab=advanced&section=approvals")}
            >
              +{total - limit} weitere Anfragen
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <AlertDialog
        open={dialogType === "approve"}
        onOpenChange={(open) => !open && setDialogType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Textbaustein genehmigen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedItem?.title}</strong> wird zur Verwendung
              freigegeben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Optionaler Kommentar..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "..." : "Genehmigen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog
        open={dialogType === "reject"}
        onOpenChange={(open) => !open && setDialogType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Textbaustein ablehnen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedItem?.title}</strong> wird zur Überarbeitung
              zurückgewiesen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Begründung für die Ablehnung (erforderlich)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            required
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isSubmitting || !comment.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "..." : "Ablehnen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

export default ApprovalRequestsWidget;
