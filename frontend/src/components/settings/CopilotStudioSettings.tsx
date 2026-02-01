/**
 * CopilotStudioSettings - Integration mit Microsoft Copilot Studio
 *
 * Ermöglicht die Konfiguration der Copilot Studio / Power Platform Integration:
 * - API-Schlüssel generieren für eingehende Bot-Anfragen
 * - Webhook-Subscriptions verwalten für Power Automate
 * - Berechtigungen konfigurieren
 * - Connection testen
 *
 * v1.0: Initial implementation
 */

import { useState, useEffect } from "react";
import {
  Bot,
  Key,
  Webhook,
  Copy,
  RefreshCw,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Play,
  ExternalLink,
  Shield,
  FileText,
  Search,
  Clock,
  Loader2,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface CopilotConfig {
  is_enabled: boolean;
  tenant_id: string | null;
  client_id: string | null;
  bot_id: string | null;
  api_key: string | null;
  api_key_created_at: string | null;
  allow_document_creation: boolean;
  allow_document_search: boolean;
  allow_deadline_access: boolean;
  allowed_document_types: string[] | null;
  request_count: number;
  last_request_at: string | null;
}

interface WebhookSubscription {
  id: number;
  url: string;
  events: string[];
  description: string | null;
  is_active: boolean;
  created_at: string;
  last_triggered_at: string | null;
  trigger_count: number;
  last_error: string | null;
}

interface WebhookEvent {
  name: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Available Webhook Events
// ═══════════════════════════════════════════════════════════════════════════

const WEBHOOK_EVENTS: WebhookEvent[] = [
  { name: "document.created", description: "Neues Dokument erstellt" },
  { name: "document.exported", description: "Dokument exportiert (PDF/DOCX)" },
  { name: "document.deleted", description: "Dokument gelöscht" },
  { name: "deadline.approaching", description: "Frist nähert sich (7 Tage)" },
  { name: "deadline.overdue", description: "Frist überschritten" },
  { name: "approval.requested", description: "Freigabe angefordert" },
  { name: "approval.completed", description: "Freigabe erteilt/abgelehnt" },
  { name: "draft.created", description: "Entwurf erstellt" },
  { name: "draft.updated", description: "Entwurf aktualisiert" },
];

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export const CopilotStudioSettings = () => {
  const toast = useToast();

  // State
  const [config, setConfig] = useState<CopilotConfig | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // New Webhook Dialog
  const [showNewWebhookDialog, setShowNewWebhookDialog] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    url: "",
    events: [] as string[],
    description: "",
    secret: "",
  });
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);

  // Test Webhook Dialog
  const [testingWebhookId, setTestingWebhookId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    status_code?: number;
    response_time_ms?: number;
  } | null>(null);

  // Delete Confirmation Dialog
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    webhookId: number | null;
    webhookUrl: string;
  }>({ open: false, webhookId: null, webhookUrl: "" });
  const [isDeleting, setIsDeleting] = useState(false);

  // URL Validation
  const [urlError, setUrlError] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // Load Data
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load Copilot Config
      const configRes = await api.get<CopilotConfig>("/api/v1/copilot-studio/config");
      setConfig(configRes.data);

      // Load Webhooks
      const webhooksRes = await api.get<WebhookSubscription[]>("/api/v1/webhooks/subscriptions");
      setWebhooks(webhooksRes.data);
    } catch (error) {
      // Config might not exist yet - that's OK
      setConfig({
        is_enabled: false,
        tenant_id: null,
        client_id: null,
        bot_id: null,
        api_key: null,
        api_key_created_at: null,
        allow_document_creation: true,
        allow_document_search: true,
        allow_deadline_access: true,
        allowed_document_types: null,
        request_count: 0,
        last_request_at: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Save Config
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSaveConfig = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      await api.put("/api/v1/copilot-studio/config", config);
      toast.success("Gespeichert", "Copilot Studio Einstellungen wurden gespeichert");
    } catch (error: unknown) {
      // Detailliertere Fehlermeldung
      let errorDetail = "Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.";
      if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("403")) {
          errorDetail = "Sie haben keine Berechtigung für diese Aktion. Bitte melden Sie sich erneut an.";
        } else if (error.message.includes("network") || error.message.includes("Network")) {
          errorDetail = "Netzwerkfehler: Server ist nicht erreichbar.";
        }
      }
      toast.error("Speichern fehlgeschlagen", errorDetail);
    } finally {
      setIsSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // API Key Management
  // ═══════════════════════════════════════════════════════════════════════════

  const handleGenerateApiKey = async () => {
    try {
      const res = await api.post<{ api_key: string }>("/api/v1/copilot-studio/generate-api-key");
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              api_key: res.data.api_key,
              api_key_created_at: new Date().toISOString(),
            }
          : prev
      );
      toast.success("API-Schlüssel generiert", "Kopieren Sie den Schlüssel jetzt - er wird nur einmal vollständig angezeigt!");
      setShowApiKey(true);
    } catch (error: unknown) {
      let errorDetail = "Bitte versuchen Sie es erneut.";
      if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("403")) {
          errorDetail = "Keine Berechtigung. Nur Administratoren können API-Schlüssel generieren.";
        }
      }
      toast.error("API-Schlüssel Fehler", errorDetail);
    }
  };

  const handleCopyApiKey = () => {
    if (config?.api_key) {
      navigator.clipboard.writeText(config.api_key);
      toast.success("Kopiert", "API-Schlüssel wurde in die Zwischenablage kopiert");
    }
  };

  const handleCopyOpenApiUrl = () => {
    const url = `${window.location.origin}/api/v1/openapi.json`;
    navigator.clipboard.writeText(url);
    toast.success("Kopiert", "OpenAPI URL wurde in die Zwischenablage kopiert");
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Webhook Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validiert eine URL auf Gültigkeit und Sicherheit
   */
  const validateWebhookUrl = (url: string): string | null => {
    if (!url || url.trim() === "") {
      return "URL ist erforderlich";
    }

    // Prüfe auf gefährliche Protokolle (XSS-Schutz)
    const dangerousProtocols = /^(javascript|data|vbscript|file):/i;
    if (dangerousProtocols.test(url.trim())) {
      return "Ungültiges URL-Protokoll. Nur HTTPS-URLs sind erlaubt.";
    }

    // Prüfe auf gültiges URL-Format
    try {
      const parsedUrl = new URL(url);
      // Nur HTTPS erlauben (außer localhost für Dev)
      if (parsedUrl.protocol !== "https:" && !parsedUrl.hostname.includes("localhost")) {
        return "Nur HTTPS-URLs sind aus Sicherheitsgründen erlaubt";
      }
      return null; // Gültig
    } catch {
      return "Ungültiges URL-Format. Bitte eine vollständige URL eingeben (z.B. https://...)";
    }
  };

  const handleCreateWebhook = async () => {
    // URL-Validierung
    const urlValidationError = validateWebhookUrl(newWebhook.url);
    if (urlValidationError) {
      setUrlError(urlValidationError);
      toast.error("Ungültige URL", urlValidationError);
      return;
    }

    if (newWebhook.events.length === 0) {
      toast.error("Fehler", "Bitte mindestens ein Event auswählen");
      return;
    }

    setUrlError(null);
    setIsCreatingWebhook(true);
    try {
      const res = await api.post<WebhookSubscription>("/api/v1/webhooks/subscribe", {
        url: newWebhook.url,
        events: newWebhook.events,
        description: newWebhook.description || null,
        secret: newWebhook.secret || null,
      });
      setWebhooks((prev) => [res.data, ...prev]);
      setShowNewWebhookDialog(false);
      setNewWebhook({ url: "", events: [], description: "", secret: "" });
      toast.success("Webhook erstellt", "Webhook-Subscription wurde erfolgreich erstellt. Testen Sie die Verbindung mit dem Play-Button.");
    } catch (error: unknown) {
      let errorDetail = "Bitte überprüfen Sie die eingegebenen Daten.";
      if (error instanceof Error) {
        if (error.message.includes("400")) {
          errorDetail = "Ungültige Daten. Bitte prüfen Sie URL und Events.";
        } else if (error.message.includes("409")) {
          errorDetail = "Ein Webhook mit dieser URL existiert bereits.";
        }
      }
      toast.error("Webhook Fehler", errorDetail);
    } finally {
      setIsCreatingWebhook(false);
    }
  };

  const handleDeleteWebhookClick = (webhook: WebhookSubscription) => {
    // Custom Confirm Dialog öffnen statt native confirm()
    setDeleteConfirmDialog({
      open: true,
      webhookId: webhook.id,
      webhookUrl: webhook.url,
    });
  };

  const handleDeleteWebhookConfirm = async () => {
    if (!deleteConfirmDialog.webhookId) return;

    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/webhooks/subscriptions/${deleteConfirmDialog.webhookId}`);
      setWebhooks((prev) => prev.filter((w) => w.id !== deleteConfirmDialog.webhookId));
      toast.success("Gelöscht", "Webhook wurde erfolgreich gelöscht");
      setDeleteConfirmDialog({ open: false, webhookId: null, webhookUrl: "" });
    } catch (error: unknown) {
      // Detailliertere Fehlermeldung
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
      toast.error("Löschen fehlgeschlagen", `Der Webhook konnte nicht gelöscht werden: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestWebhook = async (id: number) => {
    setTestingWebhookId(id);
    setTestResult(null);

    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        status_code?: number;
        response_time_ms?: number;
      }>(`/api/v1/webhooks/subscriptions/${id}/test`);
      setTestResult(res.data);
    } catch (error) {
      setTestResult({
        success: false,
        message: "Test konnte nicht durchgeführt werden",
      });
    } finally {
      setTestingWebhookId(null);
    }
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

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Copilot Studio Integration</h2>
            <p className="text-sm text-muted-foreground">
              Verbinden Sie Ihren HR Document Generator mit Microsoft Copilot Studio und Power Automate
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Mit dieser Integration können Sie HR-Dokumente über Teams-Bots erstellen und Workflows in Power Automate
            automatisieren.{" "}
            <a
              href="https://copilotstudio.microsoft.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Copilot Studio öffnen <ExternalLink className="w-3 h-3" />
            </a>
          </AlertDescription>
        </Alert>

        {/* Enable/Disable Toggle */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Integration aktivieren</CardTitle>
                <CardDescription>Erlaubt Copilot Studio / Power Platform den Zugriff auf die API</CardDescription>
              </div>
              <Switch
                checked={config?.is_enabled || false}
                onCheckedChange={(checked) => setConfig((prev) => (prev ? { ...prev, is_enabled: checked } : prev))}
              />
            </div>
          </CardHeader>
        </Card>

        {config?.is_enabled && (
          <>
            {/* API Connection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API-Verbindung
                </CardTitle>
                <CardDescription>
                  Verwenden Sie diese Informationen um einen Custom Connector in Copilot Studio zu erstellen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* OpenAPI URL */}
                <div className="space-y-2">
                  <Label>OpenAPI Specification URL</Label>
                  <div className="flex gap-2">
                    <Input value={`${window.location.origin}/api/v1/openapi.json`} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={handleCopyOpenApiUrl}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Importieren Sie diese URL in Copilot Studio als Custom Connector
                  </p>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label>API-Schlüssel</Label>
                  {config.api_key ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          value={showApiKey ? config.api_key : "••••••••••••••••••••••••"}
                          readOnly
                          className="font-mono text-sm pr-10"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <Button variant="outline" size="icon" onClick={handleCopyApiKey}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleGenerateApiKey}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={handleGenerateApiKey} className="gap-2">
                      <Key className="w-4 h-4" />
                      API-Schlüssel generieren
                    </Button>
                  )}
                  {config.api_key_created_at && (
                    <p className="text-xs text-muted-foreground">
                      Erstellt am: {new Date(config.api_key_created_at).toLocaleString("de-DE")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Berechtigungen
                </CardTitle>
                <CardDescription>Welche Aktionen darf der Bot ausführen?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <Label>Dokumente erstellen</Label>
                  </div>
                  <Switch
                    checked={config.allow_document_creation}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => (prev ? { ...prev, allow_document_creation: checked } : prev))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Label>Dokumente suchen</Label>
                  </div>
                  <Switch
                    checked={config.allow_document_search}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => (prev ? { ...prev, allow_document_search: checked } : prev))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <Label>Fristen einsehen</Label>
                  </div>
                  <Switch
                    checked={config.allow_deadline_access}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => (prev ? { ...prev, allow_deadline_access: checked } : prev))
                    }
                  />
                </div>

                <Button onClick={handleSaveConfig} disabled={isSaving} className="w-full mt-4">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Berechtigungen speichern
                </Button>
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Webhook className="w-4 h-4" />
                      Webhooks
                    </CardTitle>
                    <CardDescription>Benachrichtigungen an Power Automate senden</CardDescription>
                  </div>
                  <Button size="sm" className="gap-2" onClick={() => setShowNewWebhookDialog(true)}>
                    <Plus className="w-4 h-4" />
                    Webhook hinzufügen
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {webhooks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Webhook className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Keine Webhooks konfiguriert</p>
                    <p className="text-xs mt-1">
                      Erstellen Sie einen Webhook um Events an Power Automate zu senden
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {webhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={webhook.is_active ? "default" : "secondary"}>
                              {webhook.is_active ? "Aktiv" : "Inaktiv"}
                            </Badge>
                            {webhook.last_error && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="destructive">Fehler</Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">{webhook.last_error}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <p className="text-sm font-mono truncate mt-1">{webhook.url}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              Events: {webhook.events.join(", ")}
                            </span>
                            {webhook.trigger_count > 0 && (
                              <span className="text-xs text-muted-foreground">
                                • {webhook.trigger_count}x ausgelöst
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTestWebhook(webhook.id)}
                            disabled={testingWebhookId === webhook.id}
                          >
                            {testingWebhookId === webhook.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteWebhookClick(webhook)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Test Result */}
                {testResult && (
                  <Alert className={`mt-4 ${testResult.success ? "border-green-500" : "border-red-500"}`}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <AlertDescription>
                      {testResult.message}
                      {testResult.response_time_ms && (
                        <span className="text-xs ml-2">({testResult.response_time_ms}ms)</span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Usage Stats */}
            {(config.request_count > 0 || config.last_request_at) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Nutzungsstatistik</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold">{config.request_count}</p>
                      <p className="text-xs text-muted-foreground">API-Anfragen gesamt</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {config.last_request_at
                          ? new Date(config.last_request_at).toLocaleDateString("de-DE")
                          : "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">Letzte Anfrage</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Delete Confirmation Dialog (Accessible Custom Dialog) */}
        <Dialog open={deleteConfirmDialog.open} onOpenChange={(open) => !open && setDeleteConfirmDialog({ open: false, webhookId: null, webhookUrl: "" })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Webhook löschen?
              </DialogTitle>
              <DialogDescription>
                Diese Aktion kann nicht rückgängig gemacht werden. Der folgende Webhook wird dauerhaft gelöscht:
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-mono break-all">{deleteConfirmDialog.webhookUrl}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Power Automate Flows, die diesen Webhook verwenden, werden keine Benachrichtigungen mehr erhalten.
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmDialog({ open: false, webhookId: null, webhookUrl: "" })}
                disabled={isDeleting}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteWebhookConfirm}
                disabled={isDeleting}
                className="gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Endgültig löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Webhook Dialog */}
        <Dialog open={showNewWebhookDialog} onOpenChange={setShowNewWebhookDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Neuen Webhook erstellen</DialogTitle>
              <DialogDescription>
                Geben Sie die Power Automate HTTP-Trigger URL ein und wählen Sie die Events aus
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Webhook URL *</Label>
                <Input
                  placeholder="https://prod-123.westeurope.logic.azure.com/workflows/..."
                  value={newWebhook.url}
                  onChange={(e) => {
                    setNewWebhook((prev) => ({ ...prev, url: e.target.value }));
                    // Live-Validierung bei Eingabe
                    if (e.target.value) {
                      setUrlError(validateWebhookUrl(e.target.value));
                    } else {
                      setUrlError(null);
                    }
                  }}
                  className={urlError ? "border-red-500" : ""}
                />
                {urlError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {urlError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Beschreibung</Label>
                <Input
                  placeholder="z.B. Power Automate - Neue Verträge archivieren"
                  value={newWebhook.description}
                  onChange={(e) => setNewWebhook((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Events *</Label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div key={event.name} className="flex items-center gap-2">
                      <Checkbox
                        id={event.name}
                        checked={newWebhook.events.includes(event.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewWebhook((prev) => ({
                              ...prev,
                              events: [...prev.events, event.name],
                            }));
                          } else {
                            setNewWebhook((prev) => ({
                              ...prev,
                              events: prev.events.filter((e) => e !== event.name),
                            }));
                          }
                        }}
                      />
                      <label htmlFor={event.name} className="text-sm cursor-pointer flex-1">
                        <span className="font-medium">{event.name}</span>
                        <span className="text-muted-foreground ml-2">- {event.description}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secret (optional)</Label>
                <Input
                  type="password"
                  placeholder="HMAC Secret für Signatur-Validierung"
                  value={newWebhook.secret}
                  onChange={(e) => setNewWebhook((prev) => ({ ...prev, secret: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Wenn angegeben, wird jeder Payload mit HMAC-SHA256 signiert (Header: X-Webhook-Signature)
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewWebhookDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreateWebhook} disabled={isCreatingWebhook}>
                {isCreatingWebhook && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Webhook erstellen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default CopilotStudioSettings;
