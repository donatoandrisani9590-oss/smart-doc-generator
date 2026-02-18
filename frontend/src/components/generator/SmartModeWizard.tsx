/**
 * SmartModeWizard - Conversational document creation
 *
 * Features:
 * - Chat-like interface for filling form fields
 * - One question at a time (less overwhelming)
 * - Progress indicator
 * - Auto-suggestions and hints
 * - Quick completion with Enter key
 *
 * Privacy: Uses Groq (free), Mistral (EU) or Ollama (local)
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  ArrowRight,
  Check,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

// Quick-answer button configs for common fields (Lueckenschliesser UX)
// Instead of free text, show clickable buttons for fields with typical values.
const QUICK_ANSWERS: Record<string, { label: string; value: string }[]> = {
  probezeit: [
    { label: "Standard (6 Monate)", value: "6 Monate" },
    { label: "3 Monate", value: "3 Monate" },
    { label: "Keine", value: "Keine" },
  ],
  urlaubstage: [
    { label: "30 Tage", value: "30" },
    { label: "28 Tage", value: "28" },
    { label: "Gesetzlich (20)", value: "20" },
  ],
  wochenstunden: [
    { label: "Vollzeit (40h)", value: "40" },
    { label: "Teilzeit (20h)", value: "20" },
    { label: "Teilzeit (30h)", value: "30" },
  ],
  kuendigungsfrist: [
    { label: "Gesetzlich", value: "Gesetzlich" },
    { label: "4 Wochen", value: "4 Wochen zum Monatsende" },
    { label: "3 Monate", value: "3 Monate zum Quartalsende" },
  ],
  befristung: [
    { label: "Unbefristet", value: "Unbefristet" },
    { label: "1 Jahr", value: "12 Monate" },
    { label: "2 Jahre", value: "24 Monate" },
  ],
  arbeitszeitmodell: [
    { label: "Vollzeit", value: "Vollzeit" },
    { label: "Teilzeit", value: "Teilzeit" },
    { label: "Gleitzeit", value: "Gleitzeit" },
  ],
};

// Types
interface SmartField {
  name: string;
  label: string;
  field_type: string;
  required: boolean;
  placeholder: string;
  hint: string;
  options: string[];
  default_value: string | null;
  order: number;
}

interface SmartModeConfig {
  document_type_id: number;
  document_type_name: string;
  priority_fields: SmartField[];
  optional_fields: SmartField[];
  suggested_title: string;
  estimated_time: string;
}

interface ConversationMessage {
  type: "question" | "answer" | "system";
  content: string;
  field?: string;
}

interface SmartModeWizardProps {
  /** Document type ID to create */
  documentTypeId: number;
  /** Initial data (from chat extraction) */
  initialData?: Record<string, unknown>;
  /** Callback when wizard is complete */
  onComplete: (formData: Record<string, unknown>, title: string) => void;
  /** Callback to cancel */
  onCancel?: () => void;
  /** Custom class name */
  className?: string;
}

