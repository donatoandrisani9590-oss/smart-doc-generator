import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Upload, Download, Trash2 } from "lucide-react";
import { useMasterTemplates } from "@/hooks/useApi";
import { apiFetch } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface TemplateManagerProps {
    countryCode?: string;
}

const CATEGORIES = [
    { value: "contract", label: "Vertrag" },
    { value: "letter", label: "Brief" },
    { value: "memo", label: "Memo" },
    { value: "certificate", label: "Bescheinigung" },
    { value: "amendment", label: "Vertragsänderung" },
    { value: "default", label: "Standard" },
];

export const TemplateManager = ({ countryCode: initialCountry = "DE" }: TemplateManagerProps) => {
    const [countryCode, setCountryCode] = useState(initialCountry);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, isLoading, refetch } = useMasterTemplates(countryCode);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCategory) return;

        if (!file.name.endsWith(".docx")) {
            setError("Nur DOCX-Dateien erlaubt");
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await apiFetch(
                `/api/v1/admin/templates?country_code=${countryCode}&category=${selectedCategory}`,
                { method: "POST", body: formData }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Upload fehlgeschlagen");
            }

            refetch();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDownload = (template: { country_code: string; category: string }) => {
        window.open(
            `/api/v1/admin/templates/${template.country_code}/${template.category}/download`,
            "_blank"
        );
    };

    const [deleteTarget, setDeleteTarget] = useState<{ country_code: string; category: string } | null>(null);

    const handleDelete = useCallback((template: { country_code: string; category: string }) => {
        setDeleteTarget(template);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!deleteTarget) return;
        try {
            const response = await apiFetch(
                `/api/v1/admin/templates/${deleteTarget.country_code}/${deleteTarget.category}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                throw new Error("Löschen fehlgeschlagen");
            }

            refetch();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
        }
    }, [deleteTarget, refetch]);

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const templates = data?.items || [];

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Master-Templates
                    </CardTitle>
                    <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-24">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DE">🇩🇪 DE</SelectItem>
                            <SelectItem value="IT">🇮🇹 IT</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Upload Section */}
                <div className="flex gap-2">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Kategorie wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".docx"
                        onChange={handleUpload}
                        className="hidden"
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!selectedCategory || isUploading}
                    >
                        {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4 mr-2" />
                        )}
                        Hochladen
                    </Button>
                </div>

                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

                {/* Templates List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Keine Templates für {countryCode} vorhanden</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {templates.map((template: {
                            id: number;
                            name: string;
                            category: string;
                            country_code: string;
                            filename: string;
                            file_size: number;
                            updated_at: string;
                        }) => (
                            <div
                                key={template.id}
                                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded bg-blue-100 text-blue-600">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{template.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatBytes(template.file_size)} • {template.filename}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDownload(template)}
                                    >
                                        <Download className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(template)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Info */}
                <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                    <p className="font-medium mb-1">Platzhalter im Template:</p>
                    <code className="text-xs">
                        {"{{ logo }}"}, {"{{ header_text }}"}, {"{{ footer_line1 }}"}, {"{{ assembled_content }}"}
                    </code>
                </div>
            </CardContent>

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                title="Template löschen"
                description="Template wirklich löschen?"
                confirmLabel="Löschen"
                onConfirm={confirmDelete}
            />
        </Card>
    );
};
