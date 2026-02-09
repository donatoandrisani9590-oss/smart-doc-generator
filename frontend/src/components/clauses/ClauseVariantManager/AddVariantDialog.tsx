import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, FileText, Loader2, AlertCircle } from "lucide-react";
import { useClauses, type Clause } from "@/hooks/useApi";
import type { VariantGroup } from "./types";

const API_BASE = "/api/v1";

interface AddVariantDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: VariantGroup | null;
    countryCode: string;
    onSuccess: () => void;
}

export const AddVariantDialog = ({
    open,
    onOpenChange,
    group,
    countryCode,
    onSuccess,
}: AddVariantDialogProps) => {
    const [variantName, setVariantName] = useState("");
    const [variantCode, setVariantCode] = useState("");
    const [description, setDescription] = useState("");
    const [selectedClauseId, setSelectedClauseId] = useState<number | null>(null);
    const [isDefault, setIsDefault] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { data: clauses } = useClauses(countryCode);

    // Bereits verwendete Textbausteine in dieser Gruppe ausfiltern
    const availableClauses = clauses?.filter(
        (c: Clause) => !group?.variants.some((v) => v.clause_id === c.id)
    );

    const handleSubmit = async () => {
        if (!variantName.trim() || !selectedClauseId || !group) {
            setError("Name und Textbaustein sind erforderlich");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await apiFetch(
                `${API_BASE}/clause-variants/groups/${group.id}/variants`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clause_id: selectedClauseId,
                        variant_name: variantName,
                        variant_code: variantCode || undefined,
                        description: description || undefined,
                        is_default: isDefault,
                        sort_order: group.variants.length,
                    }),
                }
            );

            if (!res.ok) {
                throw new Error("Fehler beim Hinzufügen der Variante");
            }

            // Reset form
            setVariantName("");
            setVariantCode("");
            setDescription("");
            setSelectedClauseId(null);
            setIsDefault(false);
            onSuccess();
            onOpenChange(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!group) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary" />
                        Variante hinzufügen
                    </DialogTitle>
                    <DialogDescription>
                        Fügen Sie einen Textbaustein als Variante zu "{group.name}" hinzu
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="clause">Textbaustein auswählen *</Label>
                        <Select
                            value={selectedClauseId?.toString() || ""}
                            onValueChange={(v) => setSelectedClauseId(parseInt(v))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Textbaustein wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableClauses?.map((clause: Clause) => (
                                    <SelectItem key={clause.id} value={clause.id.toString()}>
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            <span>{clause.title}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {clause.category}
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="variantName">Varianten-Name *</Label>
                            <Input
                                id="variantName"
                                value={variantName}
                                onChange={(e) => setVariantName(e.target.value)}
                                placeholder="z.B. 3 Monate (Standard)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="variantCode">Kürzel</Label>
                            <Input
                                id="variantCode"
                                value={variantCode}
                                onChange={(e) => setVariantCode(e.target.value)}
                                placeholder="z.B. A, B, C"
                                maxLength={5}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="variantDesc">Beschreibung</Label>
                        <Textarea
                            id="variantDesc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Wann wird diese Variante verwendet? (z.B. für Führungskräfte)"
                            rows={2}
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                        <input
                            type="checkbox"
                            id="isDefault"
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                            className="w-4 h-4 rounded border-border"
                        />
                        <div>
                            <Label htmlFor="isDefault" className="font-medium cursor-pointer">
                                Als Standard-Variante festlegen
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Diese Variante wird automatisch vorausgewählt
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !selectedClauseId || !variantName.trim()}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4 mr-2" />
                        )}
                        Variante hinzufügen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
