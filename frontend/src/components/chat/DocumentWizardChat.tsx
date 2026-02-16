/**
 * DocumentWizardChat - KI-geführte Dokumenterstellung im Chat-Format
 *
 * Ersetzt die SmartChatInput-Komponente auf dem Dashboard und bietet
 * einen geführten Dialog zur Erstellung rechtssicherer HR-Dokumente.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Send,
    Square,
    Sparkles,
    FileText,
    ArrowRight,
    RotateCcw,
    MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiStreamSSE } from "@/lib/api-stream";
import { useCountry } from "@/hooks/useCountry";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface WizardState {
    extractedData: Record<string, unknown>;
    suggestedDocumentTypeId: number | null;
    suggestedDocumentTypeName: string | null;
    isComplete: boolean;
}

interface DocumentWizardChatProps {
    /** Compact mode for embedding in cards */
    compact?: boolean;
    /** Callback when document creation is triggered */
    onCreateDocument?: (typeId: string, formData: Record<string, unknown>) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLE PROMPTS
// ══════════════════════════════════════════════════════════════════════════════

const EXAMPLE_PROMPTS = [
    { label: "Abmahnung", text: "Ich muss eine Abmahnung erstellen" },
    { label: "Arbeitsvertrag", text: "Ich brauche einen neuen Arbeitsvertrag" },
    { label: "Kündigung", text: "Ich muss eine Kündigung vorbereiten" },
    { label: "Zeugnis", text: "Ich brauche ein Arbeitszeugnis" },
];

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function DocumentWizardChat({ compact, onCreateDocument }: DocumentWizardChatProps) {
    const navigate = useNavigate();
    const { country } = useCountry();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [wizardState, setWizardState] = useState<WizardState>({
        extractedData: {},
        suggestedDocumentTypeId: null,
        suggestedDocumentTypeName: null,
        isComplete: false,
    });

    const abortControllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Cleanup abort controller
    useEffect(() => {
        return () => { abortControllerRef.current?.abort(); };
    }, []);

    const handleCreateDocument = useCallback(() => {
        const typeId = wizardState.suggestedDocumentTypeId;
        if (!typeId) return;

        if (onCreateDocument) {
            onCreateDocument(String(typeId), wizardState.extractedData as Record<string, unknown>);
        } else {
            const params = new URLSearchParams();
            params.set("type", String(typeId));
            if (Object.keys(wizardState.extractedData).length > 0) {
                params.set("data", JSON.stringify(wizardState.extractedData));
            }
            navigate(`/generate?${params.toString()}`);
        }
    }, [wizardState, navigate, onCreateDocument]);

    const sendMessage = useCallback(async (text?: string) => {
        const messageText = text || input.trim();
        if (!messageText || isLoading) return;

        setInput("");
        const userMessage: Message = { role: "user", content: messageText };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setIsLoading(true);

        // Setup abort controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Add empty assistant placeholder
        setMessages(prev => [...prev, { role: "assistant", content: "" }]);
        setIsStreaming(true);

        try {
            let fullText = "";

            for await (const event of apiStreamSSE(
                "/api/v1/smart/wizard/stream",
                {
                    messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
                    country_code: country,
                    document_type_id: wizardState.suggestedDocumentTypeId,
                    form_data: Object.keys(wizardState.extractedData).length > 0 ? wizardState.extractedData : undefined,
                },
                controller.signal,
            )) {
                if (event.token) {
                    fullText += event.token;
                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: "assistant", content: fullText };
                        return updated;
                    });
                }
                if (event.error) throw new Error(event.error);
                if ((event as any).done) {
                    // Extract structured data from done event
                    const doneEvent = event as any;
                    const displayMessage = doneEvent.message || fullText;

                    // Update the final message with parsed content
                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: "assistant", content: displayMessage };
                        return updated;
                    });

                    // Update wizard state
                    setWizardState(prev => ({
                        extractedData: {
                            ...prev.extractedData,
                            ...(doneEvent.extracted_data || {}),
                        },
                        suggestedDocumentTypeId: doneEvent.suggested_document_type_id ?? prev.suggestedDocumentTypeId,
                        suggestedDocumentTypeName: doneEvent.suggested_document_type_name ?? prev.suggestedDocumentTypeName,
                        isComplete: doneEvent.is_complete ?? prev.isComplete,
                    }));
                    break;
                }
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
            // Fallback to blocking endpoint
            try {
                const { apiFetch } = await import("@/lib/api-client");
                const response = await apiFetch("/api/v1/smart/wizard", {
                    method: "POST",
                    body: JSON.stringify({
                        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
                        country_code: country,
                        document_type_id: wizardState.suggestedDocumentTypeId,
                        form_data: Object.keys(wizardState.extractedData).length > 0 ? wizardState.extractedData : undefined,
                    }),
                });
                const data = await response.json();
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: data.message };
                    return updated;
                });
                setWizardState(prev => ({
                    extractedData: { ...prev.extractedData, ...(data.extracted_data || {}) },
                    suggestedDocumentTypeId: data.suggested_document_type_id ?? prev.suggestedDocumentTypeId,
                    suggestedDocumentTypeName: data.suggested_document_type_name ?? prev.suggestedDocumentTypeName,
                    isComplete: data.is_complete ?? prev.isComplete,
                }));
            } catch {
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: "assistant",
                        content: "Entschuldigung, der KI-Service ist momentan nicht verfügbar. Bitte versuchen Sie es später erneut.",
                    };
                    return updated;
                });
            }
        } finally {
            setIsStreaming(false);
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [input, messages, isLoading, country, wizardState]);

    const stopStreaming = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsStreaming(false);
        setIsLoading(false);
    }, []);

    const resetChat = useCallback(() => {
        setMessages([]);
        setWizardState({
            extractedData: {},
            suggestedDocumentTypeId: null,
            suggestedDocumentTypeName: null,
            isComplete: false,
        });
        setInput("");
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const hasMessages = messages.length > 0;

    return (
        <div className="space-y-4">
            {/* Chat Messages */}
            {hasMessages && (
                <div className={cn(
                    "space-y-3 overflow-y-auto",
                    compact ? "max-h-[250px]" : "max-h-[350px]"
                )}>
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                "flex gap-3",
                                msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {msg.role === "assistant" && (
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "rounded-xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%]",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/60 text-foreground"
                                )}
                            >
                                {msg.content || (
                                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse delay-150" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse delay-300" />
                                    </span>
                                )}
                                {isStreaming && msg.role === "assistant" && i === messages.length - 1 && msg.content && (
                                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse" />
                                )}
                            </div>
                            {msg.role === "user" && (
                                <div className="w-7 h-7 rounded-full bg-warm-200 flex items-center justify-center shrink-0 mt-0.5">
                                    <MessageSquare className="w-3.5 h-3.5 text-warm-600" />
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            )}

            {/* Document Type Badge + Create Button */}
            {wizardState.suggestedDocumentTypeName && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="gap-1.5 py-1 px-3">
                        <FileText className="w-3.5 h-3.5" />
                        {wizardState.suggestedDocumentTypeName}
                    </Badge>
                    {Object.keys(wizardState.extractedData).length > 0 && (
                        <span className="text-xs text-muted-foreground">
                            {Object.keys(wizardState.extractedData).length} Felder erfasst
                        </span>
                    )}
                    {wizardState.isComplete && (
                        <Button
                            size="sm"
                            onClick={handleCreateDocument}
                            className="ml-auto gap-1.5"
                        >
                            Dokument erstellen
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            )}

            {/* Example Prompts (only when no messages) */}
            {!hasMessages && (
                <div className="flex flex-wrap gap-2">
                    {EXAMPLE_PROMPTS.map((prompt) => (
                        <button
                            key={prompt.label}
                            type="button"
                            onClick={() => sendMessage(prompt.text)}
                            disabled={isLoading}
                            className="px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-background hover:bg-primary/5 hover:border-primary/30 transition-colors disabled:opacity-50"
                        >
                            {prompt.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={hasMessages ? "Antwort eingeben..." : "Beschreiben Sie, welches Dokument Sie benötigen..."}
                        disabled={isLoading}
                        rows={1}
                        className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 placeholder:text-muted-foreground/60"
                        style={{ minHeight: "44px", maxHeight: "120px" }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = "auto";
                            target.style.height = Math.min(target.scrollHeight, 120) + "px";
                        }}
                    />
                </div>

                <div className="flex gap-1.5 shrink-0">
                    {isStreaming ? (
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={stopStreaming}
                            className="h-[44px] w-[44px] rounded-xl"
                        >
                            <Square className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            size="icon"
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            className="h-[44px] w-[44px] rounded-xl"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    )}
                    {hasMessages && !isStreaming && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={resetChat}
                            className="h-[44px] w-[44px] rounded-xl text-muted-foreground"
                            title="Neuer Chat"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DocumentWizardChat;
