/**
 * AgentChat — Claude-powered document creation chat with tool-use visualization.
 *
 * Connects to POST /api/v1/agent/chat via SSE.
 * Renders tool actions (form_update, clause_update, clause_draft) inline.
 * Supports multi-turn conversation via session_id.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { apiStreamSSE, type SSEEvent } from "@/lib/api-stream";
import { sanitizeHtml } from "@/utils/sanitize";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Send,
  Sparkles,
  Square,
  Settings2,
  FileSearch,
  FilePlus,
  CheckCircle2,
  AlertCircle,
  Shield,
  User,
  Bot,
  RefreshCw,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

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
  /** Called when agent sets form fields */
  onFormUpdate?: (fields: Record<string, string>) => void;
  /** Called when agent enables/disables clauses */
  onClauseUpdate?: (enable: number[], disable: number[]) => void;
  /** Called when agent creates a clause draft for confirmation */
  onClauseDraft?: (title: string, html: string) => void;
  /** Called with session_id after first response */
  onSessionCreated?: (sessionId: string) => void;
}

// ── Tool display helpers ─────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────

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
  const inputRef = useRef<HTMLInputElement>(null);

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

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setError(null);
    const userMsg: ChatMessage = { role: "user", content: text };
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
        // Text streaming
        if (event.type === "text_delta" && event.content) {
          fullText += event.content;
          updateLastMessage();
        }

        // Tool actions
        if (event.type === "tool_start") {
          toolActions.push({ type: "tool_start", tool: event.tool, args: event.args as Record<string, unknown> });
          updateLastMessage();
        }

        if (event.type === "tool_result") {
          toolActions.push({ type: "tool_result", tool: event.tool, result: event.result as Record<string, unknown> });
          updateLastMessage();
        }

        // Semantic events
        if (event.type === "form_update" && event.fields) {
          toolActions.push({ type: "form_update", fields: event.fields as Record<string, string> });
          onFormUpdate?.(event.fields as Record<string, string>);
          updateLastMessage();
        }

        if (event.type === "clause_update") {
          toolActions.push({
            type: "clause_update",
            enable: event.enable as number[],
            disable: event.disable as number[],
          });
          onClauseUpdate?.(event.enable as number[] ?? [], event.disable as number[] ?? []);
          updateLastMessage();
        }

        if (event.type === "clause_draft") {
          toolActions.push({
            type: "clause_draft",
            title: event.title,
            html: event.html,
            requires_confirmation: event.requires_confirmation,
          });
          onClauseDraft?.(event.title ?? "", event.html ?? "");
          updateLastMessage();
        }

        // Done
        if (event.type === "done") {
          const sid = (event as SSEEvent & { session_id?: string }).session_id;
          if (sid) {
            setSessionId(sid);
            onSessionCreated?.(sid);
          }
        }

        // Error
        if (event.type === "error") {
          setError(event.content || (event as any).message || "Unbekannter Fehler");
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
      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="p-4 bg-primary/10 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">KI-Dokumentassistent</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Beschreiben Sie, welches Dokument Sie benötigen. Der Assistent füllt Formulare aus,
              wählt passende Textbausteine und erstellt Ihr Dokument.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[
                "Erstelle einen Arbeitsvertrag für Max Müller",
                "Ich brauche eine Kündigung",
                "Abmahnung wegen Unpünktlichkeit",
              ].map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="text-xs px-3 py-1.5 rounded-full bg-warm-100 text-muted-foreground hover:bg-warm-200 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "order-first" : ""}`}>
              {/* Tool Actions */}
              {msg.toolActions && msg.toolActions.length > 0 && (
                <div className="space-y-1.5">
                  {msg.toolActions.map((action, j) => (
                    <ToolActionCard key={j} action={action} />
                  ))}
                </div>
              )}

              {/* Text Content */}
              {msg.content && (
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-md"
                      : "bg-warm-100 text-foreground rounded-tl-md"
                  }`}
                >
                  {msg.content}
                  {isStreaming && i === messages.length - 1 && msg.role === "assistant" && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse rounded-sm" />
                  )}
                </div>
              )}

              {/* Streaming indicator without text yet */}
              {!msg.content && isStreaming && i === messages.length - 1 && msg.role === "assistant" && msg.toolActions?.length === 0 && (
                <div className="px-4 py-2.5 rounded-2xl bg-warm-100 rounded-tl-md">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-warm-200 flex items-center justify-center mt-1">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div ref={scrollRef} />
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-warm-200 px-4 py-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Beschreiben Sie Ihr Dokument..."
            disabled={isStreaming}
            className="flex-1"
          />
          {isStreaming ? (
            <Button variant="outline" size="icon" onClick={stopStreaming}>
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={sendMessage} disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          )}
          {messages.length > 0 && !isStreaming && (
            <Button variant="ghost" size="icon" onClick={handleReset} title="Neues Gespräch">
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tool Action Card ─────────────────────────────────────────────────

function ToolActionCard({ action }: { action: ToolAction }) {
  if (action.type === "tool_start") {
    const label = TOOL_LABELS[action.tool ?? ""] ?? action.tool;
    const Icon = TOOL_ICONS[action.tool ?? ""] ?? Settings2;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warm-50 border border-warm-200 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        <Loader2 className="w-3 h-3 animate-spin ml-auto" />
      </div>
    );
  }

  if (action.type === "tool_result") {
    const label = TOOL_LABELS[action.tool ?? ""] ?? action.tool;
    const isOk = action.result?.status === "ok" || action.result?.status === "requires_confirmation";
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
        isOk ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
      }`}>
        {isOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
        <span>{label}</span>
        {action.result?.count !== undefined && (
          <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
            {String(action.result.count)} Ergebnisse
          </Badge>
        )}
      </div>
    );
  }

  if (action.type === "form_update" && action.fields) {
    const fieldCount = Object.keys(action.fields).length;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
        <Settings2 className="w-3.5 h-3.5" />
        <span>{fieldCount} {fieldCount === 1 ? "Feld" : "Felder"} gesetzt</span>
        <div className="ml-auto flex gap-1">
          {Object.keys(action.fields).slice(0, 3).map(key => (
            <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300">
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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {enableCount > 0 && <span>{enableCount} aktiviert</span>}
        {enableCount > 0 && disableCount > 0 && <span>·</span>}
        {disableCount > 0 && <span>{disableCount} deaktiviert</span>}
      </div>
    );
  }

  if (action.type === "clause_draft") {
    return (
      <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs">
        <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
          <FilePlus className="w-3.5 h-3.5" />
          Klausel-Entwurf: {action.title}
        </div>
        <div
          className="text-muted-foreground line-clamp-2 text-[11px]"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.html ?? "") }}
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
