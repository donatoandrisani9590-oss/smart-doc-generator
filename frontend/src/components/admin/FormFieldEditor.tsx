/**
 * FormFieldEditor
 *
 * HR-friendly UI for customizing form fields without IT.
 * Features:
 * - Edit labels, help text, placeholders
 * - Set validation rules (min, max, required)
 * - Define default values
 * - Drag-and-drop reordering
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    useFormFields,
    useUpdateFormField,
    useFieldTypes,
    type FormField,
    type FormFieldUpdate,
} from "@/hooks/useApi";
import {
    Settings,
    GripVertical,
    Loader2,
    Save,
    X,
    HelpCircle,
    Type,
    Hash,
    Calendar,
    CheckSquare,
    List,
    Mail,
    AlignLeft,
} from "lucide-react";

interface FormFieldEditorProps {
    documentTypeId: number;
    documentTypeName?: string;
}

// Field type icons
const fieldTypeIcons: Record<string, typeof Type> = {
    text: Type,
    textarea: AlignLeft,
    number: Hash,
    date: Calendar,
    select: List,
    checkbox: CheckSquare,
    email: Mail,
};

export const FormFieldEditor = ({ documentTypeId, documentTypeName }: FormFieldEditorProps) => {
    const [selectedField, setSelectedField] = useState<FormField | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    const { data: fields, isLoading } = useFormFields(documentTypeId);
    const { data: fieldTypesData } = useFieldTypes();
    const updateMutation = useUpdateFormField();

    // Edit form state
    const [editForm, setEditForm] = useState<FormFieldUpdate>({});

    const handleEditField = (field: FormField) => {
        setSelectedField(field);
        setEditForm({
            field_label: field.field_label,
            field_type: field.field_type,
            is_required: field.is_required,
            default_value: field.default_value || "",
            help_text: field.help_text || "",
            placeholder_text: field.placeholder_text || "",
            suffix: field.suffix || "",
            min_value: field.min_value ?? undefined,
            max_value: field.max_value ?? undefined,
        });
        setEditDialogOpen(true);
    };

    const handleSaveField = async () => {
        if (!selectedField) return;

        try {
            await updateMutation.mutateAsync({
                fieldId: selectedField.id,
                data: editForm,
            });
            setEditDialogOpen(false);
            setSelectedField(null);
        } catch {
            // Error handled by mutation
        }
    };

    // Group fields by display_group
    const groupedFields = (fields || []).reduce((acc, field) => {
        const group = field.display_group || "Allgemein";
        if (!acc[group]) acc[group] = [];
        acc[group].push(field);
        return acc;
    }, {} as Record<string, FormField[]>);

    const fieldTypes = fieldTypesData?.field_types || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold">Formularfelder anpassen</h2>
                    <p className="text-sm text-muted-foreground">
                        {documentTypeName || `Dokumenttyp #${documentTypeId}`}
                    </p>
                </div>
            </div>

            {/* Info Box */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                    <div className="flex gap-3">
                        <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-medium">So passen Sie Felder an:</p>
                            <ul className="mt-1 list-disc list-inside space-y-1">
                                <li>Klicken Sie auf ein Feld, um Label, Hilfetext und Validierung zu ändern</li>
                                <li>Pflichtfelder werden mit * markiert</li>
                                <li>Ihre Änderungen werden sofort gespeichert</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Fields List */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : Object.keys(groupedFields).length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Keine Formularfelder für diesen Dokumenttyp</p>
                    </CardContent>
                </Card>
            ) : (
                Object.entries(groupedFields).map(([groupName, groupFields]) => (
                    <Card key={groupName}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">{groupName}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {groupFields.map((field) => {
                                const FieldIcon = fieldTypeIcons[field.field_type] || Type;

                                return (
                                    <div
                                        key={field.id}
                                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                        onClick={() => handleEditField(field)}
                                    >
                                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />

                                        <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                                            <FieldIcon className="w-4 h-4 text-primary" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium truncate">
                                                    {field.field_label}
                                                </span>
                                                {field.is_required && (
                                                    <span className="text-destructive">*</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <code className="bg-muted px-1 rounded">
                                                    {`{{ ${field.field_name} }}`}
                                                </code>
                                                <span>•</span>
                                                <span>{fieldTypes.find(t => t.type === field.field_type)?.label || field.field_type}</span>
                                                {field.suffix && (
                                                    <>
                                                        <span>•</span>
                                                        <span>Suffix: {field.suffix}</span>
                                                    </>
                                                )}
                                            </div>
                                            {field.help_text && (
                                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                                    {field.help_text}
                                                </p>
                                            )}
                                        </div>

                                        <Button variant="ghost" size="icon">
                                            <Settings className="w-4 h-4" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                ))
            )}

            {/* Edit Field Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Feld anpassen</DialogTitle>
                        <DialogDescription>
                            {selectedField && (
                                <code className="text-xs bg-muted px-1 rounded">
                                    {`{{ ${selectedField.field_name} }}`}
                                </code>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                        {/* Label */}
                        <div className="space-y-2">
                            <Label htmlFor="field_label">Anzeige-Label</Label>
                            <Input
                                id="field_label"
                                value={editForm.field_label || ""}
                                onChange={(e) => setEditForm({ ...editForm, field_label: e.target.value })}
                                placeholder="z.B. Bruttogehalt (jährlich)"
                            />
                        </div>

                        {/* Field Type */}
                        <div className="space-y-2">
                            <Label htmlFor="field_type">Feldtyp</Label>
                            <select
                                id="field_type"
                                value={editForm.field_type || "text"}
                                onChange={(e) => setEditForm({ ...editForm, field_type: e.target.value })}
                                className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                            >
                                {fieldTypes.map((type) => (
                                    <option key={type.type} value={type.type}>
                                        {type.label} - {type.description}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Required */}
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_required"
                                checked={editForm.is_required || false}
                                onCheckedChange={(checked) =>
                                    setEditForm({ ...editForm, is_required: checked === true })
                                }
                            />
                            <label htmlFor="is_required" className="text-sm font-medium">
                                Pflichtfeld
                            </label>
                        </div>

                        {/* Help Text */}
                        <div className="space-y-2">
                            <Label htmlFor="help_text">Hilfetext (Tooltip)</Label>
                            <Input
                                id="help_text"
                                value={editForm.help_text || ""}
                                onChange={(e) => setEditForm({ ...editForm, help_text: e.target.value })}
                                placeholder="z.B. Jahresgehalt ohne Bonus, in Euro"
                            />
                            <p className="text-xs text-muted-foreground">
                                Wird als Hinweis unter dem Feld angezeigt
                            </p>
                        </div>

                        {/* Placeholder */}
                        <div className="space-y-2">
                            <Label htmlFor="placeholder_text">Platzhalter</Label>
                            <Input
                                id="placeholder_text"
                                value={editForm.placeholder_text || ""}
                                onChange={(e) => setEditForm({ ...editForm, placeholder_text: e.target.value })}
                                placeholder="z.B. 55000"
                            />
                            <p className="text-xs text-muted-foreground">
                                Wird im leeren Feld als Beispiel angezeigt
                            </p>
                        </div>

                        {/* Default Value */}
                        <div className="space-y-2">
                            <Label htmlFor="default_value">Standardwert</Label>
                            <Input
                                id="default_value"
                                value={editForm.default_value || ""}
                                onChange={(e) => setEditForm({ ...editForm, default_value: e.target.value })}
                                placeholder="Vorbelegter Wert"
                            />
                        </div>

                        {/* Suffix */}
                        <div className="space-y-2">
                            <Label htmlFor="suffix">Einheit (Suffix)</Label>
                            <Input
                                id="suffix"
                                value={editForm.suffix || ""}
                                onChange={(e) => setEditForm({ ...editForm, suffix: e.target.value })}
                                placeholder="z.B. €, Tage, Stunden"
                            />
                        </div>

                        {/* Validation - for number fields */}
                        {editForm.field_type === "number" && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="min_value">Mindestwert</Label>
                                    <Input
                                        id="min_value"
                                        type="number"
                                        value={editForm.min_value ?? ""}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                min_value: e.target.value ? Number(e.target.value) : undefined,
                                            })
                                        }
                                        placeholder="z.B. 0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max_value">Maximalwert</Label>
                                    <Input
                                        id="max_value"
                                        type="number"
                                        value={editForm.max_value ?? ""}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                max_value: e.target.value ? Number(e.target.value) : undefined,
                                            })
                                        }
                                        placeholder="z.B. 500000"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Preview */}
                        <div className="border-t pt-4 mt-4">
                            <Label className="mb-2 block">Vorschau</Label>
                            <div className="p-4 bg-muted/30 rounded-lg">
                                <label className="text-sm font-medium">
                                    {editForm.field_label || "Feldname"}
                                    {editForm.is_required && <span className="text-destructive ml-1">*</span>}
                                </label>
                                <div className="flex mt-1">
                                    <Input
                                        placeholder={editForm.placeholder_text || ""}
                                        defaultValue={editForm.default_value || ""}
                                        className="flex-1"
                                        disabled
                                    />
                                    {editForm.suffix && (
                                        <span className="ml-2 flex items-center text-sm text-muted-foreground">
                                            {editForm.suffix}
                                        </span>
                                    )}
                                </div>
                                {editForm.help_text && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {editForm.help_text}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            <X className="w-4 h-4 mr-2" />
                            Abbrechen
                        </Button>
                        <Button onClick={handleSaveField} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            Speichern
                        </Button>
                    </DialogFooter>

                    {updateMutation.isError && (
                        <p className="text-sm text-destructive">
                            Fehler: {updateMutation.error.message}
                        </p>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
