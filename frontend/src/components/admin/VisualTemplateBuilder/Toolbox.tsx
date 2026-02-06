"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { getCategoryIcon } from "./constants";
import { ToolboxClauseItem } from "./ToolboxClauseItem";
import type { ToolboxProps, Clause } from "./types";

export const Toolbox = ({ clauses, searchQuery, onSearchChange }: ToolboxProps) => {
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
