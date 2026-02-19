/**
 * StationeryGalleryPage - Briefpapier management page
 *
 * Settings sub-page for managing blank letterhead templates (Briefpapier).
 * Shows a visual card grid with country-code filter tabs, upload dialog,
 * delete confirmation, and set-as-default actions.
 *
 * Fetches templates via GET /api/v1/user-templates?template_type=stationery
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Plus,
    Trash2,
    Loader2,
    Upload,
    Stamp,
    Save,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { StationeryCard } from "@/components/admin/StationeryCard";
import { TemplateUploadDialog } from "@/components/admin/TemplateUploadDialog";
import type { StationeryTemplate } from "@/components/admin/StationeryCard";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Map country code to flag emoji */
function countryFlag(code: string): string {
    try {
        const upper = code.toUpperCase();
        if (upper.length !== 2) return code;
        const codePoints = [...upper].map(
            (c) => 0x1f1e6 + c.charCodeAt(0) - 65
        );
        return String.fromCodePoint(...codePoints);
    } catch {
        return code;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE DIALOG
// ═══════════════════════════════════════════════════════════════════════════

interface DeleteDialogProps {
    template: StationeryTemplate | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

function DeleteDialog({ template, open, onOpenChange, onConfirm, isDeleting }: DeleteDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Briefpapier löschen</DialogTitle>
                    <DialogDescription>
                        Bist du sicher, dass du das Briefpapier &ldquo;{template?.name}&rdquo; löschen möchtest?
                        Diese Aktion kann nicht rückgängig gemacht werden.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
                        Abbrechen
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
                        {isDeleting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Wird gelöscht...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Löschen
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDIT DIALOG
// ═══════════════════════════════════════════════════════════════════════════

interface EditDialogProps {
    template: StationeryTemplate | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (id: number, data: { name: string; description: string; country_code: string; category: string }) => void;
    isSaving: boolean;
}

function EditDialog({ template, open, onOpenChange, onSave, isSaving }: EditDialogProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [countryCode, setCountryCode] = useState("");
    const [category, setCategory] = useState("");

    useEffect(() => {
        if (template && open) {
            setName(template.name);
            setDescription(template.description || "");
            setCountryCode(template.country_code || "");
            setCategory(template.category || "");
        }
    }, [template, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Briefpapier bearbeiten</DialogTitle>
                    <DialogDescription>
                        Name, Beschreibung, Land oder Kategorie ändern.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-name">Name *</Label>
                        <Input
                            id="edit-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={255}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-desc">Beschreibung</Label>
                        <Textarea
                            id="edit-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            maxLength={1000}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-country">Land</Label>
                            <Input
                                id="edit-country"
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                                placeholder="z.B. DE"
                                maxLength={2}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-category">Kategorie</Label>
                            <Input
                                id="edit-category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="z.B. HR"
                                maxLength={100}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={() => template && onSave(template.id, { name, description, country_code: countryCode, category })}
                        disabled={!name.trim() || isSaving}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Wird gespeichert...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Speichern
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function StationeryGalleryPage() {
    const toast = useToast();
    const [templates, setTemplates] = useState<StationeryTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [deleteTemplate, setDeleteTemplate] = useState<StationeryTemplate | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editTemplate, setEditTemplate] = useState<StationeryTemplate | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeCountryFilter, setActiveCountryFilter] = useState<string>("all");

    // ───────────────────────────────────────────────────────────────────────
    // Fetch stationery templates
    // ───────────────────────────────────────────────────────────────────────

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiFetch("/api/v1/user-templates?template_type=stationery");
            if (response.ok) {
                const data = await response.json();
                setTemplates(data.items || []);
            } else if (response.status === 404) {
                // API endpoint may not be deployed yet - show empty state
                setTemplates([]);
            }
        } catch {
            toast.error("Fehler", "Briefpapiere konnten nicht geladen werden");
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // ───────────────────────────────────────────────────────────────────────
    // Derive unique countries for filter tabs
    // ───────────────────────────────────────────────────────────────────────

    const uniqueCountries = useMemo(() => {
        const countries = new Set<string>();
        templates.forEach((t) => {
            if (t.country_code) countries.add(t.country_code.toUpperCase());
        });
        return Array.from(countries).sort();
    }, [templates]);

    // ───────────────────────────────────────────────────────────────────────
    // Filter templates by country
    // ───────────────────────────────────────────────────────────────────────

    const filteredTemplates = useMemo(() => {
        if (activeCountryFilter === "all") return templates;
        return templates.filter(
            (t) => t.country_code?.toUpperCase() === activeCountryFilter
        );
    }, [templates, activeCountryFilter]);

    // ───────────────────────────────────────────────────────────────────────
    // Actions
    // ───────────────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!deleteTemplate) return;
        setIsDeleting(true);
        try {
            const response = await apiFetch(`/api/v1/user-templates/${deleteTemplate.id}`, {
                method: "DELETE",
            });
            if (response.ok) {
                setTemplates((prev) => prev.filter((t) => t.id !== deleteTemplate.id));
                toast.success("Briefpapier gelöscht", `"${deleteTemplate.name}" wurde entfernt`);
                setDeleteTemplate(null);
            } else {
                toast.error("Fehler", "Briefpapier konnte nicht gelöscht werden");
            }
        } catch {
            toast.error("Fehler", "Briefpapier konnte nicht gelöscht werden");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSetDefault = async (id: number) => {
        try {
            const response = await apiFetch(`/api/v1/user-templates/${id}/default`, {
                method: "PUT",
            });
            if (response.ok) {
                // Country-aware: nur Defaults desselben Landes zurücksetzen
                const target = templates.find((t) => t.id === id);
                const targetCountry = target?.country_code?.toUpperCase() ?? null;
                setTemplates((prev) =>
                    prev.map((t) => {
                        const tCountry = t.country_code?.toUpperCase() ?? null;
                        if (t.id === id) return { ...t, is_default: true };
                        if (tCountry === targetCountry) return { ...t, is_default: false };
                        return t;
                    })
                );
                toast.success("Standard gesetzt", "Briefpapier als Standard festgelegt");
            } else {
                toast.error("Fehler", "Standard konnte nicht gesetzt werden");
            }
        } catch {
            toast.error("Fehler", "Standard konnte nicht gesetzt werden");
        }
    };

    const handleDownload = async (template: StationeryTemplate) => {
        try {
            const response = await apiFetch(`/api/v1/user-templates/${template.id}/download`);
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = template.original_filename;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                toast.error("Fehler", "Download fehlgeschlagen");
            }
        } catch {
            toast.error("Fehler", "Download fehlgeschlagen");
        }
    };

    const handleEdit = async (id: number, data: { name: string; description: string; country_code: string; category: string }) => {
        setIsSaving(true);
        try {
            const params = new URLSearchParams();
            params.set("name", data.name.trim());
            params.set("description", data.description.trim());
            params.set("country_code", data.country_code.trim());
            params.set("category", data.category.trim());

            const response = await apiFetch(`/api/v1/user-templates/${id}?${params.toString()}`, {
                method: "PATCH",
            });
            if (response.ok) {
                const updated = await response.json();
                setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
                toast.success("Gespeichert", "Briefpapier wurde aktualisiert");
                setEditTemplate(null);
            } else {
                const err = await response.json().catch(() => null);
                toast.error("Fehler", err?.detail || "Änderungen konnten nicht gespeichert werden");
            }
        } catch {
            toast.error("Fehler", "Änderungen konnten nicht gespeichert werden");
        } finally {
            setIsSaving(false);
        }
    };

    // ───────────────────────────────────────────────────────────────────────
    // Render
    // ───────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">Briefpapier</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Blanko-Briefpapiere mit Firmen-Branding als Basis für Dokumente.
                    </p>
                </div>
                <Button onClick={() => setUploadOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Briefpapier hochladen
                </Button>
            </div>

            {/* Country Filter Tabs */}
            {uniqueCountries.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant={activeCountryFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveCountryFilter("all")}
                    >
                        Alle
                        <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                            {templates.length}
                        </Badge>
                    </Button>
                    {uniqueCountries.map((cc) => {
                        const count = templates.filter(
                            (t) => t.country_code?.toUpperCase() === cc
                        ).length;
                        return (
                            <Button
                                key={cc}
                                variant={activeCountryFilter === cc ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveCountryFilter(cc)}
                            >
                                {countryFlag(cc)} {cc}
                                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                                    {count}
                                </Badge>
                            </Button>
                        );
                    })}
                </div>
            )}

            {/* Card Grid or Loading / Empty State */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : filteredTemplates.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Stamp className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-1">
                            {activeCountryFilter !== "all"
                                ? `Kein Briefpapier für ${countryFlag(activeCountryFilter)} ${activeCountryFilter}`
                                : "Noch kein Briefpapier"}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md mb-4">
                            Lade eine DOCX-Datei mit deinem Firmen-Briefpapier hoch (Logo, Kopf-/Fusszeile),
                            um dieses als Layout-Basis bei der Dokumentenerstellung zu verwenden.
                        </p>
                        <Button onClick={() => setUploadOpen(true)} variant="outline" className="gap-2">
                            <Upload className="w-4 h-4" />
                            Erstes Briefpapier hochladen
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((t) => (
                        <StationeryCard
                            key={t.id}
                            template={t}
                            onSetDefault={handleSetDefault}
                            onDelete={setDeleteTemplate}
                            onDownload={handleDownload}
                            onEdit={setEditTemplate}
                        />
                    ))}
                </div>
            )}

            {/* Upload Dialog */}
            <TemplateUploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onSuccess={fetchTemplates}
                templateType="stationery"
                showDefaultCheckbox
            />

            {/* Delete Confirmation Dialog */}
            <DeleteDialog
                template={deleteTemplate}
                open={!!deleteTemplate}
                onOpenChange={(open) => { if (!open) setDeleteTemplate(null); }}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />

            {/* Edit Dialog */}
            <EditDialog
                template={editTemplate}
                open={!!editTemplate}
                onOpenChange={(open) => { if (!open) setEditTemplate(null); }}
                onSave={handleEdit}
                isSaving={isSaving}
            />
        </div>
    );
}

export default StationeryGalleryPage;
