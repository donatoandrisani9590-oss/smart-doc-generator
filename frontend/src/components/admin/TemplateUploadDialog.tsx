/**
 * TemplateUploadDialog - Reusable DOCX upload dialog
 *
 * Supports two template types:
 * - "content": Standard user templates (Eigene Vorlagen)
 * - "stationery": Blank letterhead templates (Briefpapier)
 *
 * When templateType="stationery", an additional "Als Standard setzen"
 * checkbox is shown.
 */

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
    Loader2,
    Upload,
    CheckCircle2,
    AlertCircle,
    Building2,
    Users,
    Lock,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { apiFetch } from "@/lib/api-client";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TeamOption {
    id: number;
    name: string;
}

interface TemplateUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    /** Template type: "content" for user templates, "stationery" for letterhead */
    templateType: "content" | "stationery";
    /** Show "Als Standard setzen" checkbox (typically for stationery) */
    showDefaultCheckbox?: boolean;
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

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function TemplateUploadDialog({
    open,
    onOpenChange,
    onSuccess,
    templateType,
    showDefaultCheckbox = false,
}: TemplateUploadDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [countryCode, setCountryCode] = useState("");
    const [scope, setScope] = useState<"company" | "team" | "private">("company");
    const [teamId, setTeamId] = useState<string>("");
    const [category, setCategory] = useState("");
    const [setAsDefault, setSetAsDefault] = useState(false);
    const [teams, setTeams] = useState<TeamOption[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadState, setUploadState] = useState<"idle" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const isStationery = templateType === "stationery";

    // Dialog titles based on type
    const dialogTitle = isStationery ? "Briefpapier hochladen" : "Vorlage hochladen";
    const dialogDescription = isStationery
        ? "Laden Sie eine DOCX-Datei mit Ihrem Blanko-Briefpapier hoch (Logo, Kopf-/Fusszeile, ohne Textinhalt)."
        : "Laden Sie eine DOCX-Datei mit Ihrem Firmen-Branding hoch (Logo, Kopf-/Fusszeile).";

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
            params.set("template_type", templateType);
            if (description.trim()) params.set("description", description.trim());
            if (countryCode.trim()) params.set("country_code", countryCode.trim().toUpperCase());
            params.set("scope", scope);
            if (scope === "team" && teamId) params.set("team_id", teamId);
            if (category.trim()) params.set("category", category.trim());
            if (showDefaultCheckbox && setAsDefault) params.set("is_default", "true");

            const response = await apiFetch(
                `/api/v1/user-templates?${params.toString()}`,
                { method: "POST", body: formData }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Upload fehlgeschlagen");
            }

            setUploadState("success");
            setTimeout(() => {
                onSuccess();
                resetForm();
                onOpenChange(false);
            }, 1000);
        } catch (err) {
            setUploadState("error");
            setErrorMsg(err instanceof Error ? err.message : "Upload fehlgeschlagen");
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
        setSetAsDefault(false);
        setUploadState("idle");
        setErrorMsg("");
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!uploading) { onOpenChange(v); if (!v) resetForm(); } }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>{dialogDescription}</DialogDescription>
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
                            placeholder={isStationery ? "z.B. Briefpapier Deutschland" : "z.B. Firmenvorlage Deutschland"}
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
                            placeholder={isStationery ? "Optionale Beschreibung des Briefpapiers..." : "Optionale Beschreibung der Vorlage..."}
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
                                        <SelectValue placeholder="Team waehlen..." />
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
                                    Sie sind noch keinem Team zugeordnet.
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

                    {/* Set as Default checkbox (stationery only) */}
                    {showDefaultCheckbox && (
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="set-default"
                                checked={setAsDefault}
                                onCheckedChange={(checked) => setSetAsDefault(checked === true)}
                            />
                            <Label
                                htmlFor="set-default"
                                className="text-sm font-normal cursor-pointer"
                            >
                                Als Standard-Briefpapier setzen
                            </Label>
                        </div>
                    )}

                    {/* Status Messages */}
                    {uploadState === "success" && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            {isStationery ? "Briefpapier erfolgreich hochgeladen!" : "Vorlage erfolgreich hochgeladen!"}
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

export default TemplateUploadDialog;
