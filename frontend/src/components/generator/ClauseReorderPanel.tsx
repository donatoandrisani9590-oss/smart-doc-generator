/**
 * ClauseReorderPanel - Textbaustein-Reihenfolge für HRBP-Benutzer
 *
 * v4.2 Feature (Kapitel 3.3):
 * - Optionale Textbausteine ein-/ausschalten
 * - Varianten auswählen (wenn verfügbar)
 * - Reihenfolge per Drag & Drop ändern (für nicht-gesperrte Textbausteine)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
    GripVertical,
    FileText,
    Lock,
    Layers,
    ChevronDown,
    ChevronUp,
    Info,
    Settings2,
    Eye,
    Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Decodes HTML entities and strips tags using the browser's DOMParser,
 * then truncates the text to maxLength characters.
 */
const stripHtmlAndTruncate = (html: string, maxLength: number = 200): string => {
    // DOMParser decodes entities AND strips tags in one step
    const doc = new DOMParser().parseFromString(html, "text/html");
    const text = (doc.body.textContent || "").replace(/\s+/g, " ").trim();

    if (text.length <= maxLength) {
        return text;
    }

    // Am letzten Wort vor maxLength abschneiden
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
};

// ══════════════════════════════════════════════════════════════════════════════
// CLAUSE PREVIEW TOOLTIP
// ══════════════════════════════════════════════════════════════════════════════

interface ClausePreviewTooltipProps {
    content?: string;
    title: string;
    children: React.ReactNode;
}

/**
 * Tooltip mit Textbaustein-Vorschau (erste 200 Zeichen)
 */
