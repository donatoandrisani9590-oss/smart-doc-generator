/**
 * ClauseChangeReasonDialog - Dialog für Änderungsgrund bei Klausel-Bearbeitung
 *
 * v4.2 Feature (Kapitel 15.5.10):
 * - Änderungsgrund dokumentieren (Gesetzesänderung, Korrektur, etc.)
 * - Pflicht-Kommentar für Nachvollziehbarkeit
 * - Referenz auf Gesetze/Urteile (optional)
 */

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Scale,
    FileText,
    Wrench,
    Sparkles,
    Gavel,
    Building2,
    HelpCircle,
    Loader2,
    AlertCircle,
    History,
    Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Änderungsgründe gemäß v4.2 Spezifikation
const CHANGE_REASONS = [
    {
        code: "gesetzesaenderung",
        label: "Gesetzesänderung",
        description: "Anpassung aufgrund neuer oder geänderter Gesetze/Verordnungen",
        icon: Scale,
        color: "text-blue-600 bg-blue-100",
    },
    {
        code: "tarifvertrag",
        label: "Tarifvertrag",
        description: "Anpassung aufgrund neuer Tarifvereinbarungen",
        icon: FileText,
        color: "text-purple-600 bg-purple-100",
    },
    {
        code: "betriebsvereinbarung",
        label: "Betriebsvereinbarung",
        description: "Anpassung aufgrund neuer Betriebsvereinbarungen",
        icon: Building2,
        color: "text-orange-600 bg-orange-100",
    },
    {
        code: "korrektur",
        label: "Korrektur/Fehlerbeseitigung",
        description: "Behebung von Fehlern oder Unklarheiten",
        icon: Wrench,
        color: "text-red-600 bg-red-100",
    },
    {
        code: "optimierung",
        label: "Optimierung",
        description: "Verbesserung der Formulierung ohne inhaltliche Änderung",
        icon: Sparkles,
        color: "text-green-600 bg-green-100",
    },
    {
        code: "rechtsprechung",
        label: "Rechtsprechung",
        description: "Anpassung aufgrund neuer Gerichtsurteile",
        icon: Gavel,
        color: "text-amber-600 bg-amber-100",
    },
    {
        code: "sonstiges",
        label: "Sonstiges",
        description: "Andere Gründe (bitte im Kommentar erläutern)",
        icon: HelpCircle,
        color: "text-gray-600 bg-gray-100",
    },
];

interface ClauseChangeReasonDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clauseTitle: string;
    currentVersion: number;
    onConfirm: (data: {
        changeReason: string;
        changeComment: string;
        changeReference?: string;
    }) => void;
    isLoading?: boolean;
}

export const ClauseChangeReasonDialog = ({
    open,
    onOpenChange,
    clauseTitle,
    currentVersion,
    onConfirm,
    isLoading = false,
}: ClauseChangeReasonDialogProps) => {
    const [selectedReason, setSelectedReason] = useState<string>("");
    const [comment, setComment] = useState("");
    const [reference, setReference] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!selectedReason) {
            newErrors.reason = "Bitte wählen Sie einen Änderungsgrund";
        }

        if (!comment.trim()) {
            newErrors.comment = "Bitte beschreiben Sie die Änderung";
        } else if (comment.length < 10) {
            newErrors.comment = "Bitte geben Sie eine ausführlichere Beschreibung an";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleConfirm = () => {
        if (!validate()) return;

        onConfirm({
            changeReason: selectedReason,
            changeComment: comment,
            changeReference: reference || undefined,
        });
    };

    const handleClose = () => {
        setSelectedReason("");
        setComment("");
        setReference("");
        setErrors({});
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        Änderung dokumentieren
                    </DialogTitle>
                    <DialogDescription>
                        Bitte dokumentieren Sie den Grund für die Änderung an "{clauseTitle}"
                        <span className="ml-1 text-muted-foreground">
                            (v{currentVersion} → v{currentVersion + 1})
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Änderungsgrund */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">
                            Änderungsgrund <span className="text-red-500">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            {CHANGE_REASONS.map((reason) => {
                                const Icon = reason.icon;
                                const isSelected = selectedReason === reason.code;
                                return (
                                    <button
                                        key={reason.code}
                                        type="button"
                                        onClick={() => setSelectedReason(reason.code)}
                                        className={cn(
                                            "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                                            isSelected
                                                ? "border-primary bg-primary/5 ring-1 ring-[#243186]"
                                                : "border-border hover:border-primary/50"
                                        )}
                                    >
                                        <div className={cn("p-1.5 rounded", reason.color)}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-foreground">
                                                {reason.label}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {reason.description}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {errors.reason && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.reason}
                            </p>
                        )}
                    </div>

                    {/* Kommentar */}
                    <div className="space-y-2">
                        <Label htmlFor="comment" className="text-sm font-medium">
                            Beschreibung der Änderung <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Beschreiben Sie, was und warum geändert wurde..."
                            rows={3}
                            className={cn(errors.comment && "border-red-500")}
                        />
                        {errors.comment ? (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.comment}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Diese Dokumentation ist für die Compliance-Nachverfolgung wichtig
                            </p>
                        )}
                    </div>

                    {/* Referenz (optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="reference" className="text-sm font-medium flex items-center gap-2">
                            <Bookmark className="w-4 h-4 text-muted-foreground" />
                            Referenz (optional)
                        </Label>
                        <Input
                            id="reference"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="z.B. § 4 TzBfG, BAG Urteil vom 01.01.2025"
                        />
                        <p className="text-xs text-muted-foreground">
                            Verweisen Sie auf Gesetze, Urteile oder interne Dokumente
                        </p>
                    </div>

                    {/* Info Banner */}
                    <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="py-3 px-4">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-amber-800">
                                    <strong>Hinweis:</strong> Diese Informationen werden in der
                                    Versionshistorie gespeichert und sind für alle Benutzer einsehbar.
                                    Sie dienen der Nachvollziehbarkeit von Änderungen.
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading || !selectedReason || !comment.trim()}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <History className="w-4 h-4 mr-2" />
                        )}
                        Änderung speichern
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
