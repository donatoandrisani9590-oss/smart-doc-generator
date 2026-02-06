// ============================================================================
// Types for VisualTemplateBuilder
// ============================================================================

import type React from "react";

// --- Core Domain Types ---

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

// --- Top-Level Props (Union) ---

/** Legacy props for backward compatibility */
export interface VisualTemplateBuilderPropsLegacy {
    availableClauses: Clause[];
    selectedClauses: SelectedClause[];
    onClausesChange: (clauses: SelectedClause[]) => void;
    sections?: never;
    onSectionsChange?: never;
    showPreview?: boolean;
}

/** New props with sections support */
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

// --- Component Props ---

export interface ToolboxClauseItemProps {
    clause: Clause;
}

export interface ToolboxProps {
    clauses: Clause[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

export interface CanvasClauseCardProps {
    clause: SelectedClause;
    onRemove: (id: string) => void;
    inSection?: boolean;
}

export interface SortableSectionProps {
    section: TemplateSection;
    onToggleCollapse: (sectionId: string) => void;
    onTitleChange: (sectionId: string, title: string) => void;
    onRemoveSection: (sectionId: string) => void;
    onRemoveClause: (sectionId: string, clauseId: string) => void;
    isOverSection: boolean;
}

export interface CanvasWithSectionsProps {
    sections: TemplateSection[];
    onToggleCollapse: (sectionId: string) => void;
    onTitleChange: (sectionId: string, title: string) => void;
    onRemoveSection: (sectionId: string) => void;
    onRemoveClause: (sectionId: string, clauseId: string) => void;
    onAddSection: () => void;
    isOver: boolean;
    overSectionId: string | null;
}

export interface CanvasProps {
    clauses: SelectedClause[];
    onRemove: (id: string) => void;
    isOver: boolean;
}

export interface EmptyCanvasPlaceholderProps {
    isOver: boolean;
    onAddSection?: () => void;
}

export interface DropIndicatorProps {
    isOver: boolean;
}

export interface PreviewPanelProps {
    sections: TemplateSection[];
    availableClauses: Clause[];
}

export interface DragOverlayContentProps {
    clause?: Clause | SelectedClause;
    section?: TemplateSection;
    type: "toolbox" | "canvas" | "section";
}

// --- Category Icons Type ---

export type CategoryIconsMap = Record<string, React.ElementType>;
