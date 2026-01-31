/**
 * NewLocalClauseDialog - Dialog zum Erstellen einer neuen lokalen Klausel
 *
 * Smart UX Phase 3:
 * - Schnelle Erstellung individueller Klauseln
 * - Rich Text Editor für den Inhalt
 * - Optionale Positionierung
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
import { Plus, Loader2, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./RichTextEditor";

interface NewLocalClauseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreateClause: (data: NewClauseData) => Promise<void>;
    position?: number;
    isLoading?: boolean;
}

export interface NewClauseData {
    title: string;
    content_html: string;
    position?: number;
}

export const NewLocalClauseDialog = ({
    open,
    onOpenChange,
    onCreateClause,
    position,
    isLoading = false,
}: NewLocalClauseDialogProps) => {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Reset beim Öffnen
    useEffect(() => {
        if (open) {
            setTitle("");
            setContent("");
            setErrors({});
        }
    }, [open]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!title.trim()) {
            newErrors.title = "Titel ist erforderlich";
        } else if (title.length < 2) {
            newErrors.title = "Titel muss mindestens 2 Zeichen haben";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        await onCreateClause({
            title: title.trim(),
            content_html: content,
            position,
        });

        // Dialog schließen nach erfolgreicher Erstellung
        onOpenChange(false);
    };

    const handleClose = () => {
        if (!isLoading) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-full">
                            <FileEdit className="w-5 h-5 text-blue-600" />
                        </div>
                        Neue individuelle Klausel
                    </DialogTitle>
                    <DialogDescription>
                        Erstellen Sie eine neue Klausel speziell für dieses Dokument.
                        {position !== undefined && (
                            <span className="block mt-1 text-xs">
                                Die Klausel wird an Position {position + 1} eingefügt.
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Titel */}
                    <div className="space-y-2">
                        <Label htmlFor="new-clause-title">
                            Titel <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="new-clause-title"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                            }}
                            placeholder="z.B. Sondervereinbarung Homeoffice"
                            className={cn(errors.title && "border-red-500")}
                            autoFocus
                        />
                        {errors.title && (
                            <p className="text-xs text-red-500">{errors.title}</p>
                        )}
                    </div>

                    {/* Inhalt */}
                    <div className="space-y-2">
                        <Label htmlFor="new-clause-content">Inhalt</Label>
                        <RichTextEditor
                            value={content}
                            onChange={setContent}
                            placeholder="Klauseltext eingeben..."
                            minHeight="200px"
                        />
                        <p className="text-xs text-muted-foreground">
                            Sie können den Inhalt auch später im Eigenschaften-Panel bearbeiten.
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                            <FileEdit className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800">
                                <strong>Tipp:</strong> Individuelle Klauseln können später über
                                "In Bibliothek aufnehmen" als Standard-Bausteine für zukünftige
                                Dokumente gespeichert werden.
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !title.trim()}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Wird erstellt...
                            </span>
                        ) : (
                            <>
                                <Plus className="w-4 h-4 mr-2" />
                                Klausel erstellen
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NewLocalClauseDialog;
