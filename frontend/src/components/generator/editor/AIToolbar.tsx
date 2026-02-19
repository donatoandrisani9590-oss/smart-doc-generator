/**
 * AIToolbar - KI-Nachbesserungs-Toolbar für den Dokumenten-Editor
 *
 * Floating Toolbar mit KI-Optionen:
 * - Förmlicher formulieren
 * - Kürzer fassen
 * - Rechtskonform prüfen
 * - Freundlicher formulieren
 * - Verständlicher formulieren
 * - Freie Anweisung...
 *
 * Supports SSE streaming for real-time token display.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
    Sparkles,
    GraduationCap,
    Scissors,
    ShieldCheck,
    Heart,
    Eye,
    MessageSquare,
    Loader2,
    Check,
    AlertCircle,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { api, type ApiError } from "@/lib/api-client";
import { apiStreamSSE } from "@/lib/api-stream";

interface AIToolbarProps {
    /** Get currently selected text from the editor */
    getSelectedText: () => string;
    /** Replace selected text in the editor */
    replaceSelectedText: (newText: string) => void;
    /** Document context for better AI results */
    documentContext?: string;
    /** Country code */
    countryCode?: string;
    /** Document type ID */
    documentTypeId?: number | null;
    /** Tone of voice (1-5) */
    toneOfVoice?: number;
}

interface RefineResponse {
    refined_text: string;
    provider: string;
    changes_summary: string;
}

const PRESETS = [
    { id: "formal", label: "Förmlicher formulieren", icon: GraduationCap, description: "Professioneller Ton" },
    { id: "concise", label: "Kürzer fassen", icon: Scissors, description: "Kompakter ohne Verlust" },
    { id: "compliance", label: "Rechtskonform prüfen", icon: ShieldCheck, description: "Arbeitsrecht prüfen" },
    { id: "friendly", label: "Freundlicher formulieren", icon: Heart, description: "Wertschätzender Ton" },
    { id: "clear", label: "Verständlicher formulieren", icon: Eye, description: "Weniger Fachjargon" },
];

type ToolbarStatus = "idle" | "loading" | "success" | "error" | "no-selection";

