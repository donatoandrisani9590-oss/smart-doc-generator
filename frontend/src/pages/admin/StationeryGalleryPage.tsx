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
                        Sind Sie sicher, dass Sie das Briefpapier &ldquo;{template?.name}&rdquo; löschen möchten?
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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function StationeryGalleryPage() {
    const toast = useToast();
    const [templates, setTemplates] = useState<StationeryTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [deleteTemplate, setDeleteTemplate] = useState<StationeryTemplate | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
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
        } catch (err) {
            console.error("Failed to fetch stationery templates:", err);
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
        } catch (err) {
            console.error("Failed to delete stationery template:", err);
            toast.error("Fehler", "Briefpapier konnte nicht gelöscht werden");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSetDefault = async (id: number) => {
        try {
            const response = await apiFetch(`/api/v1/user-templates/${id}/set-default`, {
                method: "POST",
            });
            if (response.ok) {
                // Update local state: un-default all, then set this one
                setTemplates((prev) =>
                    prev.map((t) => ({
                        ...t,
                        is_default: t.id === id,
                    }))
                );
                toast.success("Standard gesetzt", "Briefpapier als Standard festgelegt");
            } else {
                toast.error("Fehler", "Standard konnte nicht gesetzt werden");
            }
        } catch (err) {
            console.error("Failed to set default stationery:", err);
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
        } catch (err) {
            console.error("Failed to download stationery template:", err);
            toast.error("Fehler", "Download fehlgeschlagen");
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
                    <h2 className="text-xl font-semibold text-foreground">Briefpapier</h2>
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
                            Laden Sie eine DOCX-Datei mit Ihrem Firmen-Briefpapier hoch (Logo, Kopf-/Fusszeile),
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
        </div>
    );
}

export default StationeryGalleryPage;
