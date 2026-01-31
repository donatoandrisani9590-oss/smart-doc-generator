/**
 * RetentionPoliciesPage - Aufbewahrungsrichtlinien verwalten
 *
 * v4.2 Feature:
 * - Definiere wie lange Dokumente aufbewahrt werden
 * - Automatische Archivierung/Löschung nach Ablauf
 * - Gesetzliche Aufbewahrungsfristen einhalten
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Archive,
    Trash2,
    Plus,
    Edit,
    AlertTriangle,
    Clock,
    FileText,
    Loader2,
    Save,
    Shield,
    Info,
} from "lucide-react";

interface RetentionPolicy {
    id: number;
    name: string;
    description: string | null;
    document_category: string;  // "contract", "hr", "all"
    retention_days: number;
    action: "archive" | "delete";
    is_active: boolean;
    warn_before_days: number;
    legal_basis: string | null;
    created_at: string;
}

const DOCUMENT_CATEGORIES = [
    { value: "all", label: "Alle Dokumente" },
    { value: "contract", label: "Arbeitsverträge" },
    { value: "amendment", label: "Vertragsänderungen" },
    { value: "termination", label: "Kündigungen" },
    { value: "certificate", label: "Arbeitszeugnisse" },
    { value: "warning", label: "Abmahnungen" },
    { value: "salary", label: "Gehaltsunterlagen" },
    { value: "hr_general", label: "Sonstige HR-Dokumente" },
];

const RETENTION_PRESETS = [
    { days: 30, label: "30 Tage" },
    { days: 90, label: "3 Monate" },
    { days: 365, label: "1 Jahr" },
    { days: 730, label: "2 Jahre" },
    { days: 1825, label: "5 Jahre" },
    { days: 2555, label: "7 Jahre (gesetzliche Aufbewahrungsfrist)" },
    { days: 3650, label: "10 Jahre" },
];

export default function RetentionPoliciesPage() {
    const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dialog state
    const [showDialog, setShowDialog] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        document_category: "all",
        retention_days: 365,
        action: "archive" as "archive" | "delete",
        warn_before_days: 30,
        legal_basis: "",
        is_active: true,
    });

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/v1/retention-policies");
            if (response.ok) {
                const data = await response.json();
                setPolicies(data);
            } else {
                // Mock data for demo
                setPolicies([
                    {
                        id: 1,
                        name: "Standard-Aufbewahrung",
                        description: "Alle Dokumente 7 Jahre aufbewahren",
                        document_category: "all",
                        retention_days: 2555,
                        action: "archive",
                        is_active: true,
                        warn_before_days: 90,
                        legal_basis: "§ 257 HGB, § 147 AO",
                        created_at: "2024-01-01",
                    },
                    {
                        id: 2,
                        name: "Arbeitsverträge",
                        description: "Aufbewahrung nach Beendigung des Arbeitsverhältnisses",
                        document_category: "contract",
                        retention_days: 3650,
                        action: "archive",
                        is_active: true,
                        warn_before_days: 180,
                        legal_basis: "§ 195 BGB (Verjährungsfrist)",
                        created_at: "2024-01-01",
                    },
                    {
                        id: 3,
                        name: "Entwürfe",
                        description: "Nicht abgeschlossene Entwürfe nach 30 Tagen löschen",
                        document_category: "all",
                        retention_days: 30,
                        action: "delete",
                        is_active: true,
                        warn_before_days: 7,
                        legal_basis: null,
                        created_at: "2024-01-01",
                    },
                ]);
            }
        } catch (err) {
            setError("Richtlinien konnten nicht geladen werden");
        } finally {
            setIsLoading(false);
        }
    };

    const openNewDialog = () => {
        setEditingPolicy(null);
        setFormData({
            name: "",
            description: "",
            document_category: "all",
            retention_days: 365,
            action: "archive",
            warn_before_days: 30,
            legal_basis: "",
            is_active: true,
        });
        setShowDialog(true);
    };

    const openEditDialog = (policy: RetentionPolicy) => {
        setEditingPolicy(policy);
        setFormData({
            name: policy.name,
            description: policy.description || "",
            document_category: policy.document_category,
            retention_days: policy.retention_days,
            action: policy.action,
            warn_before_days: policy.warn_before_days,
            legal_basis: policy.legal_basis || "",
            is_active: policy.is_active,
        });
        setShowDialog(true);
    };

    const handleSubmit = async () => {
        if (!formData.name) return;

        setIsSubmitting(true);
        try {
            const url = editingPolicy
                ? `/api/v1/retention-policies/${editingPolicy.id}`
                : "/api/v1/retention-policies";
            const method = editingPolicy ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setShowDialog(false);
                await fetchPolicies();
            }
        } catch (err) {
            setError("Speichern fehlgeschlagen");
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleActive = async (policy: RetentionPolicy) => {
        try {
            await fetch(`/api/v1/retention-policies/${policy.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...policy, is_active: !policy.is_active }),
            });
            await fetchPolicies();
        } catch (err) {
            console.error("Toggle failed:", err);
        }
    };

    const formatDays = (days: number) => {
        if (days < 30) return `${days} Tage`;
        if (days < 365) return `${Math.round(days / 30)} Monate`;
        return `${Math.round(days / 365)} Jahre`;
    };

    const getCategoryLabel = (category: string) => {
        return DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label || category;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Archive className="w-6 h-6" />
                        Aufbewahrungsrichtlinien
                    </h1>
                    <p className="text-muted-foreground">
                        Definieren Sie, wie lange Dokumente aufbewahrt werden
                    </p>
                </div>
                <Button onClick={openNewDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Neue Richtlinie
                </Button>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-medium text-blue-800 dark:text-blue-200">Gesetzliche Aufbewahrungsfristen</p>
                    <p className="text-blue-700 dark:text-blue-300 mt-1">
                        Nach § 257 HGB und § 147 AO müssen Geschäftsunterlagen mindestens 6-10 Jahre aufbewahrt werden.
                        Arbeitsrechtliche Unterlagen unterliegen der 3-jährigen Verjährungsfrist (§ 195 BGB).
                    </p>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4">
                    {error}
                </div>
            )}

            {/* Policies Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : policies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Keine Aufbewahrungsrichtlinien definiert</p>
                    <Button variant="outline" className="mt-4" onClick={openNewDialog}>
                        Erste Richtlinie erstellen
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {policies.map((policy) => (
                        <Card key={policy.id} className={!policy.is_active ? "opacity-60" : ""}>
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${policy.action === "delete" ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                                            {policy.action === "delete" ? (
                                                <Trash2 className="w-6 h-6 text-red-500" />
                                            ) : (
                                                <Archive className="w-6 h-6 text-blue-500" />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold">{policy.name}</h3>
                                                {!policy.is_active && (
                                                    <Badge variant="secondary">Inaktiv</Badge>
                                                )}
                                            </div>
                                            {policy.description && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {policy.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-4 mt-3 text-sm">
                                                <div className="flex items-center gap-1">
                                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                                    <span>{getCategoryLabel(policy.document_category)}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                                    <span>{formatDays(policy.retention_days)}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                                                    <span>Warnung {policy.warn_before_days} Tage vorher</span>
                                                </div>
                                            </div>
                                            {policy.legal_basis && (
                                                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                                    <Shield className="w-3 h-3" />
                                                    <span>Rechtsgrundlage: {policy.legal_basis}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <Badge variant={policy.action === "delete" ? "destructive" : "default"}>
                                            {policy.action === "delete" ? "Löschen" : "Archivieren"}
                                        </Badge>
                                        <Switch
                                            checked={policy.is_active}
                                            onCheckedChange={() => toggleActive(policy)}
                                        />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openEditDialog(policy)}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* New/Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPolicy ? "Richtlinie bearbeiten" : "Neue Aufbewahrungsrichtlinie"}
                        </DialogTitle>
                        <DialogDescription>
                            Definieren Sie, wie lange Dokumente aufbewahrt werden sollen.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name *</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="z.B. Standard-Aufbewahrung"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Beschreibung</label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="Kurze Beschreibung der Richtlinie..."
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Dokumentkategorie</label>
                                <Select
                                    value={formData.document_category}
                                    onValueChange={(v) => setFormData((prev) => ({ ...prev, document_category: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DOCUMENT_CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Aktion nach Ablauf</label>
                                <Select
                                    value={formData.action}
                                    onValueChange={(v) => setFormData((prev) => ({ ...prev, action: v as "archive" | "delete" }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="archive">
                                            <div className="flex items-center gap-2">
                                                <Archive className="w-4 h-4" />
                                                Archivieren
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="delete">
                                            <div className="flex items-center gap-2">
                                                <Trash2 className="w-4 h-4" />
                                                Löschen
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Aufbewahrungsdauer</label>
                            <Select
                                value={String(formData.retention_days)}
                                onValueChange={(v) => setFormData((prev) => ({ ...prev, retention_days: parseInt(v) }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RETENTION_PRESETS.map((preset) => (
                                        <SelectItem key={preset.days} value={String(preset.days)}>
                                            {preset.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Warnung vor Ablauf (Tage)</label>
                            <Input
                                type="number"
                                value={formData.warn_before_days}
                                onChange={(e) => setFormData((prev) => ({ ...prev, warn_before_days: parseInt(e.target.value) || 0 }))}
                                min={1}
                                max={365}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Rechtsgrundlage (optional)</label>
                            <Input
                                value={formData.legal_basis}
                                onChange={(e) => setFormData((prev) => ({ ...prev, legal_basis: e.target.value }))}
                                placeholder="z.B. § 257 HGB"
                            />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <label className="text-sm font-medium">Richtlinie aktiv</label>
                            <Switch
                                checked={formData.is_active}
                                onCheckedChange={(v) => setFormData((prev) => ({ ...prev, is_active: v }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>
                            Abbrechen
                        </Button>
                        <Button onClick={handleSubmit} disabled={!formData.name || isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Save className="w-4 h-4 mr-2" />
                            Speichern
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
