import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Download, Trash2, RefreshCw, Calendar } from "lucide-react";
import { useDocumentHistory, useDeleteDocument } from "@/hooks/useApi";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface DocumentHistoryProps {
    userId?: string;
    countryCode?: string;
}

export const DocumentHistory = ({ userId = "anonymous", countryCode }: DocumentHistoryProps) => {
    const { data, isLoading, refetch } = useDocumentHistory(userId, countryCode);
    const deleteDoc = useDeleteDocument();
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteDocId, setDeleteDocId] = useState<number | null>(null);

    const handleDelete = useCallback((id: number) => {
        setDeleteDocId(id);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (deleteDocId === null) return;
        await deleteDoc.mutateAsync(deleteDocId);
    }, [deleteDocId, deleteDoc]);

    const handleDownload = (id: number) => {
        window.open(`/api/v1/documents/history/${id}/download`, "_blank");
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const filteredDocuments = data?.items?.filter((doc: { form_data_summary?: Record<string, string> }) => {
        if (!searchTerm) return true;
        const summary = doc.form_data_summary || {};
        return Object.values(summary).some((v) =>
            String(v).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }) || [];

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Meine Dokumente
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => refetch()}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
                <Input
                    placeholder="Suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-2"
                />
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Noch keine Dokumente generiert</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredDocuments.map((doc: {
                            id: number;
                            file_format: string;
                            created_at: string;
                            can_download: boolean;
                            form_data_summary?: { mitarbeiter_vorname?: string; mitarbeiter_nachname?: string };
                        }) => (
                            <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded ${doc.file_format === "pdf" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            {doc.form_data_summary?.mitarbeiter_vorname} {doc.form_data_summary?.mitarbeiter_nachname || `Dokument #${doc.id}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(doc.created_at)}
                                            <span className="ml-2 uppercase">{doc.file_format}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {doc.can_download && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDownload(doc.id)}
                                        >
                                            <Download className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(doc.id)}
                                        disabled={deleteDoc.isPending}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        {deleteDoc.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {data?.total > 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-4">
                        {data.total} Dokument{data.total !== 1 ? "e" : ""} insgesamt
                    </p>
                )}
            </CardContent>

            <ConfirmDialog
                open={deleteDocId !== null}
                onOpenChange={(open) => { if (!open) setDeleteDocId(null); }}
                title="Dokument löschen"
                description="Dokument wirklich löschen?"
                confirmLabel="Löschen"
                onConfirm={confirmDelete}
            />
        </Card>
    );
};