const ClausePreviewTooltip = ({ content, title, children }: ClausePreviewTooltipProps) => {
    if (!content || content.trim().length === 0) {
        return <>{children}</>;
    }

    const previewText = stripHtmlAndTruncate(content, 200);
    const decoded = new DOMParser().parseFromString(content, "text/html").body.textContent || "";
    const hasMoreContent = decoded.length > 200;

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {children}
                </TooltipTrigger>
                <TooltipContent
                    side="right"
                    align="start"
                    className="max-w-[400px] p-4 bg-popover text-popover-foreground shadow-lg rounded-lg border"
                    sideOffset={8}
                >
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Eye className="w-4 h-4 text-primary" />
                            <span>Vorschau: {title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {previewText}
                        </p>
                        {hasMoreContent && (
                            <p className="text-xs text-primary font-medium cursor-pointer hover:underline">
                                Mehr anzeigen...
                            </p>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface DocumentClause {
    id: number;
    uniqueId: string;
    title: string;
    content?: string; // Textbaustein-Inhalt für Tooltip-Vorschau
    is_mandatory: boolean;
    is_enabled: boolean;
    is_order_locked: boolean;
    is_recommended?: boolean; // Empfohlener Textbaustein (fällt zurück auf is_mandatory wenn nicht gesetzt)
    has_paragraph_number?: boolean; // v4.4: §-Nummerierung (true = Vertrag, false = Schreiben)
    order: number;
    clause_type: "standard" | "optional" | "conditional" | "variant";
    // Variant support
    variant_group_id?: number;
    variant_group_name?: string;
    selected_variant_id?: number;
    available_variants?: Array<{
        id: number;
        name: string;
        is_default: boolean;
    }>;
}

/**
 * Computes §-numbers for enabled clauses that have paragraph numbering.
 * Returns a Map from uniqueId → paragraph number (1-based).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function computeParagraphNumbers(clauses: DocumentClause[]): Map<string, number> {
    const result = new Map<string, number>();
    let paraNum = 0;
    for (const clause of clauses) {
        if (clause.is_enabled && clause.has_paragraph_number !== false) {
            paraNum++;
            result.set(clause.uniqueId, paraNum);
        }
    }
    return result;
}

interface ClauseReorderPanelProps {
    clauses: DocumentClause[];
    onClausesChange: (clauses: DocumentClause[]) => void;
    disabled?: boolean;
    showHelp?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// SORTABLE CLAUSE ITEM
// ══════════════════════════════════════════════════════════════════════════════

const SortableClauseItem = ({
    clause,
    paragraphNumber,
    onToggle,
    onVariantChange,
    disabled,
}: {
    clause: DocumentClause;
    paragraphNumber?: number;
    onToggle: () => void;
    onVariantChange?: (variantId: number) => void;
    disabled?: boolean;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: clause.uniqueId,
        disabled: disabled || clause.is_order_locked,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const canDrag = !clause.is_order_locked && !disabled;
    const canToggle = !clause.is_mandatory && !disabled;
    const hasVariants = clause.clause_type === "variant" && clause.available_variants && clause.available_variants.length > 1;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-3 p-3 bg-white border rounded-lg transition-all",
                isDragging && "border-primary shadow-lg ring-2 ring-primary/20",
                !clause.is_enabled && "opacity-50 bg-warm-50",
                clause.is_mandatory && "border-l-4 border-l-[#243186]"
            )}
        >
            {/* Drag Handle */}
            <div
                {...(canDrag ? { ...attributes, ...listeners } : {})}
                className={cn(
                    "p-1 rounded",
                    canDrag
                        ? "cursor-grab active:cursor-grabbing hover:bg-muted text-muted-foreground"
                        : "cursor-not-allowed text-warm-300"
                )}
            >
                {clause.is_order_locked ? (
                    <Lock className="w-4 h-4" />
                ) : (
                    <GripVertical className="w-4 h-4" />
                )}
            </div>

            {/* Order Number / §-Badge */}
            {paragraphNumber != null ? (
                <div className="w-8 h-7 bg-primary/15 rounded-md flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    § {paragraphNumber}
                </div>
            ) : (
                <div className="w-7 h-7 bg-warm-100 rounded-full flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                    {clause.order}
                </div>
            )}

            {/* Clause Info */}
            <div className="flex-1 min-w-0">
                <ClausePreviewTooltip content={clause.content} title={clause.title}>
                    <div className="flex items-center gap-2 cursor-help">
                        {clause.clause_type === "variant" ? (
                            <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                        ) : (
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className={cn(
                            "text-sm font-medium truncate",
                            !clause.is_enabled && "line-through text-muted-foreground"
                        )}>
                            {clause.title}
                        </span>
                        {clause.content && (
                            <Eye className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                        )}
                    </div>
                </ClausePreviewTooltip>

                {/* Variant Selector */}
                {hasVariants && clause.is_enabled && (
                    <div className="mt-2 pl-6">
                        <Select
                            value={clause.selected_variant_id?.toString() || ""}
                            onValueChange={(v) => onVariantChange?.(parseInt(v))}
                            disabled={disabled}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Variante wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {clause.available_variants?.map((variant) => (
                                    <SelectItem key={variant.id} value={variant.id.toString()}>
                                        <span className="flex items-center gap-2">
                                            {variant.name}
                                            {variant.is_default && (
                                                <Badge variant="outline" className="text-[10px] px-1">
                                                    Standard
                                                </Badge>
                                            )}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Empfohlen Badge - zeigt an wenn is_recommended true ist, oder fällt auf is_mandatory zurück */}
                {(clause.is_recommended ?? clause.is_mandatory) && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs gap-1">
                                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                    Empfohlen
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Dieser Textbaustein wird für diesen Vertragstyp empfohlen</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {clause.is_mandatory && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                                    Pflicht
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Dieser Textbaustein ist verpflichtend und kann nicht deaktiviert werden</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {clause.clause_type === "variant" && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                        Variante
                    </Badge>
                )}
            </div>

            {/* Enable/Disable Toggle */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <Switch
                                checked={clause.is_enabled}
                                onCheckedChange={onToggle}
                                disabled={!canToggle}
                                className="data-[state=checked]:bg-secondary"
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>
                            {clause.is_mandatory
                                ? "Pflicht-Textbaustein kann nicht deaktiviert werden"
                                : clause.is_enabled
                                ? "Textbaustein deaktivieren"
                                : "Textbaustein aktivieren"}
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export const ClauseReorderPanel = ({
    clauses,
    onClausesChange,
    disabled = false,
    showHelp = true,
}: ClauseReorderPanelProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = clauses.findIndex((c) => c.uniqueId === active.id);
            const newIndex = clauses.findIndex((c) => c.uniqueId === over.id);

            // Check if we can move (both positions must be unlocked)
            if (clauses[oldIndex].is_order_locked || clauses[newIndex].is_order_locked) {
                return;
            }

            const newClauses = arrayMove(clauses, oldIndex, newIndex);
            const reordered = newClauses.map((clause, idx) => ({
                ...clause,
                order: idx + 1,
            }));
            onClausesChange(reordered);
        }
    };

    const handleToggle = (uniqueId: string) => {
        const updated = clauses.map((c) =>
            c.uniqueId === uniqueId ? { ...c, is_enabled: !c.is_enabled } : c
        );
        onClausesChange(updated);
    };

    const handleVariantChange = (uniqueId: string, variantId: number) => {
        const updated = clauses.map((c) =>
            c.uniqueId === uniqueId ? { ...c, selected_variant_id: variantId } : c
        );
        onClausesChange(updated);
    };

    // Compute §-numbers (updates live on drag & drop / toggle)
    const paragraphNumbers = computeParagraphNumbers(clauses);

    // Count optional clauses
    const optionalCount = clauses.filter((c) => !c.is_mandatory).length;
    const enabledCount = clauses.filter((c) => c.is_enabled).length;
    const variantCount = clauses.filter((c) => c.clause_type === "variant").length;

    if (clauses.length === 0) {
        return null;
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader
                className="pb-3 bg-gradient-to-r from-[#243186]/5 to-transparent cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-primary" />
                        Textbausteine anpassen
                    </CardTitle>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{enabledCount}/{clauses.length} aktiv</span>
                            {variantCount > 0 && (
                                <>
                                    <span className="text-border">•</span>
                                    <span>{variantCount} Varianten</span>
                                </>
                            )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <CardContent className="pt-4 space-y-4">
                            {/* Help Text */}
                            {showHelp && (
                                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-blue-800">
                                        Optionale Textbausteine können ein-/ausgeschaltet werden.
                                        {variantCount > 0 && " Bei Varianten wählen Sie die passende Version."}
                                        {optionalCount > 0 && " Ziehen Sie Textbausteine zum Umsortieren (außer gesperrte)."}
                                    </p>
                                </div>
                            )}

                            {/* Clause List */}
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={clauses.map((c) => c.uniqueId)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2">
                                        {clauses.map((clause) => (
                                            <SortableClauseItem
                                                key={clause.uniqueId}
                                                clause={clause}
                                                paragraphNumber={paragraphNumbers.get(clause.uniqueId)}
                                                onToggle={() => handleToggle(clause.uniqueId)}
                                                onVariantChange={(variantId) =>
                                                    handleVariantChange(clause.uniqueId, variantId)
                                                }
                                                disabled={disabled}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>

                                <DragOverlay>
                                    {activeId && (
                                        <div className="p-3 bg-white border-2 border-primary rounded-lg shadow-lg">
                                            {clauses.find((c) => c.uniqueId === activeId)?.title}
                                        </div>
                                    )}
                                </DragOverlay>
                            </DndContext>
                        </CardContent>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
};
