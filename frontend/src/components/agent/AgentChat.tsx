/**
 * AgentChat — Claude-powered document creation chat (ChatGPT-inspired design).
 *
 * Connects to POST /api/v1/agent/chat via SSE.
 * Renders tool actions inline with clean visual hierarchy.
 * Centered layout with max-width constraint.
 *
 * Security: All HTML content is sanitized via sanitizeHtml() before rendering.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { apiStreamSSE, type SSEEvent } from "@/lib/api-stream";
import { sanitizeHtml } from "@/utils/sanitize";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Sparkles,
  Square,
  Settings2,
  FileSearch,
  FilePlus,
  CheckCircle2,
  AlertCircle,
  Shield,
  User,
  RefreshCw,
  ArrowUp,
  FileText,
  Briefcase,
  AlertTriangle,
} from "lucide-react";

// Types
interface ToolAction {
  type: "tool_start" | "tool_result" | "form_update" | "clause_update" | "clause_draft";
  tool?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  fields?: Record<string, string>;
  enable?: number[];
  disable?: number[];
  title?: string;
  html?: string;
  requires_confirmation?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolActions?: ToolAction[];
}

interface AgentChatProps {
  countryCode?: string;
  teamId?: number | null;
  documentTypeId?: number | null;
  formData?: Record<string, unknown>;
  onFormUpdate?: (fields: Record<string, string>) => void;
  onClauseUpdate?: (enable: number[], disable: number[]) => void;
  onClauseDraft?: (title: string, html: string) => void;
  onSessionCreated?: (sessionId: string) => void;
}

// Tool display configuration
const TOOL_LABELS: Record<string, string> = {
  fill_form_fields: "Formular ausfüllen",
  select_clauses: "Textbausteine wählen",
  search_clauses: "Textbausteine suchen",
  create_clause_draft: "Klausel-Entwurf",
  search_employee_history: "Mitarbeiter-Historie",
  run_compliance_check: "Compliance-Check",
  generate_text: "Text generieren",
  get_form_field_definitions: "Felder laden",
};

const TOOL_ICONS: Record<string, typeof Settings2> = {
  fill_form_fields: Settings2,
  select_clauses: CheckCircle2,
  search_clauses: FileSearch,
  create_clause_draft: FilePlus,
  search_employee_history: User,
  run_compliance_check: Shield,
  generate_text: Sparkles,
  get_form_field_definitions: Settings2,
};

// Suggestion prompts
const SUGGESTIONS = [
  { text: "Erstelle einen Arbeitsvertrag für Max Müller", icon: FileText },
  { text: "Ich brauche eine Kündigung", icon: AlertTriangle },
  { text: "Abmahnung wegen Unpünktlichkeit", icon: Briefcase },
];

export function AgentChat({
  countryCode = "DE",
  teamId,
  documentTypeId,
  formData,
  onFormUpdate,
  onClauseUpdate,
  onClauseDraft,
  onSessionCreated,
}: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isStreaming) return;

    setError(null);
    const userMsg: ChatMessage = { role: "user", content: messageText };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    // Placeholder for assistant message
    setMessages(prev => [...prev, { role: "assistant", content: "", toolActions: [] }]);

    let fullText = "";
    const toolActions: ToolAction[] = [];

    const updateLastMessage = () => {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: fullText, toolActions: [...toolActions] };
        return updated;
      });
    };

    try {
      const body = {
        messages: allMessages.map(m => ({ role: m.role, content: m.content })),
        country_code: countryCode,
        team_id: teamId,
        document_type_id: documentTypeId,
        form_data: formData,
        session_id: sessionId,
      };

      for await (const event of apiStreamSSE("/api/v1/agent/chat", body, controller.signal)) {
        if (event.type === "text_delta" && event.content) {
          fullText += event.content;
          updateLastMessage();
        }
        if (event.type === "tool_start") {
          toolActions.push({ type: "tool_start", tool: event.tool, args: event.args as Record<string, unknown> });
          updateLastMessage();
        }
        if (event.type === "tool_result") {
          toolActions.push({ type: "tool_result", tool: event.tool, result: event.result as Record<string, unknown> });
          updateLastMessage();
        }
        if (event.type === "form_update" && event.fields) {
          toolActions.push({ type: "form_update", fields: event.fields as Record<string, string> });
          onFormUpdate?.(event.fields as Record<string, string>);
          updateLastMessage();
        }
        if (event.type === "clause_update") {
          toolActions.push({ type: "clause_update", enable: event.enable as number[], disable: event.disable as number[] });
          onClauseUpdate?.(event.enable as number[] ?? [], event.disable as number[] ?? []);
          updateLastMessage();
        }
        if (event.type === "clause_draft") {
          toolActions.push({ type: "clause_draft", title: event.title, html: event.html, requires_confirmation: event.requires_confirmation });
          onClauseDraft?.(event.title ?? "", event.html ?? "");
          updateLastMessage();
        }
        if (event.type === "done") {
          const sid = (event as SSEEvent & { session_id?: string }).session_id;
          if (sid) { setSessionId(sid); onSessionCreated?.(sid); }
        }
        if (event.type === "error") {
          setError(event.content || "Unbekannter Fehler");
        }
      }
      updateLastMessage();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Agent stream error:", err);
      setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      setMessages(prev => prev.filter((_, i) => i < prev.length - 1));
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [input, isStreaming, messages, countryCode, teamId, documentTypeId, formData, sessionId, onFormUpdate, onClauseUpdate, onClauseDraft, onSessionCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReset = () => {
    if (isStreaming) stopStreaming();
    setMessages([]);
    setSessionId(null);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        /* ── Empty State: vertically centered content + input as one unit ── */
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-3xl flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Wie kann ich helfen?
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-8 text-center">
              Beschreiben Sie, welches Dokument Sie benötigen. Ich fülle Formulare aus,
              wähle passende Textbausteine und erstelle Ihr Dokument.
            </p>

            {/* Suggestion Cards */}
            <div className="grid gap-2 w-full max-w-lg mb-6">
              {SUGGESTIONS.map((suggestion, i) => {
                const Icon = suggestion.icon;
                return (
                  <button
                    key={i}
                    onClick={() => sendMessage(suggestion.text)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warm-200 bg-background hover:bg-warm-50 hover:border-warm-300 transition-all text-left group"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    <span className="text-sm text-foreground">{suggestion.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Input inline unter den Suggestions */}
            <div className="w-full max-w-lg">
              <div className="relative flex items-end gap-2 rounded-2xl border border-warm-200 bg-background px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Beschreiben Sie Ihr Dokument..."
                  disabled={isStreaming}
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 max-h-[120px] py-1"
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Chat Mode: messages scrollable, input fixed at bottom ── */
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4">
              {messages.map((msg, i) => (
                <div key={i} className="py-4">
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-md bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Tool Actions */}
                      {msg.toolActions && msg.toolActions.length > 0 && (
                        <div className="space-y-1.5 pl-1">
                          {msg.toolActions.map((action, j) => (
                            <ToolActionCard key={j} action={action} />
                          ))}
                        </div>
                      )}

                      {/* Text Content — no bubble, just text (ChatGPT style) */}
                      {msg.content && (
                        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pl-1">
                          {msg.content}
                          {isStreaming && i === messages.length - 1 && (
                            <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/50 animate-pulse rounded-sm align-middle" />
                          )}
                        </div>
                      )}

                      {/* Streaming without text */}
                      {!msg.content && isStreaming && i === messages.length - 1 && msg.toolActions?.length === 0 && (
                        <div className="pl-1">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div ref={scrollRef} className="h-4" />
            </div>
          </div>

          {/* Input Area — bottom-fixed during conversation */}
          <div className="border-t border-warm-100 bg-background">
            <div className="max-w-3xl mx-auto px-4 py-3">
              <div className="relative flex items-end gap-2 rounded-2xl border border-warm-200 bg-background px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Beschreiben Sie Ihr Dokument..."
                  disabled={isStreaming}
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 max-h-[120px] py-1"
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isStreaming ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-warm-100"
                      onClick={stopStreaming}
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => sendMessage()}
                      disabled={!input.trim()}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Reset */}
              {!isStreaming && (
                <div className="flex justify-center mt-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Neues Gespräch
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Tool Action Card — sanitizeHtml() ensures all HTML content is safe before rendering
function ToolActionCard({ action }: { action: ToolAction }) {
  if (action.type === "tool_start") {
    const label = TOOL_LABELS[action.tool ?? ""] ?? action.tool;
    const Icon = TOOL_ICONS[action.tool ?? ""] ?? Settings2;
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warm-50 border border-warm-200 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        <Loader2 className="w-3 h-3 animate-spin ml-1" />
      </div>
    );
  }

  if (action.type === "tool_result") {
    const label = TOOL_LABELS[action.tool ?? ""] ?? action.tool;
    const isOk = action.result?.status === "ok" || action.result?.status === "requires_confirmation";
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
        isOk ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
      }`}>
        {isOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
        <span>{label}</span>
        {action.result?.count !== undefined && (
          <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4">
            {String(action.result.count)}
          </Badge>
        )}
      </div>
    );
  }

  if (action.type === "form_update" && action.fields) {
    const fieldCount = Object.keys(action.fields).length;
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
        <Settings2 className="w-3.5 h-3.5" />
        <span>{fieldCount} {fieldCount === 1 ? "Feld" : "Felder"} gesetzt</span>
        <div className="flex gap-1 ml-1">
          {Object.keys(action.fields).slice(0, 3).map(key => (
            <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-300">
              {key}
            </Badge>
          ))}
          {fieldCount > 3 && <span className="text-[10px]">+{fieldCount - 3}</span>}
        </div>
      </div>
    );
  }

  if (action.type === "clause_update") {
    const enableCount = action.enable?.length ?? 0;
    const disableCount = action.disable?.length ?? 0;
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {enableCount > 0 && <span>{enableCount} aktiviert</span>}
        {enableCount > 0 && disableCount > 0 && <span className="text-emerald-400">·</span>}
        {disableCount > 0 && <span>{disableCount} deaktiviert</span>}
      </div>
    );
  }

  if (action.type === "clause_draft") {
    // Content is sanitized via sanitizeHtml() before rendering
    const safeHtml = sanitizeHtml(action.html ?? "");
    return (
      <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs max-w-md">
        <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
          <FilePlus className="w-3.5 h-3.5" />
          Klausel-Entwurf: {action.title}
        </div>
        <div
          className="text-muted-foreground line-clamp-2 text-[11px]"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
        {action.requires_confirmation && (
          <Badge variant="outline" className="mt-1 text-[10px] border-amber-300 text-amber-600">
            Bestätigung erforderlich
          </Badge>
        )}
      </div>
    );
  }

  return null;
}
