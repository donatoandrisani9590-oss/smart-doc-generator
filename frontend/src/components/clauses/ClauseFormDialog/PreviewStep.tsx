import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertCircle,
    FileText,
    Loader2,
    BarChart3,
    User,
    Calendar as CalendarIcon,
    MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/utils/sanitize";
import type { Clause } from "@/hooks/useApi";
import type { ClauseImpactAnalysis } from "@/hooks/useClauseExtras";

// ═══════════════════════════════════════════════════════════════════════════
// Preview Step (Wizard Step 3)
// ═══════════════════════════════════════════════════════════════════════════

interface PreviewStepProps {
    title: string;
    category: string;
    customCategory: string;
    countryCode: string;
    content: string;
    isActive: boolean;
    setIsActive: (value: boolean) => void;
    saveError: Error | null;
}

export const PreviewStep = ({
    title,
    category,
    customCategory,
    countryCode,
    content,
    isActive,
    setIsActive,
    saveError,
}: PreviewStepProps) => {
    const effectiveCategory = category === "custom" ? customCategory : category;

    return (
        <div className="space-y-4">
            <Card className="border-primary/20">
                <CardContent className="p-6">
                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                                Titel
                            </Label>
                            <p className="text-lg font-semibold text-foreground">{title}</p>
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-2">
                            <Badge className="bg-primary/10 text-primary">
                                {effectiveCategory}
                            </Badge>
                            <Badge className="bg-secondary/10 text-secondary">
                                {countryCode === "DE" ? "\u{1F1E9}\u{1F1EA} Deutschland" : "\u{1F1EE}\u{1F1F9} Italien"}
                            </Badge>
                            <Badge
                                className={cn(
                                    isActive
                                        ? "bg-green-100 text-green-700"
                                        : "bg-warm-100 text-muted-foreground"
                                )}
                            >
                                {isActive ? "Aktiv" : "Inaktiv"}
                            </Badge>
                        </div>

                        {/* Content Preview */}
                        <div>
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                                Vorschau
                            </Label>
                            <div className="mt-2 p-4 bg-background rounded-lg">
                                <div
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
                                />
                            </div>
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center justify-between pt-4 border-t">
                            <div>
                                <Label className="font-medium">Status</Label>
                                <p className="text-sm text-muted-foreground">
                                    Inaktive Textbausteine sind nicht in Dokumenttypen verfügbar
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsActive(!isActive)}
                                className={cn(
                                    "relative w-12 h-6 rounded-full transition-colors",
                                    isActive ? "bg-secondary" : "bg-border"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow",
                                        isActive ? "translate-x-7" : "translate-x-1"
                                    )}
                                />
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {saveError && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-2 text-red-700">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {saveError.message || "Fehler beim Speichern"}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// Impact Tab (Edit Mode)
// ═══════════════════════════════════════════════════════════════════════════

interface ImpactTabProps {
    editClause: Clause | null | undefined;
    impactData: ClauseImpactAnalysis | undefined;
    isLoadingImpact: boolean;
}

export const ImpactTab = ({
    editClause,
    impactData,
    isLoadingImpact,
}: ImpactTabProps) => {
    if (!editClause) return null;
    if (isLoadingImpact) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-primary">{impactData?.total_document_types || 0}</div>
                        <p className="text-sm text-muted-foreground font-medium mt-1">Verwendet in Dokumenttypen</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-blue-600">{impactData?.total_usage_30_days || 0}</div>
                        <p className="text-sm text-muted-foreground font-medium mt-1">Generierte Dokumente (30 Tage)</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Verwendung in Dokumenttypen
                </h4>
                {impactData?.affected_document_types.length === 0 ? (
                    <div className="text-center p-8 border rounded-lg bg-muted/10 border-dashed">
                        <p className="text-muted-foreground">Dieser Textbaustein wird aktuell in keinem Dokumenttyp verwendet.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {impactData?.affected_document_types.map((dt) => (
                            <div key={dt.id} className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-all">
                                <div>
                                    <div className="font-medium">{dt.name}</div>
                                    {dt.category && <Badge variant="outline" className="mt-1 text-xs">{dt.category}</Badge>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant={dt.is_mandatory ? "default" : "secondary"}>
                                        {dt.is_mandatory ? "Pflicht" : "Optional"}
                                    </Badge>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded">
                                        <BarChart3 className="w-3 h-3" />
                                        {dt.usage_count_30_days} Verwendungen
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// Notes Tab (Edit Mode)
// ═══════════════════════════════════════════════════════════════════════════

interface ClauseNote {
    id: number;
    content: string;
    created_by_user_name: string;
    created_at: string;
}

interface NotesTabProps {
    editClause: Clause | null | undefined;
    notes: ClauseNote[] | undefined;
    isLoadingNotes: boolean;
    newNote: string;
    setNewNote: (value: string) => void;
    onAddNote: () => void;
    isAddingNote: boolean;
}

export const NotesTab = ({
    editClause,
    notes,
    isLoadingNotes,
    newNote,
    setNewNote,
    onAddNote,
    isAddingNote,
}: NotesTabProps) => {
    if (!editClause) return null;

    return (
        <div className="flex flex-col h-[500px] pt-4">
            <ScrollArea className="flex-1 pr-4 mb-4 border rounded-lg bg-muted/10 p-4">
                {isLoadingNotes ? (
                    <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                ) : notes?.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                            <MessageSquare className="w-6 h-6 opacity-30" />
                        </div>
                        <p>Noch keine internen Notizen vorhanden</p>
                        <p className="text-xs mt-1">Nutzen Sie Notizen für die Kommunikation zwischen HR und Legal.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {notes?.map((note) => (
                            <div key={note.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                    <User className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-foreground">{note.created_by_user_name}</span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <CalendarIcon className="w-3 h-3" />
                                            {new Date(note.created_at).toLocaleDateString("de-DE", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })} Uhr
                                        </span>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg text-sm border shadow-sm relative before:content-[''] before:absolute before:top-3 before:-left-1.5 before:w-3 before:h-3 before:bg-white before:border-l before:border-b before:rotate-45 before:border-border">
                                        {note.content}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
            <div className="flex gap-2 items-end bg-white p-3 border rounded-lg shadow-sm">
                <div className="flex-1 space-y-2">
                    <Label htmlFor="note">Neue Notiz</Label>
                    <Input
                        id="note"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Z.B. Freigabe durch RA Müller am 12.10. erfolgt..."
                        onKeyDown={(e) => e.key === "Enter" && onAddNote()}
                    />
                </div>
                <Button onClick={onAddNote} disabled={!newNote.trim() || isAddingNote} className="mb-0.5">
                    {isAddingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Senden"}
                </Button>
            </div>
        </div>
    );
};
