/**
 * GuestReviewPage - Public Document Review Page
 *
 * Allows external reviewers to view a shared document and leave comments
 * via a token-based URL. No authentication required.
 *
 * Route: /guest-review/:token
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
    FileText,
    Send,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Eye,
    MessageSquare,
    Lightbulb,
    ThumbsUp,
    User,
    ShieldAlert,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/utils/sanitize";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuestReviewData {
    document_title: string | null;
    content_html: string | null;
    permissions: "view_only" | "comment_only" | "suggest_changes";
    recipient_name: string;
    expires_at: string;
}

interface GuestComment {
    id: number;
    link_id: number;
    guest_name: string;
    comment_type: "comment" | "suggestion" | "approval";
    content: string;
    status: string;
    created_at: string;
}

type CommentType = "comment" | "suggestion" | "approval";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const COMMENT_TYPE_OPTIONS: {
    value: CommentType;
    label: string;
    icon: typeof MessageSquare;
    description: string;
}[] = [
    {
        value: "comment",
        label: "Kommentar",
        icon: MessageSquare,
        description: "Allgemeine Anmerkung",
    },
    {
        value: "suggestion",
        label: "Vorschlag",
        icon: Lightbulb,
        description: "Textänderung vorschlagen",
    },
    {
        value: "approval",
        label: "Zustimmung",
        icon: ThumbsUp,
        description: "Dokument freigeben",
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string): string {
    try {
        return new Intl.DateTimeFormat("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(isoString));
    } catch {
        return isoString;
    }
}

function formatDateShort(isoString: string): string {
    try {
        return new Intl.DateTimeFormat("de-DE", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        }).format(new Date(isoString));
    } catch {
        return isoString;
    }
}

function commentTypeLabel(type: CommentType): string {
    const map: Record<CommentType, string> = {
        comment: "Kommentar",
        suggestion: "Vorschlag",
        approval: "Zustimmung",
    };
    return map[type] ?? type;
}

function commentTypeBadgeVariant(
    type: CommentType
): "default" | "warning" | "success" {
    const map: Record<CommentType, "default" | "warning" | "success"> = {
        comment: "default",
        suggestion: "warning",
        approval: "success",
    };
    return map[type] ?? "default";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
    return (
        <div
            className="min-h-screen bg-background"
            role="status"
            aria-label="Dokument wird geladen..."
        >
            {/* Header skeleton */}
            <div className="border-b border-border bg-card">
                <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-8 w-32 rounded-full" />
                </div>
            </div>

            {/* Content skeleton */}
            <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-5 w-40 rounded-full" />
                <div
                    className="rounded-2xl bg-card p-10 space-y-6"
                    style={{ boxShadow: "var(--shadow-elevated)" }}
                >
                    <SkeletonText lines={4} />
                    <SkeletonText lines={3} />
                    <SkeletonText lines={5} />
                    <SkeletonText lines={2} />
                </div>
            </div>
            <span className="sr-only">Dokument wird geladen...</span>
        </div>
    );
}

function ErrorState({
    status,
}: {
    status: "not_found" | "expired" | "generic";
}) {
    const config = {
        not_found: {
            icon: AlertTriangle,
            title: "Review-Link nicht gefunden",
            description:
                "Der angeforderte Review-Link existiert nicht. Bitte prüfen Sie die URL oder kontaktieren Sie den Absender.",
            iconColor: "text-amber-500",
            bgColor: "bg-amber-50",
        },
        expired: {
            icon: ShieldAlert,
            title: "Review-Link abgelaufen",
            description:
                "Dieser Review-Link ist abgelaufen oder wurde deaktiviert. Bitte kontaktieren Sie den Absender für einen neuen Link.",
            iconColor: "text-destructive",
            bgColor: "bg-destructive/5",
        },
        generic: {
            icon: AlertTriangle,
            title: "Fehler beim Laden",
            description:
                "Das Dokument konnte nicht geladen werden. Bitte versuchen Sie es später erneut.",
            iconColor: "text-muted-foreground",
            bgColor: "bg-muted",
        },
    };

    const { icon: Icon, title, description, iconColor, bgColor } =
        config[status];

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div
                className="max-w-md w-full text-center rounded-2xl bg-card p-10"
                style={{ boxShadow: "var(--shadow-elevated)" }}
            >
                <div
                    className={cn(
                        "mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl",
                        bgColor
                    )}
                >
                    <Icon className={cn("h-8 w-8", iconColor)} />
                </div>
                <h1 className="text-xl font-semibold text-foreground mb-2">
                    {title}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    );
}

