/**
 * VisualTemplateBuilder - Split-Screen Canvas Editor
 *
 * PandaDoc-style Layout:
 * - Toolbox (links): Kategorisierte Klauseln zum Draggen
 * - Canvas (mitte): Drop-Zone mit sortierbaren Klausel-Karten und Sections
 * - Preview (rechts): Live-Vorschau des gerenderten Outputs
 */

"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
    DndContext,
    DragOverlay,
    pointerWithin,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    useDraggable,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
    type UniqueIdentifier,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    Search,
    FileText,
    Layers,
    GripVertical,
    X,
    ChevronDown,
    ChevronRight,
    Plus,
    Calendar,
    Type,
    Hash,
    ToggleLeft,
    FileCheck,
    Eye,
    EyeOff,
    FolderPlus,
    Pencil,
    Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface Clause {
    id: string;
    title: string;
    category: string;
    preview?: string;
    content?: string; // HTML content for preview
    hasVariants?: boolean;
    variantCount?: number;
    isRequired?: boolean;
}

export interface SelectedClause {
    id: string;
    clauseId: string;
    title: string;
    category: string;
    order: number;
    content?: string;
}

export interface TemplateSection {
    id: string;
    title: string;
    isCollapsed: boolean;
    clauses: SelectedClause[];
}

// Legacy props for backward compatibility
export interface VisualTemplateBuilderPropsLegacy {
    availableClauses: Clause[];
    selectedClauses: SelectedClause[];
    onClausesChange: (clauses: SelectedClause[]) => void;
    sections?: never;
    onSectionsChange?: never;
    showPreview?: boolean;
}

// New props with sections support
export interface VisualTemplateBuilderPropsWithSections {
    availableClauses: Clause[];
    sections: TemplateSection[];
    onSectionsChange: (sections: TemplateSection[]) => void;
    selectedClauses?: never;
    onClausesChange?: never;
    showPreview?: boolean;
}

export type VisualTemplateBuilderProps =
    | VisualTemplateBuilderPropsLegacy
    | VisualTemplateBuilderPropsWithSections;

// ============================================================================
// Utility: Debounce Hook
// ============================================================================

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// ============================================================================
// Category Icons Mapping
// ============================================================================

const categoryIcons: Record<string, React.ElementType> = {
    Arbeitszeit: FileText,
    Verguetung: Hash,
    Urlaub: Calendar,
    Kuendigung: FileCheck,
    Sonstiges: Layers,
    Formular: Type,
    Datum: Calendar,
    Toggle: ToggleLeft,
};

const getCategoryIcon = (category: string): React.ElementType => {
    return categoryIcons[category] || FileText;
};

// ============================================================================
// Toolbox Draggable Item
// ============================================================================

interface ToolboxClauseItemProps {
    clause: Clause;
}

const ToolboxClauseItem = ({ clause }: ToolboxClauseItemProps) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `toolbox-${clause.id}`,
        data: {
            type: "toolbox-clause",
            clause,
        },
    });

    const style = transform
        ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              zIndex: isDragging ? 999 : undefined,
          }
        : undefined;

    const IconComponent = getCategoryIcon(clause.category);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={cn(
                "flex items-center gap-2 p-2.5 rounded-md bg-white border cursor-grab",
                "hover:border-primary hover:shadow-sm transition-all",
                "active:cursor-grabbing",
                isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
            )}
        >
            <div className="p-1.5 bg-green-100 rounded shrink-0">
                <IconComponent className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{clause.title}</p>
                {clause.preview && (
                    <p className="text-xs text-muted-foreground truncate">{clause.preview}</p>
                )}
            </div>
            {clause.hasVariants && (
                <Badge variant="secondary" className="text-xs shrink-0">
                    {clause.variantCount}
                </Badge>
            )}
            {clause.isRequired && (
                <Badge variant="destructive" className="text-xs shrink-0">
                    Pflicht
                </Badge>
            )}
        </div>
    );
};

// ============================================================================
// Toolbox (Left Panel)
// ============================================================================

