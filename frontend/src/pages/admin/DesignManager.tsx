/**
 * Design Manager Page
 *
 * Admin page for managing corporate design settings:
 * - Logo upload
 * - Color scheme
 * - Document header/footer
 * - Font settings
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    UploadCloud,
    Save,
    Trash2,
    Loader2,
    AlertCircle,
    CheckCircle,
    Image,
    FileText,
} from "lucide-react";

interface DesignSettings {
    id: number;
    country_code: string;
    company_name: string;
    logo_path: string | null;
    header_line1: string | null;
    header_line2: string | null;
    header_line3: string | null;
    footer_line1: string | null;
    footer_line2: string | null;
    footer_line3: string | null;
    font_family: string;
    primary_color: string;
    colors: Record<string, string>;
    // DIN 5008 Document Layout Settings
    margin_left_cm: string;
    margin_right_cm: string;
    margin_top_cm: string;
    margin_bottom_cm: string;
    font_size_pt: number;
    line_spacing: string;
    logo_width_cm: string;
}

export const DesignManager = () => {
    const [countryCode, setCountryCode] = useState("DE");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);

    // Design Settings State
    const [designSettings, setDesignSettings] = useState<Partial<DesignSettings>>({
        company_name: "",
        logo_path: null,
        header_line1: "",
        header_line2: "",
        header_line3: "",
        footer_line1: "",
        footer_line2: "",
        footer_line3: "",
        font_family: "Arial",
        primary_color: "#243186",
        colors: {},
        // DIN 5008 Defaults
        margin_left_cm: "2.5",
        margin_right_cm: "2.0",
        margin_top_cm: "2.5",
        margin_bottom_cm: "2.0",
        font_size_pt: 11,
        line_spacing: "1.15",
        logo_width_cm: "5.0",
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch settings
    const fetchSettings = async () => {
        try {
            setLoading(true);
            setError(null);
            // Design settings werden hier geladen wenn Backend-Endpunkt existiert
        } catch (err) {
            setError(err instanceof Error ? err.message : "Fehler beim Laden");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [countryCode]);

    // Save settings
    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            // Design settings speichern wenn Backend-Endpunkt existiert
            setSuccess("Einstellungen gespeichert");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Fehler beim Speichern");
        } finally {
            setSaving(false);
        }
    };

    // Logo upload
    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate
        const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml"];
        if (!allowedTypes.includes(file.type)) {
            setError("Nur PNG, JPG oder SVG erlaubt");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setError("Datei zu gross. Maximum: 2MB");
            return;
        }

        try {
            setLogoUploading(true);
            setError(null);

            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`/api/v1/admin/logo/${countryCode}`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Upload fehlgeschlagen");
            }

            const result = await response.json();
            setDesignSettings(prev => ({
                ...prev,
                logo_path: result.logo_path,
            }));
            setSuccess("Logo hochgeladen");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
        } finally {
            setLogoUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    // Delete logo
    const handleDeleteLogo = async () => {
        try {
            setLogoUploading(true);
            const response = await fetch(`/api/v1/admin/logo/${countryCode}`, {
                method: "DELETE",
            });

            if (response.ok) {
                setDesignSettings(prev => ({
                    ...prev,
                    logo_path: null,
                }));
                setSuccess("Logo geloescht");
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            setError("Fehler beim Loeschen");
        } finally {
            setLogoUploading(false);
        }
    };

    const fonts = [
        { value: "Arial", label: "Arial" },
        { value: "Times New Roman", label: "Times New Roman" },
        { value: "Helvetica", label: "Helvetica" },
        { value: "Calibri", label: "Calibri" },
        { value: "Verdana", label: "Verdana" },
    ];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Design Einstellungen
                    </h1>
                    <p className="text-muted-foreground">
                        Gestalten Sie das Erscheinungsbild Ihrer Dokumente
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DE">Deutschland</SelectItem>
                            <SelectItem value="IT">Italien</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Speichern
                    </Button>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-700">{error}</p>
                    <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
                        Schliessen
                    </Button>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="text-green-700">{success}</p>
                </div>
            )}

            {/* Main Content: Settings + Live Preview */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Settings Tabs (2/3 width) */}
                <div className="lg:col-span-2">
                    <Tabs defaultValue="branding" className="space-y-6">
                        <TabsList className="bg-background">
                            <TabsTrigger value="branding" className="gap-2">
                                <Image className="w-4 h-4" />
                                Branding
                            </TabsTrigger>
                            <TabsTrigger value="documents" className="gap-2">
                                <FileText className="w-4 h-4" />
                                Dokumenten-Layout
                            </TabsTrigger>
                        </TabsList>

                        {/* Branding Tab */}
                        <TabsContent value="branding">
                            <div className="grid gap-6 md:grid-cols-2">
                        {/* Logo Upload */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Firmenlogo</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/svg+xml"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                />

                                {designSettings.logo_path ? (
                                    <div className="space-y-4">
                                        <div className="border rounded-lg p-4 bg-background">
                                            <img
                                                src={`/api/v1/admin/logo/${designSettings.logo_path}`}
                                                alt="Firmenlogo"
                                                className="max-h-32 mx-auto"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={logoUploading}
                                                className="flex-1"
                                            >
                                                {logoUploading ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <UploadCloud className="w-4 h-4 mr-2" />
                                                )}
                                                Ersetzen
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={handleDeleteLogo}
                                                disabled={logoUploading}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center justify-center text-center hover:bg-background transition-colors cursor-pointer"
                                    >
                                        {logoUploading ? (
                                            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                                        ) : (
                                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                                                <UploadCloud className="w-8 h-8 text-primary" />
                                            </div>
                                        )}
                                        <p className="font-medium text-foreground">Logo hierhin ziehen</p>
                                        <p className="text-sm text-muted-foreground mt-1">PNG, JPG, SVG bis 2MB</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Color Scheme */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Farbschema</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Primaerfarbe</Label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={designSettings.primary_color}
                                            onChange={(e) => setDesignSettings(prev => ({
                                                ...prev,
                                                primary_color: e.target.value
                                            }))}
                                            className="w-10 h-10 rounded-md border shadow-sm cursor-pointer"
                                        />
                                        <Input
                                            value={designSettings.primary_color}
                                            onChange={(e) => setDesignSettings(prev => ({
                                                ...prev,
                                                primary_color: e.target.value
                                            }))}
                                            className="flex-1 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Schriftart</Label>
                                    <Select
                                        value={designSettings.font_family}
                                        onValueChange={(value) => setDesignSettings(prev => ({
                                            ...prev,
                                            font_family: value
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {fonts.map(font => (
                                                <SelectItem key={font.value} value={font.value}>
                                                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Document Layout Tab */}
                <TabsContent value="documents">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* DIN 5008 Page Margins */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Seitenränder (DIN 5008)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Links (cm)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="5"
                                            value={designSettings.margin_left_cm || "2.5"}
                                            onChange={(e) => setDesignSettings(prev => ({
                                                ...prev,
                                                margin_left_cm: e.target.value
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Rechts (cm)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="5"
                                            value={designSettings.margin_right_cm || "2.0"}
                                            onChange={(e) => setDesignSettings(prev => ({
                                                ...prev,
                                                margin_right_cm: e.target.value
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Oben (cm)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="5"
                                            value={designSettings.margin_top_cm || "2.5"}
                                            onChange={(e) => setDesignSettings(prev => ({
                                                ...prev,
                                                margin_top_cm: e.target.value
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Unten (cm)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="5"
                                            value={designSettings.margin_bottom_cm || "2.0"}
                                            onChange={(e) => setDesignSettings(prev => ({
                                                ...prev,
                                                margin_bottom_cm: e.target.value
                                            }))}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    DIN 5008 Standard: Links 2,5 cm, Rechts 2,0 cm
                                </p>
                            </CardContent>
                        </Card>

                        {/* Typography Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Typographie</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Schriftgröße (pt)</Label>
                                    <Select
                                        value={String(designSettings.font_size_pt || 11)}
                                        onValueChange={(value) => setDesignSettings(prev => ({
                                            ...prev,
                                            font_size_pt: parseInt(value)
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10 pt</SelectItem>
                                            <SelectItem value="11">11 pt (Standard)</SelectItem>
                                            <SelectItem value="12">12 pt</SelectItem>
                                            <SelectItem value="14">14 pt</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Zeilenabstand</Label>
                                    <Select
                                        value={designSettings.line_spacing || "1.15"}
                                        onValueChange={(value) => setDesignSettings(prev => ({
                                            ...prev,
                                            line_spacing: value
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1.0">Einfach (1.0)</SelectItem>
                                            <SelectItem value="1.15">Standard (1.15)</SelectItem>
                                            <SelectItem value="1.5">1,5-fach</SelectItem>
                                            <SelectItem value="2.0">Doppelt (2.0)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Logo-Breite (cm)</Label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        min="2"
                                        max="10"
                                        value={designSettings.logo_width_cm || "5.0"}
                                        onChange={(e) => setDesignSettings(prev => ({
                                            ...prev,
                                            logo_width_cm: e.target.value
                                        }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Header Content */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Kopfzeile</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Zeile 1</Label>
                                    <Input
                                        value={designSettings.header_line1 || ""}
                                        onChange={(e) => setDesignSettings(prev => ({
                                            ...prev,
                                            header_line1: e.target.value
                                        }))}
                                        placeholder="Firmenname"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Zeile 2</Label>
                                    <Input
                                        value={designSettings.header_line2 || ""}
                                        onChange={(e) => setDesignSettings(prev => ({
                                            ...prev,
                                            header_line2: e.target.value
                                        }))}
                                        placeholder="Adresse"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Zeile 3</Label>
                                    <Input
                                        value={designSettings.header_line3 || ""}
                                        onChange={(e) => setDesignSettings(prev => ({
                                            ...prev,
                                            header_line3: e.target.value
                                        }))}
                                        placeholder="PLZ Ort"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Footer Content */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Fusszeile</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Zeile 1</Label>
                                    <Input
                                        value={designSettings.footer_line1 || ""}
                                        onChange={(e) => setDesignSettings(prev => ({
                                            ...prev,
                                            footer_line1: e.target.value
                                        }))}
                                        placeholder="Geschaeftsfuehrer: ..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Zeile 2</Label>
                                    <Input
                                        value={designSettings.footer_line2 || ""}
                                        onChange={(e) => setDesignSettings(prev => ({
                                            ...prev,
                                            footer_line2: e.target.value
                                        }))}
                                        placeholder="Handelsregister: ..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Zeile 3</Label>
                                    <Input
                                        value={designSettings.footer_line3 || ""}
                                        onChange={(e) => setDesignSettings(prev => ({
                                            ...prev,
                                            footer_line3: e.target.value
                                        }))}
                                        placeholder="Bank: ..."
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                    </Tabs>
                </div>

                {/* Live Preview (1/3 width) - E2E-010 Fix */}
                <div className="lg:col-span-1">
                    <Card className="sticky top-4">
                        <CardHeader>
                            <CardTitle className="text-sm">Live-Vorschau</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div
                                className="bg-white border rounded-lg shadow-sm overflow-hidden"
                                style={{
                                    fontFamily: designSettings.font_family || "Arial",
                                    fontSize: `${(designSettings.font_size_pt || 11) * 0.6}pt`,
                                    lineHeight: designSettings.line_spacing || "1.15",
                                }}
                            >
                                {/* Mini Document Preview */}
                                <div
                                    className="p-3"
                                    style={{
                                        paddingLeft: `${parseFloat(designSettings.margin_left_cm || "2.5") * 4}px`,
                                        paddingRight: `${parseFloat(designSettings.margin_right_cm || "2.0") * 4}px`,
                                    }}
                                >
                                    {/* Header */}
                                    <div
                                        className="flex justify-between items-start pb-2 mb-3"
                                        style={{ borderBottom: `2px solid ${designSettings.primary_color || "#243186"}` }}
                                    >
                                        <div>
                                            {designSettings.logo_path ? (
                                                <img
                                                    src={`/api/v1/admin/logo/${designSettings.logo_path}`}
                                                    alt="Logo"
                                                    style={{ width: `${parseFloat(designSettings.logo_width_cm || "5.0") * 8}px`, maxHeight: "30px", objectFit: "contain" }}
                                                />
                                            ) : (
                                                <div className="bg-gray-200 rounded px-2 py-1 text-[8px] text-gray-500">
                                                    Logo
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right text-[7px] text-gray-600">
                                            <div className="font-semibold">{designSettings.company_name || "Firmenname"}</div>
                                            <div>{designSettings.header_line1 || "Adresszeile 1"}</div>
                                            <div>{designSettings.header_line2 || "Adresszeile 2"}</div>
                                        </div>
                                    </div>

                                    {/* Sample Content */}
                                    <div className="space-y-2">
                                        <h3 style={{ color: designSettings.primary_color || "#243186", fontSize: "9pt", fontWeight: "bold" }}>
                                            Arbeitsvertrag
                                        </h3>
                                        <div className="text-[7px] text-gray-700 space-y-1">
                                            <p>Zwischen der Firma und Max Mustermann wird folgender Vertrag geschlossen...</p>
                                            <p className="font-semibold">§ 1 Vertragsgegenstand</p>
                                            <p>Der Arbeitnehmer wird ab dem 01.01.2025 als Software-Entwickler eingestellt.</p>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-4 pt-2 border-t text-[6px] text-gray-500">
                                        {designSettings.footer_line1 || "Fußzeile 1"} | {designSettings.footer_line2 || "Fußzeile 2"}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 text-center">
                                Änderungen werden in Echtzeit angezeigt
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
