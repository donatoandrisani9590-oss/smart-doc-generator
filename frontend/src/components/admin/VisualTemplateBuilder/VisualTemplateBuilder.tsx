/**
 * VisualTemplateBuilder - Split-Screen Canvas Editor
 *
 * PandaDoc-style Layout:
 * - Toolbox (links): Kategorisierte Klauseln zum Draggen
 * - Canvas (mitte): Drop-Zone mit sortierbaren Klausel-Karten und Sections
 * - Preview (rechts): Live-Vorschau des gerenderten Outputs
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
    DndContext,
    DragOverlay,
    pointerWithin,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
    type UniqueIdentifier,
} from "@dnd-kit/core";
import {
    arrayMove,
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useSectionsMode } from "./hooks";
import { Toolbox } from "./Toolbox";
import { Canvas, CanvasWithSections } from "./Canvas";
import { PreviewPanel } from "./PreviewPanel";
import { DragOverlayContent } from "./DragOverlayContent";
import type {
    Clause,
    SelectedClause,
    TemplateSection,
    VisualTemplateBuilderProps,
} from "./types";

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
