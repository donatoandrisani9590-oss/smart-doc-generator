/**
 * ShareWithTeamDialog - Dialog zum Teilen von Dokumenten mit Teams
 */

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Users,
    Loader2,
    AlertCircle,
    CheckCircle,
    Eye,
    Edit3,
    Download,
} from "lucide-react";

interface Team {
    id: number;
    name: string;
    description: string | null;
    member_count: number;
    my_role: string | null;
}

interface ShareWithTeamDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentId: number;
    documentTitle?: string;
    onSuccess?: () => void;
}

export const ShareWithTeamDialog = ({
    open,
    onOpenChange,
    documentId,
    documentTitle,
    onSuccess,
}: ShareWithTeamDialogProps) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Form state
    const [selectedTeamId, setSelectedTeamId] = useState<string>("");
    const [canView, setCanView] = useState(true);
    const [canEdit, setCanEdit] = useState(false);
    const [canDownload, setCanDownload] = useState(true);
    const [note, setNote] = useState("");

    // Fetch user's teams
    useEffect(() => {
        if (open) {
            fetchTeams();
            // Reset form
            setSelectedTeamId("");
            setCanView(true);
            setCanEdit(false);
            setCanDownload(true);
            setNote("");
            setError(null);
            setSuccess(false);
        }
    }, [open]);

    const fetchTeams = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/v1/teams");
            if (response.ok) {
                const data = await response.json();
                setTeams(data);
            } else {
                setError("Fehler beim Laden der Teams");
            }
        } catch (err) {
            setError("Netzwerkfehler");
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!selectedTeamId) {
            setError("Bitte waehlen Sie ein Team aus");
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const response = await fetch(`/api/v1/teams/${selectedTeamId}/shares`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document_id: documentId,
                    can_view: canView,
                    can_edit: canEdit,
                    can_download: canDownload,
                    note: note || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Fehler beim Teilen");
            }

            setSuccess(true);
            setTimeout(() => {
                onOpenChange(false);
                onSuccess?.();
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Fehler beim Teilen");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Mit Team teilen
                    </DialogTitle>
                    <DialogDescription>
                        {documentTitle
                            ? `"${documentTitle}" mit einem Team teilen`
                            : "Dokument mit einem Team teilen"}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : success ? (
                    <div className="flex flex-col items-center py-8 text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                        <p className="font-medium text-foreground">Erfolgreich geteilt!</p>
                        <div className="mt-3 text-sm text-muted-foreground space-y-1">
                            <p className="flex items-center justify-center gap-2">
                                <Users className="w-4 h-4" />
                                <span className="font-medium text-foreground">
                                    {teams.find(t => t.id.toString() === selectedTeamId)?.name}
                                </span>
                            </p>
                            <p className="flex items-center justify-center gap-3 text-xs mt-2">
                                {canView && (
                                    <span className="flex items-center gap-1">
                                        <Eye className="w-3 h-3 text-green-600" /> Ansehen
                                    </span>
                                )}
                                {canDownload && (
                                    <span className="flex items-center gap-1">
                                        <Download className="w-3 h-3 text-green-600" /> Download
                                    </span>
                                )}
                                {canEdit && (
                                    <span className="flex items-center gap-1">
                                        <Edit3 className="w-3 h-3 text-green-600" /> Bearbeiten
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        {teams.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                <p className="font-medium">Keine Teams verfuegbar</p>
                                <p className="text-sm mt-1">
                                    Sie sind noch keinem Team beigetreten.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label>Team auswaehlen</Label>
                                    <Select
                                        value={selectedTeamId}
                                        onValueChange={setSelectedTeamId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Team waehlen..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {teams.map((team) => (
                                                <SelectItem
                                                    key={team.id}
                                                    value={team.id.toString()}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>{team.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            ({team.member_count === 1 ? "1 Mitglied" : `${team.member_count} Mitglieder`})
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-3">
                                    <Label>Berechtigungen</Label>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <Checkbox
                                                checked={canView}
                                                onCheckedChange={(checked) =>
                                                    setCanView(checked === true)
                                                }
                                            />
                                            <Eye className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">Ansehen</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <Checkbox
                                                checked={canDownload}
                                                onCheckedChange={(checked) =>
                                                    setCanDownload(checked === true)
                                                }
                                            />
                                            <Download className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">Herunterladen</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer opacity-50">
                                            <Checkbox
                                                checked={canEdit}
                                                onCheckedChange={(checked) =>
                                                    setCanEdit(checked === true)
                                                }
                                                disabled
                                            />
                                            <Edit3 className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">
                                                Bearbeiten (nur fuer Entwuerfe)
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Nachricht (optional)</Label>
                                    <Textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Optionale Nachricht an das Team..."
                                        rows={3}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {success ? "Schliessen" : "Abbrechen"}
                    </Button>
                    {!success && teams.length > 0 && (
                        <Button
                            onClick={handleShare}
                            disabled={submitting || !selectedTeamId}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {submitting && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Teilen
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
