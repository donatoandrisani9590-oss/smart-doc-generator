/**
 * DocumentDetail Page - Dokumentansicht
 *
 * UX-Refactoring: Klare, übersichtliche Darstellung
 * - Fokus auf wichtige Informationen
 * - Schnelle Aktionen
 * - Modernes Layout
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
    ArrowLeft,
    Download,
    Edit3,
    User,
    Loader2,
    AlertCircle,
    Share2,
    Printer,
    Copy,
    CheckCircle,
} from "lucide-react";

export const DocumentDetailPage = () => {
    const { documentId } = useParams<{ documentId: string }>();
    const navigate = useNavigate();
    const [showCorrection, setShowCorrection] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [copied, setCopied] = useState(false);

    const { data: document, isLoading, error, refetch } = useRepositoryDocument(
        documentId ? parseInt(documentId, 10) : 0
    );

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
            {/* Header - Modern & Clean */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">
                            {document.title || document.document_type_name}
                        </h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            {document.employee_name && (
                                <span className="flex items-center gap-1">
                                    <User className="w-4 h-4" />
                                    {document.employee_name}
                                </span>
                            )}
                            {document.employee_name && <span>•</span>}
                            {document.document_type_name}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyLink}>
                        {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => window.open(document.file_path, "_blank")}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content - Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Kompakte Metadaten */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 bg-muted/30 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-1">Mitarbeiter</p>
                                    <p className="font-medium">{document.employee_name || "-"}</p>
                                </div>
                                {document.employee_id && (
                                    <div className="p-3 bg-muted/30 rounded-lg">
                                        <p className="text-xs text-muted-foreground mb-1">Personalnr.</p>
                                        <p className="font-medium">{document.employee_id}</p>
                                    </div>
                                )}
                                <div className="p-3 bg-muted/30 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-1">Erstellt am</p>
                                    <p className="font-medium">
                                        {document.created_at
                                            ? new Date(document.created_at).toLocaleDateString("de")
                                            : "-"}
                                    </p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-1">Version</p>
                                    <p className="font-medium">v{document.current_version}</p>
                                </div>
                            </div>

                            {/* Korrektur-Button */}
                            {document.is_correctable && (
                                <div className="mt-4 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowCorrection(true)}
                                    >
                                        <Edit3 className="w-4 h-4 mr-2" />
                                        Dokument korrigieren
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Formulardaten - Falls vorhanden */}
                    {document.form_data && Object.keys(document.form_data).length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Formulardaten</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.entries(document.form_data).map(([key, value]) => (
                                        <div
                                            key={key}
                                            className="p-3 bg-muted/30 rounded-lg"
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
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar - Rechte Spalte */}
                <div className="space-y-6">
                    {/* Versionshistorie */}
                    <VersionHistoryPanel
                        documentId={document.id}
                        onDownloadVersion={(version) => {
                            window.open(version.file_path, "_blank");
                        }}
                    />

                    {/* Schnellaktionen */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Aktionen</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => window.open(document.file_path, "_blank")}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Herunterladen
                            </Button>
                            {document.is_correctable && (
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => setShowCorrection(true)}
                                >
                                    <Edit3 className="w-4 h-4 mr-2" />
                                    Korrektur
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => setShowShareDialog(true)}
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                Teilen
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Verwandte Dokumente */}
                    {relatedDocs.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Verwandte Dokumente</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {relatedDocs.map((related) => (
                                        <Link
                                            key={related.id}
                                            to={`/documents/${related.id}`}
                                            className="block p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
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
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Dialoge */}
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