function ViewOnlyBanner() {
    return (
        <div
            className="flex items-center gap-3 rounded-2xl bg-muted/60 px-5 py-4"
            role="status"
        >
            <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
                Sie haben Leserechte. Kommentare sind nicht möglich.
            </p>
        </div>
    );
}

function CommentCard({ comment }: { comment: GuestComment }) {
    return (
        <div className="rounded-xl bg-card border border-border/50 p-5 space-y-2">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                        {comment.guest_name}
                    </span>
                    <Badge variant={commentTypeBadgeVariant(comment.comment_type as CommentType)}>
                        {commentTypeLabel(comment.comment_type as CommentType)}
                    </Badge>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(comment.created_at)}
                </span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed pl-[42px]">
                {comment.content}
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function GuestReviewPage() {
    const { token } = useParams<{ token: string }>();

    // Data state
    const [reviewData, setReviewData] = useState<GuestReviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorStatus, setErrorStatus] = useState<
        "not_found" | "expired" | "generic" | null
    >(null);

    // Comment form state
    const [guestName, setGuestName] = useState("");
    const [commentType, setCommentType] = useState<CommentType>("comment");
    const [commentContent, setCommentContent] = useState("");
    const [suggestedReplacement, setSuggestedReplacement] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // Submitted comments
    const [comments, setComments] = useState<GuestComment[]>([]);

    // -----------------------------------------------------------------------
    // Fetch document
    // -----------------------------------------------------------------------

    const fetchReview = useCallback(async () => {
        if (!token) {
            setErrorStatus("not_found");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE}/api/v1/guest-review/${encodeURIComponent(token)}`
            );

            if (response.status === 404) {
                setErrorStatus("not_found");
                setLoading(false);
                return;
            }

            if (response.status === 410) {
                setErrorStatus("expired");
                setLoading(false);
                return;
            }

            if (!response.ok) {
                setErrorStatus("generic");
                setLoading(false);
                return;
            }

            const data: GuestReviewData = await response.json();
            setReviewData(data);
            setGuestName(data.recipient_name || "");
        } catch {
            setErrorStatus("generic");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchReview();
    }, [fetchReview]);

    // -----------------------------------------------------------------------
    // Submit comment
    // -----------------------------------------------------------------------

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token || !commentContent.trim()) return;

        setSubmitting(true);
        setSubmitSuccess(false);

        try {
            const body: Record<string, unknown> = {
                guest_name: guestName.trim() || "Gast",
                comment_type: commentType,
                content: commentContent.trim(),
            };

            if (commentType === "suggestion" && suggestedReplacement.trim()) {
                body.suggested_replacement = suggestedReplacement.trim();
            }

            const response = await fetch(
                `${API_BASE}/api/v1/guest-review/${encodeURIComponent(token)}/comments`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                }
            );

            if (!response.ok) {
                throw new Error("Kommentar konnte nicht gesendet werden.");
            }

            const newComment: GuestComment = await response.json();
            setComments((prev) => [newComment, ...prev]);
            setCommentContent("");
            setSuggestedReplacement("");
            setSubmitSuccess(true);

            // Auto-hide success message after 4 seconds
            setTimeout(() => setSubmitSuccess(false), 4000);
        } catch (err) {
            console.error("Failed to submit comment:", err);
        } finally {
            setSubmitting(false);
        }
    };

    // -----------------------------------------------------------------------
    // Render: Loading / Error states
    // -----------------------------------------------------------------------

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (errorStatus) {
        return <ErrorState status={errorStatus} />;
    }

    if (!reviewData) {
        return <ErrorState status="generic" />;
    }

    const canComment = reviewData.permissions !== "view_only";
    const canSuggest = reviewData.permissions === "suggest_changes";

    // -----------------------------------------------------------------------
    // Render: Main review page
    // -----------------------------------------------------------------------

    return (
        <div className="min-h-screen bg-background">
            {/* -- Header -- */}
            <header className="sticky top-0 z-30 border-b border-border/60 bg-card/95 backdrop-blur-sm">
                <div className="mx-auto max-w-4xl px-6 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <FileText className="h-4.5 w-4.5" />
                        </div>
                        <span className="text-base font-semibold tracking-tight text-foreground">
                            Niederwieser DOCS
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Expiration badge */}
                        <Badge
                            variant="muted"
                            className="hidden sm:inline-flex gap-1.5"
                        >
                            <Clock className="h-3 w-3" />
                            Gültig bis{" "}
                            {formatDateShort(reviewData.expires_at)}
                        </Badge>

                        {/* Guest name badge */}
                        <Badge variant="outline" className="gap-1.5">
                            <User className="h-3 w-3" />
                            {reviewData.recipient_name}
                        </Badge>
                    </div>
                </div>
            </header>

            {/* -- Content -- */}
            <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
                {/* Document title */}
                <div className="space-y-3">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        {reviewData.document_title || "Dokument-Review"}
                    </h1>

                    {/* Mobile expiration badge */}
                    <Badge
                        variant="muted"
                        className="sm:hidden gap-1.5"
                    >
                        <Clock className="h-3 w-3" />
                        Gültig bis {formatDateShort(reviewData.expires_at)}
                    </Badge>

                    {/* Permission info */}
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={canComment ? "secondary" : "muted"}
                            className="gap-1.5"
                        >
                            {canComment ? (
                                <MessageSquare className="h-3 w-3" />
                            ) : (
                                <Eye className="h-3 w-3" />
                            )}
                            {reviewData.permissions === "view_only"
                                ? "Nur Ansicht"
                                : reviewData.permissions === "comment_only"
                                  ? "Kommentieren"
                                  : "Kommentieren & Vorschlagen"}
                        </Badge>
                    </div>
                </div>

                {/* -- Document Preview -- */}
                <section
                    className="rounded-2xl bg-card overflow-hidden"
                    style={{ boxShadow: "var(--shadow-elevated)" }}
                    aria-label="Dokumentvorschau"
                >
                    {reviewData.content_html ? (
                        <div
                            className="p-8 sm:p-10 prose prose-sm max-w-none
                                prose-headings:text-foreground
                                prose-p:text-foreground/90
                                prose-strong:text-foreground
                                prose-a:text-primary
                                prose-li:text-foreground/90"
                            dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(reviewData.content_html),
                            }}
                        />
                    ) : (
                        <div className="p-10 text-center text-muted-foreground">
                            <FileText className="mx-auto h-10 w-10 mb-3 opacity-40" />
                            <p className="text-sm">
                                Keine Dokumentvorschau verfügbar.
                            </p>
                        </div>
                    )}
                </section>

                <Separator />

                {/* -- Comment Section -- */}
                <section className="space-y-6" aria-label="Kommentare">
                    <h2 className="text-lg font-semibold text-foreground">
                        Feedback
                    </h2>

                    {/* View-only banner */}
                    {!canComment && <ViewOnlyBanner />}

                    {/* Comment form */}
                    {canComment && (
                        <form
                            onSubmit={handleSubmit}
                            className="rounded-2xl bg-card border border-border/50 p-6 sm:p-8 space-y-6"
                            style={{ boxShadow: "var(--shadow-soft-sm)" }}
                        >
                            {/* Guest name */}
                            <div className="space-y-2">
                                <Label htmlFor="guest-name">Ihr Name</Label>
                                <Input
                                    id="guest-name"
                                    value={guestName}
                                    onChange={(e) =>
                                        setGuestName(e.target.value)
                                    }
                                    placeholder="Name eingeben..."
                                    className="max-w-sm"
                                />
                            </div>

                            {/* Comment type selector (radio pills) */}
                            <div className="space-y-2">
                                <Label>Art des Feedbacks</Label>
                                <div className="flex flex-wrap gap-2">
                                    {COMMENT_TYPE_OPTIONS.filter((opt) => {
                                        // Hide "suggestion" if permission is comment_only
                                        if (
                                            opt.value === "suggestion" &&
                                            !canSuggest
                                        ) {
                                            return false;
                                        }
                                        return true;
                                    }).map((opt) => {
                                        const Icon = opt.icon;
                                        const isActive =
                                            commentType === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() =>
                                                    setCommentType(opt.value)
                                                }
                                                className={cn(
                                                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                                                    "border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                    isActive
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                                )}
                                                aria-pressed={isActive}
                                            >
                                                <Icon className="h-4 w-4" />
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Comment content */}
                            <div className="space-y-2">
                                <Label htmlFor="comment-content">
                                    {commentType === "approval"
                                        ? "Anmerkung zur Freigabe (optional)"
                                        : commentType === "suggestion"
                                          ? "Beschreibung des Vorschlags"
                                          : "Ihr Kommentar"}
                                </Label>
                                <Textarea
                                    id="comment-content"
                                    value={commentContent}
                                    onChange={(e) =>
                                        setCommentContent(e.target.value)
                                    }
                                    placeholder={
                                        commentType === "approval"
                                            ? "Optional: Anmerkungen zur Freigabe..."
                                            : "Ihr Feedback hier eingeben..."
                                    }
                                    rows={4}
                                    className="resize-y"
                                />
                            </div>

                            {/* Suggested replacement (only for "suggestion" type) */}
                            {commentType === "suggestion" && (
                                <div className="space-y-2">
                                    <Label htmlFor="suggested-replacement">
                                        Vorgeschlagener Ersatztext
                                    </Label>
                                    <Textarea
                                        id="suggested-replacement"
                                        value={suggestedReplacement}
                                        onChange={(e) =>
                                            setSuggestedReplacement(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Wie sollte der Text stattdessen lauten..."
                                        rows={3}
                                        className="resize-y"
                                    />
                                </div>
                            )}

                            {/* Submit */}
                            <div className="flex items-center gap-4">
                                <Button
                                    type="submit"
                                    disabled={
                                        submitting || !commentContent.trim()
                                    }
                                >
                                    {submitting ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4 mr-2" />
                                    )}
                                    {submitting
                                        ? "Wird gesendet..."
                                        : "Absenden"}
                                </Button>

                                {/* Success message */}
                                {submitSuccess && (
                                    <div className="flex items-center gap-2 text-sm text-secondary animate-in fade-in slide-in-from-left-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>
                                            Feedback erfolgreich gesendet
                                        </span>
                                    </div>
                                )}
                            </div>
                        </form>
                    )}

                    {/* -- Submitted comments list -- */}
                    {comments.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Eingereichte Kommentare ({comments.length})
                            </h3>
                            <div className="space-y-3">
                                {comments.map((comment) => (
                                    <CommentCard
                                        key={comment.id}
                                        comment={comment}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state when no comments and view only */}
                    {comments.length === 0 && !canComment && (
                        <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">
                                Noch keine Kommentare vorhanden.
                            </p>
                        </div>
                    )}
                </section>
            </main>

            {/* -- Footer -- */}
            <footer className="border-t border-border/40 mt-12">
                <div className="mx-auto max-w-4xl px-6 py-6 text-center">
                    <p className="text-xs text-muted-foreground">
                        Bereitgestellt von{" "}
                        <span className="font-medium text-foreground/70">
                            Niederwieser DOCS
                        </span>{" "}
                        &mdash; Sicherer Dokumenten-Review
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default GuestReviewPage;