export function SmartModeWizard({
  documentTypeId,
  initialData = {},
  onComplete,
  onCancel,
  className,
}: SmartModeWizardProps) {
  // State
  const [config, setConfig] = useState<SmartModeConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get current field
  const allFields = useMemo(
    () => config ? [...config.priority_fields, ...config.optional_fields] : [],
    [config]
  );
  const currentField = allFields[currentFieldIndex];
  const isComplete = currentFieldIndex >= allFields.length;
  const progress = allFields.length > 0
    ? Math.round((currentFieldIndex / allFields.length) * 100)
    : 0;

  // Stable reference for initialData to prevent infinite re-renders
  const initialDataRef = useRef(initialData);

  // Initialize smart mode
  useEffect(() => {
    let cancelled = false;

    const initSmartMode = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.post<{
          config: SmartModeConfig;
          first_question: string;
          prefilled_data: Record<string, unknown>;
        }>("/api/v1/smart-mode/start", {
          document_type_id: documentTypeId,
          initial_context: initialDataRef.current,
        });

        if (cancelled) return;

        setConfig(response.data.config);
        setFormData(response.data.prefilled_data);

        // Add welcome message
        setConversation([
          {
            type: "system",
            content: `Willkommen! Ich helfe dir beim Erstellen eines "${response.data.config.document_type_name}". Das dauert etwa ${response.data.config.estimated_time}.`,
          },
        ]);

        // Skip pre-filled fields
        const fields = [
          ...response.data.config.priority_fields,
          ...response.data.config.optional_fields,
        ];
        let startIndex = 0;
        for (let i = 0; i < fields.length; i++) {
          if (response.data.prefilled_data[fields[i].name]) {
            startIndex = i + 1;
          } else {
            break;
          }
        }
        setCurrentFieldIndex(startIndex);

        // Add first question
        if (startIndex < fields.length) {
          setTimeout(() => {
            if (!cancelled) addQuestion(fields[startIndex]);
          }, 500);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        console.error("Smart mode init failed:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes("No LLM provider") || errorMsg.includes("fetch")) {
          setError("Kein KI-Service verfügbar. Bitte konfigurieren Sie einen LLM-Provider (Groq, Mistral oder Ollama) in den Umgebungsvariablen.");
        } else {
          setError(`Smart Mode konnte nicht gestartet werden: ${errorMsg}`);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initSmartMode();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time initialization; addQuestion is stable
  }, [documentTypeId]);

  // Scroll to bottom when conversation changes
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversation]);

  // Focus input when question appears
  useEffect(() => {
    if (currentField && !isComplete) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentFieldIndex, isComplete, currentField]);

  // Add question to conversation
  const addQuestion = useCallback((field: SmartField) => {
    let question = `${field.label}?`;
    if (field.hint) {
      question += ` (${field.hint})`;
    }

    setConversation((prev) => [
      ...prev,
      { type: "question", content: question, field: field.name },
    ]);

    // Set default value if available
    if (field.default_value) {
      setInputValue(field.default_value);
    }
  }, []);

  // Handle answer submission
  const handleSubmit = useCallback(async () => {
    if (!currentField || !inputValue.trim() || isSending) return;

    setIsSending(true);

    // Add answer to conversation
    setConversation((prev) => [
      ...prev,
      { type: "answer", content: inputValue, field: currentField.name },
    ]);

    // Update form data
    const newFormData = { ...formData, [currentField.name]: inputValue };
    setFormData(newFormData);
    setInputValue("");

    // Move to next field
    const nextIndex = currentFieldIndex + 1;
    setCurrentFieldIndex(nextIndex);

    // Add next question or complete
    setTimeout(() => {
      if (nextIndex < allFields.length) {
        addQuestion(allFields[nextIndex]);
      } else {
        // Completion message
        setConversation((prev) => [
          ...prev,
          {
            type: "system",
            content: "Perfekt! Alle Angaben sind vollständig. Klicken Sie auf 'Dokument erstellen' um fortzufahren.",
          },
        ]);
      }
      setIsSending(false);
    }, 300);
  }, [currentField, inputValue, formData, currentFieldIndex, allFields, addQuestion, isSending]);

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

  // Handle completion
  const handleComplete = useCallback(() => {
    if (!config) return;

    // Generate title
    const nameParts = [];
    if (formData.vorname) nameParts.push(String(formData.vorname));
    if (formData.nachname) nameParts.push(String(formData.nachname));
    const title = nameParts.length > 0
      ? `${config.document_type_name} - ${nameParts.join(" ")}`
      : config.suggested_title;

    onComplete(formData, title);
  }, [config, formData, onComplete]);

  // Handle quick-answer button click
  const handleQuickAnswer = useCallback((value: string) => {
    if (!currentField || isSending) return;
    setInputValue(value);
    // Auto-submit after setting value
    setIsSending(true);
    setConversation((prev) => [
      ...prev,
      { type: "answer", content: value, field: currentField.name },
    ]);
    const newFormData = { ...formData, [currentField.name]: value };
    setFormData(newFormData);
    setInputValue("");
    const nextIndex = currentFieldIndex + 1;
    setCurrentFieldIndex(nextIndex);
    setTimeout(() => {
      if (nextIndex < allFields.length) {
        addQuestion(allFields[nextIndex]);
      } else {
        setConversation((prev) => [
          ...prev,
          {
            type: "system",
            content: "Perfekt! Alle Angaben sind vollständig. Klicken Sie auf 'Dokument erstellen' um fortzufahren.",
          },
        ]);
      }
      setIsSending(false);
    }, 300);
  }, [currentField, formData, currentFieldIndex, allFields, addQuestion, isSending]);

  // Get quick answers for current field
  const currentQuickAnswers = currentField
    ? QUICK_ANSWERS[currentField.name] || []
    : [];

  // Skip optional field
  const handleSkip = useCallback(() => {
    if (!currentField) return;

    // Move to next field
    const nextIndex = currentFieldIndex + 1;
    setCurrentFieldIndex(nextIndex);
    setInputValue("");

    setTimeout(() => {
      if (nextIndex < allFields.length) {
        addQuestion(allFields[nextIndex]);
      } else {
        setConversation((prev) => [
          ...prev,
          {
            type: "system",
            content: "Perfekt! Alle Angaben sind vollständig.",
          },
        ]);
      }
    }, 200);
  }, [currentField, currentFieldIndex, allFields, addQuestion]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Smart Mode wird geladen...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("text-center space-y-6 py-8 px-4", className)}>
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-destructive" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Smart Mode nicht verfügbar</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{error}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onCancel}>
            Manuell erstellen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full max-h-[600px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wand2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{config?.document_type_name}</h3>
            <p className="text-xs text-muted-foreground">Smart Mode</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="w-3 h-3" />
          {progress}% fertig
        </Badge>
      </div>

      {/* Progress Bar */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30"
      >
        {conversation.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] p-3 rounded-2xl",
              msg.type === "question" && "bg-background border mr-auto",
              msg.type === "answer" && "bg-primary text-primary-foreground ml-auto",
              msg.type === "system" &&
                "bg-muted text-muted-foreground text-sm mx-auto text-center max-w-full rounded-lg"
            )}
          >
            {msg.content}
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Verarbeite...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      {!isComplete && currentField && (
        <div className="p-4 border-t bg-background space-y-3">
          {/* Field-specific input */}
          {currentField.field_type === "select" &&
          currentField.options.length > 0 ? (
            <Select
              value={inputValue}
              onValueChange={(value) => {
                setInputValue(value);
                // Auto-submit on select
                setTimeout(() => {
                  setConversation((prev) => [
                    ...prev,
                    { type: "answer", content: value, field: currentField.name },
                  ]);
                  setFormData((prev) => ({ ...prev, [currentField.name]: value }));
                  setInputValue("");
                  const nextIndex = currentFieldIndex + 1;
                  setCurrentFieldIndex(nextIndex);
                  if (nextIndex < allFields.length) {
                    setTimeout(() => addQuestion(allFields[nextIndex]), 300);
                  }
                }, 100);
              }}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder={`${currentField.label} wählen...`} />
              </SelectTrigger>
              <SelectContent>
                {currentField.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentField.placeholder ||
                  `${currentField.label} eingeben...`
                }
                type={currentField.field_type === "number" ? "number" :
                      currentField.field_type === "date" ? "date" : "text"}
                className="h-12 text-base"
                disabled={isSending}
              />
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isSending}
                className="h-12 w-12"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          )}

          {/* Quick-answer buttons (Lueckenschliesser) */}
          {currentQuickAnswers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentQuickAnswers.map((qa) => (
                <Button
                  key={qa.value}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAnswer(qa.value)}
                  disabled={isSending}
                  className="h-8 text-xs hover:bg-primary/5 hover:border-primary/30"
                >
                  {qa.label}
                </Button>
              ))}
            </div>
          )}

          {/* Skip button for optional fields */}
          {!currentField.required && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="w-full text-muted-foreground"
            >
              Überspringen <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      )}

      {/* Complete Button */}
      {isComplete && (
        <div className="p-4 border-t bg-background">
          <Button onClick={handleComplete} className="w-full h-12 gap-2">
            <Check className="w-5 h-5" />
            Dokument erstellen
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default SmartModeWizard;
