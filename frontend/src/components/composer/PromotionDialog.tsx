/**
 * PromotionDialog - "In Bibliothek aufnehmen" Dialog
 *
 * Smart UX Phase 3:
 * - Ermöglicht das Promoten einer lokalen/deviation Klausel zur Bibliothek
 * - Titel und Kategorie können angepasst werden
 * - Löst Approval-Workflow aus
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, AlertTriangle, Loader2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClauseInstance } from "./types";

// Vordefinierte Kategorien für Klauseln
const CLAUSE_CATEGORIES = [
    { value: "allgemein", label: "Allgemeine Bestimmungen" },
    { value: "arbeitszeit", label: "Arbeitszeit" },
    { value: "verguetung", label: "Vergütung & Zusatzleistungen" },
    { value: "urlaub", label: "Urlaub & Freistellung" },
    { value: "kuendigung", label: "Kündigung & Beendigung" },
    { value: "geheimhaltung", label: "Geheimhaltung & Wettbewerb" },
    { value: "homeoffice", label: "Homeoffice & Remote Work" },
    { value: "sonstiges", label: "Sonstiges" },
];

interface PromotionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clause: ClauseInstance | null;
    onPromote: (data: PromotionData) => Promise<void>;
    isLoading?: boolean;
}

export interface PromotionData {
    title: string;
    category: string;
    country_code: string;
    convert_to_global: boolean;
    notes?: string;
}

export const PromotionDialog = ({
    open,
    onOpenChange,
    clause,
    onPromote,
    isLoading = false,
}: PromotionDialogProps) => {
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("");
    const [countryCode, setCountryCode] = useState("DE");
    const [convertToGlobal, setConvertToGlobal] = useState(false);
    const [notes, setNotes] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Sync mit ausgewählter Klausel
    useEffect(() => {
        if (clause && open) {
            setTitle(clause.title);
            setCategory("");
            setCountryCode("DE");
            setConvertToGlobal(false);
            setNotes("");
            setErrors({});
        }
    }, [clause, open]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!title.trim()) {
            newErrors.title = "Titel ist erforderlich";
        } else if (title.length < 3) {
            newErrors.title = "Titel muss mindestens 3 Zeichen haben";
        }

        if (!category) {
            newErrors.category = "Bitte wählen Sie eine Kategorie";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        await onPromote({
            title: title.trim(),
            category,
            country_code: countryCode,
            convert_to_global: convertToGlobal,
            notes: notes.trim() || undefined,
        });
    };

    const handleClose = () => {
        if (!isLoading) {
            onOpenChange(false);
        }
    };

    if (!clause) return null;

    const isDeviation = clause.origin === "deviation";

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                {/* UX-Refactoring: Vereinfachte, nutzerfreundliche Sprache */}
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Star className="w-5 h-5 text-primary" />
                        </div>
                        Als Vorlage speichern
                    </DialogTitle>
                    <DialogDescription>
                        Ihr Text wird nach Freigabe für alle Kollegen als Vorlage verfügbar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Hinweis */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-amber-800">
                                <strong>Hinweis:</strong> Die Klausel wird zur Prüfung eingereicht.
                                Nach Freigabe durch einen Administrator steht sie in der Bibliothek bereit.
                            </div>
                        </div>
                    </div>

                    {/* Titel */}
                    <div className="space-y-2">
                        <Label htmlFor="promotion-title">
                            Titel der Klausel <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="promotion-title"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                            }}
                            placeholder="z.B. §12 Homeoffice-Regelung"
                            className={cn(errors.title && "border-red-500")}
                        />
                        {errors.title && (
                            <p className="text-xs text-red-500">{errors.title}</p>
                        )}
                    </div>

                    {/* Kategorie */}
                    <div className="space-y-2">
                        <Label htmlFor="promotion-category">
                            Kategorie <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={category}
                            onValueChange={(value) => {
                                setCategory(value);
                                if (errors.category) setErrors((prev) => ({ ...prev, category: "" }));
                            }}
                        >
                            <SelectTrigger
                                id="promotion-category"
                                className={cn(errors.category && "border-red-500")}
                            >
                                <SelectValue placeholder="Kategorie wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {CLAUSE_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.category && (
                            <p className="text-xs text-red-500">{errors.category}</p>
                        )}
                    </div>

                    {/* Land */}
                    <div className="space-y-2">
                        <Label htmlFor="promotion-country">Land</Label>
                        <Select value={countryCode} onValueChange={setCountryCode}>
                            <SelectTrigger id="promotion-country">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DE">Deutschland</SelectItem>
                                <SelectItem value="IT">Italien</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Die Klausel wird nur für Dokumente dieses Landes verfügbar sein.
                        </p>
                    </div>

                    {/* Notizen für Prüfer */}
                    <div className="space-y-2">
                        <Label htmlFor="promotion-notes">Notizen für Prüfer (optional)</Label>
                        <Textarea
                            id="promotion-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="z.B. Kontext, warum diese Klausel nützlich ist..."
                            rows={2}
                            className="resize-none"
                        />
                    </div>

                    {/* Convert to Global Option */}
                    {isDeviation && (
                        <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                            <Checkbox
                                id="convert-to-global"
                                checked={convertToGlobal}
                                onCheckedChange={(checked) => setConvertToGlobal(checked === true)}
                            />
                            <div className="space-y-1">
                                <Label
                                    htmlFor="convert-to-global"
                                    className="text-sm font-medium cursor-pointer"
                                >
                                    Nach Freigabe zu Standard-Klausel umwandeln
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Die Klausel in diesem Dokument wird nach der Freigabe automatisch
                                    mit der neuen Bibliotheks-Klausel verknüpft.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            Vorschau des Inhalts
                        </Label>
                        <div
                            className="p-3 bg-muted rounded-lg text-sm prose prose-sm max-w-none max-h-32 overflow-auto"
                            dangerouslySetInnerHTML={{
                                __html: clause.content_html || "<em>Kein Inhalt</em>",
                            }}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !title.trim() || !category}
                        className="bg-yellow-600 hover:bg-yellow-700"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Wird eingereicht...
                            </span>
                        ) : (
                            <>
                                <Star className="w-4 h-4 mr-2" />
                                Zur Prüfung einreichen
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PromotionDialog;
