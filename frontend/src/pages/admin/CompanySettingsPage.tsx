/**
 * CompanySettingsPage - Stammdaten-Verwaltung
 *
 * v4.2 Feature (Kapitel 15.5.7):
 * - Firmendaten zentral pflegen
 * - Automatisches Ausfüllen in Dokumenten
 *
 * HINWEIS: Vertrags-Standardwerte (Probezeit, Kündigungsfrist, etc.) wurden
 * in den Dokumenttyp verschoben, da diese pro Dokumenttyp unterschiedlich sein können.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Building2,
    MapPin,
    User,
    FileText,
    Save,
    Loader2,
    CheckCircle,
    AlertCircle,
} from "lucide-react";

interface CompanySettings {
    id: number;
    country_code: string;
    company_name: string | null;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    managing_director: string | null;
    commercial_register: string | null;
    tax_id: string | null;
    updated_at: string | null;
    updated_by: string | null;
}

export default function CompanySettingsPage() {
    const [country, setCountry] = useState<"DE" | "IT">("DE");
    const [settings, setSettings] = useState<CompanySettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [error, setError] = useState<string | null>(null);

    // Form state - nur Firmendaten, keine Vertrags-Defaults mehr
    const [formData, setFormData] = useState({
        company_name: "",
        street: "",
        postal_code: "",
        city: "",
        managing_director: "",
        commercial_register: "",
        tax_id: "",
    });

    // Fetch settings on country change
    useEffect(() => {
        fetchSettings();
    }, [country]);

    const fetchSettings = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/v1/company-settings/${country}`, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {},
            });
            if (!response.ok) throw new Error("Einstellungen konnten nicht geladen werden");
            const data: CompanySettings = await response.json();
            setSettings(data);
            setFormData({
                company_name: data.company_name || "",
                street: data.street || "",
                postal_code: data.postal_code || "",
                city: data.city || "",
                managing_director: data.managing_director || "",
                commercial_register: data.commercial_register || "",
                tax_id: data.tax_id || "",
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus("idle");
        try {
            const response = await fetch(`/api/v1/company-settings/${country}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            if (!response.ok) throw new Error("Speichern fehlgeschlagen");
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
            await fetchSettings();
        } catch (err) {
            setSaveStatus("error");
            setError(err instanceof Error ? err.message : "Fehler beim Speichern");
        } finally {
            setIsSaving(false);
        }
    };

    const updateField = (field: string, value: string | number) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Stammdaten</h1>
                    <p className="text-muted-foreground">
                        Zentrale Firmendaten für automatisches Ausfüllen
                    </p>
                </div>
                <Select value={country} onValueChange={(v) => setCountry(v as "DE" | "IT")}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="DE">🇩🇪 Deutschland</SelectItem>
                        <SelectItem value="IT">🇮🇹 Italien</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Company Data Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="w-5 h-5" />
                            Unternehmensdaten
                        </CardTitle>
                        <CardDescription>
                            Diese Werte werden automatisch in Dokumente eingefügt
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                Firmenname
                            </label>
                            <Input
                                value={formData.company_name}
                                onChange={(e) => updateField("company_name", e.target.value)}
                                placeholder="Niederwieser GmbH"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                Straße
                            </label>
                            <Input
                                value={formData.street}
                                onChange={(e) => updateField("street", e.target.value)}
                                placeholder="Musterstraße 123"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">PLZ</label>
                                <Input
                                    value={formData.postal_code}
                                    onChange={(e) => updateField("postal_code", e.target.value)}
                                    placeholder="80333"
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-sm font-medium">Ort</label>
                                <Input
                                    value={formData.city}
                                    onChange={(e) => updateField("city", e.target.value)}
                                    placeholder="München"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                Geschäftsführer
                            </label>
                            <Input
                                value={formData.managing_director}
                                onChange={(e) => updateField("managing_director", e.target.value)}
                                placeholder="Hans Niederwieser"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                Handelsregister
                            </label>
                            <Input
                                value={formData.commercial_register}
                                onChange={(e) => updateField("commercial_register", e.target.value)}
                                placeholder="HRB 12345, Amtsgericht München"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">USt-IdNr.</label>
                            <Input
                                value={formData.tax_id}
                                onChange={(e) => updateField("tax_id", e.target.value)}
                                placeholder="DE123456789"
                            />
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-4 border-t">
                {settings?.updated_at && (
                    <div className="text-sm text-muted-foreground">
                        Zuletzt aktualisiert: {new Date(settings.updated_at).toLocaleString("de-DE")}
                        {settings.updated_by && ` von ${settings.updated_by}`}
                    </div>
                )}
                <Button onClick={handleSave} disabled={isSaving} className="min-w-[150px]">
                    {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : saveStatus === "success" ? (
                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    {saveStatus === "success" ? "Gespeichert!" : "Speichern"}
                </Button>
            </div>
        </div>
    );
}
