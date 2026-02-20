/**
 * DocumentDetail Page - Split-Screen Review Layout
 *
 * Left (60%): Document HTML preview (DIN A4 floating paper)
 * Right (40%): Collapsible sidebar with tabs (Details / Verlauf)
 * Top: Status action bar with document actions
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRepositoryDocument } from "@/hooks/useApi";
import { apiFetch } from "@/lib/api-client";
import { DocumentPreviewPanel } from "@/components/documents/DocumentPreviewPanel";
import { DocumentApprovalPanel } from "@/components/documents/DocumentApprovalPanel";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";
import { useDocumentApproval, useApproveDocument } from "@/hooks/useDocumentApproval";
import { Badge } from "@/components/ui/badge";
import { FullDocumentPreview, type DocumentZones } from "@/components/editor/FullDocumentPreview";
import { useDesignSettings } from "@/hooks/api/useDocumentTypeQueries";
import { useCountry } from "@/hooks/useCountry";

interface RelatedDocument {
    id: number;
    title: string | null;
    employee_name: string | null;
    document_type_name: string | null;
    created_at: string | null;
    relation: "same_employee" | "same_type";
}
import { DocumentLifecycleTab } from "@/components/documents/DocumentLifecycleTab";
import { DocumentCorrectionDialog } from "@/components/documents/DocumentCorrectionDialog";
import { VersionHistoryPanel } from "@/components/documents/VersionHistoryPanel";
import { ShareWithTeamDialog } from "@/components/documents/ShareWithTeamDialog";
import { DocumentLockBanner } from "@/components/documents/DocumentLockBanner";
import { useDocumentLockStatus } from "@/hooks/api/useDocumentQueries";
import { CommentThread } from "@/components/collaboration/CommentThread";
import { useCommentCount, useComments } from "@/hooks/useComments";
import type { SelectionRange } from "@/hooks/useComments";
import {
    ArrowLeft,
    Download,
    Edit3,
    User,
    Loader2,
    AlertCircle,
    Share2,
    FileText,
    FileCheck,
    Copy,
    CheckCircle,
    PanelRightClose,
    PanelRightOpen,
    Clock,
    Info,
    MessageSquare,
    Shield,
    ClipboardList,
    Send,
    CheckCircle2,
    XCircle,
    Mail,
} from "lucide-react";

// Deutsche Labels für Formulardaten-Anzeige
const FORM_FIELD_LABELS: Record<string, string> = {
    signatory_name: "Unterzeichner",
    vorname: "Vorname",
    nachname: "Nachname",
    eintrittsdatum: "Eintrittsdatum",
    geburtsdatum: "Geburtsdatum",
    position: "Position",
    gehalt: "Gehalt",
    wochenstunden: "Wochenstunden",
    urlaubstage: "Urlaubstage",
    probezeit: "Probezeit",
    strasse: "Straße",
    plz: "PLZ",
    ort: "Ort",
    firmenwagen: "Firmenwagen",
    homeoffice: "Home Office",
    adresse: "Adresse",
};

function formatFieldLabel(key: string): string {
    if (FORM_FIELD_LABELS[key]) return FORM_FIELD_LABELS[key];
    const label = key.replace(/_/g, " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatFieldValue(key: string, value: unknown): string {
    if (value === undefined || value === null || value === "") return "-";
    if (typeof value === "boolean") return value ? "Ja" : "Nein";

    const strValue = String(value);

    if (key.toLowerCase().includes("datum") && /^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
        const [y, m, d] = strValue.split("-");
        return `${d}.${m}.${y}`;
    }

    if (key === "gehalt") {
        const num = parseFloat(strValue);
        if (!isNaN(num)) {
            return num.toLocaleString("de-DE") + " \u20AC";
        }
    }

    if (key === "wochenstunden") {
        return `${strValue} Std./Woche`;
    }

    if (key === "urlaubstage") {
        return `${strValue} Tage`;
    }

    return strValue;
}

type SidebarTab = "details" | "verwaltung" | "verlauf" | "kommentare" | "freigabe";

export const DocumentDetailPage = () => {
    const { documentId } = useParams<{ documentId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [showCorrection, setShowCorrection] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const initialTab = useMemo(() => {
        const tab = searchParams.get("tab");
        if (tab && ["details", "verwaltung", "verlauf", "kommentare", "freigabe"].includes(tab)) {
            return tab as SidebarTab;
        }
        return "details";
    }, [searchParams]);
    const [activeTab, setActiveTab] = useState<SidebarTab>(initialTab);
    const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
    const [pendingInlineSelection, setPendingInlineSelection] = useState<SelectionRange | null>(null);

    const docIdNum = documentId ? parseInt(documentId, 10) : 0;
    const { data: document, isLoading, error, refetch } = useRepositoryDocument(docIdNum);
    const { data: lockStatus } = useDocumentLockStatus(docIdNum);
    const { unresolved: commentUnresolved } = useCommentCount("document", docIdNum);
    const { data: commentsData } = useComments("document", docIdNum);
    const approvalEnabled = useFeatureEnabled("enable_approval_workflow");
    const { data: approval } = useDocumentApproval(docIdNum, { enabled: approvalEnabled });
    const approveMutation = useApproveDocument();
    const pendingApproval = approval?.status === "pending_approval";

    // Design settings for full document preview with header/footer
    const { country } = useCountry();
    const { data: designSettings } = useDesignSettings(country);
    const documentZones = useMemo((): DocumentZones | null => {
        if (!designSettings) return null;
        const ds = designSettings as Record<string, unknown>;
        return {
            logoUrl: ds.logo_path as string | undefined,
            logoPosition: (ds.logo_position as "left" | "center" | "right") || "right",
            logoWidthCm: (ds.logo_width_cm as string) || "5",
            companyName: ds.company_name as string | undefined,
            headerLines: [ds.header_line1, ds.header_line2, ds.header_line3] as (string | null)[],
            footerLines: [ds.footer_line1, ds.footer_line2, ds.footer_line3] as (string | null)[],
            primaryColor: ds.primary_color as string | undefined,
        };
    }, [designSettings]);

    const inlineComments = commentsData?.comments?.filter(
        (t) => t.root.selection_range != null
    ) ?? [];

    const isLockedByOther = lockStatus?.is_locked && !lockStatus?.is_own_lock;

    const [relatedDocs, setRelatedDocs] = useState<RelatedDocument[]>([]);

    useEffect(() => {
        if (!documentId) return;

        const abortController = new AbortController();

        apiFetch(`/api/v1/repository/${documentId}/related?limit=5`, {
            signal: abortController.signal,
        })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (!abortController.signal.aborted) {
                    setRelatedDocs(data.related_documents || []);
                }
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                if (!abortController.signal.aborted) {
                    setRelatedDocs([]);
                }
            });

        return () => {
            abortController.abort();
        };
    }, [documentId]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !document) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => navigate("/documents")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Zurück
                </Button>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Dokument nicht gefunden</h2>
                        <p className="text-muted-foreground mb-4">
                            Das angeforderte Dokument existiert nicht oder wurde gelöscht.
                        </p>
                        <Button onClick={() => navigate("/documents")}>
                            Zum Repository
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-[1600px] mx-auto">
            {/* Status Action Bar */}
            <div className="shrink-0 bg-white dark:bg-card rounded-xl p-3 shadow-soft-sm border border-warm-200/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mx-1 mb-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/documents")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="p-1.5 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <FileCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-semibold text-foreground truncate text-sm sm:text-base">
                            {document.title || document.document_type_name}
                        </h1>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            {document.employee_name && (
                                <>
                                    <User className="w-3 h-3" />
                                    <span>{document.employee_name}</span>
                                    <span>&middot;</span>
                                </>
                            )}
                            v{document.current_version} &middot;{" "}
                            {document.created_at
                                ? new Date(document.created_at).toLocaleDateString("de")
                                : "-"}
                        </p>
                    </div>
                </div>
                <div className="flex gap-1.5 flex-wrap shrink-0">
                    <Button variant="outline" size="sm" onClick={handleCopyLink}>
                        {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="ml-1.5 hidden sm:inline">{copied ? "Kopiert" : "Link"}</span>
                    </Button>
                    {document.is_correctable && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCorrection(true)}
                            disabled={!!isLockedByOther}
                            title={isLockedByOther ? `Gesperrt von ${lockStatus?.locked_by_name || lockStatus?.locked_by_email}` : undefined}
                        >
                            <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                            Korrigieren
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)}>
                        <Share2 className="w-3.5 h-3.5 mr-1.5" />
                        Teilen
                    </Button>
                    <Button size="sm" onClick={() => window.open(document.file_path, "_blank")}>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hidden lg:flex"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        title={sidebarOpen ? "Seitenleiste ausblenden" : "Seitenleiste einblenden"}
                    >
                        {sidebarOpen ? (
                            <PanelRightClose className="w-4 h-4" />
                        ) : (
                            <PanelRightOpen className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Document Lock Banner */}
            <div className="shrink-0 mx-1">
                <DocumentLockBanner documentId={docIdNum} />
            </div>

            {/* Prominent Status & Approval Bar */}
            {approvalEnabled && (
                <div className="shrink-0 mx-1 mb-3">
                    <div className="card-soft p-4 space-y-3">
                        {/* Current Status */}
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status:</span>
                            <Badge variant="outline" className={
                                pendingApproval
                                    ? "border-amber-300 text-amber-700 bg-amber-50"
                                    : approval?.status === "approved"
                                    ? "border-green-300 text-green-700 bg-green-50"
                                    : approval?.status === "rejected"
                                    ? "border-red-300 text-red-700 bg-red-50"
                                    : approval?.status === "changes_requested"
                                    ? "border-orange-300 text-orange-700 bg-orange-50"
                                    : "border-warm-300 text-muted-foreground"
                            }>
                                {pendingApproval ? "Freigabe ausstehend"
                                    : approval?.status === "approved" ? "Freigegeben"
                                    : approval?.status === "rejected" ? "Abgelehnt"
                                    : approval?.status === "changes_requested" ? "Änderungen angefordert"
                                    : "Kein Freigabe-Status"}
                            </Badge>
                        </div>

                        {/* Primary Actions */}
                        <div className="flex flex-wrap gap-2">
                            {/* Send for approval if no pending approval */}
                            {!pendingApproval && (
                                <Button
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => { setActiveTab("freigabe"); setSidebarOpen(true); }}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    Zur Freigabe senden
                                </Button>
                            )}

                            {/* Approver actions if pending */}
                            {pendingApproval && approval && (
                                <>
                                    <Button
                                        size="sm"
                                        className="gap-1.5 bg-green-600 hover:bg-green-700"
                                        disabled={approveMutation.isPending}
                                        onClick={() => approveMutation.mutate({ approvalId: approval.id })}
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Freigeben
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
                                        onClick={() => { setActiveTab("freigabe"); setSidebarOpen(true); }}
                                    >
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Änderungen anfordern
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                                        onClick={() => { setActiveTab("freigabe"); setSidebarOpen(true); }}
                                    >
                                        <XCircle className="w-3.5 h-3.5" />
                                        Ablehnen
                                    </Button>
                                </>
                            )}

                            {/* Secondary quick actions */}
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => { setActiveTab("verwaltung"); setSidebarOpen(true); }}
                            >
                                <Mail className="w-3.5 h-3.5" />
                                Versendet
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => { setActiveTab("verwaltung"); setSidebarOpen(true); }}
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Abschließen
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Split-Screen: Preview + Sidebar */}
            <div className="flex-1 flex gap-4 min-h-0 mx-1 pb-2">
                {/* Left: Document Preview */}
                <div
                    className={`flex-1 min-w-0 transition-all duration-300 ${
                        sidebarOpen ? "lg:flex-[3]" : ""
                    }`}
                >
                    {documentZones ? (
                        <FullDocumentPreview zones={documentZones} readOnly>
                            <DocumentPreviewPanel
                                contentHtml={document.content_html ?? null}
                                documentTitle={document.title || document.document_type_name || "Dokument"}
                                filePath={document.file_path}
                                comments={inlineComments}
                                onCreateInlineComment={(range) => {
                                    setPendingInlineSelection(range);
                                    setActiveTab("kommentare");
                                    setSidebarOpen(true);
                                }}
                                onHighlightClick={(commentId) => {
                                    setActiveCommentId(commentId);
                                    setActiveTab("kommentare");
                                    setSidebarOpen(true);
                                }}
                                activeCommentId={activeCommentId}
                            />
                        </FullDocumentPreview>
                    ) : (
                        <DocumentPreviewPanel
                            contentHtml={document.content_html ?? null}
                            documentTitle={document.title || document.document_type_name || "Dokument"}
                            filePath={document.file_path}
                            comments={inlineComments}
                            onCreateInlineComment={(range) => {
                                setPendingInlineSelection(range);
                                setActiveTab("kommentare");
                                setSidebarOpen(true);
                            }}
                            onHighlightClick={(commentId) => {
                                setActiveCommentId(commentId);
                                setActiveTab("kommentare");
                                setSidebarOpen(true);
                            }}
                            activeCommentId={activeCommentId}
                        />
                    )}
                </div>

                {/* Right: Sidebar */}
                <div
                    className={`shrink-0 transition-all duration-300 overflow-hidden ${
                        sidebarOpen
                            ? "w-full lg:w-[380px] lg:flex-[2]"
                            : "w-0 lg:w-0 opacity-0 pointer-events-none"
                    }`}
                >
                    <div className="flex flex-col h-full min-w-[320px]">
                        {/* Tab Switcher */}
                        <div className="flex border-b border-warm-200/50 mb-3">
                            <button
                                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    activeTab === "details"
                                        ? "text-primary border-b-[3px] border-primary -mb-[1px]"
                                        : "text-muted-foreground hover:text-foreground hover:bg-warm-50/50"
                                }`}
                                onClick={() => setActiveTab("details")}
                            >
                                <Info className="w-3.5 h-3.5" />
                                Details
                            </button>
                            <button
                                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    activeTab === "verwaltung"
                                        ? "text-primary border-b-[3px] border-primary -mb-[1px]"
                                        : "text-muted-foreground hover:text-foreground hover:bg-warm-50/50"
                                }`}
                                onClick={() => setActiveTab("verwaltung")}
                            >
                                <ClipboardList className="w-3.5 h-3.5" />
                                Verwaltung
                            </button>
                            <button
                                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    activeTab === "verlauf"
                                        ? "text-primary border-b-[3px] border-primary -mb-[1px]"
                                        : "text-muted-foreground hover:text-foreground hover:bg-warm-50/50"
                                }`}
                                onClick={() => setActiveTab("verlauf")}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                Verlauf
                            </button>
                            <button
                                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    activeTab === "kommentare"
                                        ? "text-primary border-b-[3px] border-primary -mb-[1px]"
                                        : "text-muted-foreground hover:text-foreground hover:bg-warm-50/50"
                                }`}
                                onClick={() => setActiveTab("kommentare")}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Kommentare
                                {commentUnresolved > 0 && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-primary text-white">
                                        {commentUnresolved > 9 ? "9+" : commentUnresolved}
                                    </span>
                                )}
                            </button>
                            {approvalEnabled && (
                                <button
                                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                        activeTab === "freigabe"
                                            ? "text-primary border-b-[3px] border-primary -mb-[1px]"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                    onClick={() => setActiveTab("freigabe")}
                                >
                                    <Shield className="w-3.5 h-3.5" />
                                    Freigabe
                                </button>
                            )}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                            {activeTab === "details" && (
                                <>
                                    {/* Employee Info Card */}
                                    <div className="card-soft p-0 overflow-hidden">
                                        <div className="px-4 py-2.5 info-card-header">
                                            <h3 className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                                                <User className="w-3.5 h-3.5 text-primary" />
                                                Mitarbeiter
                                            </h3>
                                        </div>
                                        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">Name</p>
                                                <p className="font-medium text-sm">{document.employee_name || "-"}</p>
                                            </div>
                                            {document.employee_id && (
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">Personalnr.</p>
                                                    <p className="font-medium text-sm">{document.employee_id}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">Erstellt am</p>
                                                <p className="font-medium text-sm">
                                                    {document.created_at
                                                        ? new Date(document.created_at).toLocaleDateString("de")
                                                        : "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">Version</p>
                                                <p className="font-medium text-sm">v{document.current_version}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Document Info Card */}
                                    <div className="card-soft p-0 overflow-hidden">
                                        <div className="px-4 py-2.5 info-card-header">
                                            <h3 className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                                                <FileText className="w-3.5 h-3.5 text-primary" />
                                                Dokument
                                            </h3>
                                        </div>
                                        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">Typ</p>
                                                <p className="font-medium text-sm">{document.document_type_name}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">Format</p>
                                                <p className="font-medium text-sm uppercase">
                                                    {document.file_path?.split(".").pop() || "-"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Form Data */}
                                    {document.form_data && Object.keys(document.form_data).length > 0 && (
                                        <div className="card-soft p-0 overflow-hidden">
                                            <div className="px-4 py-2.5 info-card-header">
                                                <h3 className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                                                    <FileText className="w-3.5 h-3.5 text-primary" />
                                                    Formulardaten
                                                </h3>
                                            </div>
                                            <div className="p-4">
                                                <div className="space-y-2">
                                                    {Object.entries(document.form_data).map(([key, value]) => (
                                                        <div
                                                            key={key}
                                                            className="flex justify-between items-baseline py-1.5 border-b border-warm-100 last:border-0"
                                                        >
                                                            <span className="text-xs text-muted-foreground">
                                                                {formatFieldLabel(key)}
                                                            </span>
                                                            <span className="font-medium text-sm text-right ml-2">
                                                                {formatFieldValue(key, value)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === "verwaltung" && (
                                <DocumentLifecycleTab documentId={document.id} />
                            )}

                            {activeTab === "verlauf" && (
                                <>
                                    {/* Version History */}
                                    <VersionHistoryPanel
                                        documentId={document.id}
                                        onDownloadVersion={(version) => {
                                            window.open(version.file_path, "_blank");
                                        }}
                                    />

                                    {/* Related Documents */}
                                    {relatedDocs.length > 0 && (
                                        <div className="card-soft p-0 overflow-hidden">
                                            <div className="px-4 py-2.5 info-card-header">
                                                <h3 className="text-xs font-medium uppercase tracking-wide">
                                                    Verwandte Dokumente
                                                </h3>
                                            </div>
                                            <div className="p-2 space-y-0.5">
                                                {relatedDocs.map((related) => (
                                                    <Link
                                                        key={related.id}
                                                        to={`/documents/${related.id}`}
                                                        className="block p-2.5 rounded-lg hover:bg-warm-50 transition-colors"
                                                    >
                                                        <p className="text-sm font-medium truncate" title={related.title || related.employee_name || undefined}>
                                                            {related.title || related.employee_name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {related.document_type_name}
                                                        </p>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === "kommentare" && (
                                <CommentThread
                                    anchorType="document"
                                    anchorId={document.id}
                                    compact
                                    pendingSelection={pendingInlineSelection}
                                    onPendingSelectionClear={() => setPendingInlineSelection(null)}
                                    onNavigateToHighlight={(commentId) => setActiveCommentId(commentId)}
                                    activeCommentId={activeCommentId}
                                />
                            )}

                            {activeTab === "freigabe" && approvalEnabled && (
                                <DocumentApprovalPanel documentId={document.id} />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile: Sidebar below preview */}
            <div className="lg:hidden mt-4 mx-1 space-y-4 pb-4">
                {/* Show sidebar content inline on mobile */}
            </div>

            {/* Dialogs */}
            {showCorrection && (
                <DocumentCorrectionDialog
                    documentId={document.id}
                    open={showCorrection}
                    onOpenChange={setShowCorrection}
                    onSuccess={() => {
                        refetch();
                        setShowCorrection(false);
                    }}
                />
            )}

            <ShareWithTeamDialog
                open={showShareDialog}
                onOpenChange={setShowShareDialog}
                documentId={document.id}
                documentTitle={document.title || document.employee_name || undefined}
            />
        </div>
    );
};
