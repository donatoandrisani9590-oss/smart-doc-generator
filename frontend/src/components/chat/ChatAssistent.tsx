import { useState, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { apiStreamSSE } from "@/lib/api-stream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Sparkles, RefreshCw, Square } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface ChatAssistentProps {
    context?: Record<string, unknown>;
    countryCode?: string;
    onInsertText?: (text: string) => void;
}

export const ChatAssistent = ({ context, countryCode = "DE", onInsertText }: ChatAssistentProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [mode, setMode] = useState<"general" | "clause" | "formal">("general");
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

        const requestBody = {
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
                "/api/v1/chat/stream",
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
                    break;
                }
            }

            // Ensure final text is set (in case stream ended without done frame)
            if (fullText) {
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
                const response = await apiFetch("/api/v1/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                });

                const data = await response.json();
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: data.message },
                ]);
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
    };

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
                    <div className="flex gap-1">
                        {(["general", "clause", "formal"] as const).map((m) => (
                            <Button
                                key={m}
                                variant={mode === m ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setMode(m)}
                                className="text-xs"
                                disabled={isLoading}
                            >
                                {m === "general" ? "Allgemein" : m === "clause" ? "Textbausteine" : "Formell"}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-auto mb-4 space-y-3">
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
                                        <span className="inline-block w-2 h-4 ml-0.5 bg-primary/60 animate-pulse" />
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
                    <div ref={messagesEndRef} />
                </div>

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
