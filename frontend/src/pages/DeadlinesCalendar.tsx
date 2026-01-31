/**
 * DeadlinesCalendar - Fristen-Kalender
 *
 * v4.2 Feature (Kapitel 15.2.7):
 * - Probezeit-Ende Tracking
 * - Befristungs-Ablauf überwachen
 * - Erinnerungen vor Ablauf
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    Calendar,
    Clock,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    Plus,
    Loader2,
    Filter,
    Eye,
    Check,
    X,
    Edit2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SkeletonDeadlinesList } from "@/components/ui/skeleton";

interface Deadline {
    id: number;
    country_code: string;
    deadline_type: string;
    deadline_date: string;
    deadline_label: string | null;
    employee_name: string;
    employee_id: string | null;
    status: string;
    notes: string | null;
    days_remaining: number;
    urgency: "overdue" | "urgent" | "soon" | "normal";
    created_at: string;
}

interface DeadlineSummary {
    overdue_count: number;
    this_week_count: number;
    this_month_count: number;
    upcoming_deadlines: Deadline[];
}

const URGENCY_CONFIG = {
    overdue: { label: "Überfällig", color: "bg-red-500", textColor: "text-red-500", icon: AlertCircle },
    urgent: { label: "Dringend", color: "bg-amber-500", textColor: "text-amber-500", icon: AlertTriangle },
    soon: { label: "Bald fällig", color: "bg-yellow-500", textColor: "text-yellow-500", icon: Clock },
    normal: { label: "Normal", color: "bg-green-500", textColor: "text-green-500", icon: CheckCircle },
};

const DEADLINE_TYPES = [
    { value: "probezeit_ende", label: "Probezeit-Ende" },
    { value: "befristung_ende", label: "Befristungs-Ende" },
    { value: "kuendigung_frist", label: "Kündigungsfrist" },
    { value: "vertragsverlaengerung", label: "Vertragsverlängerung" },
    { value: "sonstiges", label: "Sonstiges" },
];

export default function DeadlinesCalendar() {
    const toast = useToast();
    const [summary, setSummary] = useState<DeadlineSummary | null>(null);
    const [deadlines, setDeadlines] = useState<Deadline[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("pending");
    const [typeFilter, setTypeFilter] = useState<string>("all");

    // New deadline dialog
    const [showNewDialog, setShowNewDialog] = useState(false);
    const [newDeadline, setNewDeadline] = useState({
        deadline_type: "probezeit_ende",
        deadline_date: "",
        employee_name: "",
        employee_id: "",
        notes: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit notes dialog
    const [showEditNotesDialog, setShowEditNotesDialog] = useState(false);
    const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
    const [editedNotes, setEditedNotes] = useState("");

    // Fetch data on mount
    useEffect(() => {
        fetchSummary();
        fetchDeadlines();
    }, [statusFilter, typeFilter]);

    const fetchSummary = async () => {
        try {
            const response = await fetch("/api/v1/deadlines/summary");
            if (response.ok) {
                const data = await response.json();
                setSummary(data);
            }
        } catch (err) {
            console.error("Failed to fetch summary:", err);
        }
    };

    const fetchDeadlines = async () => {
        setIsLoading(true);
        setError(null);
        try {
            let url = "/api/v1/deadlines?days_ahead=180";
            if (statusFilter !== "all") url += `&status=${statusFilter}`;
            if (typeFilter !== "all") url += `&deadline_type=${typeFilter}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error("Fristen konnten nicht geladen werden");
            const data = await response.json();
            setDeadlines(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    const createDeadline = async () => {
        if (!newDeadline.employee_name || !newDeadline.deadline_date) return;

        setIsSubmitting(true);
        try {
            const response = await fetch("/api/v1/deadlines", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newDeadline),
            });
            if (!response.ok) throw new Error("Frist konnte nicht erstellt werden");

            setShowNewDialog(false);
            const employeeName = newDeadline.employee_name;
            setNewDeadline({
                deadline_type: "probezeit_ende",
                deadline_date: "",
                employee_name: "",
                employee_id: "",
                notes: "",
            });
            await fetchSummary();
            await fetchDeadlines();
            toast.success("Frist erstellt", `Neue Frist für ${employeeName} wurde angelegt`);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Fehler beim Erstellen";
            setError(message);
            toast.error("Fehler", message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateStatus = async (id: number, status: string) => {
        try {
            await fetch(`/api/v1/deadlines/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            await fetchSummary();
            await fetchDeadlines();
            const statusLabels: Record<string, string> = {
                acknowledged: "als gesehen markiert",
                completed: "als erledigt markiert",
                dismissed: "ignoriert",
            };
            toast.success("Status aktualisiert", `Frist wurde ${statusLabels[status] || "aktualisiert"}`);
        } catch (err) {
            console.error("Status update failed:", err);
            toast.error("Fehler", "Status konnte nicht aktualisiert werden");
        }
    };

    const openEditNotes = (deadline: Deadline) => {
        setEditingDeadline(deadline);
        setEditedNotes(deadline.notes || "");
        setShowEditNotesDialog(true);
    };

    const saveNotes = async () => {
        if (!editingDeadline) return;

        setIsSubmitting(true);
        try {
            await fetch(`/api/v1/deadlines/${editingDeadline.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes: editedNotes }),
            });
            setShowEditNotesDialog(false);
            setEditingDeadline(null);
            await fetchDeadlines();
            toast.success("Notizen gespeichert", "Die Änderungen wurden übernommen");
        } catch (err) {
            console.error("Notes update failed:", err);
            toast.error("Fehler", "Notizen konnten nicht gespeichert werden");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Calendar className="w-6 h-6" />
                        Fristen-Kalender
                    </h1>
                    <p className="text-muted-foreground">
                        Probezeiten, Befristungen und andere HR-Fristen
                    </p>
                </div>
                <Button onClick={() => setShowNewDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Neue Frist
                </Button>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className={summary.overdue_count > 0 ? "border-red-500 bg-red-50 dark:bg-red-900/20" : ""}>
                        <CardHeader className="pb-2">
                            <CardDescription>Überfällig</CardDescription>
                            <CardTitle className="text-3xl text-red-500">
                                {summary.overdue_count}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className={summary.this_week_count > 0 ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : ""}>
                        <CardHeader className="pb-2">
                            <CardDescription>Diese Woche</CardDescription>
                            <CardTitle className="text-3xl text-amber-500">
                                {summary.this_week_count}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Nächste 30 Tage</CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.this_month_count}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Gesamt offen</CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.overdue_count + summary.this_week_count + summary.this_month_count}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Status</SelectItem>
                        <SelectItem value="pending">Offen</SelectItem>
                        <SelectItem value="acknowledged">Bestätigt</SelectItem>
                        <SelectItem value="completed">Erledigt</SelectItem>
                        <SelectItem value="dismissed">Ignoriert</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Frist-Typ" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Typen</SelectItem>
                        {DEADLINE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Deadlines List */}
            {isLoading ? (
                <SkeletonDeadlinesList items={4} />
            ) : deadlines.length === 0 ? (
                <Card>
                    <CardContent className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                            <Calendar className="w-8 h-8 text-muted-foreground" />
                        </div>
                        {statusFilter !== "all" || typeFilter !== "all" ? (
                            <>
                                <h3 className="text-lg font-medium mb-2">
                                    Keine Fristen für diese Filter
                                </h3>
                                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                                    Passen Sie Ihre Filtereinstellungen an oder setzen Sie sie zurück.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setStatusFilter("pending");
                                        setTypeFilter("all");
                                    }}
                                >
                                    Filter zurücksetzen
                                </Button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-medium mb-2">
                                    Keine Fristen vorhanden
                                </h3>
                                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                                    Legen Sie Ihre erste Frist an, um Probezeiten und Befristungen zu überwachen.
                                </p>
                                <Button onClick={() => setShowNewDialog(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Erste Frist anlegen
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {deadlines.map((deadline) => {
                        const urgencyConfig = URGENCY_CONFIG[deadline.urgency];
                        const UrgencyIcon = urgencyConfig.icon;
                        const typeLabel = DEADLINE_TYPES.find((t) => t.value === deadline.deadline_type)?.label || deadline.deadline_type;

                        return (
                            <Card key={deadline.id} className={deadline.urgency === "overdue" ? "border-red-500" : deadline.urgency === "urgent" ? "border-amber-500" : ""}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Urgency Indicator */}
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${urgencyConfig.color}`}>
                                                <UrgencyIcon className="w-5 h-5 text-white" />
                                            </div>

                                            {/* Main Info */}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{deadline.employee_name}</span>
                                                    {deadline.employee_id && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {deadline.employee_id}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <Badge variant="secondary">{typeLabel}</Badge>
                                                    <span>•</span>
                                                    <span>{formatDate(deadline.deadline_date)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Days Remaining & Actions */}
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className={`text-lg font-bold ${urgencyConfig.textColor}`}>
                                                    {deadline.days_remaining < 0
                                                        ? `${Math.abs(deadline.days_remaining)} Tage überfällig`
                                                        : deadline.days_remaining === 0
                                                            ? "Heute"
                                                            : `${deadline.days_remaining} Tage`}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {urgencyConfig.label}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            {deadline.status === "pending" && (
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateStatus(deadline.id, "acknowledged")}
                                                        title="Bestätigen"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateStatus(deadline.id, "completed")}
                                                        title="Erledigt"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => updateStatus(deadline.id, "dismissed")}
                                                        title="Ignorieren"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            )}
                                            {deadline.status !== "pending" && (
                                                <Badge variant={deadline.status === "completed" ? "default" : "secondary"}>
                                                    {deadline.status === "completed" ? "Erledigt" : deadline.status === "acknowledged" ? "Bestätigt" : "Ignoriert"}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div className="mt-3 pt-3 border-t flex items-start justify-between gap-2">
                                        <div className="text-sm text-muted-foreground flex-1">
                                            {deadline.notes || <span className="italic">Keine Notizen</span>}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openEditNotes(deadline)}
                                            title="Notizen bearbeiten"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Edit Notes Dialog */}
            <Dialog open={showEditNotesDialog} onOpenChange={setShowEditNotesDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Notizen bearbeiten</DialogTitle>
                        <DialogDescription>
                            {editingDeadline && (
                                <span>
                                    {editingDeadline.employee_name} - {DEADLINE_TYPES.find((t) => t.value === editingDeadline.deadline_type)?.label}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Textarea
                            value={editedNotes}
                            onChange={(e) => setEditedNotes(e.target.value)}
                            placeholder="Notizen zur Frist..."
                            rows={4}
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditNotesDialog(false)}>
                            Abbrechen
                        </Button>
                        <Button onClick={saveNotes} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Speichern
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Deadline Dialog */}
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Neue Frist erstellen</DialogTitle>
                        <DialogDescription>
                            Erstellen Sie eine neue Frist für einen Mitarbeiter.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Mitarbeitername *</label>
                                <Input
                                    value={newDeadline.employee_name}
                                    onChange={(e) => setNewDeadline((prev) => ({ ...prev, employee_name: e.target.value }))}
                                    placeholder="Max Müller"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Personalnummer</label>
                                <Input
                                    value={newDeadline.employee_id}
                                    onChange={(e) => setNewDeadline((prev) => ({ ...prev, employee_id: e.target.value }))}
                                    placeholder="P-1001"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Frist-Typ *</label>
                                <Select
                                    value={newDeadline.deadline_type}
                                    onValueChange={(v) => setNewDeadline((prev) => ({ ...prev, deadline_type: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DEADLINE_TYPES.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Frist-Datum *</label>
                                <Input
                                    type="date"
                                    value={newDeadline.deadline_date}
                                    onChange={(e) => setNewDeadline((prev) => ({ ...prev, deadline_date: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notizen</label>
                            <Textarea
                                value={newDeadline.notes}
                                onChange={(e) => setNewDeadline((prev) => ({ ...prev, notes: e.target.value }))}
                                placeholder="Optionale Notizen zur Frist..."
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={createDeadline}
                            disabled={!newDeadline.employee_name || !newDeadline.deadline_date || isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Erstellen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
