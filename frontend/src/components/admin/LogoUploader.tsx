import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, ImageIcon, Loader2 } from "lucide-react";

interface LogoUploaderProps {
    countryCode: string;
    currentLogoPath?: string;
    onUploadComplete?: (path: string) => void;
}

export const LogoUploader = ({ countryCode, currentLogoPath, onUploadComplete }: LogoUploaderProps) => {
    const [logoPath, setLogoPath] = useState(currentLogoPath || "");
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml"];
        if (!allowedTypes.includes(file.type)) {
            setError("Nur PNG, JPG oder SVG erlaubt");
            return;
        }

        // Validate size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError("Datei zu groß. Maximum: 2MB");
            return;
        }

        setError(null);
        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`/api/v1/admin/logo/${countryCode}`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Upload fehlgeschlagen");
            }

            const data = await response.json();
            setLogoPath(data.url);
            onUploadComplete?.(data.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!logoPath) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/v1/admin/logo/${countryCode}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Löschen fehlgeschlagen");
            }

            setLogoPath("");
            onUploadComplete?.("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Firmenlogo ({countryCode.toUpperCase()})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {logoPath ? (
                    <div className="space-y-4">
                        <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-center">
                            <img
                                src={logoPath}
                                alt="Firmenlogo"
                                className="max-h-20 max-w-full object-contain"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="flex-1"
                            >
                                {isUploading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4 mr-2" />
                                )}
                                Ersetzen
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                        {isUploading ? (
                            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                        ) : (
                            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        )}
                        <p className="text-sm text-muted-foreground mb-2">
                            Klicken zum Hochladen oder Datei hierher ziehen
                        </p>
                        <p className="text-xs text-muted-foreground">
                            PNG, JPG oder SVG, max. 2MB
                        </p>
                    </div>
                )}

                {error && (
                    <p className="text-sm text-destructive mt-2">{error}</p>
                )}
            </CardContent>
        </Card>
    );
};
