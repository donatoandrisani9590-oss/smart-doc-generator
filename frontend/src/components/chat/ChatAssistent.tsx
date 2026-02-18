import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api-client";
import { apiStreamSSE, type SSEEvent } from "@/lib/api-stream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Sparkles, RefreshCw, Square, FileText, ArrowRight } from "lucide-react";
import { OnboardingResultCard } from "./OnboardingResultCard";

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

interface ChatAssistentProps {
    context?: Record<string, unknown>;
    countryCode?: string;
    onInsertText?: (text: string) => void;
    /** Callback to fill form fields from wizard-extracted data */
    onFillFormData?: (data: Record<string, unknown>) => void;
}

export const ChatAssistent = ({ context, countryCode = "DE", onInsertText, onFillFormData }: ChatAssistentProps) => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [mode, setMode] = useState<"general" | "clause" | "formal" | "document" | "onboarding">("general");
    const [onboardingResult, setOnboardingResult] = useState<{
        jobId: number;
        packageName: string;
        drafts: Array<{
            id: number | null;
            title: string;
            document_type: string;
            document_type_id: number;
            missing_fields?: string[];
            error?: string;
        }>;
        summary: string;
    } | null>(null);
    const [wizardState, setWizardState] = useState<WizardState>({
        extractedData: {},
        suggestedDocumentTypeId: null,
        suggestedDocumentTypeName: null,
        isComplete: false,
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup: abort stream on unmount
    useEffect(() => {
        return () => { abortControllerRef.current?.abort(); };
    }, []);

    // Auto-scroll during streaming
    useEffect(() => {
        if (isStreaming) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isStreaming]);

    const stopStreaming = () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsStreaming(false);
        setIsLoading(false);
    };

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: "user", content: input };
        const allMessages = [...messages, userMessage];
        setMessages(allMessages);
        setInput("");
        setIsLoading(true);

        // Detect onboarding intent
        const isOnboardingMode = mode === "onboarding";
        const onboardingKeywords = ["onboarding", "einstellen", "kündigung", "kündigen", "beförderung", "befördern"];
        const isOnboardingIntent = isOnboardingMode ||
            onboardingKeywords.some(kw => input.toLowerCase().includes(kw));

        if (isOnboardingIntent && !onboardingResult) {
            await handleOnboardingPipeline(input, allMessages);
            return;
        }

        const isWizardMode = mode === "document";
        const streamEndpoint = isWizardMode ? "/api/v1/smart/wizard/stream" : "/api/v1/chat/stream";
        const blockingEndpoint = isWizardMode ? "/api/v1/smart/wizard" : "/api/v1/chat";

        const requestBody = isWizardMode
            ? {
                messages: allMessages,
                country_code: countryCode,
                document_type_id: wizardState.suggestedDocumentTypeId,
                form_data: Object.keys(wizardState.extractedData).length > 0 ? wizardState.extractedData : undefined,
            }
            : {
                messages: allMessages,
                context,
                country_code: countryCode,
                mode,
            };

        // Try streaming first, fallback to blocking
        try {
            const controller = new AbortController();
            abortControllerRef.current = controller;

            // Add empty assistant placeholder for live updates
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
            setIsStreaming(true);

            let fullText = "";

            for await (const event of apiStreamSSE(
                streamEndpoint,
                requestBody,
                controller.signal,
            )) {
                if (event.token) {
                    fullText += event.token;
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: "assistant", content: fullText };
                        return updated;
                    });
                }
                if (event.error) {
                    throw new Error(event.error);
                }
                if (event.done) {
                    // Handle wizard structured data from done event
                    if (isWizardMode) {
                        const doneEvent = event as SSEEvent & { message?: string; extracted_data?: Record<string, unknown>; suggested_document_type_id?: number; suggested_document_type_name?: string; is_complete?: boolean };
                        const displayMessage = doneEvent.message || fullText;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = { role: "assistant", content: displayMessage };
                            return updated;
                        });
                        setWizardState(prev => ({
                            extractedData: { ...prev.extractedData, ...(doneEvent.extracted_data || {}) },
                            suggestedDocumentTypeId: doneEvent.suggested_document_type_id ?? prev.suggestedDocumentTypeId,
                            suggestedDocumentTypeName: doneEvent.suggested_document_type_name ?? prev.suggestedDocumentTypeName,
                            isComplete: doneEvent.is_complete ?? prev.isComplete,
                        }));
                    }
                    break;
                }
            }

            // Ensure final text is set (in case stream ended without done frame)
            if (fullText && !isWizardMode) {
                setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: fullText };
                    return updated;
                });
            }
        } catch (error) {
            // On abort (user cancelled), keep partial text
            if (error instanceof DOMException && error.name === "AbortError") {
                // User cancelled — partial text stays visible
                return;
            }

            console.error("Streaming chat error, trying blocking fallback:", error);

            // Remove the empty/partial streaming placeholder
            setMessages((prev) => prev.filter((_, i) => i < prev.length - 1));

            // Fallback to blocking endpoint
            try {
                const response = await apiFetch(blockingEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                });

                const data = await response.json();
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: data.message },
                ]);
                if (isWizardMode) {
                    setWizardState(prev => ({
                        extractedData: { ...prev.extractedData, ...(data.extracted_data || {}) },
                        suggestedDocumentTypeId: data.suggested_document_type_id ?? prev.suggestedDocumentTypeId,
                        suggestedDocumentTypeName: data.suggested_document_type_name ?? prev.suggestedDocumentTypeName,
                        isComplete: data.is_complete ?? prev.isComplete,
                    }));
                }
            } catch (fallbackError) {
                console.error("Blocking chat fallback also failed:", fallbackError);
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "Entschuldigung, ein Fehler ist aufgetreten." },
                ]);
            }
        } finally {
            abortControllerRef.current = null;
            setIsStreaming(false);
            setIsLoading(false);
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };

    const handleOnboardingPipeline = async (message: string, _allMessages: Message[]) => {
        try {
            const controller = new AbortController();
            abortControllerRef.current = controller;

            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
            setIsStreaming(true);
            setMode("onboarding");

            let statusText = "";

            for await (const event of apiStreamSSE(
                "/api/v1/smart/onboarding",
                { message, country_code: countryCode },
                controller.signal,
            )) {
                if (event.type === "status") {
                    statusText = event.message as string;
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: "assistant", content: statusText };
                        return updated;
                    });
                }
                if (event.type === "employee_history") {
                    statusText += `\n${event.message}`;
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: "assistant", content: statusText };
                        return updated;
                    });
                }
                if (event.type === "draft_created") {
                    const draft = event.draft as { title: string };
                    statusText += `\n${draft.title}`;
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: "assistant", content: statusText };
                        return updated;
                    });
                }
                if (event.type === "done") {
                    const packageName = event.package_name || "Onboarding";
                    const doneDrafts = (event.drafts || []) as Array<{
                        id: number | null;
                        title: string;
                        document_type: string;
                        document_type_id: number;
                        missing_fields?: string[];
                        error?: string;
                    }>;

                    setOnboardingResult({
                        jobId: event.job_id || 0,
                        packageName,
                        drafts: doneDrafts,
                        summary: event.summary || "",
                    });

                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: "assistant",
                            content: `${event.summary || ""}\n\nDu kannst die Dokumente jetzt öffnen und bearbeiten. Oder schreib mir, was ich anpassen soll — z.B. "Adresse ist Musterstraße 5, 80333 München".`,
                        };
                        return updated;
                    });
                    break;
                }
                if (event.type === "error") {
                    throw new Error(event.message as string);
                }
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            console.error("Onboarding pipeline error:", error);
            setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: "assistant",
                    content: `Fehler beim Erstellen des Pakets: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
                };
                return updated;
            });
        } finally {
            abortControllerRef.current = null;
            setIsStreaming(false);
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleReset = () => {
        if (isStreaming) {
            stopStreaming();
        }
        setMessages([]);
        setOnboardingResult(null);
        setWizardState({
            extractedData: {},
            suggestedDocumentTypeId: null,
            suggestedDocumentTypeName: null,
            isComplete: false,
        });
    };

    const handleWizardCreateDocument = useCallback(() => {
        const typeId = wizardState.suggestedDocumentTypeId;
        if (!typeId) return;

        // If inside generator, fill form data directly
        if (onFillFormData && Object.keys(wizardState.extractedData).length > 0) {
            onFillFormData(wizardState.extractedData);
        }

        // Navigate to generator with pre-filled data
        const params = new URLSearchParams();
        params.set("type", String(typeId));
        if (Object.keys(wizardState.extractedData).length > 0) {
            params.set("data", JSON.stringify(wizardState.extractedData));
        }
        navigate(`/generate?${params.toString()}`);
    }, [wizardState, navigate, onFillFormData]);

    const quickPrompts = [
        { label: "Textbaustein formulieren", prompt: "Formuliere einen Textbaustein für..." },
        { label: "Text verbessern", prompt: "Verbessere folgenden Text: " },
        { label: "Rechtsfrage", prompt: "Welche rechtlichen Aspekte muss ich bei ... beachten?" },
    ];

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Brief-Assistent
                    </CardTitle>
                    <div className="flex gap-1.5 flex-wrap">
                        {(["general", "clause", "formal", "document", "onboarding"] as const).map((m) => (
                            <Button
                                key={m}
                                variant={mode === m ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => { setMode(m); if (m !== mode) handleReset(); }}
                                className="text-xs h-7 px-3"
                                disabled={isLoading}
                            >
                                {m === "general" ? "Allgemein" : m === "clause" ? "Textbausteine" : m === "formal" ? "Formell" : m === "document" ? "Dokument erstellen" : "Onboarding"}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-auto mb-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="mb-4">Stelle eine Frage oder wähle einen Schnellstart:</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {quickPrompts.map((qp) => (
                                    <Button
                                        key={qp.label}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setInput(qp.prompt)}
                                    >
                                        {qp.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`p-3 rounded-lg ${msg.role === "user"
                                        ? "bg-primary/10 ml-8"
                                        : "bg-muted mr-8"
                                    }`}
                            >
                                <p className="text-sm whitespace-pre-wrap">
                                    {msg.content}
                                    {/* Streaming cursor on last assistant message */}
                                    {isStreaming && msg.role === "assistant" && i === messages.length - 1 && (
                                        <span className="inline-block w-[2px] h-4 ml-1 bg-primary rounded-sm animate-pulse" />
                                    )}
                                </p>
                                {msg.role === "assistant" && !isStreaming && msg.content && onInsertText && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-2"
                                        onClick={() => onInsertText(msg.content)}
                                    >
                                        In Dokument einfügen
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                    {onboardingResult && (
                        <OnboardingResultCard
                            packageName={onboardingResult.packageName}
                            drafts={onboardingResult.drafts}
                            jobId={onboardingResult.jobId}
                            summary={onboardingResult.summary}
                        />
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Wizard Status Bar */}
                {mode === "document" && wizardState.suggestedDocumentTypeName && (
                    <div className="flex items-center gap-2 flex-wrap mb-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <Badge variant="secondary" className="gap-1.5">
                            <FileText className="w-3 h-3" />
                            {wizardState.suggestedDocumentTypeName}
                        </Badge>
                        {Object.keys(wizardState.extractedData).length > 0 && (
                            <span className="text-xs text-muted-foreground">
                                {Object.keys(wizardState.extractedData).length} Felder
                            </span>
                        )}
                        {wizardState.isComplete && (
                            <Button
                                size="sm"
                                onClick={handleWizardCreateDocument}
                                className="ml-auto gap-1.5 h-7 text-xs"
                            >
                                Dokument erstellen
                                <ArrowRight className="w-3 h-3" />
                            </Button>
                        )}
                    </div>
                )}

                {/* Input */}
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Frage stellen..."
                        disabled={isLoading}
                    />
                    {isStreaming ? (
                        <Button variant="destructive" size="icon" onClick={stopStreaming} title="Stoppen">
                            <Square className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    )}
                    {messages.length > 0 && !isStreaming && (
                        <Button variant="ghost" size="icon" onClick={handleReset}>
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
