
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, History, RotateCcw, Eye, Clock } from "lucide-react";
import { useClauseVersions, useRestoreClauseVersion } from "@/hooks/useApi";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface ClauseVersionHistoryProps {
    clauseId: number;
    clauseTitle: string;
}

export const ClauseVersionHistory = ({ clauseId, clauseTitle }: ClauseVersionHistoryProps) => {
    const { data, isLoading, refetch } = useClauseVersions(clauseId);
    const restoreVersion = useRestoreClauseVersion();


    const handleRestore = async (versionId: number) => {
        if (confirm("Möchten Sie diese Version wirklich wiederherstellen? Die aktuelle Version wird als Backup gespeichert.")) {
            await restoreVersion.mutateAsync({ clauseId, versionId });
            refetch();
        }
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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <History className="w-4 h-4" />
                    Versionshistorie: {clauseTitle}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : data?.versions?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Keine frühere Versionen vorhanden
                    </p>
                ) : (
                    <div className="space-y-2">
                        {/* Current Version */}
                        <div className="p-3 rounded-lg bg-primary/10 border-2 border-primary">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-medium">Version {data?.current_version}</span>
                                    <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                        Aktuell
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Previous Versions */}
                        {data?.versions?.map((version: {
                            id: number;
                            version: string;
                            content: string;
                            created_at: string;
                            created_by?: string;
                        }) => (
                            <div
                                key={version.id}
                                className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3 text-muted-foreground" />
                                            <span className="font-medium text-sm">
                                                Version {version.version}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDate(version.created_at)}
                                            {version.created_by && ` • ${version.created_by}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle>
                                                        Version {version.version} - {formatDate(version.created_at)}
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div
                                                    className="prose prose-sm max-w-none p-4 bg-muted rounded-lg"
                                                    dangerouslySetInnerHTML={{ __html: version.content }}
                                                />
                                                <Button
                                                    onClick={() => handleRestore(version.id)}
                                                    className="mt-4"
                                                >
                                                    <RotateCcw className="w-4 h-4 mr-2" />
                                                    Diese Version wiederherstellen
                                                </Button>
                                            </DialogContent>
                                        </Dialog>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRestore(version.id)}
                                            disabled={restoreVersion.isPending}
                                        >
                                            {restoreVersion.isPending ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <RotateCcw className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
