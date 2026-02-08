import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, Link2, Building2, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { VariantGroup } from "./types";

const API_BASE = "/api/v1";

interface AssignDocumentTypesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: VariantGroup | null;
    countryCode: string;
    onSuccess: () => void;
}

export const AssignDocumentTypesDialog = ({
    open,
    onOpenChange,
    group,
    countryCode: _countryCode,
    onSuccess,
}: AssignDocumentTypesDialogProps) => {
    const [assignments, setAssignments] = useState<{
        document_type_id: number;
        document_type_name: string;
        document_type_category?: string;
        is_assigned: boolean;
        is_mandatory: boolean;
        default_variant_id: number | null;
    }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Lade Dokumenttypen-Zuordnungen beim Öffnen
    useEffect(() => {
        if (open && group) {
            setIsLoading(true);
            setError(null);
            apiFetch(`${API_BASE}/clause-variants/groups/${group.id}/document-types`)
                .then(res => {
                    if (!res.ok) throw new Error("Fehler beim Laden der Zuordnungen");
                    return res.json();
                })
                .then(data => {
                    // Zusammenführen: zugeordnete + verfügbare
                    const assigned = data.assignments || [];
                    const available = data.available_document_types || [];

                    const combined = [
                        ...assigned.map((a: { document_type_id: number; document_type_name: string; document_type_category?: string; is_mandatory: boolean; default_variant_id?: number }) => ({
                            document_type_id: a.document_type_id,
                            document_type_name: a.document_type_name,
                            document_type_category: a.document_type_category,
                            is_assigned: true,
                            is_mandatory: a.is_mandatory,
                            default_variant_id: a.default_variant_id || null,
                        })),
                        ...available.map((dt: { id: number; name: string; category?: string }) => ({
                            document_type_id: dt.id,
                            document_type_name: dt.name,
                            document_type_category: dt.category,
                            is_assigned: false,
                            is_mandatory: true,
                            default_variant_id: group.variants.find(v => v.is_default)?.id || null,
                        })),
                    ];
                    setAssignments(combined);
                })
                .catch(err => setError(err.message))
                .finally(() => setIsLoading(false));
        }
    }, [open, group]);

    const toggleAssignment = (docTypeId: number) => {
        setAssignments(prev =>
            prev.map(a =>
                a.document_type_id === docTypeId
                    ? { ...a, is_assigned: !a.is_assigned }
                    : a
            )
        );
    };

    const toggleMandatory = (docTypeId: number) => {
        setAssignments(prev =>
            prev.map(a =>
                a.document_type_id === docTypeId
                    ? { ...a, is_mandatory: !a.is_mandatory }
                    : a
            )
        );
    };

    const setDefaultVariant = (docTypeId: number, variantId: number) => {
        setAssignments(prev =>
            prev.map(a =>
                a.document_type_id === docTypeId
                    ? { ...a, default_variant_id: variantId }
                    : a
            )
        );
    };

    const handleSave = async () => {
        if (!group) return;

        setIsSaving(true);
        setError(null);

        try {
            const assignedDocs = assignments
                .filter(a => a.is_assigned)
                .map(a => ({
                    document_type_id: a.document_type_id,
                    is_mandatory: a.is_mandatory,
                    default_variant_id: a.default_variant_id,
                    display_order: 0,
                }));

            const res = await apiFetch(`${API_BASE}/clause-variants/groups/${group.id}/document-types`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignments: assignedDocs }),
            });

            if (!res.ok) throw new Error("Fehler beim Speichern der Zuordnungen");

            onSuccess();
            onOpenChange(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!group) return null;

    const assignedCount = assignments.filter(a => a.is_assigned).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-purple-600" />
                        Dokumenttypen zuordnen
                    </DialogTitle>
                    <DialogDescription>
                        Ordnen Sie die Varianten-Gruppe "{group.name}" den gewünschten Dokumenttypen zu.
                        Bei der Dokumenterstellung erscheint dann eine Auswahl für die Varianten.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-lg">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    ) : assignments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Keine Dokumenttypen gefunden
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {assignments.map(a => (
                                <div
                                    key={a.document_type_id}
                                    className={cn(
                                        "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                                        a.is_assigned
                                            ? "border-purple-300 bg-purple-50"
                                            : "border-border hover:border-purple-200"
                                    )}
                                >
                                    <Checkbox
                                        checked={a.is_assigned}
                                        onCheckedChange={() => toggleAssignment(a.document_type_id)}
                                    />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{a.document_type_name}</span>
                                            {a.document_type_category && (
                                                <Badge variant="outline" className="text-xs">
                                                    {a.document_type_category}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {a.is_assigned && (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleMandatory(a.document_type_id)}
                                                className={cn(
                                                    "px-2 py-1 text-xs rounded transition-colors",
                                                    a.is_mandatory
                                                        ? "bg-purple-200 text-purple-800"
                                                        : "bg-warm-100 text-muted-foreground"
                                                )}
                                            >
                                                {a.is_mandatory ? "Pflicht" : "Optional"}
                                            </button>

                                            <Select
                                                value={String(a.default_variant_id || "")}
                                                onValueChange={(val) => setDefaultVariant(a.document_type_id, parseInt(val))}
                                            >
                                                <SelectTrigger className="h-8 w-[160px] text-xs">
                                                    <SelectValue placeholder="Standard-Variante" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {group.variants.map(v => (
                                                        <SelectItem key={v.id} value={String(v.id)}>
                                                            {v.variant_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-sm text-muted-foreground">
                            {assignedCount} Dokumenttyp{assignedCount !== 1 ? "en" : ""} zugeordnet
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Abbrechen
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4 mr-2" />
                                )}
                                Speichern
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
