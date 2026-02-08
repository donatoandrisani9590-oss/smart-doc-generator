/**
 * ClauseLibrarySidebar - Linke Spalte mit Klausel-Bibliothek
 *
 * Smart UX Konzept:
 * - Suchfeld für Klauseln
 * - Kategorien-Filter
 * - Draggable Klausel-Karten
 */

import { useState, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Search, FileText, Layers, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import type { LibraryClause, LibraryCategory } from "./types";

interface ClauseLibrarySidebarProps {
    countryCode?: string;
    onDragStart?: (clause: LibraryClause) => void;
}

// Draggable Library Clause Card
const LibraryClauseCard = ({ clause }: { clause: LibraryClause }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `library-${clause.id}`,
        data: {
            type: "library-clause",
            clause,
        },
    });

    const style = transform
        ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          }
        : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={cn(
                "p-3 bg-white border rounded-lg cursor-grab active:cursor-grabbing",
                "hover:border-primary hover:shadow-sm transition-all",
                isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
            )}
        >
            <div className="flex items-start gap-2">
                <div className="p-1.5 bg-green-100 rounded mt-0.5">
                    {clause.has_variants ? (
                        <Layers className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                        <FileText className="w-3.5 h-3.5 text-green-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{clause.title}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {clause.preview}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        {clause.category && (
                            <Badge variant="outline" className="text-xs">
                                {clause.category}
                            </Badge>
                        )}
                        {clause.has_variants && (
                            <Badge variant="secondary" className="text-xs">
                                {clause.variant_count} Varianten
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ClauseLibrarySidebar = ({
    countryCode = "DE",
}: ClauseLibrarySidebarProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [categories, setCategories] = useState<LibraryCategory[]>([]);
    const [clauses, setClauses] = useState<LibraryClause[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Kategorien laden
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const response = await api.get<{ categories: LibraryCategory[] }>(
                    `/api/v1/composer/library/categories?country_code=${countryCode}`
                );
                setCategories(response.data.categories);
                // Erste Kategorie expandieren
                if (response.data.categories.length > 0) {
                    setExpandedCategories(new Set([response.data.categories[0].name]));
                }
            } catch (error) {
                logError("Failed to load library categories", { error });
            }
        };
        loadCategories();
    }, [countryCode]);

    // Klauseln laden
    useEffect(() => {
        const loadClauses = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({
                    country_code: countryCode,
                    page_size: "100",
                });
                if (searchQuery) {
                    params.append("search", searchQuery);
                }
                if (selectedCategory) {
                    params.append("category", selectedCategory);
                }

                const response = await api.get<{ clauses: LibraryClause[] }>(
                    `/api/v1/composer/library?${params.toString()}`
                );
                setClauses(response.data.clauses);
            } catch (error) {
                logError("Failed to load library clauses", { error });
                setClauses([]);
            } finally {
                setIsLoading(false);
            }
        };

        const debounce = setTimeout(loadClauses, 300);
        return () => clearTimeout(debounce);
    }, [countryCode, searchQuery, selectedCategory]);

    // Klauseln nach Kategorie gruppieren
    const clausesByCategory = clauses.reduce((acc, clause) => {
        const cat = clause.category || "Sonstiges";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(clause);
        return acc;
    }, {} as Record<string, LibraryClause[]>);

    const toggleCategory = (category: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    return (
        <div className="w-64 flex-shrink-0 border-r bg-muted/30 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white">
                <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold">Bibliothek</h2>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Textbausteine suchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
            </div>

            {/* Category Filter Pills */}
            <div className="p-2 border-b bg-white flex gap-1 flex-wrap">
                <Button
                    variant={selectedCategory === null ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedCategory(null)}
                >
                    Alle
                </Button>
                {categories.slice(0, 3).map((cat) => (
                    <Button
                        key={cat.name}
                        variant={selectedCategory === cat.name ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedCategory(cat.name)}
                    >
                        {cat.name}
                    </Button>
                ))}
            </div>

            {/* Clause List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    {isLoading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Laden...
                        </div>
                    ) : Object.keys(clausesByCategory).length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Keine Klauseln gefunden
                        </div>
                    ) : (
                        Object.entries(clausesByCategory).map(([category, categoryClauses]) => (
                            <Collapsible
                                key={category}
                                open={expandedCategories.has(category)}
                                onOpenChange={() => toggleCategory(category)}
                            >
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted text-sm font-medium">
                                    <span>{category}</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                            {categoryClauses.length}
                                        </Badge>
                                        {expandedCategories.has(category) ? (
                                            <ChevronDown className="w-4 h-4" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4" />
                                        )}
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-2 pt-2">
                                    {categoryClauses.map((clause) => (
                                        <LibraryClauseCard key={clause.id} clause={clause} />
                                    ))}
                                </CollapsibleContent>
                            </Collapsible>
                        ))
                    )}
                </div>
            </ScrollArea>

            {/* Footer Hint */}
            <div className="p-3 border-t bg-white text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Ziehen Sie Klauseln in das Dokument</span>
                </div>
            </div>
        </div>
    );
};