export const AIToolbar = ({
    getSelectedText,
    replaceSelectedText,
    documentContext,
    countryCode = "DE",
    documentTypeId,
    toneOfVoice,
}: AIToolbarProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<ToolbarStatus>("idle");
    const [statusMessage, setStatusMessage] = useState("");
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customInstruction, setCustomInstruction] = useState("");
    const [streamedText, setStreamedText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);

    // Track timeout IDs for cleanup on unmount
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            abortControllerRef.current?.abort();
        };
    }, []);

    const clearStatusAfter = useCallback((ms: number, extra?: () => void) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setStatus("idle");
            setStatusMessage("");
            extra?.();
            timeoutRef.current = null;
        }, ms);
    }, []);

    const handleCancelStream = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    const handleRefine = useCallback(async (instruction: string) => {
        const selectedText = getSelectedText();

        if (!selectedText || selectedText.trim().length < 3) {
            setStatus("no-selection");
            setStatusMessage("Bitte markieren Sie zuerst einen Textabschnitt im Editor.");
            clearStatusAfter(3000);
            return;
        }

        setStatus("loading");
        setStatusMessage("KI überarbeitet...");
        setStreamedText("");
        setIsStreaming(true);

        const requestBody = {
            text: selectedText,
            instruction,
            context: documentContext || undefined,
            country_code: countryCode,
            document_type_id: documentTypeId || undefined,
            tone_of_voice: toneOfVoice || undefined,
        };

        // Create AbortController for cancellation
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            let fullText = "";
            let changesSummary = "";

            for await (const event of apiStreamSSE(
                "/api/v1/smart/refine/stream",
                requestBody,
                controller.signal
            )) {
                // Handle error event from stream
                if (event.error) {
                    setIsStreaming(false);
                    setStatus("error");
                    setStatusMessage(event.error);
                    clearStatusAfter(5000);
                    return;
                }

                // Accumulate tokens
                if (event.token) {
                    fullText += event.token;
                    setStreamedText(fullText);
                }

                // Capture changes summary
                if (event.changes_summary) {
                    changesSummary = event.changes_summary;
                }

                // Stream complete
                if (event.done) {
                    setIsStreaming(false);
                    replaceSelectedText(fullText);
                    setStreamedText("");
                    setStatus("success");
                    setStatusMessage(changesSummary || "Text wurde überarbeitet.");

                    clearStatusAfter(3000, () => {
                        setIsOpen(false);
                        setShowCustomInput(false);
                    });
                    return;
                }
            }

            // If we exit the loop without a done event, apply what we have
            if (fullText) {
                setIsStreaming(false);
                replaceSelectedText(fullText);
                setStreamedText("");
                setStatus("success");
                setStatusMessage(changesSummary || "Text wurde überarbeitet.");
                clearStatusAfter(3000, () => {
                    setIsOpen(false);
                    setShowCustomInput(false);
                });
            } else {
                setIsStreaming(false);
                setStatus("error");
                setStatusMessage("Keine Antwort vom KI-Service erhalten.");
                clearStatusAfter(5000);
            }

        } catch (err: unknown) {
            setIsStreaming(false);
            setStreamedText("");

            // User cancelled - don't show error
            if (err instanceof DOMException && err.name === "AbortError") {
                setStatus("idle");
                setStatusMessage("");
                return;
            }

            // Fallback: try blocking endpoint
            try {
                const { data } = await api.post<RefineResponse>("/api/v1/smart/refine", requestBody);

                replaceSelectedText(data.refined_text);
                setStatus("success");
                setStatusMessage(data.changes_summary);

                clearStatusAfter(3000, () => {
                    setIsOpen(false);
                    setShowCustomInput(false);
                });

            } catch (fallbackErr: unknown) {
                let message = "KI-Verarbeitung fehlgeschlagen";
                if (fallbackErr && typeof fallbackErr === "object" && "status" in fallbackErr && "message" in fallbackErr) {
                    message = (fallbackErr as ApiError).message;
                } else if (fallbackErr instanceof Error) {
                    message = fallbackErr.message;
                }
                setStatus("error");
                setStatusMessage(message);
                clearStatusAfter(5000);
            }
        } finally {
            abortControllerRef.current = null;
        }
    }, [getSelectedText, replaceSelectedText, documentContext, countryCode, documentTypeId, toneOfVoice, clearStatusAfter]);

    const handleCustomSubmit = useCallback(() => {
        if (customInstruction.trim()) {
            handleRefine(customInstruction.trim());
            setCustomInstruction("");
            setShowCustomInput(false);
        }
    }, [customInstruction, handleRefine]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-primary"
                    title="KI-Textverbesserung"
                >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs font-medium">KI</span>
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-80 p-0" align="start" side="bottom">
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-primary/5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">KI-Nachbesserung</span>
                    {(status === "loading" || isStreaming) && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary ml-auto" />
                    )}
                </div>

                {/* Status Message / Streaming Preview */}
                {(statusMessage || isStreaming) && (
                    <div className={`px-3 py-2 text-xs flex flex-col gap-1.5 border-b ${
                        status === "success" ? "bg-green-50 text-green-700" :
                        status === "error" ? "bg-red-50 text-red-700" :
                        status === "no-selection" ? "bg-amber-50 text-amber-700" :
                        "bg-primary/5 text-primary"
                    }`}>
                        <div className="flex items-start gap-2">
                            {status === "success" && <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                            {status === "error" && <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                            {status === "no-selection" && <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                            {status === "loading" && !isStreaming && <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" />}
                            {isStreaming && <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" />}
                            <span className="flex-1">{isStreaming ? "KI schreibt..." : statusMessage}</span>
                            {isStreaming && (
                                <button
                                    onClick={handleCancelStream}
                                    className="ml-auto p-0.5 hover:bg-primary/10 rounded"
                                    title="Abbrechen"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        {isStreaming && streamedText && (
                            <div className="max-h-[150px] overflow-y-auto text-xs font-mono bg-white/50 rounded p-2 border border-primary/10">
                                {streamedText}
                                <span className="inline-block w-0.5 h-3.5 bg-primary animate-pulse ml-0.5" />
                            </div>
                        )}
                    </div>
                )}

                {/* Preset Options */}
                <div className="py-1">
                    {PRESETS.map((preset) => {
                        const Icon = preset.icon;
                        return (
                            <button
                                key={preset.id}
                                onClick={() => handleRefine(preset.id)}
                                disabled={status === "loading" || isStreaming}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-warm-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                            >
                                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{preset.label}</div>
                                    <div className="text-xs text-muted-foreground truncate">{preset.description}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Divider */}
                <div className="border-t" />

                {/* Custom Instruction */}
                {showCustomInput ? (
                    <div className="p-3 space-y-2">
                        <Textarea
                            value={customInstruction}
                            onChange={(e) => setCustomInstruction(e.target.value)}
                            placeholder="z.B. 'Formuliere den Absatz als Aufzählung' oder 'Ergänze einen Hinweis auf die Probezeit'"
                            className="min-h-[70px] text-sm resize-none"
                            disabled={status === "loading" || isStreaming}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCustomSubmit();
                                }
                            }}
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setShowCustomInput(false);
                                    setCustomInstruction("");
                                }}
                                className="text-xs"
                            >
                                Abbrechen
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleCustomSubmit}
                                disabled={!customInstruction.trim() || status === "loading" || isStreaming}
                                className="text-xs gap-1.5"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Anwenden
                            </Button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowCustomInput(true)}
                        disabled={status === "loading" || isStreaming}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-warm-50 transition-colors disabled:opacity-50 text-left"
                    >
                        <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="font-medium">Freie Anweisung...</div>
                    </button>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default AIToolbar;
