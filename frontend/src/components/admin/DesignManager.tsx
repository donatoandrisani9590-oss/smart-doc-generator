import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Palette, Save, Eye } from "lucide-react";
import { useDesignSettings, useUpdateDesignSettings } from "@/hooks/useApi";
import { LogoUploader } from "./LogoUploader";

interface DesignManagerProps {
    countryCode: string;
}

const FONT_OPTIONS = [
    { value: "Arial", label: "Arial" },
    { value: "Helvetica", label: "Helvetica" },
    { value: "Times New Roman", label: "Times New Roman" },
    { value: "Georgia", label: "Georgia" },
    { value: "Verdana", label: "Verdana" },
    { value: "Inter", label: "Inter" },
    { value: "Roboto", label: "Roboto" },
];

export const DesignManager = ({ countryCode }: DesignManagerProps) => {
    const { data: settings, isLoading } = useDesignSettings(countryCode);
    const updateSettings = useUpdateDesignSettings();

    const [formData, setFormData] = useState({
        company_name: "",
        header_line1: "",
        header_line2: "",
        header_line3: "",
        footer_line1: "",
        footer_line2: "",
        footer_line3: "",
        font_family: "Arial",
        primary_color: "#243186",
    });

    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        if (settings) {
            setFormData({
                company_name: settings.company_name || "",
                header_line1: settings.header_line1 || "",
                header_line2: settings.header_line2 || "",
                header_line3: settings.header_line3 || "",
                footer_line1: settings.footer_line1 || "",
                footer_line2: settings.footer_line2 || "",
                footer_line3: settings.footer_line3 || "",
                font_family: settings.font_family || "Arial",
                primary_color: settings.primary_color || "#243186",
            });
        }
    }, [settings]);

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        await updateSettings.mutateAsync({
            countryCode,
            settings: formData,
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form Section */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="w-5 h-5" />
                            Design-Manager ({countryCode})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Logo Upload */}
                        <LogoUploader countryCode={countryCode} currentLogoPath={settings?.logo_path} />

                        {/* Company Name */}
                        <div className="space-y-2">
                            <Label>Firmenname</Label>
                            <Input
                                value={formData.company_name}
                                onChange={(e) => handleChange("company_name", e.target.value)}
                                placeholder="Niederwieser GmbH"
                            />
                        </div>

                        {/* Header Lines */}
                        <div className="space-y-2">
                            <Label>Kopfzeile</Label>
                            <Input
                                value={formData.header_line1}
                                onChange={(e) => handleChange("header_line1", e.target.value)}
                                placeholder="Zeile 1 (z.B. Adresse)"
                            />
                            <Input
                                value={formData.header_line2}
                                onChange={(e) => handleChange("header_line2", e.target.value)}
                                placeholder="Zeile 2 (z.B. PLZ Ort)"
                            />
                            <Input
                                value={formData.header_line3}
                                onChange={(e) => handleChange("header_line3", e.target.value)}
                                placeholder="Zeile 3 (z.B. Tel/Email)"
                            />
                        </div>

                        {/* Footer Lines */}
                        <div className="space-y-2">
                            <Label>Fußzeile</Label>
                            <Input
                                value={formData.footer_line1}
                                onChange={(e) => handleChange("footer_line1", e.target.value)}
                                placeholder="Zeile 1 (z.B. Geschäftsführer)"
                            />
                            <Input
                                value={formData.footer_line2}
                                onChange={(e) => handleChange("footer_line2", e.target.value)}
                                placeholder="Zeile 2 (z.B. HRB, USt-ID)"
                            />
                            <Input
                                value={formData.footer_line3}
                                onChange={(e) => handleChange("footer_line3", e.target.value)}
                                placeholder="Zeile 3 (z.B. Bankverbindung)"
                            />
                        </div>

                        {/* Typography */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Schriftart</Label>
                                <Select
                                    value={formData.font_family}
                                    onValueChange={(v) => handleChange("font_family", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FONT_OPTIONS.map((font) => (
                                            <SelectItem key={font.value} value={font.value}>
                                                <span style={{ fontFamily: font.value }}>{font.label}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Primärfarbe</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={formData.primary_color}
                                        onChange={(e) => handleChange("primary_color", e.target.value)}
                                        className="w-12 h-10 p-1 cursor-pointer"
                                    />
                                    <Input
                                        value={formData.primary_color}
                                        onChange={(e) => handleChange("primary_color", e.target.value)}
                                        placeholder="#243186"
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4">
                            <Button onClick={handleSave} disabled={updateSettings.isPending} className="flex-1">
                                {updateSettings.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Speichern
                            </Button>
                            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Vorschau
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Preview Section */}
            {showPreview && (
                <Card>
                    <CardHeader>
                        <CardTitle>Vorschau</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="bg-white border rounded-lg p-8 shadow-lg"
                            style={{ fontFamily: formData.font_family }}
                        >
                            {/* Header Preview */}
                            <div className="border-b-2 pb-4 mb-6" style={{ borderColor: formData.primary_color }}>
                                <div className="flex justify-between items-start">
                                    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                                        LOGO
                                    </div>
                                    <div className="text-right text-sm">
                                        <p className="font-bold" style={{ color: formData.primary_color }}>
                                            {formData.company_name || "Firmenname"}
                                        </p>
                                        <p>{formData.header_line1 || "Adresse"}</p>
                                        <p>{formData.header_line2 || "PLZ Ort"}</p>
                                        <p>{formData.header_line3 || "Kontakt"}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Content Preview */}
                            <div className="space-y-4 min-h-[200px]">
                                <h1 className="text-xl font-bold" style={{ color: formData.primary_color }}>
                                    Dokumenttitel
                                </h1>
                                <p className="text-gray-600">
                                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.
                                </p>
                            </div>

                            {/* Footer Preview */}
                            <div className="border-t pt-4 mt-6 text-xs text-gray-500 text-center">
                                <p>{formData.footer_line1 || "Geschäftsführer: Name"}</p>
                                <p>{formData.footer_line2 || "HRB 12345 | USt-ID: DE123456789"}</p>
                                <p>{formData.footer_line3 || "IBAN: DE12 3456 7890"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
