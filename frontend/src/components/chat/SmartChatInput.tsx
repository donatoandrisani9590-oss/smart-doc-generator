/**
 * SmartChatInput - Natural language document creation input
 *
 * Features:
 * - Single input that understands natural language
 * - Extracts intents: create document, fill fields, add clauses
 * - Privacy-first: Lokale Regex-Engine + Mistral EU-Fallback
 *
 * Datenschutz-Architektur:
 * 1. Primär: Lokale Regex/Rules (80% der Anfragen, instant)
 * 2. Fallback: Mistral AI (EU-hosted, DSGVO-freundlich)
 *
 * Examples:
 * - "Erstelle einen Arbeitsvertrag für Max Müller"
 * - "Der Mitarbeiter verdient 5000€ pro Monat"
 * - "Füge eine Homeoffice-Klausel hinzu"
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  ArrowRight,
  Zap,
  FileText,
  Shield,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  processSmartMessage,
  configureMistral,
  type MistralResponse,
} from "@/lib/mistral-service";

// =============================================================================
// Types
// =============================================================================

interface SmartChatInputProps {
  /** Callback when document creation is triggered */
  onCreateDocument?: (
    documentType: string,
    initialData: Record<string, unknown>
  ) => void;
  /** Callback when field update is detected */
  onUpdateField?: (field: string, value: unknown) => void;
  /** Callback when clause search is requested */
  onSearchClause?: (query: string) => void;
  /** Current context to send to LLM */
  currentContext?: Record<string, unknown>;
  /** Placeholder text */
  placeholder?: string;
  /** Show suggestions */
  showSuggestions?: boolean;
  /** Custom class name */
  className?: string;
  /** Mistral API Key (optional - enables AI fallback) */
  mistralApiKey?: string;
}

// =============================================================================
// Constants
// =============================================================================

// Quick action suggestions
const QUICK_ACTIONS = [
  {
    label: "Arbeitsvertrag",
    prompt: "Erstelle einen Arbeitsvertrag",
    icon: FileText,
  },
  {
    label: "Kündigung",
    prompt: "Erstelle eine Kündigung",
    icon: FileText,
  },
  {
    label: "Zeugnis",
    prompt: "Erstelle ein Arbeitszeugnis",
    icon: FileText,
  },
];

// Field labels for display
const FIELD_LABELS: Record<string, string> = {
  full_name: "Name",
  first_name: "Vorname",
  last_name: "Nachname",
  salary: "Gehalt",
  position: "Position",
  department: "Abteilung",
  start_date: "Startdatum",
  working_hours: "Arbeitszeit",
  vacation_days: "Urlaubstage",
  probation_months: "Probezeit",
  email: "E-Mail",
  phone: "Telefon",
  street: "Straße",
  postal_code: "PLZ",
  city: "Ort",
};

// =============================================================================
// Component
// =============================================================================

