import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Sparkles, RefreshCw } from "lucide-react";

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
    const [mode, setMode] = useState<"general" | "clause" | "formal">("general");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: "user", content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/v1/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    context,
                    country_code: countryCode,
                    mode,
                }),
            });

            const data = await response.json();
            const assistantMessage: Message = { role: "assistant", content: data.message };
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Entschuldigung, ein Fehler ist aufgetreten." },
            ]);
        } finally {
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

    const quickPrompts = [
        { label: "Klausel formulieren", prompt: "Formuliere eine Klausel für..." },
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
                            >
                                {m === "general" ? "Allgemein" : m === "clause" ? "Klauseln" : "Formell"}
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
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                {msg.role === "assistant" && onInsertText && (
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
                    {isLoading && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Assistent denkt nach...</span>
                        </div>
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
                    <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                    {messages.length > 0 && (
                        <Button variant="ghost" size="icon" onClick={() => setMessages([])}>
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
