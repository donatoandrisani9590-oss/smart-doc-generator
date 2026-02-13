/**
 * VersionHistoryPanel Component
 *
 * Shows version history for a document with:
 * - Timeline view of all versions
 * - Changed fields per version
 * - Download links for each version
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentVersions, type DocumentVersion } from "@/hooks/useApi";
import { Loader2, History, Download, CheckCircle, Clock, FileText, User } from "lucide-react";

// Deutsche Labels für Feldnamen
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
    arbeitgeber: "Arbeitgeber",
};

function formatFieldLabel(key: string): string {
    if (FORM_FIELD_LABELS[key]) return FORM_FIELD_LABELS[key];
    const label = key.replace(/_/g, " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
}

interface VersionHistoryPanelProps {
    documentId: number;
    onDownloadVersion?: (version: DocumentVersion) => void;
}

export const VersionHistoryPanel = ({
    documentId,
    onDownloadVersion,
}: VersionHistoryPanelProps) => {
    const { data: versions, isLoading } = useDocumentVersions(documentId);

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (!versions || versions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Versionsverlauf
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Keine Versionen vorhanden</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Versionsverlauf
                    <span className="text-xs font-normal text-muted-foreground ml-auto">
                        {versions.length} Version(en)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                    <div className="space-y-4">
                        {versions.map((version, index) => (
                            <div key={version.id} className="relative pl-10">
                                {/* Timeline dot */}
                                <div
                                    className={`absolute left-2 w-4 h-4 rounded-full border-2 ${
                                        version.is_current
                                            ? "bg-primary border-primary"
                                            : "bg-white border-muted-foreground"
                                    }`}
                                >
                                    {version.is_current && (
                                        <CheckCircle className="w-3 h-3 text-white absolute -top-0.5 -left-0.5" />
                                    )}
                                </div>

                                <div
                                    className={`p-4 rounded-lg border ${
                                        version.is_current
                                            ? "bg-primary/5 border-primary/30"
                                            : "bg-muted/20"
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                    Version {version.version_number}
                                                </span>
                                                {version.is_current && (
                                                    <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                                                        Aktuell
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(version.created_at).toLocaleString("de")}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {version.created_by}
                                                </span>
                                            </div>
                                        </div>

                                        {onDownloadVersion && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDownloadVersion(version)}
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>

                                    {version.change_reason && (
                                        <div className="mt-3 pt-3 border-t border-border/50">
                                            <p className="text-sm text-muted-foreground">
                                                <span className="font-medium text-foreground">Grund:</span>{" "}
                                                {version.change_reason}
                                            </p>
                                        </div>
                                    )}

                                    {version.changed_fields && version.changed_fields.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-muted-foreground mb-1">
                                                Geänderte Felder:
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {version.changed_fields.map((field) => (
                                                    <span
                                                        key={field}
                                                        className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded"
                                                    >
                                                        {formatFieldLabel(field)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {index === 0 && versions.length === 1 && (
                                        <p className="text-xs text-muted-foreground mt-2 italic">
                                            Originalversion
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
