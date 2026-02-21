/**
 * ClauseNotesPanel - Interne Notizen für Textbausteine
 *
 * v4.2 Feature (Kapitel 15.5.6):
 * - "RA Müller hat geprüft und freigegeben"
 * - "Betriebsrat hat zugestimmt (Protokoll vom 03.12.24)"
 * - Diese Notizen erscheinen NICHT im generierten Dokument
 */

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    MessageSquare,
    Pin,
    PinOff,
    Trash2,
    Plus,
    AlertTriangle,
    Scale,
    CheckCircle,
    Info,
    Loader2,
    Send,
} from "lucide-react";

interface ClauseNote {
    id: number;
    clause_id: number;
    content: string;
    is_pinned: boolean;
    note_type: "info" | "warning" | "legal" | "approval";
    created_by_user_id: string;
    created_by_user_name: string;
    created_at: string;
}

interface ClauseNotesPanelProps {
    clauseId: number;
    onNotesCountChange?: (count: number) => void;
}

const NOTE_TYPES = {
    info: { label: "Info", icon: Info, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
    warning: { label: "Wichtig", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
    legal: { label: "Rechtlich", icon: Scale, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
    approval: { label: "Freigabe", icon: CheckCircle, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
};

export function ClauseNotesPanel({ clauseId, onNotesCountChange }: ClauseNotesPanelProps) {
    const [notes, setNotes] = useState<ClauseNote[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New note form
    const [newNoteContent, setNewNoteContent] = useState("");
    const [newNoteType, setNewNoteType] = useState<string>("info");
    const [newNotePinned, setNewNotePinned] = useState(false);
    const [showNewNoteForm, setShowNewNoteForm] = useState(false);

    // Fetch notes on mount
    useEffect(() => {
        fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch only on mount and when clauseId changes
    }, [clauseId]);

    // Notify parent of notes count
    useEffect(() => {
        onNotesCountChange?.(notes.length);
    }, [notes.length, onNotesCountChange]);

    const fetchNotes = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiFetch(`/api/v1/clauses/${clauseId}/notes`);
            if (!response.ok) throw new Error("Notizen konnten nicht geladen werden");
            const data = await response.json();
            setNotes(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    const createNote = async () => {
        if (!newNoteContent.trim()) return;

        setIsSubmitting(true);
        try {
            const response = await apiFetch(`/api/v1/clauses/${clauseId}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newNoteContent,
                    note_type: newNoteType,
                    is_pinned: newNotePinned,
                }),
            });
            if (!response.ok) throw new Error("Notiz konnte nicht erstellt werden");

            // Reset form and refresh
            setNewNoteContent("");
            setNewNoteType("info");
            setNewNotePinned(false);
            setShowNewNoteForm(false);
            await fetchNotes();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
        } finally {
            setIsSubmitting(false);
        }
    };

    const togglePin = async (note: ClauseNote) => {
        try {
            await apiFetch(`/api/v1/clauses/${clauseId}/notes/${note.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_pinned: !note.is_pinned }),
            });
            await fetchNotes();
        } catch (err) {
            console.error("Pin toggle failed:", err);
        }
    };

    const [deleteNoteId, setDeleteNoteId] = useState<number | null>(null);

    const deleteNote = useCallback((noteId: number) => {
        setDeleteNoteId(noteId);
    }, []);

    const confirmDeleteNote = useCallback(async () => {
        if (deleteNoteId === null) return;
        try {
            await apiFetch(`/api/v1/clauses/${clauseId}/notes/${deleteNoteId}`, {
                method: "DELETE",
            });
            await fetchNotes();
        } catch (err) {
            console.error("Delete failed:", err);
        }
    }, [deleteNoteId, clauseId, fetchNotes]);

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                        Interne Notizen ({notes.length})
                    </span>
                </div>
                <Button
                    size="sm"
                    variant={showNewNoteForm ? "secondary" : "outline"}
                    onClick={() => setShowNewNoteForm(!showNewNoteForm)}
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Notiz hinzufügen
                </Button>
            </div>

            {/* Warning: Notes are internal */}
            <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                Diese Notizen erscheinen NICHT im generierten Dokument.
            </div>

            {/* New Note Form */}
            {showNewNoteForm && (
                <div className="border rounded-lg p-4 space-y-3 bg-card">
                    <Textarea
                        placeholder="Neue Notiz eingeben..."
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        className="min-h-[80px]"
                    />
                    <div className="flex items-center gap-4">
                        <Select value={newNoteType} onValueChange={setNewNoteType}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(NOTE_TYPES).map(([key, { label, icon: Icon, color }]) => (
                                    <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-2">
                                            <Icon className={`w-4 h-4 ${color}`} />
                                            {label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={newNotePinned}
                                onChange={(e) => setNewNotePinned(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <Pin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">Anheften</span>
                        </label>

                        <div className="flex-1" />

                        <Button
                            onClick={createNote}
                            disabled={!newNoteContent.trim() || isSubmitting}
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4 mr-2" />
                            )}
                            Speichern
                        </Button>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                    {error}
                </div>
            )}

            {/* Notes List */}
            {notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Noch keine Notizen vorhanden</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notes.map((note) => {
                        const typeConfig = NOTE_TYPES[note.note_type] || NOTE_TYPES.info;
                        const TypeIcon = typeConfig.icon;

                        return (
                            <div
                                key={note.id}
                                className={`border rounded-lg p-4 ${typeConfig.bg} ${note.is_pinned ? "ring-2 ring-primary/20" : ""}`}
                            >
                                {/* Note Header */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {note.is_pinned && (
                                            <Pin className="w-4 h-4 text-primary" />
                                        )}
                                        <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                                        <Badge variant="outline" className="text-xs">
                                            {typeConfig.label}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            onClick={() => togglePin(note)}
                                            title={note.is_pinned ? "Lösen" : "Anheften"}
                                        >
                                            {note.is_pinned ? (
                                                <PinOff className="w-4 h-4" />
                                            ) : (
                                                <Pin className="w-4 h-4" />
                                            )}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                            onClick={() => deleteNote(note.id)}
                                            title="Löschen"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Note Content */}
                                <p className="text-sm whitespace-pre-wrap">{note.content}</p>

                                {/* Note Footer */}
                                <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{note.created_by_user_name}</span>
                                    <span>{formatDate(note.created_at)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <ConfirmDialog
                open={deleteNoteId !== null}
                onOpenChange={(open) => { if (!open) setDeleteNoteId(null); }}
                title="Notiz löschen"
                description="Notiz wirklich löschen?"
                confirmLabel="Löschen"
                onConfirm={confirmDeleteNote}
            />
        </div>
    );
}