interface ToolboxProps {
    clauses: Clause[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

const Toolbox = ({ clauses, searchQuery, onSearchChange }: ToolboxProps) => {
    // Group clauses by category
    const clausesByCategory = useMemo(() => {
        const filtered = clauses.filter(
            (clause) =>
                clause.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                clause.category.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return filtered.reduce(
            (acc, clause) => {
                const cat = clause.category || "Sonstiges";
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(clause);
                return acc;
            },
            {} as Record<string, Clause[]>
        );
    }, [clauses, searchQuery]);

    const categories = Object.keys(clausesByCategory);

    return (
        <div className="w-[280px] flex-shrink-0 border-r bg-muted/30 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white">
                <h2 className="font-semibold text-lg mb-3">Toolbox</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Klauseln suchen..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
            </div>

            {/* Clause Categories */}
            <ScrollArea className="flex-1">
                <div className="p-2">
                    {categories.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Keine Klauseln gefunden
                        </div>
                    ) : (
                        <Accordion
                            type="multiple"
                            defaultValue={categories.slice(0, 2)}
                            className="space-y-1"
                        >
                            {categories.map((category) => {
                                const categoryClauses = clausesByCategory[category];
                                const IconComponent = getCategoryIcon(category);

                                return (
                                    <AccordionItem
                                        key={category}
                                        value={category}
                                        className="border-none"
                                    >
                                        <AccordionTrigger className="px-2 py-2 rounded hover:bg-muted hover:no-underline">
                                            <div className="flex items-center gap-2">
                                                <IconComponent className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-sm font-medium">{category}</span>
                                                <Badge variant="outline" className="ml-auto text-xs">
                                                    {categoryClauses.length}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-1 pb-2 space-y-1.5">
                                            {categoryClauses.map((clause) => (
                                                <ToolboxClauseItem key={clause.id} clause={clause} />
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    )}
                </div>
            </ScrollArea>

            {/* Footer Hint */}
            <div className="p-3 border-t bg-white text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Klauseln auf den Canvas ziehen</span>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Sortable Canvas Clause Card
// ============================================================================

interface CanvasClauseCardProps {
    clause: SelectedClause;
    onRemove: (id: string) => void;
    inSection?: boolean;
}

const CanvasClauseCard = ({ clause, onRemove, inSection = false }: CanvasClauseCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: clause.id,
        data: {
            type: "canvas-clause",
            clause,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const IconComponent = getCategoryIcon(clause.category);

    return (
        <Card
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative group transition-all",
                isDragging && "opacity-50 shadow-xl ring-2 ring-primary z-50",
                inSection && "border-l-4 border-l-blue-300"
            )}
        >
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    {/* Drag Handle */}
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        className={cn(
                            "flex items-center justify-center w-8 h-8 rounded text-muted-foreground",
                            "hover:text-foreground hover:bg-muted/50 cursor-grab",
                            "focus:outline-none focus:ring-2 focus:ring-primary",
                            isDragging && "cursor-grabbing"
                        )}
                        aria-label="Klausel verschieben"
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>

                    {/* Icon */}
                    <div className="p-2 bg-green-100 rounded shrink-0">
                        <IconComponent className="w-4 h-4 text-green-600" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="font-medium">{clause.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{clause.category}</p>
                    </div>

                    {/* Delete Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(clause.id)}
                        aria-label={`${clause.title} entfernen`}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

// ============================================================================
// Sortable Section Component
// ============================================================================

interface SortableSectionProps {
    section: TemplateSection;
    onToggleCollapse: (sectionId: string) => void;
    onTitleChange: (sectionId: string, title: string) => void;
    onRemoveSection: (sectionId: string) => void;
    onRemoveClause: (sectionId: string, clauseId: string) => void;
    isOverSection: boolean;
}

const SortableSection = ({
    section,
    onToggleCollapse,
    onTitleChange,
    onRemoveSection,
    onRemoveClause,
    isOverSection,
}: SortableSectionProps) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(section.title);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: section.id,
        data: {
            type: "section",
            section,
        },
    });

    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `section-drop-${section.id}`,
        data: {
            type: "section-drop",
            sectionId: section.id,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const clauseIds = useMemo(() => section.clauses.map((c) => c.id), [section.clauses]);

    useEffect(() => {
        if (isEditingTitle && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditingTitle]);

    const handleTitleSubmit = () => {
        if (editedTitle.trim()) {
            onTitleChange(section.id, editedTitle.trim());
        } else {
            setEditedTitle(section.title);
        }
        setIsEditingTitle(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleTitleSubmit();
        } else if (e.key === "Escape") {
            setEditedTitle(section.title);
            setIsEditingTitle(false);
        }
    };

    return (
        <div
            ref={setSortableRef}
            style={style}
            className={cn(
                "rounded-lg border-2 transition-all",
                isDragging && "opacity-50 shadow-xl ring-2 ring-blue-500 z-50",
                isOverSection && "ring-2 ring-primary bg-primary/5"
            )}
        >
            <Collapsible open={!section.isCollapsed}>
                {/* Section Header */}
                <div
                    className={cn(
                        "flex items-center gap-2 p-3 rounded-t-lg",
                        "bg-slate-100 border-b"
                    )}
                >
                    {/* Drag Handle */}
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        className={cn(
                            "flex items-center justify-center w-6 h-6 rounded text-muted-foreground",
                            "hover:text-foreground hover:bg-muted cursor-grab",
                            "focus:outline-none focus:ring-2 focus:ring-primary",
                            isDragging && "cursor-grabbing"
                        )}
                        aria-label="Section verschieben"
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>

                    {/* Collapse Toggle */}
                    <CollapsibleTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onToggleCollapse(section.id)}
                        >
                            {section.isCollapsed ? (
                                <ChevronRight className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </Button>
                    </CollapsibleTrigger>

                    {/* Section Title */}
                    <div className="flex-1 min-w-0">
                        {isEditingTitle ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={inputRef}
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    onBlur={handleTitleSubmit}
                                    onKeyDown={handleKeyDown}
                                    className="h-7 text-sm font-semibold"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={handleTitleSubmit}
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm truncate">
                                    {section.title}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                                    onClick={() => setIsEditingTitle(true)}
                                >
                                    <Pencil className="w-3 h-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Clause Count */}
                    <Badge variant="secondary" className="text-xs">
                        {section.clauses.length} Klausel{section.clauses.length !== 1 ? "n" : ""}
                    </Badge>

                    {/* Delete Section */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveSection(section.id)}
                        aria-label="Section entfernen"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Section Content */}
                <CollapsibleContent>
                    <div
                        ref={setDroppableRef}
                        className={cn(
                            "p-3 min-h-[60px] bg-slate-50/50 rounded-b-lg",
                            isOverSection && "bg-primary/5"
                        )}
                    >
                        {section.clauses.length === 0 ? (
                            <div className="flex items-center justify-center h-12 border-2 border-dashed border-slate-300 rounded text-sm text-muted-foreground">
                                Klauseln hier ablegen
                            </div>
                        ) : (
                            <SortableContext
                                items={clauseIds}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {section.clauses.map((clause) => (
                                        <CanvasClauseCard
                                            key={clause.id}
                                            clause={clause}
                                            onRemove={(id) => onRemoveClause(section.id, id)}
                                            inSection
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
};

// ============================================================================
// Canvas with Sections Support
// ============================================================================

interface CanvasWithSectionsProps {
    sections: TemplateSection[];
    onToggleCollapse: (sectionId: string) => void;
    onTitleChange: (sectionId: string, title: string) => void;
    onRemoveSection: (sectionId: string) => void;
    onRemoveClause: (sectionId: string, clauseId: string) => void;
    onAddSection: () => void;
    isOver: boolean;
    overSectionId: string | null;
}

const CanvasWithSections = ({
    sections,
    onToggleCollapse,
    onTitleChange,
    onRemoveSection,
    onRemoveClause,
    onAddSection,
    isOver,
    overSectionId,
}: CanvasWithSectionsProps) => {
    const { setNodeRef } = useDroppable({
        id: "canvas-drop-zone",
    });

    const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
    const totalClauses = useMemo(
        () => sections.reduce((sum, s) => sum + s.clauses.length, 0),
        [sections]
    );

    return (
        <div className="flex-1 bg-muted/20 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-lg">Document Canvas</h2>
                    <p className="text-sm text-muted-foreground">
                        {sections.length} Section{sections.length !== 1 ? "s" : ""}, {totalClauses}{" "}
                        Klausel{totalClauses !== 1 ? "n" : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onAddSection}
                        className="gap-1"
                    >
                        <FolderPlus className="w-4 h-4" />
                        Neue Section
                    </Button>
                    <Badge variant="outline">{totalClauses} Elemente</Badge>
                </div>
            </div>

            {/* Canvas Area */}
            <ScrollArea className="flex-1">
                <div
                    ref={setNodeRef}
                    className={cn(
                        "p-4 min-h-full transition-colors",
                        isOver && !overSectionId && "bg-primary/5"
                    )}
                >
                    {sections.length === 0 ? (
                        <EmptyCanvasPlaceholder isOver={isOver} onAddSection={onAddSection} />
                    ) : (
                        <SortableContext
                            items={sectionIds}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-4">
                                {sections.map((section) => (
                                    <SortableSection
                                        key={section.id}
                                        section={section}
                                        onToggleCollapse={onToggleCollapse}
                                        onTitleChange={onTitleChange}
                                        onRemoveSection={onRemoveSection}
                                        onRemoveClause={onRemoveClause}
                                        isOverSection={overSectionId === section.id}
                                    />
                                ))}

                                {/* Drop Indicator at Bottom */}
                                {isOver && !overSectionId && <DropIndicator isOver={true} />}
                            </div>
                        </SortableContext>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

// ============================================================================
// Legacy Canvas (for backward compatibility)
// ============================================================================

interface CanvasProps {
    clauses: SelectedClause[];
    onRemove: (id: string) => void;
    isOver: boolean;
}

const Canvas = ({ clauses, onRemove, isOver }: CanvasProps) => {
    const { setNodeRef } = useDroppable({
        id: "canvas-drop-zone",
    });

    const clauseIds = useMemo(() => clauses.map((c) => c.id), [clauses]);

    return (
        <div className="flex-1 bg-muted/20 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-lg">Document Canvas</h2>
                    <p className="text-sm text-muted-foreground">
                        {clauses.length} Klausel{clauses.length !== 1 ? "n" : ""} ausgewaehlt
                    </p>
                </div>
                <Badge variant="outline">{clauses.length} Elemente</Badge>
            </div>

            {/* Canvas Area */}
            <ScrollArea className="flex-1">
                <div
                    ref={setNodeRef}
                    className={cn(
                        "p-4 min-h-full transition-colors",
                        isOver && "bg-primary/5"
                    )}
                >
                    {clauses.length === 0 ? (
                        <EmptyCanvasPlaceholder isOver={isOver} />
                    ) : (
                        <SortableContext
                            items={clauseIds}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {clauses.map((clause) => (
                                    <CanvasClauseCard
                                        key={clause.id}
                                        clause={clause}
                                        onRemove={onRemove}
                                    />
                                ))}

                                {/* Drop Indicator at Bottom */}
                                <DropIndicator isOver={isOver} />
                            </div>
                        </SortableContext>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

// ============================================================================
// Empty Canvas Placeholder
// ============================================================================

interface EmptyCanvasPlaceholderProps {
    isOver: boolean;
    onAddSection?: () => void;
}

const EmptyCanvasPlaceholder = ({ isOver, onAddSection }: EmptyCanvasPlaceholderProps) => {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg transition-all",
                isOver
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-muted-foreground/30"
            )}
        >
            <div
                className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
                    isOver ? "bg-primary/20" : "bg-muted"
                )}
            >
                <Plus
                    className={cn(
                        "w-8 h-8 transition-colors",
                        isOver ? "text-primary" : "text-muted-foreground"
                    )}
                />
            </div>
            <p className="text-lg font-medium text-muted-foreground">
                {isOver ? "Klausel hier ablegen" : "Klauseln hier ablegen"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
                Ziehen Sie Klauseln aus der Toolbox hierher
            </p>
            {onAddSection && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddSection}
                    className="mt-4 gap-1"
                >
                    <FolderPlus className="w-4 h-4" />
                    Section erstellen
                </Button>
            )}
        </div>
    );
};

// ============================================================================
// Drop Indicator (shown at bottom when dragging)
// ============================================================================

interface DropIndicatorProps {
    isOver: boolean;
}

const DropIndicator = ({ isOver }: DropIndicatorProps) => {
    if (!isOver) return null;

    return (
        <div className="flex items-center justify-center p-4 border-2 border-dashed border-primary rounded-lg bg-primary/5">
            <Plus className="w-5 h-5 text-primary mr-2" />
            <span className="text-sm font-medium text-primary">Hier ablegen</span>
        </div>
    );
};

// ============================================================================
// Live Preview Panel
// ============================================================================

interface PreviewPanelProps {
    sections: TemplateSection[];
    availableClauses: Clause[];
}

const PreviewPanel = ({ sections, availableClauses }: PreviewPanelProps) => {
    // Create a map for quick clause content lookup
    const clauseContentMap = useMemo(() => {
        const map = new Map<string, Clause>();
        availableClauses.forEach((clause) => {
            map.set(clause.id, clause);
        });
        return map;
    }, [availableClauses]);

    // Collect all clauses from all sections
    const allClauses = useMemo(() => {
        return sections.flatMap((section) => section.clauses);
    }, [sections]);

    // Debounce the preview content for performance
    const debouncedClauses = useDebounce(allClauses, 300);

    // Generate preview HTML
    const previewHtml = useMemo(() => {
        if (debouncedClauses.length === 0) {
            return '<p class="text-muted">Keine Klauseln ausgewaehlt. Ziehen Sie Klauseln auf den Canvas, um eine Vorschau zu sehen.</p>';
        }

        return sections
            .map((section) => {
                if (section.clauses.length === 0) return "";

                const sectionContent = section.clauses
                    .map((selectedClause) => {
                        const originalClause = clauseContentMap.get(selectedClause.clauseId);
                        const content =
                            selectedClause.content ||
                            originalClause?.content ||
                            `<p><strong>${selectedClause.title}</strong></p><p>{{inhalt_${selectedClause.clauseId}}}</p>`;
                        return `<div class="clause">${content}</div>`;
                    })
                    .join("\n");

                return `
                    <div class="section">
                        <h2 class="section-title">${section.title}</h2>
                        ${sectionContent}
                    </div>
                `;
            })
            .filter(Boolean)
            .join("\n<hr class=\"section-divider\" />\n");
    }, [sections, debouncedClauses, clauseContentMap]);

    return (
        <div className="w-[300px] flex-shrink-0 border-l bg-white flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white">
                <h2 className="font-semibold text-lg">Vorschau</h2>
                <p className="text-sm text-muted-foreground">
                    Live-Rendering des Templates
                </p>
            </div>

            {/* Preview Content */}
            <ScrollArea className="flex-1">
                <div className="p-6">
                    <style>{`
                        .preview-content {
                            font-family: 'Georgia', 'Times New Roman', serif;
                            font-size: 12px;
                            line-height: 1.6;
                            color: #1a1a1a;
                        }
                        .preview-content .section {
                            margin-bottom: 1.5rem;
                        }
                        .preview-content .section-title {
                            font-size: 14px;
                            font-weight: 600;
                            margin-bottom: 0.75rem;
                            padding-bottom: 0.25rem;
                            border-bottom: 1px solid #e5e5e5;
                        }
                        .preview-content .clause {
                            margin-bottom: 1rem;
                        }
                        .preview-content .clause p {
                            margin: 0 0 0.5rem 0;
                        }
                        .preview-content .section-divider {
                            border: none;
                            border-top: 1px dashed #d4d4d4;
                            margin: 1.5rem 0;
                        }
                        .preview-content .text-muted {
                            color: #9ca3af;
                            font-style: italic;
                        }
                        /* Placeholder styling */
                        .preview-content code,
                        .preview-content .placeholder {
                            background-color: #fef3c7;
                            padding: 1px 4px;
                            border-radius: 2px;
                            font-family: 'Consolas', monospace;
                            font-size: 11px;
                        }
                    `}</style>
                    <div
                        className="preview-content bg-white border rounded-lg p-6 shadow-sm"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Platzhalter werden gelb markiert</span>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Drag Overlay Content
// ============================================================================

interface DragOverlayContentProps {
    clause?: Clause | SelectedClause;
    section?: TemplateSection;
    type: "toolbox" | "canvas" | "section";
}

const DragOverlayContent = ({ clause, section, type }: DragOverlayContentProps) => {
    if (type === "section" && section) {
        return (
            <div className="shadow-xl ring-2 ring-blue-500 opacity-90 w-80 bg-slate-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-sm">{section.title}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                        {section.clauses.length} Klauseln
                    </Badge>
                </div>
            </div>
        );
    }

    if (clause) {
        const IconComponent = getCategoryIcon(clause.category);

        return (
            <Card className="shadow-xl ring-2 ring-primary opacity-90 w-64">
                <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 rounded">
                            <IconComponent className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{clause.title}</p>
                            <p className="text-xs text-muted-foreground">{clause.category}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return null;
};

// ============================================================================
// Helper: Check if using sections mode
// ============================================================================

function useSectionsMode(
    props: VisualTemplateBuilderProps
): props is VisualTemplateBuilderPropsWithSections {
    return "sections" in props && props.sections !== undefined;
}

// ============================================================================
// Main Component
// ============================================================================

export const VisualTemplateBuilder = (props: VisualTemplateBuilderProps) => {
    const { availableClauses, showPreview: initialShowPreview = false } = props;
    const isSectionsMode = useSectionsMode(props);

    const [searchQuery, setSearchQuery] = useState("");
    const [_activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
    const [activeData, setActiveData] = useState<{
        type: "toolbox" | "canvas" | "section";
        clause?: Clause | SelectedClause;
        section?: TemplateSection;
    } | null>(null);
    const [isOverCanvas, setIsOverCanvas] = useState(false);
    const [overSectionId, setOverSectionId] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(initialShowPreview);

    // Legacy mode state (flat clauses)
    const [legacySelectedClauses, setLegacySelectedClauses] = useState<SelectedClause[]>([]);

    // Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Generate unique ID
    const generateId = useCallback(() => {
        return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    // Get current sections (from props or convert legacy)
    const currentSections = useMemo((): TemplateSection[] => {
        if (isSectionsMode) {
            return props.sections;
        }
        // Legacy mode: wrap clauses in a single default section
        const clauses = props.selectedClauses || legacySelectedClauses;
        if (clauses.length === 0) return [];
        return [
            {
                id: "default-section",
                title: "Hauptabschnitt",
                isCollapsed: false,
                clauses,
            },
        ];
    }, [isSectionsMode, props, legacySelectedClauses]);

    // Update sections
    const updateSections = useCallback(
        (newSections: TemplateSection[]) => {
            if (isSectionsMode) {
                props.onSectionsChange(newSections);
            } else {
                // Legacy mode: flatten sections to clauses
                const flatClauses = newSections.flatMap((s) => s.clauses);
                if (props.onClausesChange) {
                    props.onClausesChange(flatClauses);
                } else {
                    setLegacySelectedClauses(flatClauses);
                }
            }
        },
        [isSectionsMode, props]
    );

    // Add new section
    const handleAddSection = useCallback(() => {
        const newSection: TemplateSection = {
            id: generateId(),
            title: `Section ${currentSections.length + 1}`,
            isCollapsed: false,
            clauses: [],
        };
        updateSections([...currentSections, newSection]);
    }, [currentSections, generateId, updateSections]);

    // Toggle section collapse
    const handleToggleCollapse = useCallback(
        (sectionId: string) => {
            const updated = currentSections.map((s) =>
                s.id === sectionId ? { ...s, isCollapsed: !s.isCollapsed } : s
            );
            updateSections(updated);
        },
        [currentSections, updateSections]
    );

    // Update section title
    const handleTitleChange = useCallback(
        (sectionId: string, title: string) => {
            const updated = currentSections.map((s) =>
                s.id === sectionId ? { ...s, title } : s
            );
            updateSections(updated);
        },
        [currentSections, updateSections]
    );

    // Remove section
    const handleRemoveSection = useCallback(
        (sectionId: string) => {
            const updated = currentSections.filter((s) => s.id !== sectionId);
            updateSections(updated);
        },
        [currentSections, updateSections]
    );

    // Remove clause from section
    const handleRemoveClauseFromSection = useCallback(
        (sectionId: string, clauseId: string) => {
            const updated = currentSections.map((s) => {
                if (s.id === sectionId) {
                    return {
                        ...s,
                        clauses: s.clauses
                            .filter((c) => c.id !== clauseId)
                            .map((c, i) => ({ ...c, order: i })),
                    };
                }
                return s;
            });
            updateSections(updated);
        },
        [currentSections, updateSections]
    );

    // Handle drag start
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id);

        const data = active.data.current;
        if (data?.type === "toolbox-clause") {
            setActiveData({ type: "toolbox", clause: data.clause });
        } else if (data?.type === "canvas-clause") {
            setActiveData({ type: "canvas", clause: data.clause });
        } else if (data?.type === "section") {
            setActiveData({ type: "section", section: data.section });
        }
    }, []);

    // Handle drag over
    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;

        if (!over) {
            setIsOverCanvas(false);
            setOverSectionId(null);
            return;
        }

        const overData = over.data.current;

        // Check if over a section drop zone
        if (overData?.type === "section-drop") {
            setIsOverCanvas(true);
            setOverSectionId(overData.sectionId);
            return;
        }

        // Check if over the main canvas
        if (over.id === "canvas-drop-zone") {
            setIsOverCanvas(true);
            setOverSectionId(null);
            return;
        }

        // Check if over a clause (determine which section)
        if (overData?.type === "canvas-clause") {
            setIsOverCanvas(true);
            // Find which section contains this clause
            for (const section of currentSections) {
                if (section.clauses.some((c) => c.id === over.id)) {
                    setOverSectionId(section.id);
                    return;
                }
            }
            setOverSectionId(null);
            return;
        }

        setIsOverCanvas(false);
        setOverSectionId(null);
    }, [currentSections]);

    // Handle drag end
    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;

            setActiveId(null);
            setActiveData(null);
            setIsOverCanvas(false);
            setOverSectionId(null);

            if (!over) return;

            const activeData = active.data.current;
            const overData = over.data.current;

            // Case 1: Dropping from toolbox onto canvas/section
            if (activeData?.type === "toolbox-clause") {
                const clause = activeData.clause as Clause;

                // Check if already exists in any section
                const alreadyExists = currentSections.some((s) =>
                    s.clauses.some((c) => c.clauseId === clause.id)
                );
                if (alreadyExists) return;

                const newClause: SelectedClause = {
                    id: generateId(),
                    clauseId: clause.id,
                    title: clause.title,
                    category: clause.category,
                    order: 0,
                    content: clause.content,
                };

                // Determine target section
                let targetSectionId: string | null = null;
                let insertIndex: number | null = null;

                if (overData?.type === "section-drop") {
                    targetSectionId = overData.sectionId;
                } else if (overData?.type === "canvas-clause") {
                    // Find section containing this clause
                    for (const section of currentSections) {
                        const idx = section.clauses.findIndex((c) => c.id === over.id);
                        if (idx !== -1) {
                            targetSectionId = section.id;
                            insertIndex = idx;
                            break;
                        }
                    }
                } else if (overData?.type === "section") {
                    targetSectionId = overData.section.id;
                }

                if (targetSectionId) {
                    // Add to existing section
                    const updated = currentSections.map((s) => {
                        if (s.id === targetSectionId) {
                            const newClauses = [...s.clauses];
                            if (insertIndex !== null) {
                                newClauses.splice(insertIndex, 0, newClause);
                            } else {
                                newClauses.push(newClause);
                            }
                            return {
                                ...s,
                                clauses: newClauses.map((c, i) => ({ ...c, order: i })),
                            };
                        }
                        return s;
                    });
                    updateSections(updated);
                } else {
                    // Create new section or add to default
                    if (currentSections.length === 0) {
                        // Create first section
                        const newSection: TemplateSection = {
                            id: generateId(),
                            title: "Section 1",
                            isCollapsed: false,
                            clauses: [newClause],
                        };
                        updateSections([newSection]);
                    } else {
                        // Add to last section
                        const updated = [...currentSections];
                        const lastSection = updated[updated.length - 1];
                        updated[updated.length - 1] = {
                            ...lastSection,
                            clauses: [...lastSection.clauses, newClause].map((c, i) => ({
                                ...c,
                                order: i,
                            })),
                        };
                        updateSections(updated);
                    }
                }
                return;
            }

            // Case 2: Reordering clauses within/between sections
            if (activeData?.type === "canvas-clause") {
                const activeClause = activeData.clause as SelectedClause;

                // Find source section
                let sourceSection: TemplateSection | null = null;
                let sourceIndex = -1;
                for (const section of currentSections) {
                    const idx = section.clauses.findIndex((c) => c.id === activeClause.id);
                    if (idx !== -1) {
                        sourceSection = section;
                        sourceIndex = idx;
                        break;
                    }
                }

                if (!sourceSection) return;

                // Determine target
                let targetSectionId: string | null = null;
                let targetIndex: number | null = null;

                if (overData?.type === "section-drop") {
                    targetSectionId = overData.sectionId;
                } else if (overData?.type === "canvas-clause") {
                    for (const section of currentSections) {
                        const idx = section.clauses.findIndex((c) => c.id === over.id);
                        if (idx !== -1) {
                            targetSectionId = section.id;
                            targetIndex = idx;
                            break;
                        }
                    }
                }

                if (!targetSectionId) return;

                // Same section reorder
                if (sourceSection.id === targetSectionId) {
                    if (targetIndex !== null && sourceIndex !== targetIndex) {
                        const updated = currentSections.map((s) => {
                            if (s.id === sourceSection.id) {
                                const reordered = arrayMove(s.clauses, sourceIndex, targetIndex!);
                                return {
                                    ...s,
                                    clauses: reordered.map((c, i) => ({ ...c, order: i })),
                                };
                            }
                            return s;
                        });
                        updateSections(updated);
                    }
                } else {
                    // Move between sections
                    const updated = currentSections.map((s) => {
                        if (s.id === sourceSection.id) {
                            return {
                                ...s,
                                clauses: s.clauses
                                    .filter((c) => c.id !== activeClause.id)
                                    .map((c, i) => ({ ...c, order: i })),
                            };
                        }
                        if (s.id === targetSectionId) {
                            const newClauses = [...s.clauses];
                            if (targetIndex !== null) {
                                newClauses.splice(targetIndex, 0, activeClause);
                            } else {
                                newClauses.push(activeClause);
                            }
                            return {
                                ...s,
                                clauses: newClauses.map((c, i) => ({ ...c, order: i })),
                            };
                        }
                        return s;
                    });
                    updateSections(updated);
                }
                return;
            }

            // Case 3: Reordering sections
            if (activeData?.type === "section" && overData?.type === "section") {
                const activeSection = activeData.section as TemplateSection;
                const overSection = overData.section as TemplateSection;

                if (activeSection.id !== overSection.id) {
                    const oldIndex = currentSections.findIndex((s) => s.id === activeSection.id);
                    const newIndex = currentSections.findIndex((s) => s.id === overSection.id);

                    if (oldIndex !== -1 && newIndex !== -1) {
                        const reordered = arrayMove(currentSections, oldIndex, newIndex);
                        updateSections(reordered);
                    }
                }
            }
        },
        [currentSections, generateId, updateSections]
    );

    // Handle drag cancel
    const handleDragCancel = useCallback(() => {
        setActiveId(null);
        setActiveData(null);
        setIsOverCanvas(false);
        setOverSectionId(null);
    }, []);

    // Legacy: Remove clause from flat list
    const handleRemoveClauseLegacy = useCallback(
        (id: string) => {
            if (!isSectionsMode && props.onClausesChange) {
                const clauses = props.selectedClauses || [];
                const filtered = clauses
                    .filter((c) => c.id !== id)
                    .map((c, i) => ({ ...c, order: i }));
                props.onClausesChange(filtered);
            }
        },
        [isSectionsMode, props]
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="flex h-full border rounded-lg overflow-hidden bg-white">
                {/* Toolbox (Left) */}
                <Toolbox
                    clauses={availableClauses}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />

                {/* Canvas (Center) */}
                <div className="flex-1 flex flex-col relative">
                    {/* Preview Toggle Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-4 right-4 z-10 gap-1"
                        onClick={() => setShowPreview(!showPreview)}
                    >
                        {showPreview ? (
                            <>
                                <EyeOff className="w-4 h-4" />
                                Vorschau ausblenden
                            </>
                        ) : (
                            <>
                                <Eye className="w-4 h-4" />
                                Vorschau
                            </>
                        )}
                    </Button>

                    {isSectionsMode ? (
                        <CanvasWithSections
                            sections={currentSections}
                            onToggleCollapse={handleToggleCollapse}
                            onTitleChange={handleTitleChange}
                            onRemoveSection={handleRemoveSection}
                            onRemoveClause={handleRemoveClauseFromSection}
                            onAddSection={handleAddSection}
                            isOver={isOverCanvas}
                            overSectionId={overSectionId}
                        />
                    ) : (
                        <Canvas
                            clauses={props.selectedClauses || []}
                            onRemove={handleRemoveClauseLegacy}
                            isOver={isOverCanvas}
                        />
                    )}
                </div>

                {/* Preview Panel (Right) - conditionally shown */}
                {showPreview && (
                    <PreviewPanel
                        sections={currentSections}
                        availableClauses={availableClauses}
                    />
                )}
            </div>

            {/* Drag Overlay */}
            <DragOverlay adjustScale={false}>
                {activeData && (
                    <DragOverlayContent
                        clause={activeData.clause}
                        section={activeData.section}
                        type={activeData.type}
                    />
                )}
            </DragOverlay>
        </DndContext>
    );
};

export default VisualTemplateBuilder;
