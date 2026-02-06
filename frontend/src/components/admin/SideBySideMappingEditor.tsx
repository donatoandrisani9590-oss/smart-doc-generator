/**
 * Side-by-Side Mapping Editor
 *
 * Der visuelle Mapping-Assistent für den Magic Word-Import:
 * - Links: Original-Dokument Preview (HTML oder PDF)
 * - Rechts: Erkannte Werte mit Platzhalter-Zuordnung
 *
 * Features:
 * - Synchronisiertes Highlighting zwischen beiden Panels
 * - Keyboard Shortcuts (Y/N/A/E für schnelles Mapping)
 * - "Für alle ersetzen" Funktion für ähnliche Werte
 * - Konfidenz-basierte Farbcodierung
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
    Check,
    X,
    ZoomIn,
    ZoomOut,
    Copy,
    FileText,
    Sparkles,
    Keyboard,
    RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
// Card components not currently used but available for future feature additions
// import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

// Types
interface TextPosition {
    paragraph_index: number;
    run_index: number;
    char_start: number;
    char_end: number;
    table_info?: { table_idx: number; row_idx: number; cell_idx: number } | null;
}

interface DetectedValue {
    id: string;
    text: string;
    value_type: string;
    position: TextPosition;
    confidence: number;
    suggested_placeholder: string | null;
    suggested_label: string | null;
    alternatives: string[];
    is_confirmed: boolean;
    user_override?: string | null;
}

interface DocumentSection {
    id: string;
    section_type: string;
    content: string;
    html_content: string;
    position_start: number;
    position_end: number;
    detected_values: DetectedValue[];
}

interface AnalysisStatistics {
    total_sections: number;
    total_detected_values: number;
    values_by_type: Record<string, number>;
    average_confidence: number;
    high_confidence_count: number;
    suggested_placeholder_count: number;
}

interface MagicAnalysisResult {
    document_id: string;
    original_filename: string;
    preview_html: string;
    preview_pdf_path: string | null;
    sections: DocumentSection[];
    detected_values: DetectedValue[];
    statistics: AnalysisStatistics;
    created_at: string;
}

interface PlaceholderInfo {
    name: string;
    label: string;
    type: string;
    category: string;
    example_value?: string;
}

interface PlaceholdersResponse {
    placeholders: PlaceholderInfo[];
    by_category: Record<string, PlaceholderInfo[]>;
}

interface SideBySideMappingEditorProps {
    analysisResult: MagicAnalysisResult;
    onComplete: (mapping: Record<string, string>) => void;
    onCancel: () => void;
}

// Fetch functions
async function fetchPlaceholders(): Promise<PlaceholdersResponse> {
    const response = await apiFetch("/api/v1/word-import/magic/placeholders");
    if (!response.ok) throw new Error("Failed to fetch placeholders");
    return response.json();
}

/* findSimilarValues - für zukünftige "apply to similar" Funktion
async function findSimilarValues(
    documentId: string,
    valueId: string,
    threshold: number = 0.85
) {
    const response = await fetch(`${API_BASE}/api/v1/word-import/magic/find-similar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            document_id: documentId,
            value_id: valueId,
            threshold,
        }),
    });
    if (!response.ok) throw new Error("Failed to find similar values");
    return response.json();
}
*/

async function confirmMappings(
    documentId: string,
    confirmations: Array<{ value_id: string; placeholder_name: string; apply_to_similar: boolean }>
) {
    const response = await apiFetch("/api/v1/word-import/magic/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            document_id: documentId,
            confirmations,
        }),
    });
    if (!response.ok) throw new Error("Failed to confirm mappings");
    return response.json();
}

// Value type colors and labels
const VALUE_TYPE_CONFIG: Record<
    string,
    { color: string; bgColor: string; label: string; icon: string }
> = {
    date: {
        color: "text-blue-700",
        bgColor: "bg-blue-50 border-blue-200",
        label: "Datum",
        icon: "📅",
    },
    currency: {
        color: "text-green-700",
        bgColor: "bg-green-50 border-green-200",
        label: "Betrag",
        icon: "💰",
    },
    number: {
        color: "text-purple-700",
        bgColor: "bg-purple-50 border-purple-200",
        label: "Zahl",
        icon: "🔢",
    },
    name: {
        color: "text-orange-700",
        bgColor: "bg-orange-50 border-orange-200",
        label: "Name",
        icon: "👤",
    },
    address: {
        color: "text-teal-700",
        bgColor: "bg-teal-50 border-teal-200",
        label: "Adresse",
        icon: "📍",
    },
    email: {
        color: "text-indigo-700",
        bgColor: "bg-indigo-50 border-indigo-200",
        label: "E-Mail",
        icon: "📧",
    },
    phone: {
        color: "text-pink-700",
        bgColor: "bg-pink-50 border-pink-200",
        label: "Telefon",
        icon: "📞",
    },
    text: {
        color: "text-gray-700",
        bgColor: "bg-gray-50 border-gray-200",
        label: "Text",
        icon: "📝",
    },
};

