/**
 * WorksCouncilTemplatesPage - BR-Vorlagen verwalten
 *
 * v4.2 Feature (Kapitel 15.4.6):
 * - BR-Vorlagen erstellen und bearbeiten
 * - Felder konfigurieren die übermittelt werden
 * - Vorschau der generierten Mitteilungen
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Users,
    Plus,
    Edit,
    FileText,
    History,
    Loader2,
    CheckCircle,
    Eye,
} from "lucide-react";

interface BRTemplate {
    id: number;
    name: string;
    template_type: string;
    country_code: string;
    header_html?: string;
    content_html: string;
    footer_html?: string;
    included_fields?: string[];
    excluded_fields?: string[];
    is_active: boolean;
    version: number;
    created_at?: string;
    updated_at?: string;
}

interface BRNotification {
    id: number;
    employee_name: string;
    notification_type: string;
    status: string;
    created_at: string;
    created_by?: string;
}

// Alle möglichen Felder für die Konfiguration
const AVAILABLE_FIELDS = [
    { key: "employee_name", label: "Mitarbeitername", default: true },
    { key: "job_title", label: "Stellenbezeichnung", default: true },
    { key: "department", label: "Abteilung", default: true },
    { key: "start_date", label: "Eintrittsdatum", default: true },
    { key: "working_hours", label: "Arbeitszeit (Stunden/Woche)", default: true },
    { key: "employment_type", label: "Beschäftigungsart", default: true },
    { key: "contract_type", label: "Vertragsart", default: true },
    { key: "salary_group", label: "Eingruppierung/Tarifgruppe", default: false },
    { key: "workplace", label: "Arbeitsort", default: false },
    { key: "supervisor", label: "Vorgesetzter", default: false },
    { key: "probation_end", label: "Probezeit-Ende", default: false },
];

const TEMPLATE_TYPES = [
    { value: "einstellung", label: "Einstellung" },
    { value: "versetzung", label: "Versetzung" },
    { value: "eingruppierung", label: "Ein-/Umgruppierung" },
];

export default function WorksCouncilTemplatesPage() {
    const [templates, setTemplates] = useState<BRTemplate[]>([]);
    const [notifications, setNotifications] = useState<BRNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<BRTemplate | null>(null);
    const [activeTab, setActiveTab] = useState<"templates" | "history">("templates");

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        template_type: "einstellung",
        content_html: "",
        header_html: "",
        footer_html: "",
        included_fields: AVAILABLE_FIELDS.filter((f) => f.default).map((f) => f.key),
    });

    useEffect(() => {
        loadTemplates();
        loadNotifications();
    }, []);

    const loadTemplates = async () => {
        try {
            const response = await fetch("/api/v1/works-council/templates");
            if (response.ok) {
                const data = await response.json();
                setTemplates(data);
            }
        } catch (error) {
            console.error("Failed to load templates:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadNotifications = async () => {
        try {
            const response = await fetch("/api/v1/works-council/notifications?limit=20");
            if (response.ok) {
                const data = await response.json();
                setNotifications(data);
            }
        } catch (error) {
            console.error("Failed to load notifications:", error);
        }
    };

    const openEditor = (template?: BRTemplate) => {
        if (template) {
            setEditingTemplate(template);
            setFormData({
                name: template.name,
                template_type: template.template_type,
                content_html: template.content_html,
                header_html: template.header_html || "",
                footer_html: template.footer_html || "",
                included_fields: template.included_fields || AVAILABLE_FIELDS.filter((f) => f.default).map((f) => f.key),
            });
        } else {
            setEditingTemplate(null);
            setFormData({
                name: "",
                template_type: "einstellung",
                content_html: getDefaultTemplate(),
                header_html: "",
                footer_html: "",
                included_fields: AVAILABLE_FIELDS.filter((f) => f.default).map((f) => f.key),
            });
        }
        setShowEditor(true);
    };

    const saveTemplate = async () => {
        setIsLoading(true);
        try {
            const url = editingTemplate
                ? `/api/v1/works-council/templates/${editingTemplate.id}`
                : "/api/v1/works-council/templates";

            const response = await fetch(url, {
                method: editingTemplate ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    country_code: "DE",
                    is_active: true,
                }),
            });

            if (response.ok) {
                setShowEditor(false);
                loadTemplates();
            }
        } catch (error) {
            console.error("Failed to save template:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleField = (fieldKey: string) => {
        setFormData((prev) => ({
            ...prev,
            included_fields: prev.included_fields.includes(fieldKey)
                ? prev.included_fields.filter((f) => f !== fieldKey)
                : [...prev.included_fields, fieldKey],
        }));
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "erstellt":
                return <Badge variant="outline">Erstellt</Badge>;
            case "versendet":
                return <Badge variant="secondary">Versendet</Badge>;
            case "bestaetigt":
                return <Badge className="bg-green-500">Bestätigt</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getDefaultTemplate = () => {
        return `<div class="br-notification">
    <h2>Unterrichtung des Betriebsrats gemäß §99 BetrVG</h2>
    <h3>Maßnahme: {{notification_type}}</h3>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{employee_name}}</td>
        </tr>
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Position</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{job_title}}</td>
        </tr>
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Abteilung</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{department}}</td>
        </tr>
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Eintrittsdatum</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{start_date}}</td>
        </tr>
    </table>

    <div style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-radius: 4px;">
        <p><strong>Hinweis:</strong> Der Betriebsrat wird hiermit über die geplante personelle
        Maßnahme unterrichtet. Gemäß §99 Abs. 3 BetrVG gilt die Zustimmung als erteilt,
        wenn der Betriebsrat nicht binnen einer Woche nach ordnungsgemäßer Unterrichtung
        seine Zustimmung verweigert.</p>
    </div>
</div>`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6" />
                        Betriebsrat-Vorlagen
                    </h1>
                    <p className="text-muted-foreground">
                        Verwalten Sie Vorlagen für §99 BetrVG Mitteilungen
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={activeTab === "templates" ? "default" : "outline"}
                        onClick={() => setActiveTab("templates")}
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Vorlagen
                    </Button>
                    <Button
                        variant={activeTab === "history" ? "default" : "outline"}
                        onClick={() => setActiveTab("history")}
                    >
                        <History className="w-4 h-4 mr-2" />
                        Verlauf
                    </Button>
                </div>
            </div>

            {/* Templates Tab */}
            {activeTab === "templates" && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => openEditor()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Neue Vorlage
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                    ) : templates.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="font-medium mb-2">Keine Vorlagen vorhanden</h3>
                                <p className="text-muted-foreground mb-4">
                                    Erstellen Sie Ihre erste BR-Vorlage.
                                </p>
                                <Button onClick={() => openEditor()}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Vorlage erstellen
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {templates.map((template) => (
                                <Card key={template.id}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="text-base">{template.name}</CardTitle>
                                            <Badge variant="outline">v{template.version}</Badge>
                                        </div>
                                        <CardDescription>
                                            {TEMPLATE_TYPES.find((t) => t.value === template.template_type)?.label ||
                                                template.template_type}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            {template.included_fields?.length || 0} Felder konfiguriert
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => openEditor(template)}
                                            >
                                                <Edit className="w-4 h-4 mr-1" />
                                                Bearbeiten
                                            </Button>
                                            <Button variant="ghost" size="sm">
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Erstellte Mitteilungen</CardTitle>
                        <CardDescription>
                            Übersicht aller generierten BR-Mitteilungen
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {notifications.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Noch keine Mitteilungen erstellt.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mitarbeiter</TableHead>
                                        <TableHead>Typ</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Erstellt am</TableHead>
                                        <TableHead>Erstellt von</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {notifications.map((n) => (
                                        <TableRow key={n.id}>
                                            <TableCell className="font-medium">{n.employee_name}</TableCell>
                                            <TableCell>
                                                {TEMPLATE_TYPES.find((t) => t.value === n.notification_type)?.label ||
                                                    n.notification_type}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(n.status)}</TableCell>
                                            <TableCell>
                                                {new Date(n.created_at).toLocaleDateString("de-DE")}
                                            </TableCell>
                                            <TableCell>{n.created_by || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Editor Dialog */}
            <Dialog open={showEditor} onOpenChange={setShowEditor}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTemplate ? "Vorlage bearbeiten" : "Neue Vorlage erstellen"}
                        </DialogTitle>
                        <DialogDescription>
                            Konfigurieren Sie die BR-Mitteilungsvorlage
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Vorlagenname</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="z.B. Einstellung Vollzeit"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Vorlagentyp</Label>
                                <Select
                                    value={formData.template_type}
                                    onValueChange={(v) => setFormData((prev) => ({ ...prev, template_type: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TEMPLATE_TYPES.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Field Selection */}
                        <div className="space-y-2">
                            <Label>Übermittelte Felder</Label>
                            <p className="text-sm text-muted-foreground">
                                Wählen Sie die Felder, die in der BR-Mitteilung enthalten sein sollen.
                            </p>
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 mt-2">
                                {AVAILABLE_FIELDS.map((field) => (
                                    <div key={field.key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={field.key}
                                            checked={formData.included_fields.includes(field.key)}
                                            onCheckedChange={() => toggleField(field.key)}
                                        />
                                        <label
                                            htmlFor={field.key}
                                            className="text-sm cursor-pointer"
                                        >
                                            {field.label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Template Content */}
                        <div className="space-y-2">
                            <Label>Template-Inhalt (HTML)</Label>
                            <p className="text-sm text-muted-foreground">
                                Verwenden Sie {"{{feldname}}"} als Platzhalter.
                            </p>
                            <Textarea
                                value={formData.content_html}
                                onChange={(e) => setFormData((prev) => ({ ...prev, content_html: e.target.value }))}
                                rows={12}
                                className="font-mono text-sm"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditor(false)}>
                            Abbrechen
                        </Button>
                        <Button onClick={saveTemplate} disabled={isLoading || !formData.name}>
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {editingTemplate ? "Speichern" : "Erstellen"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
