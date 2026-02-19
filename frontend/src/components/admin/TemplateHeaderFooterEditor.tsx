/**
 * TemplateHeaderFooterEditor - Individuelle Kopf-/Fußzeilen pro Dokumentvorlage
 *
 * v4.3 Feature: Ermöglicht das Setzen von individuellen Header/Footer
 * für jeden Dokumenttyp, anstatt nur globale DesignSettings zu verwenden.
 *
 * Features:
 * - Eigene Kopfzeile (3 Zeilen)
 * - Eigene Fußzeile (3 Zeilen)
 * - Eigenes Logo mit Position (links/mitte/rechts)
 * - Eigene Seitenränder
 * - Von Vorlage übernehmen
 * - Auf globale Einstellungen zurücksetzen
 */

import { useState, useEffect } from "react";
import {
  FileText,
  Copy,
  RotateCcw,
  Save,
  Loader2,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Settings2,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
// ToggleGroup nicht verfügbar - verwenden wir Buttons stattdessen
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface HeaderFooterSettings {
  custom_header_enabled: boolean;
  custom_header_line1: string | null;
  custom_header_line2: string | null;
  custom_header_line3: string | null;
  custom_footer_enabled: boolean;
  custom_footer_line1: string | null;
  custom_footer_line2: string | null;
  custom_footer_line3: string | null;
  custom_logo_enabled: boolean;
  custom_logo_path: string | null;
  custom_logo_position: string | null;
  custom_logo_width_cm: string | null;
  custom_margin_left_cm: string | null;
  custom_margin_right_cm: string | null;
  custom_margin_top_cm: string | null;
  custom_margin_bottom_cm: string | null;
}

interface DocumentType {
  id: number;
  name: string;
  country_code: string;
  category: string | null;
}

interface TemplateHeaderFooterEditorProps {
  documentTypeId: number;
  documentTypeName: string;
  onSave?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export const TemplateHeaderFooterEditor = ({
  documentTypeId,
  documentTypeName,
  onSave,
}: TemplateHeaderFooterEditorProps) => {
  const toast = useToast();

  // State
  const [settings, setSettings] = useState<HeaderFooterSettings>({
    custom_header_enabled: false,
    custom_header_line1: null,
    custom_header_line2: null,
    custom_header_line3: null,
    custom_footer_enabled: false,
    custom_footer_line1: null,
    custom_footer_line2: null,
    custom_footer_line3: null,
    custom_logo_enabled: false,
    custom_logo_path: null,
    custom_logo_position: "right",
    custom_logo_width_cm: "5.0",
    custom_margin_left_cm: null,
    custom_margin_right_cm: null,
    custom_margin_top_cm: null,
    custom_margin_bottom_cm: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Copy from template dialog
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<DocumentType[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [copyOptions, setCopyOptions] = useState({
    copy_header: true,
    copy_footer: true,
    copy_logo: true,
    copy_margins: false,
  });
  const [isCopying, setIsCopying] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // Load Data
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    loadSettings();
    loadAvailableTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch on mount and when documentTypeId changes
  }, [documentTypeId]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<HeaderFooterSettings>(
        `/api/v1/document-types/${documentTypeId}/header-footer`
      );
      setSettings(res.data);
      setHasChanges(false);
    } catch {
      // Settings might not exist yet - use defaults
      console.info("Using default header/footer settings");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableTemplates = async () => {
    try {
      const res = await api.get<DocumentType[]>("/api/v1/document-types");
      setAvailableTemplates(res.data.filter((t) => t.id !== documentTypeId));
    } catch {
      toast.error("Fehler", "Verfügbare Vorlagen konnten nicht geladen werden");
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Save Settings
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put(`/api/v1/document-types/${documentTypeId}/header-footer`, settings);
      toast.success("Gespeichert", "Kopf-/Fußzeilen-Einstellungen wurden gespeichert");
      setHasChanges(false);
      onSave?.();
    } catch {
      toast.error("Fehler", "Einstellungen konnten nicht gespeichert werden");
    } finally {
      setIsSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Reset to Global Settings
  // ═══════════════════════════════════════════════════════════════════════════

  const handleReset = async () => {
    if (!confirm("Individuelle Einstellungen zurücksetzen? Es werden dann die globalen Design-Einstellungen verwendet.")) {
      return;
    }

    try {
      await api.delete(`/api/v1/document-types/${documentTypeId}/header-footer`);
      toast.success("Zurückgesetzt", "Globale Design-Einstellungen werden verwendet");
      await loadSettings();
    } catch {
      toast.error("Fehler", "Zurücksetzen fehlgeschlagen");
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Copy from Template
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCopyFromTemplate = async () => {
    if (!selectedSourceId) {
      toast.error("Fehler", "Bitte eine Quell-Vorlage auswählen");
      return;
    }

    setIsCopying(true);
    try {
      const res = await api.post(`/api/v1/document-types/${documentTypeId}/copy-from-template`, {
        source_template_id: selectedSourceId,
        ...copyOptions,
        copy_clauses: false,
        copy_variant_groups: false,
      });
      const responseData = res.data as { message: string };
      toast.success("Übernommen", responseData.message);
      setShowCopyDialog(false);
      await loadSettings();
    } catch {
      toast.error("Fehler", "Einstellungen konnten nicht übernommen werden");
    } finally {
      setIsCopying(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Update Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  const updateSetting = <K extends keyof HeaderFooterSettings>(
    key: K,
    value: HeaderFooterSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isCustomized =
    settings.custom_header_enabled ||
    settings.custom_footer_enabled ||
    settings.custom_logo_enabled;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Kopf-/Fußzeilen für "{documentTypeName}"
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Individuelle Einstellungen überschreiben die globalen Design-Einstellungen
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCustomized && (
            <Badge variant="secondary" className="gap-1">
              <Settings2 className="w-3 h-3" />
              Individuell
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowCopyDialog(true)}>
            <Copy className="w-4 h-4 mr-2" />
            Von Vorlage
          </Button>
          {isCustomized && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {/* Info Alert */}
      {!isCustomized && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Diese Vorlage verwendet die globalen Design-Einstellungen. Aktiviere die Schalter unten,
            um individuelle Kopf-/Fußzeilen für diese Vorlage zu definieren.
          </AlertDescription>
        </Alert>
      )}

      {/* Header Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Kopfzeile</CardTitle>
              <CardDescription>Wird oben auf jeder Seite des Dokuments angezeigt</CardDescription>
            </div>
            <Switch
              checked={settings.custom_header_enabled}
              onCheckedChange={(checked) => updateSetting("custom_header_enabled", checked)}
            />
          </div>
        </CardHeader>
        {settings.custom_header_enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Zeile 1 (z.B. Firmenname)</Label>
              <Input
                value={settings.custom_header_line1 || ""}
                onChange={(e) => updateSetting("custom_header_line1", e.target.value || null)}
                placeholder="Muster GmbH"
              />
            </div>
            <div className="space-y-2">
              <Label>Zeile 2 (z.B. Adresse)</Label>
              <Input
                value={settings.custom_header_line2 || ""}
                onChange={(e) => updateSetting("custom_header_line2", e.target.value || null)}
                placeholder="Musterstraße 1, 12345 Musterstadt"
              />
            </div>
            <div className="space-y-2">
              <Label>Zeile 3 (z.B. Kontakt)</Label>
              <Input
                value={settings.custom_header_line3 || ""}
                onChange={(e) => updateSetting("custom_header_line3", e.target.value || null)}
                placeholder="Tel: +49 123 456789 | info@muster.de"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Footer Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Fußzeile</CardTitle>
              <CardDescription>Wird unten auf jeder Seite des Dokuments angezeigt</CardDescription>
            </div>
            <Switch
              checked={settings.custom_footer_enabled}
              onCheckedChange={(checked) => updateSetting("custom_footer_enabled", checked)}
            />
          </div>
        </CardHeader>
        {settings.custom_footer_enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Zeile 1 (z.B. Geschäftsführer)</Label>
              <Input
                value={settings.custom_footer_line1 || ""}
                onChange={(e) => updateSetting("custom_footer_line1", e.target.value || null)}
                placeholder="Geschäftsführer: Max Mustermann"
              />
            </div>
            <div className="space-y-2">
              <Label>Zeile 2 (z.B. Handelsregister)</Label>
              <Input
                value={settings.custom_footer_line2 || ""}
                onChange={(e) => updateSetting("custom_footer_line2", e.target.value || null)}
                placeholder="HRB 12345, Amtsgericht Musterstadt"
              />
            </div>
            <div className="space-y-2">
              <Label>Zeile 3 (z.B. Bankverbindung)</Label>
              <Input
                value={settings.custom_footer_line3 || ""}
                onChange={(e) => updateSetting("custom_footer_line3", e.target.value || null)}
                placeholder="IBAN: DE12 3456 7890 1234 5678 90"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Logo Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="w-4 h-4" />
                Logo-Einstellungen
              </CardTitle>
              <CardDescription>Position und Größe des Firmenlogos</CardDescription>
            </div>
            <Switch
              checked={settings.custom_logo_enabled}
              onCheckedChange={(checked) => updateSetting("custom_logo_enabled", checked)}
            />
          </div>
        </CardHeader>
        {settings.custom_logo_enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Logo-Position</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={settings.custom_logo_position === "left" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateSetting("custom_logo_position", "left")}
                >
                  <AlignLeft className="w-4 h-4 mr-2" />
                  Links
                </Button>
                <Button
                  type="button"
                  variant={settings.custom_logo_position === "center" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateSetting("custom_logo_position", "center")}
                >
                  <AlignCenter className="w-4 h-4 mr-2" />
                  Mitte
                </Button>
                <Button
                  type="button"
                  variant={settings.custom_logo_position === "right" || !settings.custom_logo_position ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateSetting("custom_logo_position", "right")}
                >
                  <AlignRight className="w-4 h-4 mr-2" />
                  Rechts
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Logo-Breite (cm)</Label>
              <Input
                type="text"
                value={settings.custom_logo_width_cm || "5.0"}
                onChange={(e) => updateSetting("custom_logo_width_cm", e.target.value || null)}
                placeholder="5.0"
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Empfohlen: 3.0 - 6.0 cm für professionelles Erscheinungsbild
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Änderungen speichern
          </Button>
        </div>
      )}

      {/* Copy from Template Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Einstellungen von Vorlage übernehmen</DialogTitle>
            <DialogDescription>
              Wähle eine Vorlage aus, deren Kopf-/Fußzeilen-Einstellungen du übernehmen möchtest.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quell-Vorlage</Label>
              <Select
                value={selectedSourceId?.toString() || ""}
                onValueChange={(value) => setSelectedSourceId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vorlage auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.name} ({template.country_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Was soll übernommen werden?</Label>

              <div className="flex items-center justify-between">
                <span className="text-sm">Kopfzeile</span>
                <Switch
                  checked={copyOptions.copy_header}
                  onCheckedChange={(checked) =>
                    setCopyOptions((prev) => ({ ...prev, copy_header: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Fußzeile</span>
                <Switch
                  checked={copyOptions.copy_footer}
                  onCheckedChange={(checked) =>
                    setCopyOptions((prev) => ({ ...prev, copy_footer: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Logo-Einstellungen</span>
                <Switch
                  checked={copyOptions.copy_logo}
                  onCheckedChange={(checked) =>
                    setCopyOptions((prev) => ({ ...prev, copy_logo: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Seitenränder</span>
                <Switch
                  checked={copyOptions.copy_margins}
                  onCheckedChange={(checked) =>
                    setCopyOptions((prev) => ({ ...prev, copy_margins: checked }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCopyFromTemplate} disabled={!selectedSourceId || isCopying}>
              {isCopying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateHeaderFooterEditor;