// Confidence level helpers
function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.6) return "medium";
    return "low";
}

function getConfidenceColor(level: "high" | "medium" | "low") {
    switch (level) {
        case "high":
            return "bg-green-100 text-green-800 border-green-300";
        case "medium":
            return "bg-yellow-100 text-yellow-800 border-yellow-300";
        case "low":
            return "bg-red-100 text-red-800 border-red-300";
    }
}

// Main component
export function SideBySideMappingEditor({
    analysisResult,
    onComplete,
    onCancel,
}: SideBySideMappingEditorProps) {
    // State
    const [detectedValues, setDetectedValues] = useState<DetectedValue[]>(
        analysisResult.detected_values
    );
    const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
    const [hoveredValueId, setHoveredValueId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(100);
    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
    const [confirmations, setConfirmations] = useState<
        Record<string, { placeholder: string; applyToSimilar: boolean }>
    >({});

    // Refs
    const previewRef = useRef<HTMLDivElement>(null);
    const mappingListRef = useRef<HTMLDivElement>(null);

    // Queries
    const { data: placeholdersData } = useQuery({
        queryKey: ["placeholders"],
        queryFn: fetchPlaceholders,
    });

    // Mutations
    const confirmMutation = useMutation({
        mutationFn: (data: {
            confirmations: Array<{
                value_id: string;
                placeholder_name: string;
                apply_to_similar: boolean;
            }>;
        }) => confirmMappings(analysisResult.document_id, data.confirmations),
        onSuccess: (result: { placeholder_mapping: Record<string, string> }) => {
            // Update local state with confirmed values
            setDetectedValues((prev) =>
                prev.map((v) => ({
                    ...v,
                    is_confirmed: v.id in result.placeholder_mapping,
                    user_override: result.placeholder_mapping[v.id] || v.user_override,
                }))
            );
        },
    });

    // Computed values
    const progress = useMemo(() => {
        const confirmed = detectedValues.filter((v) => v.is_confirmed || confirmations[v.id]);
        return (confirmed.length / detectedValues.length) * 100;
    }, [detectedValues, confirmations]);

    const unconfirmedValues = useMemo(
        () => detectedValues.filter((v) => !v.is_confirmed && !confirmations[v.id]),
        [detectedValues, confirmations]
    );

    const currentValue = useMemo(
        () => detectedValues.find((v) => v.id === selectedValueId),
        [detectedValues, selectedValueId]
    );

    // Auto-select first unconfirmed value
    useEffect(() => {
        if (!selectedValueId && unconfirmedValues.length > 0) {
            setSelectedValueId(unconfirmedValues[0].id);
        }
    }, [selectedValueId, unconfirmedValues]);

    // Keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            // Ignore if typing in an input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) {
                return;
            }

            const value = currentValue;
            if (!value) return;

            switch (e.key.toLowerCase()) {
                case "y":
                case "j": // German "Ja"
                    // Confirm with suggested placeholder
                    if (value.suggested_placeholder) {
                        handleConfirm(value.id, value.suggested_placeholder, false);
                    }
                    break;

                case "n":
                    // Skip/Reject
                    handleSkip(value.id);
                    break;

                case "a":
                    // Apply to all similar
                    if (value.suggested_placeholder) {
                        handleConfirm(value.id, value.suggested_placeholder, true);
                    }
                    break;

                case "e":
                    // Edit - open dropdown
                    // Focus would be handled by the dropdown component
                    break;

                case "arrowdown":
                    e.preventDefault();
                    moveToNext();
                    break;

                case "arrowup":
                    e.preventDefault();
                    moveToPrevious();
                    break;

                case "?":
                    setShowKeyboardHelp((prev) => !prev);
                    break;
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentValue]);

    // Scroll sync - when a value is selected, scroll to it in the preview
    useEffect(() => {
        if (selectedValueId && previewRef.current) {
            const marker = previewRef.current.querySelector(
                `[data-value-id="${selectedValueId}"]`
            );
            if (marker) {
                marker.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [selectedValueId]);

    // Handlers
    const handleConfirm = useCallback(
        (valueId: string, placeholder: string, applyToSimilar: boolean) => {
            setConfirmations((prev) => ({
                ...prev,
                [valueId]: { placeholder, applyToSimilar },
            }));

            // Move to next unconfirmed
            const currentIndex = detectedValues.findIndex((v) => v.id === valueId);
            const nextUnconfirmed = detectedValues.find(
                (v, i) => i > currentIndex && !v.is_confirmed && !confirmations[v.id]
            );

            if (nextUnconfirmed) {
                setSelectedValueId(nextUnconfirmed.id);
            }
        },
        [detectedValues, confirmations]
    );

    const handleSkip = useCallback(
        (valueId: string) => {
            // Move to next without confirming
            const currentIndex = detectedValues.findIndex((v) => v.id === valueId);
            const nextUnconfirmed = detectedValues.find(
                (v, i) => i > currentIndex && !v.is_confirmed && !confirmations[v.id]
            );

            if (nextUnconfirmed) {
                setSelectedValueId(nextUnconfirmed.id);
            }
        },
        [detectedValues, confirmations]
    );

    const moveToNext = useCallback(() => {
        const currentIndex = detectedValues.findIndex((v) => v.id === selectedValueId);
        if (currentIndex < detectedValues.length - 1) {
            setSelectedValueId(detectedValues[currentIndex + 1].id);
        }
    }, [detectedValues, selectedValueId]);

    const moveToPrevious = useCallback(() => {
        const currentIndex = detectedValues.findIndex((v) => v.id === selectedValueId);
        if (currentIndex > 0) {
            setSelectedValueId(detectedValues[currentIndex - 1].id);
        }
    }, [detectedValues, selectedValueId]);

    const handleComplete = useCallback(async () => {
        // Send all confirmations to backend
        const allConfirmations = Object.entries(confirmations).map(
            ([valueId, { placeholder, applyToSimilar }]) => ({
                value_id: valueId,
                placeholder_name: placeholder,
                apply_to_similar: applyToSimilar,
            })
        );

        if (allConfirmations.length > 0) {
            await confirmMutation.mutateAsync({ confirmations: allConfirmations });
        }

        // Build final mapping and call onComplete
        const mapping: Record<string, string> = {};
        for (const [valueId, { placeholder }] of Object.entries(confirmations)) {
            mapping[valueId] = placeholder;
        }

        onComplete(mapping);
    }, [confirmations, confirmMutation, onComplete]);

    const handleReset = useCallback(() => {
        setConfirmations({});
        setDetectedValues(analysisResult.detected_values);
        setSelectedValueId(analysisResult.detected_values[0]?.id || null);
    }, [analysisResult]);

    // Render value card
    const renderValueCard = (value: DetectedValue, index: number) => {
        const isSelected = selectedValueId === value.id;
        const isHovered = hoveredValueId === value.id;
        const isConfirmed = value.is_confirmed || confirmations[value.id];
        const typeConfig = VALUE_TYPE_CONFIG[value.value_type] || VALUE_TYPE_CONFIG.text;
        const confidenceLevel = getConfidenceLevel(value.confidence);

        return (
            <motion.div
                key={value.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                    "rounded-lg border p-4 transition-all cursor-pointer",
                    isSelected && "ring-2 ring-blue-500 border-blue-300",
                    isHovered && !isSelected && "border-blue-200 bg-blue-50/50",
                    isConfirmed && "opacity-60 bg-gray-50",
                    !isSelected && !isHovered && !isConfirmed && "hover:bg-gray-50"
                )}
                onClick={() => setSelectedValueId(value.id)}
                onMouseEnter={() => setHoveredValueId(value.id)}
                onMouseLeave={() => setHoveredValueId(null)}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{typeConfig.icon}</span>
                        <Badge variant="outline" className={typeConfig.bgColor}>
                            {typeConfig.label}
                        </Badge>
                        <Badge
                            variant="outline"
                            className={getConfidenceColor(confidenceLevel)}
                        >
                            {Math.round(value.confidence * 100)}%
                        </Badge>
                    </div>

                    {isConfirmed && (
                        <Check className="w-5 h-5 text-green-500" />
                    )}
                </div>

                {/* Value text */}
                <div
                    className={cn(
                        "font-mono text-lg p-2 rounded border mb-3",
                        typeConfig.bgColor
                    )}
                >
                    "{value.text}"
                </div>

                {/* Mapping controls */}
                {!isConfirmed && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Select
                                value={confirmations[value.id]?.placeholder || value.suggested_placeholder || ""}
                                onValueChange={(placeholder) =>
                                    handleConfirm(value.id, placeholder, false)
                                }
                            >
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Platzhalter wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Suggested first */}
                                    {value.suggested_placeholder && (
                                        <>
                                            <SelectItem
                                                value={value.suggested_placeholder}
                                                className="font-medium"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4 text-yellow-500" />
                                                    {value.suggested_label || value.suggested_placeholder}
                                                    <span className="text-xs text-gray-500">
                                                        (Vorschlag)
                                                    </span>
                                                </div>
                                            </SelectItem>
                                            <hr className="my-1" />
                                        </>
                                    )}

                                    {/* Alternatives */}
                                    {value.alternatives.map((alt) => {
                                        const placeholder = placeholdersData?.placeholders.find(
                                            (p) => p.name === alt
                                        );
                                        return (
                                            <SelectItem key={alt} value={alt}>
                                                {placeholder?.label || alt}
                                            </SelectItem>
                                        );
                                    })}

                                    {/* All placeholders by category */}
                                    {placeholdersData?.by_category &&
                                        Object.entries(placeholdersData.by_category).map(
                                            ([category, placeholders]) => (
                                                <React.Fragment key={category}>
                                                    <hr className="my-1" />
                                                    <div className="px-2 py-1 text-xs font-semibold text-gray-500">
                                                        {category}
                                                    </div>
                                                    {placeholders.map((p) => (
                                                        <SelectItem key={p.name} value={p.name}>
                                                            {p.label}
                                                        </SelectItem>
                                                    ))}
                                                </React.Fragment>
                                            )
                                        )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                if (value.suggested_placeholder) {
                                                    handleConfirm(
                                                        value.id,
                                                        value.suggested_placeholder,
                                                        false
                                                    );
                                                }
                                            }}
                                            disabled={!value.suggested_placeholder}
                                            className="flex-1"
                                        >
                                            <Check className="w-4 h-4 mr-1" />
                                            Ja [Y]
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Vorschlag übernehmen</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleSkip(value.id)}
                                            className="flex-1"
                                        >
                                            <X className="w-4 h-4 mr-1" />
                                            Nein [N]
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Überspringen</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => {
                                                if (value.suggested_placeholder) {
                                                    handleConfirm(
                                                        value.id,
                                                        value.suggested_placeholder,
                                                        true
                                                    );
                                                }
                                            }}
                                            disabled={!value.suggested_placeholder}
                                        >
                                            <Copy className="w-4 h-4 mr-1" />
                                            Alle [A]
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Für alle ähnlichen Werte übernehmen</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                )}

                {/* Confirmed state */}
                {isConfirmed && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>
                            Zugeordnet zu:{" "}
                            <code className="bg-gray-100 px-1 rounded">
                                {"{{ "}
                                {confirmations[value.id]?.placeholder || value.user_override}
                                {" }}"}
                            </code>
                        </span>
                    </div>
                )}
            </motion.div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-yellow-500" />
                            Magic Mapping-Assistent
                        </h2>
                        <p className="text-sm text-gray-500">
                            {analysisResult.original_filename} -{" "}
                            {detectedValues.length} erkannte Werte
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Progress */}
                        <div className="w-48">
                            <div className="text-xs text-gray-500 mb-1 text-right">
                                {Object.keys(confirmations).length} / {detectedValues.length}{" "}
                                zugeordnet
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setShowKeyboardHelp(true)}
                                        >
                                            <Keyboard className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Tastenkürzel anzeigen [?]</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <Button variant="outline" onClick={handleReset}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Zurücksetzen
                            </Button>

                            <Button variant="outline" onClick={onCancel}>
                                Abbrechen
                            </Button>

                            <Button onClick={handleComplete} disabled={progress === 0}>
                                <Check className="w-4 h-4 mr-2" />
                                Fertig ({Object.keys(confirmations).length})
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content - Split view */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Document Preview */}
                <div className="w-1/2 border-r bg-white flex flex-col">
                    {/* Toolbar */}
                    <div className="p-2 border-b flex items-center justify-between bg-gray-50">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                            >
                                <ZoomOut className="w-4 h-4" />
                            </Button>
                            <span className="text-sm text-gray-600 w-12 text-center">
                                {zoom}%
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setZoom((z) => Math.min(200, z + 10))}
                            >
                                <ZoomIn className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                                {analysisResult.original_filename}
                            </span>
                        </div>
                    </div>

                    {/* Preview content */}
                    <div
                        ref={previewRef}
                        className="flex-1 overflow-auto p-4"
                        style={{ fontSize: `${zoom}%` }}
                    >
                        {/* Inject CSS for highlighting */}
                        <style>{`
                            .detected-value {
                                position: relative;
                                cursor: pointer;
                                padding: 2px 4px;
                                border-radius: 3px;
                                transition: all 0.2s ease;
                            }
                            .detected-value.high {
                                background: rgba(34, 197, 94, 0.2);
                                border-bottom: 2px solid #22c55e;
                            }
                            .detected-value.medium {
                                background: rgba(234, 179, 8, 0.2);
                                border-bottom: 2px solid #eab308;
                            }
                            .detected-value.low {
                                background: rgba(239, 68, 68, 0.2);
                                border-bottom: 2px solid #ef4444;
                            }
                            .detected-value:hover,
                            .detected-value.selected {
                                outline: 2px solid #3b82f6;
                                outline-offset: 2px;
                            }
                            .detected-value.confirmed {
                                background: rgba(34, 197, 94, 0.3);
                                border-bottom-color: #16a34a;
                            }
                        `}</style>

                        {/* Render HTML preview with click handlers */}
                        <div
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{
                                __html: analysisResult.preview_html
                                    .replace(/<html[^>]*>|<\/html>|<head[^>]*>[\s\S]*<\/head>|<body[^>]*>|<\/body>/gi, "")
                                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ""),
                            }}
                            onClick={(e) => {
                                const target = e.target as HTMLElement;
                                const valueId = target.getAttribute("data-value-id");
                                if (valueId) {
                                    setSelectedValueId(valueId);
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Right: Mapping Panel */}
                <div className="w-1/2 flex flex-col bg-gray-50">
                    {/* Section header */}
                    <div className="p-4 bg-white border-b">
                        <h3 className="font-semibold">Erkannte Werte zuordnen</h3>
                        <p className="text-sm text-gray-500">
                            Klicken Sie auf einen Wert oder nutzen Sie Tastenkürzel
                        </p>
                    </div>

                    {/* Values list */}
                    <div
                        ref={mappingListRef}
                        className="flex-1 overflow-auto p-4 space-y-3"
                    >
                        <AnimatePresence>
                            {detectedValues.map((value, index) =>
                                renderValueCard(value, index)
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Statistics */}
                    <div className="p-4 bg-white border-t">
                        <div className="grid grid-cols-4 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-blue-600">
                                    {analysisResult.statistics.total_detected_values}
                                </div>
                                <div className="text-xs text-gray-500">Erkannt</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-green-600">
                                    {analysisResult.statistics.high_confidence_count}
                                </div>
                                <div className="text-xs text-gray-500">Hohe Konfidenz</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-yellow-600">
                                    {analysisResult.statistics.suggested_placeholder_count}
                                </div>
                                <div className="text-xs text-gray-500">Mit Vorschlag</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-purple-600">
                                    {Object.keys(confirmations).length}
                                </div>
                                <div className="text-xs text-gray-500">Bestätigt</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Keyboard shortcuts modal */}
            <AnimatePresence>
                {showKeyboardHelp && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                        onClick={() => setShowKeyboardHelp(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-lg p-6 max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Keyboard className="w-5 h-5" />
                                Tastenkürzel
                            </h3>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <kbd className="px-2 py-1 bg-gray-100 rounded font-mono">
                                        Y / J
                                    </kbd>
                                    <span>Vorschlag übernehmen</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <kbd className="px-2 py-1 bg-gray-100 rounded font-mono">
                                        N
                                    </kbd>
                                    <span>Überspringen</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <kbd className="px-2 py-1 bg-gray-100 rounded font-mono">
                                        A
                                    </kbd>
                                    <span>Für alle ähnlichen übernehmen</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <kbd className="px-2 py-1 bg-gray-100 rounded font-mono">
                                        ↑ / ↓
                                    </kbd>
                                    <span>Navigation</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <kbd className="px-2 py-1 bg-gray-100 rounded font-mono">
                                        ?
                                    </kbd>
                                    <span>Diese Hilfe anzeigen</span>
                                </div>
                            </div>

                            <Button
                                className="w-full mt-4"
                                onClick={() => setShowKeyboardHelp(false)}
                            >
                                Schließen
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default SideBySideMappingEditor;