export function SmartChatInput({
  onCreateDocument,
  onUpdateField,
  onSearchClause,
  currentContext,
  placeholder = "z.B. 'Erstelle einen Arbeitsvertrag für Max Müller, 5000€ Gehalt'",
  showSuggestions = true,
  className,
  mistralApiKey,
}: SmartChatInputProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<MistralResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Configure Mistral if API key provided
  useEffect(() => {
    if (mistralApiKey) {
      configureMistral(mistralApiKey, "mistral-small-latest");
    }
  }, [mistralApiKey]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Process the smart chat response
  const processActions = useCallback(
    (response: MistralResponse) => {
      for (const action of response.suggestedActions) {
        switch (action.action) {
          case "create_draft":
            if (action.documentType && onCreateDocument) {
              onCreateDocument(action.documentType, action.initialData || {});
            }
            break;
          case "update_field":
            if (action.field && action.value !== undefined && onUpdateField) {
              onUpdateField(action.field, action.value);
            }
            break;
          case "search_clause":
            if (action.query && onSearchClause) {
              onSearchClause(action.query);
            }
            break;
        }
      }
    },
    [onCreateDocument, onUpdateField, onSearchClause]
  );

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Nutze lokale Engine + Mistral Fallback
      const response = await processSmartMessage(input.trim(), currentContext);

      setLastResponse(response);

      // Auto-process high-confidence actions
      if (
        response.intent.confidence >= 0.7 &&
        response.intent.intentType !== "unknown" &&
        response.suggestedActions.length > 0
      ) {
        processActions(response);
      }

      setInput("");
    } catch (err) {
      console.error("Smart chat error:", err);
      setError("Verarbeitung fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setIsLoading(false);
    }
  }, [input, currentContext, isLoading, processActions]);

  // Handle quick action click
  const handleQuickAction = useCallback((prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  }, []);

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Execute pending actions from response
  const handleExecuteActions = useCallback(() => {
    if (lastResponse) {
      processActions(lastResponse);
      setLastResponse(null);
    }
  }, [lastResponse, processActions]);

  // Format field value for display
  const formatFieldValue = (key: string, value: unknown): string => {
    if (key === "salary" && typeof value === "number") {
      return `${value.toLocaleString("de-DE")} €`;
    }
    if (key === "working_hours" && typeof value === "number") {
      return `${value} Std/Woche`;
    }
    if (key === "vacation_days" && typeof value === "number") {
      return `${value} Tage`;
    }
    if (key === "probation_months" && typeof value === "number") {
      return `${value} Monate`;
    }
    return String(value);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Sparkles className="h-5 w-5 text-primary/60" />
        </div>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className="pl-10 pr-12 h-12 text-base"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Quick Actions */}
      {showSuggestions && !lastResponse && !input && (
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.prompt)}
              className="gap-1.5 text-xs"
              data-suggestion="true"
            >
              <action.icon className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Response Display */}
      {lastResponse && (
        <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
          {/* Header: Intent + Provider Badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {/* Intent Badge */}
              <Badge
                variant={
                  lastResponse.intent.confidence >= 0.7 ? "default" : "secondary"
                }
                className="gap-1"
              >
                <Zap className="h-3 w-3" />
                {lastResponse.intent.intentType === "create_document"
                  ? "Dokument erstellen"
                  : lastResponse.intent.intentType === "fill_field"
                  ? "Felder ausfüllen"
                  : lastResponse.intent.intentType === "search"
                  ? "Suchen"
                  : "Verarbeitet"}
              </Badge>

              {/* Document Type Badge */}
              {lastResponse.intent.documentType && (
                <Badge variant="outline">
                  {lastResponse.intent.documentType}
                </Badge>
              )}
            </div>

            {/* Provider + Confidence */}
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {lastResponse.provider === "local" ? (
                        <>
                          <Shield className="h-3 w-3 text-green-600" />
                          <span className="text-green-600">Lokal</span>
                        </>
                      ) : (
                        <>
                          <Globe className="h-3 w-3 text-blue-600" />
                          <span className="text-blue-600">EU</span>
                        </>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {lastResponse.provider === "local" ? (
                      <p>
                        🔒 <strong>100% lokal verarbeitet</strong>
                        <br />
                        Ihre Daten haben den Browser nie verlassen.
                      </p>
                    ) : (
                      <p>
                        🇪🇺 <strong>EU-hosted (Mistral AI, Frankreich)</strong>
                        <br />
                        DSGVO-konforme Verarbeitung in der EU.
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <span className="text-xs text-muted-foreground">
                {Math.round(lastResponse.intent.confidence * 100)}% sicher
              </span>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm">{lastResponse.message}</p>

          {/* Extracted Data Preview */}
          {Object.keys(lastResponse.intent.extractedData).length > 0 && (
            <div className="text-xs space-y-1">
              <p className="font-medium text-muted-foreground">
                Erkannte Daten:
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(lastResponse.intent.extractedData).map(
                  ([key, value]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {FIELD_LABELS[key] || key}:{" "}
                      {formatFieldValue(key, value)}
                    </Badge>
                  )
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {lastResponse.suggestedActions.length > 0 && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleExecuteActions}
                className="gap-1"
              >
                <ArrowRight className="h-4 w-4" />
                Ausführen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setLastResponse(null)}
              >
                Abbrechen
              </Button>
            </div>
          )}

          {/* Processing Time (Debug) */}
          {lastResponse.processingTime && (
            <p className="text-[10px] text-muted-foreground/50">
              Verarbeitet in {Math.round(lastResponse.processingTime)}ms
            </p>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}

export default SmartChatInput;
