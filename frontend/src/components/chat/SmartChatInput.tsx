/**
 * SmartChatInput - Natural language document creation input
 *
 * Features:
 * - Single input that understands natural language
 * - Extracts intents: create document, fill fields, add clauses
 * - Direct integration with document generator
 * - Privacy-first: Uses Mistral (EU) or Ollama (local)
 *
 * Examples:
 * - "Erstelle einen Arbeitsvertrag für Max Müller"
 * - "Der Mitarbeiter verdient 5000€ pro Monat"
 * - "Füge eine Homeoffice-Klausel hinzu"
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, ArrowRight, Zap, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

// Types
interface DocumentIntent {
  intent_type: string;
  document_type: string | null;
  extracted_data: Record<string, unknown>;
  confidence: number;
}

interface SuggestedAction {
  action: string;
  document_type?: string;
  initial_data?: Record<string, unknown>;
  field?: string;
  value?: unknown;
  query?: string;
}

interface SmartChatResponse {
  message: string;
  intent: DocumentIntent | null;
  suggested_actions: SuggestedAction[];
  provider: string;
}

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
}

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

export function SmartChatInput({
  onCreateDocument,
  onUpdateField,
  onSearchClause,
  currentContext,
  placeholder = "Beschreibe, was du erstellen möchtest...",
  showSuggestions = true,
  className,
}: SmartChatInputProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<SmartChatResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Process the smart chat response
  const processActions = useCallback(
    (response: SmartChatResponse) => {
      for (const action of response.suggested_actions) {
        switch (action.action) {
          case "create_draft":
            if (action.document_type && onCreateDocument) {
              onCreateDocument(
                action.document_type,
                action.initial_data || {}
              );
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

  // Send message to smart chat endpoint
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<SmartChatResponse>("/api/v1/chat/smart", {
        message: input.trim(),
        current_context: currentContext,
        country_code: "DE",
      });

      setLastResponse(response.data);

      // Auto-process high-confidence actions
      if (
        response.data.intent &&
        response.data.intent.confidence >= 0.7 &&
        response.data.suggested_actions.length > 0
      ) {
        processActions(response.data);
      }

      setInput("");
    } catch (err) {
      console.error("Smart chat error:", err);
      setError("Verbindung zum Assistenten fehlgeschlagen");
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
          {/* Intent Badge */}
          {lastResponse.intent && (
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  lastResponse.intent.confidence >= 0.7 ? "default" : "secondary"
                }
                className="gap-1"
              >
                <Zap className="h-3 w-3" />
                {lastResponse.intent.intent_type === "create_document"
                  ? "Dokument erstellen"
                  : lastResponse.intent.intent_type === "fill_field"
                  ? "Felder ausfüllen"
                  : lastResponse.intent.intent_type === "add_clause"
                  ? "Klausel hinzufügen"
                  : "Verarbeitet"}
              </Badge>
              {lastResponse.intent.document_type && (
                <Badge variant="outline">{lastResponse.intent.document_type}</Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {Math.round(lastResponse.intent.confidence * 100)}% sicher
              </span>
            </div>
          )}

          {/* Message */}
          <p className="text-sm">{lastResponse.message}</p>

          {/* Extracted Data Preview */}
          {lastResponse.intent &&
            Object.keys(lastResponse.intent.extracted_data).length > 0 && (
              <div className="text-xs space-y-1">
                <p className="font-medium text-muted-foreground">
                  Erkannte Daten:
                </p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(lastResponse.intent.extracted_data).map(
                    ([key, value]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}: {String(value)}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            )}

          {/* Actions */}
          {lastResponse.suggested_actions.length > 0 && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleExecuteActions} className="gap-1">
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

          {/* Provider Info */}
          <p className="text-xs text-muted-foreground">
            {lastResponse.provider === "ollama"
              ? "🔒 Lokal verarbeitet (Ollama)"
              : lastResponse.provider === "mistral"
              ? "🇪🇺 EU-hosted (Mistral AI)"
              : `Verarbeitet mit ${lastResponse.provider}`}
          </p>
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
