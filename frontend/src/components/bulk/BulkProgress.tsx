import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, XCircle, Download, Layers } from "lucide-react";
import { useBulkJobStatus } from "@/hooks/useApi";

interface BulkProgressProps {
    jobId: string;
    onComplete?: () => void;
}

export const BulkProgress = ({ jobId, onComplete }: BulkProgressProps) => {
    const [isPolling, setIsPolling] = useState(true);
    const { data: job, isLoading } = useBulkJobStatus(jobId, isPolling);

    useEffect(() => {
        if (job?.status === "completed" || job?.status === "failed") {
            setIsPolling(false);
            if (job.status === "completed" && onComplete) {
                onComplete();
            }
        }
    }, [job?.status, onComplete]);

    const handleDownload = () => {
        window.open(`/api/v1/bulk/jobs/${jobId}/download`, "_blank");
    };

    if (isLoading && !job) {
        return (
            <Card>
                <CardContent className="p-8 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    const progress = job?.total ? Math.round((job.processed / job.total) * 100) : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    Massenverarbeitung
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Status Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {job?.status === "processing" && (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        )}
                        {job?.status === "completed" && (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                        {job?.status === "failed" && (
                            <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className="font-medium">
                            {job?.status === "processing" && "Verarbeitung läuft..."}
                            {job?.status === "completed" && "Abgeschlossen"}
                            {job?.status === "failed" && "Fehlgeschlagen"}
                            {job?.status === "pending" && "Warte auf Start..."}
                        </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {job?.processed || 0} / {job?.total || 0}
                    </span>
                </div>

                {/* Progress Bar */}
                <Progress value={progress} className="h-3" />

                {/* Stats */}
                {job?.status !== "pending" && (
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 rounded-lg bg-muted">
                            <p className="text-2xl font-bold">{job?.successful || 0}</p>
                            <p className="text-xs text-muted-foreground">Erfolgreich</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                            <p className="text-2xl font-bold">{job?.failed || 0}</p>
                            <p className="text-xs text-muted-foreground">Fehlerhaft</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                            <p className="text-2xl font-bold">{(job?.total ?? 0) - (job?.processed ?? 0)}</p>
                            <p className="text-xs text-muted-foreground">Verbleibend</p>
                        </div>
                    </div>
                )}

                {/* Errors */}
                {job?.errors && job.errors.length > 0 && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-sm font-medium text-red-800 mb-2">Fehler:</p>
                        <ul className="text-xs text-red-700 space-y-1">
                            {job.errors.slice(0, 5).map((error: string, i: number) => (
                                <li key={i}>• {error}</li>
                            ))}
                            {job.errors.length > 5 && (
                                <li className="text-muted-foreground">
                                    ... und {job.errors.length - 5} weitere
                                </li>
                            )}
                        </ul>
                    </div>
                )}

                {/* Download Button */}
                {job?.status === "completed" && job?.download_ready && (
                    <Button onClick={handleDownload} className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        ZIP herunterladen ({job.successful} Dokumente)
                    </Button>
                )}

                {/* Retry on Failure */}
                {job?.status === "failed" && (
                    <Button variant="destructive" className="w-full" disabled>
                        Verarbeitung fehlgeschlagen
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};
