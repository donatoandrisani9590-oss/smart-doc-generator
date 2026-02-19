/**
 * DocumentTypesManager
 *
 * Admin page for managing document types.
 * Features:
 * - List all document types
 * - Create new document types
 * - Edit existing document types
 * - Duplicate document types
 * - Delete document types
 * - Filter by country
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    useDocumentTypes,
    useDeleteDocumentType,
    type DocumentType,
} from "@/hooks/useApi";
import { useCountry } from "@/hooks/useCountry";
import {
    Copy,
    Trash2,
    Search,
    FileText,
    MoreVertical,
    Edit,
    Loader2,
    Plus,
    FileUp,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DuplicateDocumentTypeDialog } from "@/components/documents/DuplicateDocumentTypeDialog";
import { DocumentTypeEditor } from "@/components/admin/DocumentTypeEditor";
import { DocumentTypeImportWizard } from "@/components/admin/DocumentTypeImportWizard";

export const DocumentTypesManager = () => {
    const { country } = useCountry();
    const [countryCode, setCountryCode] = useState<string>(country);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
    const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [importWizardOpen, setImportWizardOpen] = useState(false);

    const { data: documentTypes, isLoading } = useDocumentTypes(countryCode);
    const deleteMutation = useDeleteDocumentType();

    // Filter document types by search
    const filteredTypes = (documentTypes || []).filter((dt: DocumentType) =>
        dt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dt.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleNewDocumentType = () => {
        setEditId(null);
        setEditorOpen(true);
    };

    const handleEdit = (dt: DocumentType) => {
        setEditId(dt.id);
        setEditorOpen(true);
    };

    const handleDuplicate = (dt: DocumentType) => {
        setSelectedType(dt);
        setDuplicateDialogOpen(true);
    };

    const handleDeleteClick = (dt: DocumentType) => {
        setSelectedType(dt);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedType) return;

        try {
            await deleteMutation.mutateAsync(selectedType.id);
            setDeleteDialogOpen(false);
            setSelectedType(null);
        } catch {
            // Error handled by mutation
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground/80">Dokumenttypen verwalten</h1>
                    <p className="text-sm text-muted-foreground">
                        Erstelle, bearbeite und dupliziere Dokumenttypen
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setImportWizardOpen(true)}
                        className="gap-2"
                    >
                        <FileUp className="w-4 h-4" />
                        Word importieren
                    </Button>
                    <Button
                        onClick={handleNewDocumentType}
                        className="gap-2 bg-primary hover:bg-primary/90"
                    >
                        <Plus className="w-4 h-4" />
                        Neuer Dokumenttyp
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        {/* Country Filter */}
                        <Select value={countryCode} onValueChange={setCountryCode}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DE">🇩🇪 Deutschland (DE)</SelectItem>
                                <SelectItem value="IT">🇮🇹 Italien (IT)</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Dokumenttyp suchen..."
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Document Types List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-foreground/80">
                        {filteredTypes.length} Dokumenttyp{filteredTypes.length !== 1 ? "en" : ""}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : filteredTypes.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-medium mb-2">Noch keine Dokumenttypen</h3>
                            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                Importiere eine bestehende Word-Vorlage oder erstelle einen neuen Dokumenttyp von Grund auf.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <Button
                                    size="lg"
                                    onClick={() => setImportWizardOpen(true)}
                                    className="gap-2"
                                >
                                    <FileUp className="w-5 h-5" />
                                    Word-Vorlage importieren
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={handleNewDocumentType}
                                    className="gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Manuell erstellen
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredTypes.map((dt: DocumentType) => (
                                <div
                                    key={dt.id}
                                    className="flex items-center justify-between p-4 bg-background rounded-lg hover:bg-primary/5 transition-colors cursor-pointer"
                                    onClick={() => handleEdit(dt)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-foreground">{dt.name}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {dt.category || "Keine Kategorie"} • {dt.country_code === "DE" ? "🇩🇪" : "🇮🇹"} {dt.country_code}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        {/* Status Badge */}
                                        <span
                                            className={`px-2 py-1 text-xs rounded-full ${
                                                dt.is_active
                                                    ? "bg-secondary/20 text-secondary"
                                                    : "bg-warm-100 text-warm-600"
                                            }`}
                                        >
                                            {dt.is_active ? "Aktiv" : "Inaktiv"}
                                        </span>

                                        {/* Quick Actions */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDuplicate(dt)}
                                            title="Duplizieren"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>

                                        {/* More Actions */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(dt)}>
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Bearbeiten
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicate(dt)}>
                                                    <Copy className="w-4 h-4 mr-2" />
                                                    Duplizieren
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() => handleDeleteClick(dt)}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Löschen
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Document Type Editor Dialog */}
            <DocumentTypeEditor
                open={editorOpen}
                onOpenChange={setEditorOpen}
                editId={editId}
                countryCode={countryCode}
                onSuccess={() => {
                    setEditorOpen(false);
                    setEditId(null);
                }}
            />

            {/* Duplicate Dialog */}
            <DuplicateDocumentTypeDialog
                documentType={selectedType}
                open={duplicateDialogOpen}
                onOpenChange={setDuplicateDialogOpen}
                onSuccess={() => {
                    // Dialog will close automatically after showing success
                }}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dokumenttyp löschen?</DialogTitle>
                        <DialogDescription>
                            Bist du sicher, dass du "{selectedType?.name}" löschen möchtest?
                            Diese Aktion kann nicht rückgängig gemacht werden.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            disabled={deleteMutation.isPending}
                        >
                            Abbrechen
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Lösche...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Löschen
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                    {deleteMutation.isError && (
                        <p className="text-sm text-red-600">
                            Fehler: {deleteMutation.error.message}
                        </p>
                    )}
                </DialogContent>
            </Dialog>

            {/* Word Import Wizard */}
            <DocumentTypeImportWizard
                open={importWizardOpen}
                onOpenChange={setImportWizardOpen}
                countryCode={countryCode}
                onImportComplete={() => {
                    setImportWizardOpen(false);
                    window.location.reload();
                }}
            />
        </div>
    );
};
