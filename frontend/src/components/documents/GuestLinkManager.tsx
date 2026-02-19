/**
 * GuestLinkManager - Verwaltet Gast-Review-Links fuer ein Dokument
 *
 * Wird im DocumentLifecycleTab (Verwaltungs-Tab) der Dokument-Detailseite eingebettet.
 * Ermoeglicht das Erstellen von Gast-Links, deren Verwaltung und
 * die Moderation eingehender Gast-Kommentare.
 *
 * API:
 *   POST   /api/v1/documents/{id}/guest-links           -> GuestLinkResponse
 *   GET    /api/v1/documents/{id}/guest-links            -> { links, document_id }
 *   PATCH  /api/v1/documents/{id}/guest-links/{link_id}  -> GuestLinkResponse
 *   GET    /api/v1/documents/{id}/guest-comments          -> { comments, document_id }
 *   PATCH  /api/v1/documents/{id}/guest-comments/{c_id}   -> GuestCommentResponse
 */

import { useState, useEffect, useCallback } from "react";
import {
    Link2,
    Plus,
    Copy,
    Check,
    X,
    Loader2,
    Eye,
    MessageSquare,
    PenLine,
    Clock,
    UserRound,
    ThumbsUp,
    ThumbsDown,
    Bookmark,
    CheckCircle,
    XCircle,
    StickyNote,
    ArrowRight,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

import { api, isApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// =============================================================================
// TYPES
// =============================================================================

type Permission = "view_only" | "comment_only" | "suggest_changes";
type CommentType = "comment" | "suggestion" | "approval";
type CommentStatus = "pending" | "accepted" | "rejected" | "noted";
type ResolutionAction = "accepted" | "rejected" | "noted";

interface GuestLinkResponse {
    id: number;
    document_id: number;
    token: string;
    recipient_name: string;
    recipient_email?: string;
    permissions: string;
    expires_at: string;
    is_active: boolean;
    created_by_id?: number;
    created_at?: string;
    updated_at?: string;
    review_url?: string;
    comment_count: number;
}

interface GuestLinksListResponse {
    links: GuestLinkResponse[];
    document_id: number;
}

interface GuestCommentResponse {
    id: number;
    link_id: number;
    guest_name: string;
    comment_type: CommentType;
    target_text?: string;
    content: string;
    suggested_replacement?: string;
    status: CommentStatus;
    resolved_by_id?: number;
    resolved_at?: string;
    created_at?: string;
    recipient_name?: string;
    recipient_email?: string;
}

interface GuestCommentsListResponse {
    comments: GuestCommentResponse[];
    document_id: number;
}

interface GuestLinkManagerProps {
    documentId: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PERMISSION_OPTIONS: {
    value: Permission;
    label: string;
    icon: typeof Eye;
    description: string;
}[] = [
    {
        value: "view_only",
        label: "Nur lesen",
        icon: Eye,
        description: "Kann das Dokument nur ansehen",
    },
    {
        value: "comment_only",
        label: "Kommentieren",
        icon: MessageSquare,
        description: "Kann Kommentare hinterlassen",
    },
    {
        value: "suggest_changes",
        label: "Änderungen vorschlagen",
        icon: PenLine,
        description: "Kann Textänderungen vorschlagen",
    },
];

const PERMISSION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "warning" }> = {
    view_only: { label: "Nur lesen", variant: "default" },
    comment_only: { label: "Kommentieren", variant: "secondary" },
    suggest_changes: { label: "Änderungen vorschlagen", variant: "warning" },
};

const COMMENT_TYPE_CONFIG: Record<
    CommentType,
    { label: string; variant: "default" | "secondary" | "warning" }
> = {
    comment: { label: "Kommentar", variant: "default" },
    suggestion: { label: "Vorschlag", variant: "warning" },
    approval: { label: "Freigabe", variant: "secondary" },
};

const STATUS_CONFIG: Record<
    CommentStatus,
    { label: string; icon: typeof CheckCircle; color: string }
> = {
    pending: { label: "Ausstehend", icon: Clock, color: "text-foreground/50" },
    accepted: { label: "Akzeptiert", icon: CheckCircle, color: "text-green-600" },
    rejected: { label: "Abgelehnt", icon: XCircle, color: "text-red-600" },
    noted: { label: "Vermerkt", icon: Bookmark, color: "text-blue-600" },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function GuestLinkManager({ documentId }: GuestLinkManagerProps) {
    // -- State ----------------------------------------------------------------
    const [links, setLinks] = useState<GuestLinkResponse[]>([]);
    const [comments, setComments] = useState<GuestCommentResponse[]>([]);
    const [isLoadingLinks, setIsLoadingLinks] = useState(true);
    const [isLoadingComments, setIsLoadingComments] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Create form state
    const [recipientName, setRecipientName] = useState("");
    const [recipientEmail, setRecipientEmail] = useState("");
    const [permission, setPermission] = useState<Permission>("comment_only");
    const [expiresDays, setExpiresDays] = useState(14);

    // Copy feedback
    const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);
    const [newlyCreatedUrl, setNewlyCreatedUrl] = useState<string | null>(null);
    const [copiedNewUrl, setCopiedNewUrl] = useState(false);

    // Resolving comment
    const [resolvingCommentId, setResolvingCommentId] = useState<number | null>(null);

    // -- Data fetching --------------------------------------------------------

    const fetchLinks = useCallback(async () => {
        try {
            const { data } = await api.get<GuestLinksListResponse>(
                `/api/v1/documents/${documentId}/guest-links`
            );
            setLinks(data.links);
        } catch (err) {
            if (isApiError(err)) {
                toast.error(`Links konnten nicht geladen werden: ${err.message}`);
            }
        } finally {
            setIsLoadingLinks(false);
        }
    }, [documentId]);

    const fetchComments = useCallback(async () => {
        try {
            const { data } = await api.get<GuestCommentsListResponse>(
                `/api/v1/documents/${documentId}/guest-comments`
            );
            setComments(data.comments);
        } catch (err) {
            if (isApiError(err)) {
                toast.error(`Kommentare konnten nicht geladen werden: ${err.message}`);
            }
        } finally {
            setIsLoadingComments(false);
        }
    }, [documentId]);

    useEffect(() => {
        fetchLinks();
        fetchComments();
    }, [fetchLinks, fetchComments]);

    // -- Handlers -------------------------------------------------------------

    const handleCreateLink = useCallback(async () => {
        if (!recipientName.trim()) return;
        setIsSubmitting(true);
        setNewlyCreatedUrl(null);
        setCopiedNewUrl(false);

        try {
            const body: Record<string, unknown> = {
                recipient_name: recipientName.trim(),
                permissions: permission,
                expires_days: expiresDays,
            };
            if (recipientEmail.trim()) {
                body.recipient_email = recipientEmail.trim();
            }

            const { data } = await api.post<GuestLinkResponse>(
                `/api/v1/documents/${documentId}/guest-links`,
                body
            );

            toast.success(`Gast-Link für ${data.recipient_name} erstellt`);

            if (data.review_url) {
                setNewlyCreatedUrl(data.review_url);
            }

            // Reset form fields but keep form visible if a URL was generated
            setRecipientName("");
            setRecipientEmail("");
            setPermission("comment_only");
            setExpiresDays(14);

            await fetchLinks();

            // Close form if no URL to show
            if (!data.review_url) {
                setShowCreateForm(false);
            }
        } catch (err) {
            if (isApiError(err)) {
                toast.error(`Link konnte nicht erstellt werden: ${err.message}`);
            } else {
                toast.error("Link konnte nicht erstellt werden");
            }
        } finally {
            setIsSubmitting(false);
        }
    }, [documentId, recipientName, recipientEmail, permission, expiresDays, fetchLinks]);

    const handleToggleActive = useCallback(
        async (linkId: number, currentActive: boolean) => {
            try {
                await api.patch<GuestLinkResponse>(
                    `/api/v1/documents/${documentId}/guest-links/${linkId}`,
                    { is_active: !currentActive }
                );
                toast.success(currentActive ? "Link deaktiviert" : "Link aktiviert");
                await fetchLinks();
            } catch (err) {
                if (isApiError(err)) {
                    toast.error(`Fehler: ${err.message}`);
                } else {
                    toast.error("Aktion fehlgeschlagen");
                }
            }
        },
        [documentId, fetchLinks]
    );

    const handleCopyLink = useCallback(
        async (url: string, linkId: number) => {
            try {
                await navigator.clipboard.writeText(url);
                setCopiedLinkId(linkId);
                toast.success("Link kopiert");
                setTimeout(() => setCopiedLinkId(null), 2000);
            } catch {
                toast.error("Link konnte nicht kopiert werden");
            }
        },
        []
    );

    const handleCopyNewUrl = useCallback(async () => {
        if (!newlyCreatedUrl) return;
        try {
            await navigator.clipboard.writeText(newlyCreatedUrl);
            setCopiedNewUrl(true);
            toast.success("Link kopiert");
            setTimeout(() => setCopiedNewUrl(false), 2000);
        } catch {
            toast.error("Link konnte nicht kopiert werden");
        }
    }, [newlyCreatedUrl]);

    const handleResolveComment = useCallback(
        async (commentId: number, action: ResolutionAction) => {
            setResolvingCommentId(commentId);
            try {
                await api.patch(
                    `/api/v1/documents/${documentId}/guest-comments/${commentId}`,
                    { status: action }
                );

                const actionLabel =
                    action === "accepted"
                        ? "akzeptiert"
                        : action === "rejected"
                          ? "abgelehnt"
                          : "vermerkt";

                toast.success(`Kommentar ${actionLabel}`);
                await fetchComments();
            } catch (err) {
                if (isApiError(err)) {
                    toast.error(`Fehler: ${err.message}`);
                } else {
                    toast.error("Aktion fehlgeschlagen");
                }
            } finally {
                setResolvingCommentId(null);
            }
        },
        [documentId, fetchComments]
    );

    const handleCancelCreate = useCallback(() => {
        setShowCreateForm(false);
        setRecipientName("");
        setRecipientEmail("");
        setPermission("comment_only");
        setExpiresDays(14);
        setNewlyCreatedUrl(null);
        setCopiedNewUrl(false);
    }, []);

    // -- Derived state --------------------------------------------------------

    const pendingCommentCount = comments.filter((c) => c.status === "pending").length;
    const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

    // -- Loading state --------------------------------------------------------

    if (isLoadingLinks && isLoadingComments) {
        return (
            <div className="space-y-5" role="status" aria-label="Lade Gast-Links...">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-8 w-36 rounded-full" />
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)] space-y-2">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                            </div>
                            <Skeleton className="h-3 w-40" />
                        </div>
                    ))}
                </div>
                <span className="sr-only">Gast-Links werden geladen...</span>
            </div>
        );
    }

    // -- Render ---------------------------------------------------------------

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-foreground/50" />
                    <h3 className="text-[14px] font-semibold text-foreground">
                        Gast-Review-Links
                    </h3>
                    {links.length > 0 && (
                        <Badge variant="muted" className="text-[11px]">
                            {links.length}
                        </Badge>
                    )}
                </div>
                {!showCreateForm && (
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setShowCreateForm(true)}
                        className="text-primary"
                        disableMotion
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Neuen Link erstellen
                    </Button>
                )}
            </div>

            {/* ── Create Link Form ───────────────────────────────────────── */}
            {showCreateForm && (
                <div
                    className={cn(
                        "rounded-2xl p-4 space-y-4",
                        "bg-foreground/[0.02] shadow-[var(--shadow-soft)]"
                    )}
                >
                    {/* Newly created URL banner */}
                    {newlyCreatedUrl && (
                        <div
                            className={cn(
                                "flex items-center gap-2 rounded-xl px-3 py-2.5",
                                "bg-green-50/80 border border-green-200/60"
                            )}
                        >
                            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium text-green-800 mb-0.5">
                                    Link erstellt
                                </p>
                                <p className="text-[11px] text-green-700/70 truncate font-mono">
                                    {newlyCreatedUrl}
                                </p>
                            </div>
                            <Button
                                size="xs"
                                variant="ghost"
                                onClick={handleCopyNewUrl}
                                className="shrink-0 text-green-700"
                                disableMotion
                            >
                                {copiedNewUrl ? (
                                    <Check className="w-3.5 h-3.5" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                                <span className="ml-1">
                                    {copiedNewUrl ? "Kopiert" : "Link kopieren"}
                                </span>
                            </Button>
                        </div>
                    )}

                    {/* Recipient Name */}
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="guest-recipient-name"
                            className="text-[12px] font-medium text-foreground/70"
                        >
                            Empfänger <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="guest-recipient-name"
                            placeholder="Name des Empfängers"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Recipient Email */}
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="guest-recipient-email"
                            className="text-[12px] font-medium text-foreground/70"
                        >
                            E-Mail <span className="text-foreground/30 font-normal">(optional)</span>
                        </Label>
                        <Input
                            id="guest-recipient-email"
                            type="email"
                            placeholder="empfaenger@beispiel.de"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Permissions - Radio Pills */}
                    <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-foreground/70">
                            Berechtigung
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                            {PERMISSION_OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                const isSelected = permission === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setPermission(opt.value)}
                                        disabled={isSubmitting}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                                            "text-[12px] font-medium transition-all duration-200",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                            "disabled:opacity-40 disabled:pointer-events-none",
                                            isSelected
                                                ? "bg-primary/10 text-primary shadow-sm"
                                                : "bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] hover:text-foreground/80"
                                        )}
                                        title={opt.description}
                                        aria-pressed={isSelected}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Expires days */}
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="guest-expires-days"
                            className="text-[12px] font-medium text-foreground/70"
                        >
                            Gültigkeit in Tagen
                        </Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="guest-expires-days"
                                type="number"
                                min={1}
                                max={90}
                                value={expiresDays}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val)) {
                                        setExpiresDays(Math.max(1, Math.min(90, val)));
                                    }
                                }}
                                disabled={isSubmitting}
                                className="w-20"
                            />
                            <span className="text-[12px] text-foreground/40">
                                Tage (1-90)
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-1.5 pt-1">
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={handleCancelCreate}
                            disabled={isSubmitting}
                            disableMotion
                        >
                            <X className="w-3 h-3 mr-1" />
                            Abbrechen
                        </Button>
                        <Button
                            size="xs"
                            onClick={handleCreateLink}
                            disabled={isSubmitting || !recipientName.trim()}
                            disableMotion
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                                <Plus className="w-3 h-3 mr-1" />
                            )}
                            Erstellen
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Active Links List ──────────────────────────────────────── */}
            {links.length === 0 && !showCreateForm ? (
                <div className="text-center py-8">
                    <Link2 className="w-8 h-8 mx-auto text-foreground/20 mb-2" />
                    <p className="text-[13px] text-foreground/40">
                        Noch keine Gast-Links erstellt
                    </p>
                    <p className="text-[11px] text-foreground/25 mt-0.5">
                        Erstelle einen Link, um externe Personen zur Durchsicht einzuladen
                    </p>
                </div>
            ) : (
                links.length > 0 && (
                    <div className="space-y-2">
                        {links.map((link) => (
                            <GuestLinkCard
                                key={link.id}
                                link={link}
                                isExpired={isExpired(link.expires_at)}
                                isCopied={copiedLinkId === link.id}
                                onCopyLink={handleCopyLink}
                                onToggleActive={handleToggleActive}
                            />
                        ))}
                    </div>
                )
            )}

            {/* ── Guest Comments Section ─────────────────────────────────── */}
            {!isLoadingComments && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-foreground/50" />
                        <h3 className="text-[14px] font-semibold text-foreground">
                            Gast-Kommentare
                        </h3>
                        {comments.length > 0 && (
                            <Badge
                                variant={pendingCommentCount > 0 ? "warning" : "muted"}
                                className="text-[11px]"
                            >
                                {pendingCommentCount > 0
                                    ? `${pendingCommentCount} ausstehend`
                                    : comments.length}
                            </Badge>
                        )}
                    </div>

                    {comments.length === 0 ? (
                        <div className="text-center py-6">
                            <MessageSquare className="w-7 h-7 mx-auto text-foreground/15 mb-2" />
                            <p className="text-[13px] text-foreground/40">
                                Noch keine Gast-Kommentare
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {comments.map((comment) => (
                                <GuestCommentCard
                                    key={comment.id}
                                    comment={comment}
                                    isResolving={resolvingCommentId === comment.id}
                                    onResolve={handleResolveComment}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// =============================================================================
// GUEST LINK CARD
// =============================================================================

interface GuestLinkCardProps {
    link: GuestLinkResponse;
    isExpired: boolean;
    isCopied: boolean;
    onCopyLink: (url: string, linkId: number) => void;
    onToggleActive: (linkId: number, currentActive: boolean) => void;
}

function GuestLinkCard({
    link,
    isExpired,
    isCopied,
    onCopyLink,
    onToggleActive,
}: GuestLinkCardProps) {
    const permConfig = PERMISSION_LABELS[link.permissions] ?? {
        label: link.permissions,
        variant: "default" as const,
    };

    const isInactive = !link.is_active || isExpired;

    const formattedExpiry = format(new Date(link.expires_at), "dd.MM.yyyy", {
        locale: de,
    });

    const expiryRelative = isExpired
        ? "abgelaufen"
        : `läuft ab ${formatDistanceToNow(new Date(link.expires_at), {
              addSuffix: true,
              locale: de,
          })}`;

    return (
        <div
            className={cn(
                "rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)]",
                "transition-opacity duration-200",
                isInactive && "opacity-50"
            )}
        >
            <div className="flex items-start justify-between gap-3">
                {/* Left: Name + meta */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <UserRound className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                        <span className="text-[13px] font-medium text-foreground truncate">
                            {link.recipient_name}
                        </span>
                        <Badge variant={permConfig.variant} className="text-[10px]">
                            {permConfig.label}
                        </Badge>
                        {isExpired && (
                            <Badge variant="destructive" className="text-[10px]">
                                Abgelaufen
                            </Badge>
                        )}
                        {!link.is_active && !isExpired && (
                            <Badge variant="muted" className="text-[10px]">
                                Deaktiviert
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                        <span
                            className="text-[11px] text-foreground/40 flex items-center gap-1"
                            title={`Gültig bis ${formattedExpiry}`}
                        >
                            <Clock className="w-3 h-3" />
                            {expiryRelative}
                        </span>
                        {link.comment_count > 0 && (
                            <span className="text-[11px] text-foreground/40 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {link.comment_count} {link.comment_count === 1 ? "Kommentar" : "Kommentare"}
                            </span>
                        )}
                        {link.recipient_email && (
                            <span className="text-[11px] text-foreground/30 truncate max-w-[180px]">
                                {link.recipient_email}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Copy link */}
                    {link.review_url && (
                        <button
                            type="button"
                            onClick={() => onCopyLink(link.review_url!, link.id)}
                            className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded-full",
                                "text-[11px] font-medium transition-all duration-200",
                                "bg-foreground/[0.04] text-foreground/50",
                                "hover:bg-foreground/[0.08] hover:text-foreground/70",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            )}
                            title="Link kopieren"
                        >
                            {isCopied ? (
                                <Check className="w-3 h-3 text-green-600" />
                            ) : (
                                <Copy className="w-3 h-3" />
                            )}
                        </button>
                    )}

                    {/* Toggle active */}
                    <div className="flex items-center gap-1.5" title={link.is_active ? "Deaktivieren" : "Aktivieren"}>
                        <Switch
                            checked={link.is_active}
                            onCheckedChange={() => onToggleActive(link.id, link.is_active)}
                            disabled={isExpired}
                            aria-label={
                                link.is_active
                                    ? `Link für ${link.recipient_name} deaktivieren`
                                    : `Link für ${link.recipient_name} aktivieren`
                            }
                            className="scale-75 origin-right"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// GUEST COMMENT CARD
// =============================================================================

interface GuestCommentCardProps {
    comment: GuestCommentResponse;
    isResolving: boolean;
    onResolve: (commentId: number, action: ResolutionAction) => void;
}

function GuestCommentCard({ comment, isResolving, onResolve }: GuestCommentCardProps) {
    const typeConfig = COMMENT_TYPE_CONFIG[comment.comment_type] ?? {
        label: comment.comment_type,
        variant: "default" as const,
    };
    const statusConfig = STATUS_CONFIG[comment.status];
    const StatusIcon = statusConfig.icon;
    const isPending = comment.status === "pending";

    const formattedDate = comment.created_at
        ? formatTimeDisplay(comment.created_at)
        : null;

    return (
        <div
            className={cn(
                "rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)]",
                "transition-opacity duration-200",
                !isPending && "opacity-70"
            )}
        >
            {/* Header: guest name + type badge + time */}
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <UserRound className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                    <span className="text-[13px] font-medium text-foreground truncate">
                        {comment.guest_name}
                    </span>
                    <Badge variant={typeConfig.variant} className="text-[10px]">
                        {typeConfig.label}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!isPending && (
                        <span className={cn("flex items-center gap-1 text-[11px]", statusConfig.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                        </span>
                    )}
                    {formattedDate && (
                        <time
                            className="text-[11px] text-foreground/35"
                            dateTime={comment.created_at ?? undefined}
                        >
                            {formattedDate}
                        </time>
                    )}
                </div>
            </div>

            {/* Target text (quoted) */}
            {comment.target_text && (
                <div
                    className={cn(
                        "rounded-xl px-3 py-2 mb-2",
                        "bg-foreground/[0.03] border-l-2 border-foreground/10",
                        "text-[12px] text-foreground/50 italic leading-relaxed"
                    )}
                >
                    "{comment.target_text}"
                </div>
            )}

            {/* Comment content */}
            <p className="text-[13px] text-foreground/80 leading-relaxed">
                {comment.content}
            </p>

            {/* Suggested replacement */}
            {comment.suggested_replacement && (
                <div
                    className={cn(
                        "rounded-xl px-3 py-2 mt-2",
                        "bg-amber-50/60 border border-amber-200/40",
                        "text-[12px] leading-relaxed"
                    )}
                >
                    <div className="flex items-center gap-1 mb-1">
                        <ArrowRight className="w-3 h-3 text-amber-600" />
                        <span className="text-[11px] font-medium text-amber-700">
                            Vorgeschlagene Änderung
                        </span>
                    </div>
                    <p className="text-amber-900/80">
                        {comment.suggested_replacement}
                    </p>
                </div>
            )}

            {/* Resolution actions (pending only) */}
            {isPending && (
                <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-foreground/[0.05]">
                    <button
                        type="button"
                        onClick={() => onResolve(comment.id, "accepted")}
                        disabled={isResolving}
                        className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full",
                            "text-[11px] font-medium transition-all duration-200",
                            "bg-green-50/80 text-green-700",
                            "hover:bg-green-100 hover:shadow-sm",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/30",
                            "disabled:opacity-40 disabled:pointer-events-none"
                        )}
                    >
                        {isResolving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <ThumbsUp className="w-3 h-3" />
                        )}
                        Akzeptieren
                    </button>
                    <button
                        type="button"
                        onClick={() => onResolve(comment.id, "rejected")}
                        disabled={isResolving}
                        className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full",
                            "text-[11px] font-medium transition-all duration-200",
                            "bg-red-50/80 text-red-700",
                            "hover:bg-red-100 hover:shadow-sm",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30",
                            "disabled:opacity-40 disabled:pointer-events-none"
                        )}
                    >
                        <ThumbsDown className="w-3 h-3" />
                        Ablehnen
                    </button>
                    <button
                        type="button"
                        onClick={() => onResolve(comment.id, "noted")}
                        disabled={isResolving}
                        className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full",
                            "text-[11px] font-medium transition-all duration-200",
                            "bg-blue-50/80 text-blue-700",
                            "hover:bg-blue-100 hover:shadow-sm",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/30",
                            "disabled:opacity-40 disabled:pointer-events-none"
                        )}
                    >
                        <StickyNote className="w-3 h-3" />
                        Vermerken
                    </button>
                </div>
            )}

            {/* Resolved info */}
            {!isPending && comment.resolved_at && (
                <div className="mt-2 pt-1.5">
                    <span className="text-[11px] text-foreground/30">
                        {statusConfig.label} {formatTimeDisplay(comment.resolved_at)}
                    </span>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Show relative time for recent, absolute for older.
 * Within 7 days: "vor 3 Stunden" / Older: "15.01.2025"
 */
function formatTimeDisplay(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 7) {
        return formatDistanceToNow(date, { addSuffix: true, locale: de });
    }
    return format(date, "dd.MM.yyyy", { locale: de });
}
