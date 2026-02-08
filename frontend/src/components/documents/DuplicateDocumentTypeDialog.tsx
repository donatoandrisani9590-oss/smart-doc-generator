/**
 * DuplicateDocumentTypeDialog
 *
 * Dialog to duplicate a document type with options for:
 * - Custom name
 * - Target country
 * - Include/exclude clauses, attachments, form fields
 */

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Loader2, Check } from "lucide-react";
import {
    useDuplicateDocumentType,
    type DocumentType,
    type DuplicateDocumentTypeResponse,
} from "@/hooks/useApi";

interface DuplicateDocumentTypeDialogProps {
    documentType: DocumentType | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (result: DuplicateDocumentTypeResponse) => void;
}

export const DuplicateDocumentTypeDialog = ({
    documentType,
    open,
    onOpenChange,
    onSuccess,
}: DuplicateDocumentTypeDialogProps) => {
    const [newName, setNewName] = useState("");
    const [targetCountry, setTargetCountry] = useState("");
    const [includeClauses, setIncludeClauses] = useState(true);
    const [includeAttachments, setIncludeAttachments] = useState(true);
    const [includeFormFields, setIncludeFormFields] = useState(true);
    const [result, setResult] = useState<DuplicateDocumentTypeResponse | null>(null);

    const duplicateMutation = useDuplicateDocumentType();

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            // Reset state when closing
            setNewName("");
            setTargetCountry("");
            setIncludeClauses(true);
            setIncludeAttachments(true);
            setIncludeFormFields(true);
            setResult(null);
        }
        onOpenChange(isOpen);
    };

    const handleDuplicate = async () => {
        if (!documentType) return;

        try {
            const response = await duplicateMutation.mutateAsync({
                documentTypeId: documentType.id,
                options: {
                    new_name: newName || undefined,
                    target_country_code: targetCountry || undefined,
                    include_clauses: includeClauses,
                    include_attachments: includeAttachments,
                    include_form_fields: includeFormFields,
                },
            });

            setResult(response);
            onSuccess?.(response);
        } catch (error) {
            // Error handled by mutation
        }
    };

    if (!documentType) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Copy className="w-5 h-5" />
                        Dokumenttyp duplizieren
                    </DialogTitle>
                    <DialogDescription>
                        Erstellen Sie eine Kopie von "{documentType.name}"
                    </DialogDescription>
                </DialogHeader>

                {result ? (
                    // Success state
                    <div className="py-6 text-center">
                        <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                            <Check className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">Erfolgreich dupliziert!</h3>
                        <p className="text-muted-foreground mb-4">
                            "{result.name}" wurde erstellt.
                        </p>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>{result.clauses_copied} Textbausteine kopiert</p>
                            <p>{result.attachments_copied} Anhänge kopiert</p>
                            <p>{result.form_fields_copied} Formularfelder kopiert</p>
                        </div>
                        <DialogFooter className="mt-6">
                            <Button onClick={() => handleOpenChange(false)}>
                                Schließen
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    // Form state
                    <>
                        <div className="space-y-4 py-4">
                            {/* New Name */}
                            <div className="space-y-2">
                                <Label htmlFor="newName">Neuer Name (optional)</Label>
                                <Input
                                    id="newName"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder={`${documentType.name} (Kopie)`}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Leer lassen für automatische Benennung
                                </p>
                            </div>

                            {/* Target Country */}
                            <div className="space-y-2">
                                <Label htmlFor="targetCountry">Zielland (optional)</Label>
                                <select
                                    id="targetCountry"
                                    value={targetCountry}
                                    onChange={(e) => setTargetCountry(e.target.value)}
                                    className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                                >
                                    <option value="">Gleiches Land ({documentType.country_code})</option>
                                    <option value="DE">Deutschland (DE)</option>
                                    <option value="IT">Italien (IT)</option>
                                </select>
                            </div>

                            {/* Include Options */}
                            <div className="space-y-3">
                                <Label>Was soll kopiert werden?</Label>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="includeClauses"
                                        checked={includeClauses}
                                        onCheckedChange={(checked) => setIncludeClauses(checked === true)}
                                    />
                                    <label
                                        htmlFor="includeClauses"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Textbaustein-Zuordnungen
                                    </label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="includeAttachments"
                                        checked={includeAttachments}
                                        onCheckedChange={(checked) => setIncludeAttachments(checked === true)}
                                    />
                                    <label
                                        htmlFor="includeAttachments"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Anhänge
                                    </label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="includeFormFields"
                                        checked={includeFormFields}
                                        onCheckedChange={(checked) => setIncludeFormFields(checked === true)}
                                    />
                                    <label
                                        htmlFor="includeFormFields"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Formularfelder
                                    </label>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                disabled={duplicateMutation.isPending}
                            >
                                Abbrechen
                            </Button>
                            <Button
                                onClick={handleDuplicate}
                                disabled={duplicateMutation.isPending}
                            >
                                {duplicateMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Dupliziere...
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 mr-2" />
                                        Duplizieren
                                    </>
                                )}
                            </Button>
                        </DialogFooter>

                        {duplicateMutation.isError && (
                            <p className="text-sm text-destructive mt-2">
                                Fehler: {duplicateMutation.error.message}
                            </p>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
