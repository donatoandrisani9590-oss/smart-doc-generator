/**
 * User Templates Management Page
 *
 * Settings page for managing user-uploaded DOCX templates:
 * - Upload new templates (DOCX only) with scope, team, and category
 * - View all accessible templates with metadata
 * - Delete own templates
 *
 * Templates can be scoped as:
 * - 'company': visible to all users (default)
 * - 'team': visible to members of a specific team
 * - 'private': visible only to the creator
 */

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    FileText,
    Plus,
    Trash2,
    Loader2,
    Upload,
    CheckCircle2,
    AlertCircle,
    Download,
    LayoutTemplate,
    Type,
    Image,
    PanelTop,
    PanelBottom,
    Building2,
    Users,
    Lock,
    Tag,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UserTemplate {
    id: number;
    name: string;
    description: string | null;
    original_filename: string;
    file_size: number;
    country_code: string | null;
    has_header: boolean;
    has_footer: boolean;
    has_logo: boolean;
    font_family: string | null;
    scope: "company" | "team" | "private";
    team_id: number | null;
    category: string | null;
    is_own: boolean;
    created_at: string;
    updated_at: string | null;
}

interface TeamOption {
    id: number;
    name: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const SCOPE_LABELS: Record<string, { label: string; icon: typeof Building2; className: string }> = {
    company: { label: "Unternehmen", icon: Building2, className: "border-blue-200 text-blue-600" },
    team: { label: "Team", icon: Users, className: "border-green-200 text-green-600" },
    private: { label: "Privat", icon: Lock, className: "border-warm-200 text-warm-500" },
};

// ═══════════════════════════════════════════════════════════════════════════
// UPLOAD DIALOG
// ═══════════════════════════════════════════════════════════════════════════

interface UploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

function UploadDialog({ open, onOpenChange, onSuccess }: UploadDialogProps) {
    const toast = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [countryCode, setCountryCode] = useState("");
    const [scope, setScope] = useState<"company" | "team" | "private">("company");
    const [teamId, setTeamId] = useState<string>("");
    const [category, setCategory] = useState("");
    const [teams, setTeams] = useState<TeamOption[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadState, setUploadState] = useState<"idle" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // Fetch user's teams
    useEffect(() => {
        if (!open) return;
        const fetchTeams = async () => {
            try {
                const res = await apiFetch("/api/v1/teams");
                if (res.ok) {
                    const data = await res.json();
                    setTeams(Array.isArray(data) ? data : data.items || []);
                }
            } catch {
                // Teams are optional
            }
        };
        fetchTeams();
    }, [open]);

    const onDrop = useCallback((accepted: File[]) => {
        if (accepted.length > 0) {
            const f = accepted[0];
            setFile(f);
            if (!name) {
                setName(f.name.replace(/\.docx$/i, ""));
            }
            setUploadState("idle");
            setErrorMsg("");
        }
    }, [name]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        },
        maxSize: 10 * 1024 * 1024,
        multiple: false,
    });

    const handleUpload = async () => {
        if (!file || !name.trim()) return;

        setUploading(true);
        setUploadState("idle");
        setErrorMsg("");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const params = new URLSearchParams();
            params.set("name", name.trim());
            if (description.trim()) params.set("description", description.trim());
            if (countryCode.trim()) params.set("country_code", countryCode.trim().toUpperCase());
            params.set("scope", scope);
            if (scope === "team" && teamId) params.set("team_id", teamId);
            if (category.trim()) params.set("category", category.trim());

            const response = await apiFetch(
                `/api/v1/user-templates?${params.toString()}`,
                { method: "POST", body: formData }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Upload fehlgeschlagen");
            }

            setUploadState("success");
            toast.success("Vorlage hochgeladen", `"${name.trim()}" wurde erfolgreich hochgeladen`);
            setTimeout(() => {
                onSuccess();
                resetForm();
                onOpenChange(false);
            }, 1000);
        } catch (err) {
            setUploadState("error");
            const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
            setErrorMsg(msg);
            toast.error("Upload fehlgeschlagen", msg);
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setFile(null);
        setName("");
        setDescription("");
        setCountryCode("");
        setScope("company");
        setTeamId("");
        setCategory("");
        setUploadState("idle");
        setErrorMsg("");
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!uploading) { onOpenChange(v); if (!v) resetForm(); } }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Vorlage hochladen</DialogTitle>
                    <DialogDescription>
                        Lade eine DOCX-Datei mit deinem Firmen-Branding hoch (Logo, Kopf-/Fusszeile).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Drop Zone */}
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                            isDragActive
                                ? "border-primary bg-primary/5"
                                : file
                                ? "border-green-300 bg-green-50"
                                : "border-warm-300 hover:border-primary/50 hover:bg-warm-50"
                        }`}
                    >
                        <input {...getInputProps()} />
                        {file ? (
                            <div className="flex items-center justify-center gap-3">
                                <FileText className="w-8 h-8 text-blue-500" />
                                <div className="text-left">
                                    <p className="font-medium text-sm">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    {isDragActive ? "Datei hier ablegen..." : "DOCX-Datei hierher ziehen oder klicken"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">Nur .docx, max. 10 MB</p>
                            </div>
                        )}
                    </div>

                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label htmlFor="template-name">Name *</Label>
                        <Input
                            id="template-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="z.B. Firmenvorlage Deutschland"
                            maxLength={255}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="template-desc">Beschreibung</Label>
                        <Textarea
                            id="template-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optionale Beschreibung der Vorlage..."
                            rows={2}
                            maxLength={1000}
                        />
                    </div>

                    {/* Scope + Country in a row */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Scope */}
                        <div className="space-y-1.5">
                            <Label>Sichtbarkeit</Label>
                            <Select value={scope} onValueChange={(v) => { setScope(v as "company" | "team" | "private"); if (v !== "team") setTeamId(""); }}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="company">
                                        <span className="flex items-center gap-2">
                                            <Building2 className="w-3.5 h-3.5" />
                                            Unternehmensweit
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="team">
                                        <span className="flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5" />
                                            Team
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="private">
                                        <span className="flex items-center gap-2">
                                            <Lock className="w-3.5 h-3.5" />
                                            Nur ich
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Country Code */}
                        <div className="space-y-1.5">
                            <Label htmlFor="template-country">Land</Label>
                            <Input
                                id="template-country"
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                                placeholder="z.B. DE"
                                maxLength={2}
                            />
                        </div>
                    </div>

                    {/* Team Picker (conditional) */}
                    {scope === "team" && (
                        <div className="space-y-1.5">
                            <Label>Team</Label>
                            {teams.length > 0 ? (
                                <Select value={teamId} onValueChange={setTeamId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Team wählen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {teams.map((t) => (
                                            <SelectItem key={t.id} value={t.id.toString()}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Du bist noch keinem Team zugeordnet.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Category */}
                    <div className="space-y-1.5">
                        <Label htmlFor="template-category">Themengebiet</Label>
                        <Input
                            id="template-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="z.B. HR, Recht, Finanzen"
                            maxLength={100}
                        />
                    </div>

                    {/* Status Messages */}
                    {uploadState === "success" && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            Vorlage erfolgreich hochgeladen!
                        </div>
                    )}
                    {uploadState === "error" && (
                        <div className="flex items-center gap-2 text-destructive text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {errorMsg}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => { onOpenChange(false); resetForm(); }}
                        disabled={uploading}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={!file || !name.trim() || uploading || (scope === "team" && !teamId)}
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Wird hochgeladen...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Hochladen
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE DIALOG
// ═══════════════════════════════════════════════════════════════════════════

interface DeleteDialogProps {
    template: UserTemplate | null;
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
                    <DialogTitle>Vorlage löschen</DialogTitle>
                    <DialogDescription>
                        Bist du sicher, dass du die Vorlage &ldquo;{template?.name}&rdquo; löschen möchtest?
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
// SCOPE BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function ScopeBadge({ scope }: { scope: string }) {
    const config = SCOPE_LABELS[scope];
    if (!config) return null;
    const Icon = config.icon;
    return (
        <Badge variant="outline" className={`text-[10px] gap-1 py-0 px-1.5 ${config.className}`}>
            <Icon className="w-2.5 h-2.5" />
            {config.label}
        </Badge>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function UserTemplatesPage() {
    const toast = useToast();
    const [templates, setTemplates] = useState<UserTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [deleteTemplate, setDeleteTemplate] = useState<UserTemplate | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiFetch("/api/v1/user-templates");
            if (response.ok) {
                const data = await response.json();
                setTemplates(data.items || []);
            }
        } catch {
            toast.error("Fehler", "Vorlagen konnten nicht geladen werden");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleDelete = async () => {
        if (!deleteTemplate) return;
        setIsDeleting(true);
        try {
            const response = await apiFetch(`/api/v1/user-templates/${deleteTemplate.id}`, {
                method: "DELETE",
            });
            if (response.ok) {
                setTemplates((prev) => prev.filter((t) => t.id !== deleteTemplate.id));
                toast.success("Vorlage gelöscht", `"${deleteTemplate.name}" wurde entfernt`);
                setDeleteTemplate(null);
            } else {
                toast.error("Fehler", "Vorlage konnte nicht gelöscht werden");
            }
        } catch {
            toast.error("Fehler", "Vorlage konnte nicht gelöscht werden");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownload = async (template: UserTemplate) => {
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

    // Separate own and shared templates
    const ownTemplates = templates.filter((t) => t.is_own);
    const sharedTemplates = templates.filter((t) => !t.is_own);

    const renderTemplateCard = (template: UserTemplate) => (
        <Card key={template.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="flex items-center gap-4 py-4 px-5">
                {/* Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{template.name}</h4>
                        {template.country_code && (
                            <Badge variant="outline" className="text-xs">
                                {template.country_code}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                            {template.original_filename}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {formatFileSize(template.file_size)}
                        </span>
                        {template.created_at && (
                            <span className="text-xs text-muted-foreground">
                                {new Date(template.created_at).toLocaleDateString("de-DE")}
                            </span>
                        )}
                    </div>
                    {/* Feature + Scope + Category badges */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {template.has_logo && (
                            <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
                                <Image className="w-2.5 h-2.5" />
                                Logo
                            </Badge>
                        )}
                        {template.has_header && (
                            <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
                                <PanelTop className="w-2.5 h-2.5" />
                                Kopfzeile
                            </Badge>
                        )}
                        {template.has_footer && (
                            <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
                                <PanelBottom className="w-2.5 h-2.5" />
                                Fusszeile
                            </Badge>
                        )}
                        {template.font_family && (
                            <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
                                <Type className="w-2.5 h-2.5" />
                                {template.font_family}
                            </Badge>
                        )}
                        <ScopeBadge scope={template.scope} />
                        {template.category && (
                            <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
                                <Tag className="w-2.5 h-2.5" />
                                {template.category}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(template)}
                        title="Herunterladen"
                    >
                        <Download className="w-4 h-4" />
                    </Button>
                    {template.is_own && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTemplate(template)}
                            title="Löschen"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">Vorlagen</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        DOCX-Vorlagen mit Firmen-Branding für die Dokumentenerstellung. Geteilte Vorlagen anderer Nutzer sind ebenfalls sichtbar.
                    </p>
                </div>
                <Button onClick={() => setUploadOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Vorlage hochladen
                </Button>
            </div>

            {/* Template List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : templates.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <LayoutTemplate className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-1">Noch keine Vorlagen</h3>
                        <p className="text-sm text-muted-foreground max-w-md mb-4">
                            Lade eine DOCX-Datei mit deinem Firmen-Logo, Kopf- und Fusszeile hoch,
                            um diese als Layout-Vorlage bei der Dokumentenerstellung zu verwenden.
                        </p>
                        <Button onClick={() => setUploadOpen(true)} variant="outline" className="gap-2">
                            <Upload className="w-4 h-4" />
                            Erste Vorlage hochladen
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Own Templates */}
                    {ownTemplates.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Eigene Vorlagen ({ownTemplates.length})
                            </h3>
                            <div className="grid gap-3">
                                {ownTemplates.map(renderTemplateCard)}
                            </div>
                        </div>
                    )}

                    {/* Shared Templates */}
                    {sharedTemplates.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Geteilte Vorlagen ({sharedTemplates.length})
                            </h3>
                            <div className="grid gap-3">
                                {sharedTemplates.map(renderTemplateCard)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Dialogs */}
            <UploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onSuccess={fetchTemplates}
            />
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

export default UserTemplatesPage;
