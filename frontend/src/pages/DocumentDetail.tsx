/**
 * DocumentDetail Page - Warm & Friendly Design
 *
 * - Status action bar at top (EPL-inspired)
 * - Info cards with warm headers
 * - Notes/comments panel in sidebar
 * - Clean, modern layout
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRepositoryDocument } from "@/hooks/useApi";

interface RelatedDocument {
    id: number;
    title: string | null;
    employee_name: string | null;
    document_type_name: string | null;
    created_at: string | null;
    relation: "same_employee" | "same_type";
}
import { DocumentCorrectionDialog } from "@/components/documents/DocumentCorrectionDialog";
import { VersionHistoryPanel } from "@/components/documents/VersionHistoryPanel";
import { ShareWithTeamDialog } from "@/components/documents/ShareWithTeamDialog";
import { DocumentLockBanner } from "@/components/documents/DocumentLockBanner";
import { useDocumentLockStatus } from "@/hooks/api/useDocumentQueries";
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
    MessageSquare,
    Copy,
    CheckCircle,
} from "lucide-react";

export const DocumentDetailPage = () => {
    const { documentId } = useParams<{ documentId: string }>();
    const navigate = useNavigate();
    const [showCorrection, setShowCorrection] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [copied, setCopied] = useState(false);

    const docIdNum = documentId ? parseInt(documentId, 10) : 0;
    const { data: document, isLoading, error, refetch } = useRepositoryDocument(docIdNum);
    const { data: lockStatus } = useDocumentLockStatus(docIdNum);

    const isLockedByOther = lockStatus?.is_locked && !lockStatus?.is_own_lock;

    const [relatedDocs, setRelatedDocs] = useState<RelatedDocument[]>([]);

    // Fetch related documents
    useEffect(() => {
        if (!documentId) return;

        const abortController = new AbortController();

        fetch(`/api/v1/repository/${documentId}/related?limit=5`, {
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
                console.error("Failed to fetch related documents:", err);
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
                <Button variant="ghost" onClick={() => navigate(-1)}>
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
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Status Action Bar - EPL Inspired */}
            <div className="bg-white dark:bg-card rounded-xl p-4 shadow-soft-sm border border-warm-200/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <FileCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="font-medium text-foreground">Fertiggestellt</p>
                        <p className="text-xs text-muted-foreground">
                            Version {document.current_version} &middot; Erstellt am{" "}
                            {document.created_at
                                ? new Date(document.created_at).toLocaleDateString("de")
                                : "-"}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleCopyLink}>
                        {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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
                            <Edit3 className="w-4 h-4 mr-1.5" />
                            Korrigieren
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)}>
                        <Share2 className="w-4 h-4 mr-1.5" />
                        Teilen
                    </Button>
                    <Button size="sm" onClick={() => window.open(document.file_path, "_blank")}>
                        <Download className="w-4 h-4 mr-1.5" />
                        Download
                    </Button>
                </div>
            </div>

            {/* Document Lock Banner */}
            <DocumentLockBanner documentId={docIdNum} />

            {/* Header - Simplified */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {document.title || document.document_type_name}
                    </h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        {document.employee_name && (
                            <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {document.employee_name}
                            </span>
                        )}
                        {document.employee_name && <span>&middot;</span>}
                        {document.document_type_name}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content - Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Employee Info Card */}
                    <div className="card-soft p-0 overflow-hidden">
                        <div className="px-5 py-3 info-card-header">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <User className="w-4 h-4 text-primary" />
                                Mitarbeiter-Informationen
                            </h3>
                        </div>
                        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Name</p>
                                <p className="font-medium">{document.employee_name || "-"}</p>
                            </div>
                            {document.employee_id && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Personalnr.</p>
                                    <p className="font-medium">{document.employee_id}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Erstellt am</p>
                                <p className="font-medium">
                                    {document.created_at
                                        ? new Date(document.created_at).toLocaleDateString("de")
                                        : "-"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Version</p>
                                <p className="font-medium">v{document.current_version}</p>
                            </div>
                        </div>
                    </div>

                    {/* Document Info Card */}
                    <div className="card-soft p-0 overflow-hidden">
                        <div className="px-5 py-3 info-card-header">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                Dokument-Informationen
                            </h3>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Typ</p>
                                <p className="font-medium">{document.document_type_name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Version</p>
                                <p className="font-medium">v{document.current_version}</p>
                            </div>
                        </div>
                    </div>

                    {/* Form Data - If available */}
                    {document.form_data && Object.keys(document.form_data).length > 0 && (
                        <div className="card-soft p-0 overflow-hidden">
                            <div className="px-5 py-3 info-card-header">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    Formulardaten
                                </h3>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.entries(document.form_data).map(([key, value]) => (
                                        <div
                                            key={key}
                                            className="p-3 bg-warm-50/50 rounded-lg"
                                        >
                                            <p className="text-xs text-muted-foreground mb-1">
                                                {key.replace(/_/g, " ")}
                                            </p>
                                            <p className="font-medium text-sm">
                                                {typeof value === "boolean"
                                                    ? value ? "Ja" : "Nein"
                                                    : String(value) || "-"}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar - Right Column */}
                <div className="space-y-6">
                    {/* Notes / Comments Panel - EPL Inspired */}
                    <div className="card-soft p-0 overflow-hidden">
                        <div className="px-5 py-3 info-card-header flex items-center justify-between">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-primary" />
                                Notizen
                            </h3>
                        </div>
                        <div className="p-4 max-h-[300px] overflow-y-auto">
                            <div className="text-center py-6">
                                <div className="w-10 h-10 mx-auto rounded-full bg-warm-100 flex items-center justify-center mb-2">
                                    <MessageSquare className="w-4 h-4 text-warm-500" />
                                </div>
                                <p className="text-sm text-muted-foreground">Keine Notizen vorhanden</p>
                            </div>
                        </div>
                        <div className="p-3 border-t border-warm-200/50">
                            <div className="flex gap-2">
                                <Input placeholder="Notiz hinzufügen..." className="h-9 text-sm" />
                                <Button size="sm" variant="outline" className="shrink-0">
                                    Senden
                                </Button>
                            </div>
                        </div>
                    </div>

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
                            <div className="px-5 py-3 info-card-header">
                                <h3 className="text-sm font-medium">Verwandte Dokumente</h3>
                            </div>
                            <div className="p-3 space-y-1">
                                {relatedDocs.map((related) => (
                                    <Link
                                        key={related.id}
                                        to={`/documents/${related.id}`}
                                        className="block p-3 rounded-lg hover:bg-warm-50 transition-colors"
                                    >
                                        <p className="text-sm font-medium truncate">
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
                </div>
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
                documentTitle={document.title || document.employee_name}
            />
        </div>
    );
};
