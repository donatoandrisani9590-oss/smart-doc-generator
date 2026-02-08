/**
 * VersionHistoryDialog
 *
 * Displays the version history for a clause and allows
 * restoring previous versions.
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { History, Loader2 } from "lucide-react";
import { useClauseVersions, useRestoreClauseVersion } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import type { VersionHistoryDialogProps } from "./types";

export const VersionHistoryDialog = ({
    open,
    onOpenChange,
    clause,
}: VersionHistoryDialogProps) => {
    const { data: versions, isLoading } = useClauseVersions(clause?.id || 0);
    const restoreMutation = useRestoreClauseVersion();

    if (!clause) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        Versionshistorie
                    </DialogTitle>
                    <DialogDescription>
                        {clause.title} - Alle Versionen
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : versions && versions.length > 0 ? (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {versions.map((version: any, index: number) => (
                                <div
                                    key={version.id}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border",
                                        index === 0 ? "bg-primary/5 border-primary/20" : "border-border"
                                    )}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">Version {version.version}</span>
                                            {index === 0 && (
                                                <Badge className="bg-secondary/10 text-secondary text-xs">
                                                    Aktuell
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {new Date(version.created_at).toLocaleString("de-DE")}
                                        </p>
                                    </div>
                                    {index > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                restoreMutation.mutate({
                                                    clauseId: clause.id,
                                                    versionId: version.id,
                                                });
                                            }}
                                            disabled={restoreMutation.isPending}
                                        >
                                            {restoreMutation.isPending ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                "Wiederherstellen"
                                            )}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Keine Versionshistorie verfügbar</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Schließen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
